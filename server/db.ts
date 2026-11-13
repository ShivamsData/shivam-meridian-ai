import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AIInference,
  ClinicalAlert,
  ImagingROI,
  ImagingStudy,
  LabObservation,
  ModuleId,
  Patient,
  PatientFullRecord,
  ReviewStatus,
  SymptomAssessment,
  TriageLevel,
  VitalsPoint,
  XAIDriver,
} from '../src/types/clinical.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'meridian_medai.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    mrn TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    sex TEXT NOT NULL,
    blood_type TEXT NOT NULL,
    service_unit TEXT NOT NULL,
    triage_level TEXT NOT NULL,
    primary_complaint TEXT NOT NULL,
    medical_history TEXT NOT NULL,
    allergies TEXT NOT NULL,
    attending_physician TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS symptom_assessments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    onset_days INTEGER NOT NULL,
    severity_score INTEGER NOT NULL,
    symptoms_json TEXT NOT NULL,
    clinical_notes TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS imaging_studies (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    modality TEXT NOT NULL,
    anatomical_region TEXT NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_mime TEXT NOT NULL,
    model_id TEXT NOT NULL,
    study_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lab_observations (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    panel_category TEXT NOT NULL,
    biomarker_name TEXT NOT NULL,
    biomarker_code TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    ref_min REAL NOT NULL,
    ref_max REAL NOT NULL,
    flag TEXT NOT NULL,
    measured_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vitals_telemetry (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    hr INTEGER NOT NULL,
    sbp INTEGER NOT NULL,
    dbp INTEGER NOT NULL,
    spo2 INTEGER NOT NULL,
    rr INTEGER NOT NULL,
    temp_c REAL NOT NULL,
    news2_score INTEGER NOT NULL,
    qsofa_score INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS clinical_alerts (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    module TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ai_inferences (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    module TEXT NOT NULL,
    target_id TEXT,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    confidence REAL NOT NULL,
    risk_category TEXT NOT NULL,
    summary TEXT NOT NULL,
    findings_json TEXT NOT NULL,
    xai_drivers_json TEXT NOT NULL,
    roi_boxes_json TEXT NOT NULL,
    extra_data_json TEXT,
    review_status TEXT NOT NULL,
    clinician_name TEXT,
    clinician_notes TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );
`);

export function computeNews2AndQsofa(v: {
  hr: number;
  sbp: number;
  spo2: number;
  rr: number;
  tempC: number;
}): { news2Score: number; qsofaScore: number } {
  let news2 = 0;

  if (v.rr <= 8 || v.rr >= 25) news2 += 3;
  else if (v.rr >= 21) news2 += 2;
  else if (v.rr <= 11) news2 += 1;

  if (v.spo2 <= 91) news2 += 3;
  else if (v.spo2 <= 93) news2 += 2;
  else if (v.spo2 <= 95) news2 += 1;

  if (v.sbp <= 90 || v.sbp >= 220) news2 += 3;
  else if (v.sbp <= 100) news2 += 2;
  else if (v.sbp <= 110) news2 += 1;

  if (v.hr <= 40 || v.hr >= 131) news2 += 3;
  else if (v.hr >= 111) news2 += 2;
  else if (v.hr <= 50 || v.hr >= 91) news2 += 1;

  if (v.tempC <= 35.0) news2 += 3;
  else if (v.tempC >= 39.1) news2 += 2;
  else if (v.tempC <= 36.0 || v.tempC >= 38.1) news2 += 1;

  let qsofa = 0;
  if (v.rr >= 22) qsofa += 1;
  if (v.sbp <= 100) qsofa += 1;

  return { news2Score: news2, qsofaScore: qsofa };
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function seedIfEmpty(): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM patients').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  const now = new Date('2026-11-13T02:15:00.000Z');
  const isoMinusHours = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
  const isoMinusDays = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString();

  const insertPatient = db.prepare(`
    INSERT INTO patients (id, mrn, full_name, age, sex, blood_type, service_unit, triage_level, primary_complaint, medical_history, allergies, attending_physician, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSymptom = db.prepare(`
    INSERT INTO symptom_assessments (id, patient_id, onset_days, severity_score, symptoms_json, clinical_notes, recorded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertImaging = db.prepare(`
    INSERT INTO imaging_studies (id, patient_id, modality, anatomical_region, title, image_url, image_mime, model_id, study_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLab = db.prepare(`
    INSERT INTO lab_observations (id, patient_id, panel_category, biomarker_name, biomarker_code, value, unit, ref_min, ref_max, flag, measured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVitals = db.prepare(`
    INSERT INTO vitals_telemetry (id, patient_id, hr, sbp, dbp, spo2, rr, temp_c, news2_score, qsofa_score, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAlert = db.prepare(`
    INSERT INTO clinical_alerts (id, patient_id, module, severity, title, detail, acknowledged, acknowledged_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInference = db.prepare(`
    INSERT INTO ai_inferences (id, patient_id, module, target_id, model_id, model_name, confidence, risk_category, summary, findings_json, xai_drivers_json, roi_boxes_json, extra_data_json, review_status, clinician_name, clinician_notes, reviewed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    // 1. Marcus Sterling — Critical Action (Neuro-ICU + Sepsis Trajectory)
    insertPatient.run(
      'pat_marcus',
      'MRN-408192',
      'Marcus Sterling',
      58,
      'Male',
      'O+',
      'Neuro-Critical Care ICU · Bed 04',
      'Critical Action',
      'Acute confusion, left-sided drift, fever spike 38.7°C, and progressive hypotension.',
      'Hypertension, Type 2 Diabetes Mellitus, prior transient ischemic attack (2024).',
      'Penicillin (urticaria)',
      'Dr. Kavita Rao, MD',
      isoMinusDays(4),
      isoMinusHours(0.2)
    );

    insertSymptom.run(
      'sym_marcus_1',
      'pat_marcus',
      2,
      8,
      JSON.stringify(['Altered Mental Status', 'Fever (38.7°C)', 'Tachypnea', 'Left Arm Weakness']),
      'Acute neurological change noted during morning rounds accompanied by rigors and rising lactate.',
      'Dr. Kavita Rao, MD',
      isoMinusHours(3)
    );

    insertImaging.run(
      'img_marcus_mri',
      'pat_marcus',
      'MRI',
      'Brain · Axial T2-FLAIR',
      'Brain MRI Axial T2-FLAIR (Acute Cortical Signal)',
      '/assets/scans/brain_mri_axial.jpg',
      'image/jpeg',
      'rad-neuro-vit-v3',
      '2026-11-13',
      isoMinusHours(2.5)
    );

    // Marcus Labs
    const marcusLabs: Array<[string, string, string, number, string, number, number, string, number]> = [
      ['Sepsis', 'Serum Lactate', 'LAC', 1.6, 'mmol/L', 0.5, 2.0, 'Normal', 24],
      ['Sepsis', 'Serum Lactate', 'LAC', 2.4, 'mmol/L', 0.5, 2.0, 'Elevated', 12],
      ['Sepsis', 'Serum Lactate', 'LAC', 3.4, 'mmol/L', 0.5, 2.0, 'Critical High', 1],
      ['Sepsis', 'Procalcitonin', 'PCT', 0.4, 'ng/mL', 0.0, 0.5, 'Normal', 24],
      ['Sepsis', 'Procalcitonin', 'PCT', 1.5, 'ng/mL', 0.0, 0.5, 'Elevated', 12],
      ['Sepsis', 'Procalcitonin', 'PCT', 2.8, 'ng/mL', 0.0, 0.5, 'Critical High', 1],
      ['Hematology', 'White Blood Cell Count', 'WBC', 11.2, '10^9/L', 4.0, 11.0, 'Elevated', 24],
      ['Hematology', 'White Blood Cell Count', 'WBC', 16.4, '10^9/L', 4.0, 11.0, 'Critical High', 1],
      ['Metabolic', 'Serum Creatinine', 'CREAT', 1.45, 'mg/dL', 0.7, 1.3, 'Elevated', 1],
      ['Cardiac', 'High-Sensitivity Troponin I', 'TROP-I', 0.04, 'ng/mL', 0.0, 0.04, 'Normal', 1],
    ];
    marcusLabs.forEach((l, idx) => {
      insertLab.run(`lab_m_${idx}`, 'pat_marcus', l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], isoMinusHours(l[8]));
    });

    // Marcus Vitals series (progressive deterioration)
    const marcusVitalsRaw = [
      { hr: 84, sbp: 124, dbp: 78, spo2: 96, rr: 16, tempC: 37.1, h: 12 },
      { hr: 94, sbp: 114, dbp: 72, spo2: 95, rr: 19, tempC: 37.6, h: 8 },
      { hr: 106, sbp: 102, dbp: 66, spo2: 93, rr: 21, tempC: 38.2, h: 4 },
      { hr: 118, sbp: 92, dbp: 58, spo2: 91, rr: 24, tempC: 38.7, h: 0.3 },
    ];
    marcusVitalsRaw.forEach((v, idx) => {
      const scores = computeNews2AndQsofa(v);
      insertVitals.run(`vit_m_${idx}`, 'pat_marcus', v.hr, v.sbp, v.dbp, v.spo2, v.rr, v.tempC, scores.news2Score, scores.qsofaScore, isoMinusHours(v.h));
    });

    insertAlert.run(
      'alt_marcus_1',
      'pat_marcus',
      'icu',
      'Critical Action',
      'NEWS2 Escalation Threshold Breached (Score 10 · qSOFA 2)',
      'Progressive hypotension (92/58 mmHg), tachycardia (118 bpm), hypoxemia (SpO2 91%), and lactate 3.4 mmol/L indicate high decompensation risk.',
      0,
      null,
      isoMinusHours(0.3)
    );

    insertAlert.run(
      'alt_marcus_2',
      'pat_marcus',
      'radiology',
      'Review Needed',
      'Right Frontal Cortical T2-FLAIR Hyperintensity Flagged',
      'Neuro-Vascular ViT detected focal hyperintense cortical zone (91.6% model confidence) awaiting neuroradiology verification.',
      0,
      null,
      isoMinusHours(2.1)
    );

    insertInference.run(
      'inf_marcus_rad',
      'pat_marcus',
      'radiology',
      'img_marcus_mri',
      'rad-neuro-vit-v3',
      'Neuro-Vascular FLAIR Segmentation ViT',
      91.6,
      'Critical Action',
      'Focal T2-FLAIR hyperintense cortical/subcortical signal identified in the right frontal lobe with mild localized sulcal effacement; no midline shift observed.',
      JSON.stringify([
        'Right frontal lobe cortical-subcortical T2-FLAIR hyperintensity (~2.8 cm span).',
        'Preserved ventricular symmetry with no acute transtentorial herniation.',
        'Recommend urgent DWI/ADC correlation and clinical stroke/infectious workup.',
      ]),
      JSON.stringify([
        { feature: 'Right Frontal Patch Attention Peak', weight: 64, direction: 'Increases Risk', rationale: 'Asymmetric elevated FLAIR intensity relative to contralateral cortex.' },
        { feature: 'Local Sulcal Effacement Ratio', weight: 22, direction: 'Increases Risk', rationale: 'Mild focal cortical swelling adjacent to hyperintense boundary.' },
        { feature: 'Midline Ventricular Symmetry', weight: 14, direction: 'Protective', rationale: 'Septum pellucidum remains centered without significant mass shift.' },
      ] satisfies XAIDriver[]),
      JSON.stringify([
        { label: 'Right Frontal FLAIR Hyperintensity', x: 24, y: 22, width: 20, height: 18, confidence: 91.6, heatmapIntensity: 0.9, severity: 'High' },
      ] satisfies ImagingROI[]),
      null,
      'Pending Clinician Review',
      null,
      null,
      null,
      isoMinusHours(2.1)
    );

    // 2. Elena Vance — Review Needed (Thoracic Oncology CT + Chest X-Ray + Pathology Biopsy)
    insertPatient.run(
      'pat_elena',
      'MRN-319405',
      'Elena Vance',
      62,
      'Female',
      'A-',
      'Thoracic Oncology Unit · Room 312',
      'Review Needed',
      'Persistent non-productive cough for 6 weeks, mild exertional dyspnea, 4 kg unintentional weight loss.',
      'Former smoker (22 pack-years, quit 2018), mild COPD, hyperlipidemia.',
      'Iodinated contrast (mild rash — premedicated)',
      'Dr. Aris Thorne, MD',
      isoMinusDays(14),
      isoMinusHours(1.5)
    );

    insertSymptom.run(
      'sym_elena_1',
      'pat_elena',
      42,
      5,
      JSON.stringify(['Persistent Cough', 'Exertional Dyspnea', 'Unintentional Weight Loss', 'Fatigue']),
      'Referred for pulmonary nodule characterization after outpatient radiograph showed right lung opacity.',
      'Dr. Aris Thorne, MD',
      isoMinusHours(6)
    );

    insertImaging.run(
      'img_elena_ct',
      'pat_elena',
      'CT',
      'Thorax · Axial Lung Window',
      'Thoracic CT Axial (Right Subpleural Nodule)',
      '/assets/scans/chest_ct_oncology.jpg',
      'image/jpeg',
      'rad-oncology-seg-v2',
      '2026-11-12',
      isoMinusHours(5)
    );

    insertImaging.run(
      'img_elena_cxr',
      'pat_elena',
      'X-Ray',
      'Chest · PA Upright',
      'PA Chest Radiograph (Right Lung Field Opacity)',
      '/assets/scans/chest_xray_nodule.jpg',
      'image/jpeg',
      'rad-thorax-cnn-v2',
      '2026-11-10',
      isoMinusDays(3)
    );

    insertImaging.run(
      'img_elena_histo',
      'pat_elena',
      'Histopathology',
      'Right Lung Core Biopsy · H&E 40x',
      'Bronchoscopic Core Biopsy H&E Whole-Slide Field',
      '/assets/scans/slide_histopathology_he.jpg',
      'image/jpeg',
      'path-histo-vit-v1',
      '2026-11-12',
      isoMinusHours(3.5)
    );

    const elenaLabs: Array<[string, string, string, number, string, number, number, string, number]> = [
      ['Oncology', 'Carcinoembryonic Antigen', 'CEA', 6.2, 'ng/mL', 0.0, 3.0, 'Elevated', 720],
      ['Oncology', 'Carcinoembryonic Antigen', 'CEA', 10.4, 'ng/mL', 0.0, 3.0, 'Elevated', 360],
      ['Oncology', 'Carcinoembryonic Antigen', 'CEA', 14.8, 'ng/mL', 0.0, 3.0, 'Critical High', 4],
      ['Oncology', 'CYFRA 21-1', 'CYFRA', 3.1, 'ng/mL', 0.0, 3.3, 'Normal', 720],
      ['Oncology', 'CYFRA 21-1', 'CYFRA', 4.3, 'ng/mL', 0.0, 3.3, 'Elevated', 360],
      ['Oncology', 'CYFRA 21-1', 'CYFRA', 5.4, 'ng/mL', 0.0, 3.3, 'Elevated', 4],
      ['Oncology', 'CA-125', 'CA125', 28.0, 'U/mL', 0.0, 35.0, 'Normal', 4],
      ['Hematology', 'Hemoglobin', 'HGB', 11.4, 'g/dL', 12.0, 15.5, 'Low', 4],
      ['Metabolic', 'Lactate Dehydrogenase', 'LDH', 248.0, 'U/L', 120.0, 246.0, 'Elevated', 4],
    ];
    elenaLabs.forEach((l, idx) => {
      insertLab.run(`lab_e_${idx}`, 'pat_elena', l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], isoMinusHours(l[8]));
    });

    const elenaVitalsRaw = [
      { hr: 78, sbp: 128, dbp: 76, spo2: 96, rr: 16, tempC: 36.8, h: 12 },
      { hr: 82, sbp: 126, dbp: 74, spo2: 95, rr: 18, tempC: 36.9, h: 6 },
      { hr: 86, sbp: 124, dbp: 74, spo2: 94, rr: 19, tempC: 37.0, h: 1 },
    ];
    elenaVitalsRaw.forEach((v, idx) => {
      const scores = computeNews2AndQsofa(v);
      insertVitals.run(`vit_e_${idx}`, 'pat_elena', v.hr, v.sbp, v.dbp, v.spo2, v.rr, v.tempC, scores.news2Score, scores.qsofaScore, isoMinusHours(v.h));
    });

    insertAlert.run(
      'alt_elena_1',
      'pat_elena',
      'pathology',
      'Review Needed',
      'Rising CEA Velocity (+138% over 30 days) + Atypical H&E Cluster',
      'CEA climbed from 6.2 to 14.8 ng/mL alongside CYFRA 21-1 elevation (5.4 ng/mL). Tumor board pathology sign-off required.',
      0,
      null,
      isoMinusHours(3.5)
    );

    insertInference.run(
      'inf_elena_rad',
      'pat_elena',
      'radiology',
      'img_elena_ct',
      'rad-oncology-seg-v2',
      'Oncology Multi-Organ Segmentation ViT',
      94.2,
      'Review Needed',
      'Discrete peripheral subpleural pulmonary nodule localized in the right lung field with irregular margination; mediastinal silhouette appears unremarkable on this slice.',
      JSON.stringify([
        'Peripheral right subpleural solid nodule (~1.9 cm equivalent diameter) with subtle spiculated margin.',
        'Clear left lung parenchyma without gross pleural effusion.',
        'Recommend multidisciplinary thoracic oncology review alongside core biopsy H&E correlation.',
      ]),
      JSON.stringify([
        { feature: 'Spiculated Margin Gradient', weight: 58, direction: 'Increases Risk', rationale: 'High-frequency edge irregularity around peripheral right parenchymal opacity.' },
        { feature: 'Subpleural Density Attenuation', weight: 29, direction: 'Increases Risk', rationale: 'Solid soft-tissue attenuation surrounded by aerated lung.' },
        { feature: 'Contralateral Parenchyma Symmetry', weight: 13, direction: 'Protective', rationale: 'No bilateral infiltrates or bulky hilar adenopathy on current slice.' },
      ] satisfies XAIDriver[]),
      JSON.stringify([
        { label: 'Right Peripheral Subpleural Nodule', x: 13, y: 46, width: 14, height: 16, confidence: 94.2, heatmapIntensity: 0.92, severity: 'High' },
      ] satisfies ImagingROI[]),
      null,
      'Pending Clinician Review',
      null,
      null,
      null,
      isoMinusHours(4.5)
    );

    // 3. Priya Nair — Observation (Oncology & Hepatobiliary Longitudinal Screening)
    insertPatient.run(
      'pat_priya',
      'MRN-294710',
      'Priya Nair',
      47,
      'Female',
      'B+',
      'Oncology Screening Clinic · Bay 07',
      'Observation',
      'Follow-up pelvic discomfort and longitudinal CA-125 / AFP tumor marker monitoring.',
      'Endometriosis (2019), BRCA1/2 negative, benign hepatic hemangioma.',
      'No known drug allergies',
      'Dr. Elena Rostova, MD',
      isoMinusDays(60),
      isoMinusHours(5)
    );

    insertSymptom.run(
      'sym_priya_1',
      'pat_priya',
      18,
      3,
      JSON.stringify(['Mild Pelvic Discomfort', 'Bloating']),
      'Serial biomarker surveillance showing gradual downward trend in CA-125; patient comfortable.',
      'Dr. Elena Rostova, MD',
      isoMinusDays(2)
    );

    insertImaging.run(
      'img_priya_histo',
      'pat_priya',
      'Histopathology',
      'Diagnostic Biopsy · H&E',
      'Endometrial / Glandular Surveillance Slide',
      '/assets/scans/slide_histopathology_he.jpg',
      'image/jpeg',
      'path-histo-vit-v1',
      '2026-11-11',
      isoMinusDays(2)
    );

    const priyaLabs: Array<[string, string, string, number, string, number, number, string, number]> = [
      ['Oncology', 'CA-125', 'CA125', 94.0, 'U/mL', 0.0, 35.0, 'Elevated', 1440],
      ['Oncology', 'CA-125', 'CA125', 79.0, 'U/mL', 0.0, 35.0, 'Elevated', 720],
      ['Oncology', 'CA-125', 'CA125', 68.0, 'U/mL', 0.0, 35.0, 'Elevated', 12],
      ['Oncology', 'Alpha-Fetoprotein', 'AFP', 18.0, 'ng/mL', 0.0, 10.0, 'Elevated', 12],
      ['Metabolic', 'ALT (Alanine Transaminase)', 'ALT', 32.0, 'U/L', 7.0, 35.0, 'Normal', 12],
      ['Hematology', 'Platelets', 'PLT', 242.0, '10^9/L', 150.0, 400.0, 'Normal', 12],
    ];
    priyaLabs.forEach((l, idx) => {
      insertLab.run(`lab_p_${idx}`, 'pat_priya', l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], isoMinusHours(l[8]));
    });

    const priyaVitals = { hr: 72, sbp: 118, dbp: 74, spo2: 98, rr: 14, tempC: 36.6 };
    const priyaScores = computeNews2AndQsofa(priyaVitals);
    insertVitals.run('vit_p_0', 'pat_priya', priyaVitals.hr, priyaVitals.sbp, priyaVitals.dbp, priyaVitals.spo2, priyaVitals.rr, priyaVitals.tempC, priyaScores.news2Score, priyaScores.qsofaScore, isoMinusHours(5));

    // 4. Arthur Pendelton — Stable (Cardiopulmonary Step-Down, Clinician Approved)
    insertPatient.run(
      'pat_arthur',
      'MRN-182304',
      'Arthur Pendelton',
      71,
      'Male',
      'AB+',
      'Cardiopulmonary Step-Down · Room 208',
      'Stable',
      'Routine post-stabilization review following mild heart failure exacerbation.',
      'HFrEF (EF 42%), Atrial Fibrillation on Apixaban, Stage 3a CKD.',
      'Sulfa antibiotics',
      'Dr. Aris Thorne, MD',
      isoMinusDays(10),
      isoMinusHours(8)
    );

    insertSymptom.run(
      'sym_arthur_1',
      'pat_arthur',
      5,
      2,
      JSON.stringify(['Mild Pedal Edema (Resolving)']),
      'Diuresis response favorable; breathing comfortably at rest on room air.',
      'Dr. Aris Thorne, MD',
      isoMinusHours(10)
    );

    insertImaging.run(
      'img_arthur_cxr',
      'pat_arthur',
      'X-Ray',
      'Chest · PA Upright',
      'Follow-up Chest Radiograph',
      '/assets/scans/chest_xray_nodule.jpg',
      'image/jpeg',
      'rad-thorax-cnn-v2',
      '2026-11-12',
      isoMinusHours(18)
    );

    const arthurLabs: Array<[string, string, string, number, string, number, number, string, number]> = [
      ['Cardiac', 'NT-proBNP', 'NTBNP', 1240.0, 'pg/mL', 0.0, 300.0, 'Critical High', 96],
      ['Cardiac', 'NT-proBNP', 'NTBNP', 680.0, 'pg/mL', 0.0, 300.0, 'Elevated', 48],
      ['Cardiac', 'NT-proBNP', 'NTBNP', 410.0, 'pg/mL', 0.0, 300.0, 'Elevated', 8],
      ['Cardiac', 'High-Sensitivity Troponin I', 'TROP-I', 0.02, 'ng/mL', 0.0, 0.04, 'Normal', 8],
      ['Metabolic', 'Serum Potassium', 'K', 4.3, 'mmol/L', 3.5, 5.1, 'Normal', 8],
    ];
    arthurLabs.forEach((l, idx) => {
      insertLab.run(`lab_a_${idx}`, 'pat_arthur', l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], isoMinusHours(l[8]));
    });

    const arthurVitals = { hr: 68, sbp: 122, dbp: 74, spo2: 97, rr: 15, tempC: 36.7 };
    const arthurScores = computeNews2AndQsofa(arthurVitals);
    insertVitals.run('vit_a_0', 'pat_arthur', arthurVitals.hr, arthurVitals.sbp, arthurVitals.dbp, arthurVitals.spo2, arthurVitals.rr, arthurVitals.tempC, arthurScores.news2Score, arthurScores.qsofaScore, isoMinusHours(8));

    insertInference.run(
      'inf_arthur_wb',
      'pat_arthur',
      'workbench',
      null,
      'unified-multimodal-fusion-v4',
      'Meridian Unified Clinical Fusion',
      89.4,
      'Stable',
      'Downward NT-proBNP trajectory (-67% over 96h) and normalized room-air oxygenation support continued step-down stabilization.',
      JSON.stringify([
        'NT-proBNP declined steadily from 1240 to 410 pg/mL following diuretic therapy.',
        'Troponin I remains within reference bounds (0.02 ng/mL), no acute ischemic biomarker signal.',
        'NEWS2 = 0; vital parameters stable for outpatient discharge planning.',
      ]),
      JSON.stringify([
        { feature: 'NT-proBNP 96h Delta (-67%)', weight: 52, direction: 'Protective', rationale: 'Strong decongestion response to loop diuretic protocol.' },
        { feature: 'Room-Air SpO2 (97%)', weight: 30, direction: 'Protective', rationale: 'Adequate oxygenation without supplemental O2.' },
        { feature: 'Baseline Radiograph Follow-up', weight: 18, direction: 'Neutral', rationale: 'Recommend clinical correlation for focal right mid-lung opacity noted on PA film.' },
      ] satisfies XAIDriver[]),
      JSON.stringify([]),
      JSON.stringify({
        differentialConsiderations: [
          { condition: 'Compensated HFrEF Recovery', probability: 78, rationale: 'Marked NT-proBNP reduction and normotensive stability.' },
          { condition: 'Incidental Right Mid-Lung Density', probability: 22, rationale: 'Focal opacity on PA radiograph warrants routine comparison with prior films.' },
        ],
        crossDomainCorrelations: ['Cardiac biomarker improvement aligns with resolved dyspnea and NEWS2 = 0.'],
        recommendedNextSteps: ['Continue guideline-directed medical therapy.', 'Compare PA chest film with outpatient baseline prior to discharge.'],
      }),
      'Approved',
      'Dr. Aris Thorne, MD',
      'Reviewed and confirmed stable trajectory; outpatient pulmonary follow-up scheduled for PA film comparison.',
      isoMinusHours(6),
      isoMinusHours(7)
    );
  });

  tx();
}

seedIfEmpty();

function mapPatient(row: Record<string, unknown>): Patient {
  return {
    id: String(row.id),
    mrn: String(row.mrn),
    fullName: String(row.full_name),
    age: Number(row.age),
    sex: String(row.sex),
    bloodType: String(row.blood_type),
    serviceUnit: String(row.service_unit),
    triageLevel: String(row.triage_level) as TriageLevel,
    primaryComplaint: String(row.primary_complaint),
    medicalHistory: String(row.medical_history),
    allergies: String(row.allergies),
    attendingPhysician: String(row.attending_physician),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapInference(row: Record<string, unknown>): AIInference {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    module: String(row.module) as ModuleId,
    targetId: row.target_id ? String(row.target_id) : null,
    modelId: String(row.model_id),
    modelName: String(row.model_name),
    confidence: Number(row.confidence),
    riskCategory: String(row.risk_category) as TriageLevel,
    summary: String(row.summary),
    findings: JSON.parse(String(row.findings_json || '[]')),
    xaiDrivers: JSON.parse(String(row.xai_drivers_json || '[]')),
    roiBoxes: JSON.parse(String(row.roi_boxes_json || '[]')),
    extraData: row.extra_data_json ? JSON.parse(String(row.extra_data_json)) : undefined,
    reviewStatus: String(row.review_status) as ReviewStatus,
    clinicianName: row.clinician_name ? String(row.clinician_name) : null,
    clinicianNotes: row.clinician_notes ? String(row.clinician_notes) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    createdAt: String(row.created_at),
  };
}

export function listPatients(): Patient[] {
  const rows = db.prepare(`
    SELECT * FROM patients
    ORDER BY CASE triage_level
      WHEN 'Critical Action' THEN 1
      WHEN 'Review Needed' THEN 2
      WHEN 'Observation' THEN 3
      ELSE 4
    END, updated_at DESC
  `).all() as Record<string, unknown>[];
  return rows.map(mapPatient);
}

export function listAllAlerts(): ClinicalAlert[] {
  const rows = db.prepare(`
    SELECT a.*, p.full_name as patient_name, p.mrn as mrn
    FROM clinical_alerts a
    JOIN patients p ON p.id = a.patient_id
    ORDER BY a.acknowledged ASC, a.created_at DESC
  `).all() as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    patientId: String(r.patient_id),
    patientName: String(r.patient_name),
    mrn: String(r.mrn),
    module: String(r.module) as ModuleId,
    severity: String(r.severity) as TriageLevel,
    title: String(r.title),
    detail: String(r.detail),
    acknowledged: Number(r.acknowledged) === 1,
    acknowledgedBy: r.acknowledged_by ? String(r.acknowledged_by) : null,
    createdAt: String(r.created_at),
  }));
}

export function getPatientFullRecord(patientId: string): PatientFullRecord | null {
  const pRow = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as Record<string, unknown> | undefined;
  if (!pRow) return null;

  const symptomRows = db.prepare('SELECT * FROM symptom_assessments WHERE patient_id = ? ORDER BY created_at DESC').all(patientId) as Record<string, unknown>[];
  const imagingRows = db.prepare('SELECT * FROM imaging_studies WHERE patient_id = ? ORDER BY created_at DESC').all(patientId) as Record<string, unknown>[];
  const labRows = db.prepare('SELECT * FROM lab_observations WHERE patient_id = ? ORDER BY measured_at ASC').all(patientId) as Record<string, unknown>[];
  const vitalRows = db.prepare('SELECT * FROM vitals_telemetry WHERE patient_id = ? ORDER BY recorded_at ASC').all(patientId) as Record<string, unknown>[];
  const alertRows = db.prepare('SELECT * FROM clinical_alerts WHERE patient_id = ? ORDER BY created_at DESC').all(patientId) as Record<string, unknown>[];
  const infRows = db.prepare('SELECT * FROM ai_inferences WHERE patient_id = ? ORDER BY created_at DESC').all(patientId) as Record<string, unknown>[];

  return {
    patient: mapPatient(pRow),
    symptoms: symptomRows.map((r) => ({
      id: String(r.id),
      patientId: String(r.patient_id),
      onsetDays: Number(r.onset_days),
      severityScore: Number(r.severity_score),
      symptoms: JSON.parse(String(r.symptoms_json || '[]')),
      clinicalNotes: String(r.clinical_notes),
      recordedBy: String(r.recorded_by),
      createdAt: String(r.created_at),
    })),
    imaging: imagingRows.map((r) => ({
      id: String(r.id),
      patientId: String(r.patient_id),
      modality: String(r.modality) as ImagingStudy['modality'],
      anatomicalRegion: String(r.anatomical_region),
      title: String(r.title),
      imageUrl: String(r.image_url),
      imageMime: String(r.image_mime),
      modelId: String(r.model_id),
      studyDate: String(r.study_date),
      createdAt: String(r.created_at),
    })),
    labs: labRows.map((r) => ({
      id: String(r.id),
      patientId: String(r.patient_id),
      panelCategory: String(r.panel_category) as LabObservation['panelCategory'],
      biomarkerName: String(r.biomarker_name),
      biomarkerCode: String(r.biomarker_code),
      value: Number(r.value),
      unit: String(r.unit),
      refMin: Number(r.ref_min),
      refMax: Number(r.ref_max),
      flag: String(r.flag) as LabObservation['flag'],
      measuredAt: String(r.measured_at),
    })),
    vitals: vitalRows.map((r) => ({
      id: String(r.id),
      patientId: String(r.patient_id),
      hr: Number(r.hr),
      sbp: Number(r.sbp),
      dbp: Number(r.dbp),
      spo2: Number(r.spo2),
      rr: Number(r.rr),
      tempC: Number(r.temp_c),
      news2Score: Number(r.news2_score),
      qsofaScore: Number(r.qsofa_score),
      recordedAt: String(r.recorded_at),
    })),
    alerts: alertRows.map((r) => ({
      id: String(r.id),
      patientId: String(r.patient_id),
      module: String(r.module) as ModuleId,
      severity: String(r.severity) as TriageLevel,
      title: String(r.title),
      detail: String(r.detail),
      acknowledged: Number(r.acknowledged) === 1,
      acknowledgedBy: r.acknowledged_by ? String(r.acknowledged_by) : null,
      createdAt: String(r.created_at),
    })),
    inferences: infRows.map(mapInference),
  };
}

export function createPatient(input: {
  fullName: string;
  age: number;
  sex: string;
  bloodType: string;
  serviceUnit: string;
  triageLevel: TriageLevel;
  primaryComplaint: string;
  medicalHistory: string;
  allergies: string;
  attendingPhysician: string;
  initialSymptoms?: string[];
  symptomSeverity?: number;
}): Patient {
  const id = makeId('pat');
  const mrn = `MRN-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO patients (id, mrn, full_name, age, sex, blood_type, service_unit, triage_level, primary_complaint, medical_history, allergies, attending_physician, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      mrn,
      input.fullName,
      input.age,
      input.sex,
      input.bloodType || 'O+',
      input.serviceUnit || 'Diagnostic Triage Unit',
      input.triageLevel || 'Observation',
      input.primaryComplaint,
      input.medicalHistory || 'None reported',
      input.allergies || 'No known drug allergies',
      input.attendingPhysician || 'Dr. Kavita Rao, MD',
      nowIso,
      nowIso
    );

    if (input.initialSymptoms && input.initialSymptoms.length > 0) {
      db.prepare(`
        INSERT INTO symptom_assessments (id, patient_id, onset_days, severity_score, symptoms_json, clinical_notes, recorded_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId('sym'),
        id,
        1,
        input.symptomSeverity ?? 5,
        JSON.stringify(input.initialSymptoms),
        input.primaryComplaint,
        input.attendingPhysician || 'Dr. Kavita Rao, MD',
        nowIso
      );
    }

    // Baseline vitals snapshot so ICU telemetry starts populated
    const baselineVitals = { hr: 78, sbp: 120, dbp: 76, spo2: 98, rr: 16, tempC: 36.8 };
    const scores = computeNews2AndQsofa(baselineVitals);
    db.prepare(`
      INSERT INTO vitals_telemetry (id, patient_id, hr, sbp, dbp, spo2, rr, temp_c, news2_score, qsofa_score, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(makeId('vit'), id, baselineVitals.hr, baselineVitals.sbp, baselineVitals.dbp, baselineVitals.spo2, baselineVitals.rr, baselineVitals.tempC, scores.news2Score, scores.qsofaScore, nowIso);
  });

  tx();
  const created = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Record<string, unknown>;
  return mapPatient(created);
}

export function addSymptomAssessment(
  patientId: string,
  input: { onsetDays: number; severityScore: number; symptoms: string[]; clinicalNotes: string; recordedBy: string }
): SymptomAssessment {
  const id = makeId('sym');
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO symptom_assessments (id, patient_id, onset_days, severity_score, symptoms_json, clinical_notes, recorded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patientId, input.onsetDays, input.severityScore, JSON.stringify(input.symptoms), input.clinicalNotes, input.recordedBy, nowIso);
  db.prepare('UPDATE patients SET updated_at = ? WHERE id = ?').run(nowIso, patientId);

  return {
    id,
    patientId,
    onsetDays: input.onsetDays,
    severityScore: input.severityScore,
    symptoms: input.symptoms,
    clinicalNotes: input.clinicalNotes,
    recordedBy: input.recordedBy,
    createdAt: nowIso,
  };
}

export function addImagingStudy(
  patientId: string,
  input: {
    modality: ImagingStudy['modality'];
    anatomicalRegion: string;
    title: string;
    imageUrl: string;
    imageMime: string;
    modelId: string;
  }
): ImagingStudy {
  const id = makeId('img');
  const nowIso = new Date().toISOString();
  const studyDate = nowIso.slice(0, 10);
  db.prepare(`
    INSERT INTO imaging_studies (id, patient_id, modality, anatomical_region, title, image_url, image_mime, model_id, study_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patientId, input.modality, input.anatomicalRegion, input.title, input.imageUrl, input.imageMime, input.modelId, studyDate, nowIso);
  db.prepare('UPDATE patients SET updated_at = ? WHERE id = ?').run(nowIso, patientId);

  return {
    id,
    patientId,
    modality: input.modality,
    anatomicalRegion: input.anatomicalRegion,
    title: input.title,
    imageUrl: input.imageUrl,
    imageMime: input.imageMime,
    modelId: input.modelId,
    studyDate,
    createdAt: nowIso,
  };
}

export function addLabObservation(
  patientId: string,
  input: {
    panelCategory: LabObservation['panelCategory'];
    biomarkerName: string;
    biomarkerCode: string;
    value: number;
    unit: string;
    refMin: number;
    refMax: number;
  }
): LabObservation {
  const id = makeId('lab');
  const nowIso = new Date().toISOString();

  let flag: LabObservation['flag'] = 'Normal';
  if (input.value > input.refMax * 1.5) flag = 'Critical High';
  else if (input.value > input.refMax) flag = 'Elevated';
  else if (input.value < input.refMin) flag = 'Low';

  db.prepare(`
    INSERT INTO lab_observations (id, patient_id, panel_category, biomarker_name, biomarker_code, value, unit, ref_min, ref_max, flag, measured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patientId, input.panelCategory, input.biomarkerName, input.biomarkerCode, input.value, input.unit, input.refMin, input.refMax, flag, nowIso);

  if (flag === 'Critical High') {
    db.prepare(`
      INSERT INTO clinical_alerts (id, patient_id, module, severity, title, detail, acknowledged, acknowledged_by, created_at)
      VALUES (?, ?, 'pathology', 'Critical Action', ?, ?, 0, NULL, ?)
    `).run(
      makeId('alt'),
      patientId,
      `Critical Biomarker Elevation: ${input.biomarkerName} (${input.value} ${input.unit})`,
      `Measured ${input.biomarkerCode} exceeded 1.5x upper reference bound (${input.refMax} ${input.unit}). Clinician review required.`,
      nowIso
    );
  }

  db.prepare('UPDATE patients SET updated_at = ? WHERE id = ?').run(nowIso, patientId);

  return {
    id,
    patientId,
    panelCategory: input.panelCategory,
    biomarkerName: input.biomarkerName,
    biomarkerCode: input.biomarkerCode,
    value: input.value,
    unit: input.unit,
    refMin: input.refMin,
    refMax: input.refMax,
    flag,
    measuredAt: nowIso,
  };
}

export function addVitalsSnapshot(
  patientId: string,
  input: { hr: number; sbp: number; dbp: number; spo2: number; rr: number; tempC: number }
): VitalsPoint {
  const id = makeId('vit');
  const nowIso = new Date().toISOString();
  const scores = computeNews2AndQsofa(input);

  db.prepare(`
    INSERT INTO vitals_telemetry (id, patient_id, hr, sbp, dbp, spo2, rr, temp_c, news2_score, qsofa_score, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patientId, input.hr, input.sbp, input.dbp, input.spo2, input.rr, input.tempC, scores.news2Score, scores.qsofaScore, nowIso);

  if (scores.news2Score >= 7) {
    db.prepare(`UPDATE patients SET triage_level = 'Critical Action', updated_at = ? WHERE id = ?`).run(nowIso, patientId);
    db.prepare(`
      INSERT INTO clinical_alerts (id, patient_id, module, severity, title, detail, acknowledged, acknowledged_by, created_at)
      VALUES (?, ?, 'icu', 'Critical Action', ?, ?, 0, NULL, ?)
    `).run(
      makeId('alt'),
      patientId,
      `High Early Warning Score (NEWS2 ${scores.news2Score} · qSOFA ${scores.qsofaScore})`,
      `HR ${input.hr} bpm, BP ${input.sbp}/${input.dbp} mmHg, SpO2 ${input.spo2}%, RR ${input.rr}/min, Temp ${input.tempC}°C.`,
      nowIso
    );
  } else if (scores.news2Score >= 5) {
    db.prepare(`
      INSERT INTO clinical_alerts (id, patient_id, module, severity, title, detail, acknowledged, acknowledged_by, created_at)
      VALUES (?, ?, 'icu', 'Review Needed', ?, ?, 0, NULL, ?)
    `).run(
      makeId('alt'),
      patientId,
      `Elevated Early Warning Score (NEWS2 ${scores.news2Score})`,
      `Vitals drift detected: HR ${input.hr} bpm, SpO2 ${input.spo2}%, RR ${input.rr}/min.`,
      nowIso
    );
  } else {
    db.prepare('UPDATE patients SET updated_at = ? WHERE id = ?').run(nowIso, patientId);
  }

  return {
    id,
    patientId,
    hr: input.hr,
    sbp: input.sbp,
    dbp: input.dbp,
    spo2: input.spo2,
    rr: input.rr,
    tempC: input.tempC,
    news2Score: scores.news2Score,
    qsofaScore: scores.qsofaScore,
    recordedAt: nowIso,
  };
}

export function saveAIInference(input: Omit<AIInference, 'id' | 'createdAt' | 'reviewStatus' | 'clinicianName' | 'clinicianNotes' | 'reviewedAt'>): AIInference {
  const id = makeId('inf');
  const nowIso = new Date().toISOString();
  const reviewStatus: ReviewStatus = 'Pending Clinician Review';

  db.prepare(`
    INSERT INTO ai_inferences (id, patient_id, module, target_id, model_id, model_name, confidence, risk_category, summary, findings_json, xai_drivers_json, roi_boxes_json, extra_data_json, review_status, clinician_name, clinician_notes, reviewed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
  `).run(
    id,
    input.patientId,
    input.module,
    input.targetId,
    input.modelId,
    input.modelName,
    input.confidence,
    input.riskCategory,
    input.summary,
    JSON.stringify(input.findings),
    JSON.stringify(input.xaiDrivers),
    JSON.stringify(input.roiBoxes),
    input.extraData ? JSON.stringify(input.extraData) : null,
    reviewStatus,
    nowIso
  );

  db.prepare('UPDATE patients SET updated_at = ? WHERE id = ?').run(nowIso, input.patientId);

  return {
    ...input,
    id,
    reviewStatus,
    clinicianName: null,
    clinicianNotes: null,
    reviewedAt: null,
    createdAt: nowIso,
  };
}

export function reviewAIInference(
  inferenceId: string,
  input: { reviewStatus: ReviewStatus; clinicianName: string; clinicianNotes: string }
): AIInference | null {
  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE ai_inferences
    SET review_status = ?, clinician_name = ?, clinician_notes = ?, reviewed_at = ?
    WHERE id = ?
  `).run(input.reviewStatus, input.clinicianName, input.clinicianNotes, nowIso, inferenceId);

  const row = db.prepare('SELECT * FROM ai_inferences WHERE id = ?').get(inferenceId) as Record<string, unknown> | undefined;
  if (!row) return null;

  if (input.reviewStatus === 'Escalated Critical') {
    db.prepare(`UPDATE patients SET triage_level = 'Critical Action', updated_at = ? WHERE id = ?`).run(nowIso, String(row.patient_id));
  }
  return mapInference(row);
}

export function acknowledgeAlert(alertId: string, clinicianName: string): ClinicalAlert | null {
  db.prepare(`
    UPDATE clinical_alerts
    SET acknowledged = 1, acknowledged_by = ?
    WHERE id = ?
  `).run(clinicianName, alertId);

  const r = db.prepare(`
    SELECT a.*, p.full_name as patient_name, p.mrn as mrn
    FROM clinical_alerts a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.id = ?
  `).get(alertId) as Record<string, unknown> | undefined;

  if (!r) return null;
  return {
    id: String(r.id),
    patientId: String(r.patient_id),
    patientName: String(r.patient_name),
    mrn: String(r.mrn),
    module: String(r.module) as ModuleId,
    severity: String(r.severity) as TriageLevel,
    title: String(r.title),
    detail: String(r.detail),
    acknowledged: Number(r.acknowledged) === 1,
    acknowledgedBy: r.acknowledged_by ? String(r.acknowledged_by) : null,
    createdAt: String(r.created_at),
  };
}

export function getImagingStudyById(studyId: string): ImagingStudy | null {
  const r = db.prepare('SELECT * FROM imaging_studies WHERE id = ?').get(studyId) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    patientId: String(r.patient_id),
    modality: String(r.modality) as ImagingStudy['modality'],
    anatomicalRegion: String(r.anatomical_region),
    title: String(r.title),
    imageUrl: String(r.image_url),
    imageMime: String(r.image_mime),
    modelId: String(r.model_id),
    studyDate: String(r.study_date),
    createdAt: String(r.created_at),
  };
}

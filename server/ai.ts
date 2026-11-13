import { GoogleGenAI, Type } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AIInference,
  ImagingROI,
  ImagingStudy,
  PatientFullRecord,
  TriageLevel,
  XAIDriver,
} from '../src/types/clinical.ts';
import { DIAGNOSTIC_MODEL_REGISTRY } from '../src/registry/clinicalRegistry.ts';

const GEMINI_MODEL = 'gemini-4-hydrogen';

const LOCAL_ASSET_DISK_MAP: Record<string, string> = {
  '/assets/scans/chest_xray_nodule.jpg': 'src/assets/images/scan_chest_xray_nodule_1794567126126.jpg',
  '/assets/scans/brain_mri_axial.jpg': 'src/assets/images/scan_brain_mri_axial_1794567127002.jpg',
  '/assets/scans/chest_ct_oncology.jpg': 'src/assets/images/scan_chest_ct_oncology_1794567127835.jpg',
  '/assets/scans/slide_histopathology_he.jpg': 'src/assets/images/slide_histopathology_he_1794567128179.jpg',
};

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function loadImageInlinePart(imageUrl: string, fallbackMime: string): { inlineData: { mimeType: string; data: string } } | null {
  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return {
        inlineData: {
          mimeType: match[1] || fallbackMime || 'image/jpeg',
          data: match[2],
        },
      };
    }
  }

  const relativeDiskPath = LOCAL_ASSET_DISK_MAP[imageUrl];
  if (relativeDiskPath) {
    const absPath = path.resolve(process.cwd(), relativeDiskPath);
    if (fs.existsSync(absPath)) {
      const data = fs.readFileSync(absPath).toString('base64');
      return {
        inlineData: {
          mimeType: fallbackMime || 'image/jpeg',
          data,
        },
      };
    }
  }

  return null;
}

function normalizeRisk(value: string): TriageLevel {
  if (value === 'Critical Action' || value === 'Review Needed' || value === 'Observation' || value === 'Stable') {
    return value;
  }
  return 'Review Needed';
}

const CLINICAL_SYSTEM_GUARDRAIL =
  'You are the clinical decision-support inference engine inside Shivam Meridian MedAI. ' +
  'Every output is strictly preliminary screening decision support for licensed clinicians — NEVER a definitive diagnosis. ' +
  'Provide concise, medically accurate observations, calibrated confidence percentages (50-98), and clear explainable AI (XAI) feature attributions.';

export async function runImagingInference(
  record: PatientFullRecord,
  study: ImagingStudy,
  modelId: string
): Promise<Omit<AIInference, 'id' | 'createdAt' | 'reviewStatus' | 'clinicianName' | 'clinicianNotes' | 'reviewedAt'>> {
  const ai = getClient();
  const modelSpec = DIAGNOSTIC_MODEL_REGISTRY.find((m) => m.id === modelId) ?? DIAGNOSTIC_MODEL_REGISTRY[0];
  const imagePart = loadImageInlinePart(study.imageUrl, study.imageMime);

  const promptText = [
    `Analyze this ${study.modality} study (${study.anatomicalRegion} — "${study.title}") using screening pipeline "${modelSpec.name}" (${modelSpec.architecture}).`,
    `Patient context: ${record.patient.age}yo ${record.patient.sex}, Primary Complaint: ${record.patient.primaryComplaint}.`,
    `History: ${record.patient.medicalHistory}.`,
    `Latest symptoms: ${record.symptoms[0]?.symptoms.join(', ') || 'None recorded'}.`,
    'Identify key anatomical observations, localized ROI bounding boxes in normalized 0-100 coordinates (x from left, y from top, width, height) for any notable opacity, lesion, or region of interest, and XAI feature attribution drivers summing meaningfully to explain the screening output.',
  ].join('\n');

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (imagePart) parts.push(imagePart);
  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: { parts },
    config: {
      systemInstruction: CLINICAL_SYSTEM_GUARDRAIL,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          confidence: { type: Type.NUMBER },
          riskCategory: { type: Type.STRING, description: 'One of: Critical Action, Review Needed, Observation, Stable' },
          summary: { type: Type.STRING },
          findings: { type: Type.ARRAY, items: { type: Type.STRING } },
          xaiDrivers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                feature: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                direction: { type: Type.STRING, description: 'Increases Risk, Protective, or Neutral' },
                rationale: { type: Type.STRING },
              },
              required: ['feature', 'weight', 'direction', 'rationale'],
            },
          },
          roiBoxes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
                confidence: { type: Type.NUMBER },
                heatmapIntensity: { type: Type.NUMBER },
                severity: { type: Type.STRING, description: 'High, Moderate, or Low' },
              },
              required: ['label', 'x', 'y', 'width', 'height', 'confidence', 'heatmapIntensity', 'severity'],
            },
          },
        },
        required: ['confidence', 'riskCategory', 'summary', 'findings', 'xaiDrivers', 'roiBoxes'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    confidence?: number;
    riskCategory?: string;
    summary?: string;
    findings?: string[];
    xaiDrivers?: XAIDriver[];
    roiBoxes?: ImagingROI[];
  };

  return {
    patientId: record.patient.id,
    module: 'radiology',
    targetId: study.id,
    modelId: modelSpec.id,
    modelName: modelSpec.name,
    confidence: Math.min(99, Math.max(50, Number(parsed.confidence ?? 88))),
    riskCategory: normalizeRisk(parsed.riskCategory ?? 'Review Needed'),
    summary: parsed.summary || 'Preliminary screening analysis completed; clinician verification required.',
    findings: parsed.findings && parsed.findings.length > 0 ? parsed.findings : ['No structured findings returned.'],
    xaiDrivers: parsed.xaiDrivers ?? [],
    roiBoxes: (parsed.roiBoxes ?? []).map((b) => ({
      ...b,
      x: Math.max(2, Math.min(85, b.x)),
      y: Math.max(2, Math.min(85, b.y)),
      width: Math.max(8, Math.min(60, b.width)),
      height: Math.max(8, Math.min(60, b.height)),
      heatmapIntensity: Math.max(0.2, Math.min(1, b.heatmapIntensity ?? 0.75)),
    })),
  };
}

export async function runPathologyInference(
  record: PatientFullRecord,
  modelId: string,
  slideStudy?: ImagingStudy | null
): Promise<Omit<AIInference, 'id' | 'createdAt' | 'reviewStatus' | 'clinicianName' | 'clinicianNotes' | 'reviewedAt'>> {
  const ai = getClient();
  const modelSpec = DIAGNOSTIC_MODEL_REGISTRY.find((m) => m.id === modelId) ?? DIAGNOSTIC_MODEL_REGISTRY[3];

  const labSummary = record.labs
    .map((l) => `${l.measuredAt.slice(0, 16)} | [${l.panelCategory}] ${l.biomarkerName} (${l.biomarkerCode}): ${l.value} ${l.unit} (ref ${l.refMin}-${l.refMax}) [${l.flag}]`)
    .join('\n');

  const promptText = [
    `Perform longitudinal pathology & laboratory biomarker screening using "${modelSpec.name}" (${modelSpec.architecture}).`,
    `Patient: ${record.patient.age}yo ${record.patient.sex}, Complaint: ${record.patient.primaryComplaint}, History: ${record.patient.medicalHistory}.`,
    `Laboratory observations:\n${labSummary || 'No lab entries recorded yet.'}`,
    slideStudy ? `Also inspect attached histopathology slide "${slideStudy.title}" (${slideStudy.anatomicalRegion}) for cellular morphology patterns.` : '',
    'Return preliminary screening findings, panel risk signals, and XAI feature weights across biomarkers/morphology.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (slideStudy) {
    const imgPart = loadImageInlinePart(slideStudy.imageUrl, slideStudy.imageMime);
    if (imgPart) parts.push(imgPart);
  }
  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: { parts },
    config: {
      systemInstruction: CLINICAL_SYSTEM_GUARDRAIL,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          confidence: { type: Type.NUMBER },
          riskCategory: { type: Type.STRING },
          summary: { type: Type.STRING },
          findings: { type: Type.ARRAY, items: { type: Type.STRING } },
          screeningPanels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                panel: { type: Type.STRING },
                signal: { type: Type.STRING },
                status: { type: Type.STRING },
              },
              required: ['panel', 'signal', 'status'],
            },
          },
          xaiDrivers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                feature: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                direction: { type: Type.STRING },
                rationale: { type: Type.STRING },
              },
              required: ['feature', 'weight', 'direction', 'rationale'],
            },
          },
        },
        required: ['confidence', 'riskCategory', 'summary', 'findings', 'screeningPanels', 'xaiDrivers'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    confidence?: number;
    riskCategory?: string;
    summary?: string;
    findings?: string[];
    screeningPanels?: Array<{ panel: string; signal: string; status: string }>;
    xaiDrivers?: XAIDriver[];
  };

  return {
    patientId: record.patient.id,
    module: 'pathology',
    targetId: slideStudy?.id ?? null,
    modelId: modelSpec.id,
    modelName: modelSpec.name,
    confidence: Math.min(99, Math.max(50, Number(parsed.confidence ?? 86))),
    riskCategory: normalizeRisk(parsed.riskCategory ?? 'Review Needed'),
    summary: parsed.summary || 'Biomarker & pathology screening completed.',
    findings: parsed.findings ?? [],
    xaiDrivers: parsed.xaiDrivers ?? [],
    roiBoxes: [],
    extraData: {
      screeningPanels: parsed.screeningPanels ?? [],
    },
  };
}

export async function runIcuVitalsInference(
  record: PatientFullRecord
): Promise<Omit<AIInference, 'id' | 'createdAt' | 'reviewStatus' | 'clinicianName' | 'clinicianNotes' | 'reviewedAt'>> {
  const ai = getClient();
  const modelSpec = DIAGNOSTIC_MODEL_REGISTRY.find((m) => m.id === 'icu-ews-trajectory-v3')!;

  const vitalsSeries = record.vitals
    .slice(-8)
    .map((v) => `${v.recordedAt.slice(11, 19)} | HR:${v.hr} BP:${v.sbp}/${v.dbp} SpO2:${v.spo2}% RR:${v.rr} Temp:${v.tempC}C | NEWS2:${v.news2Score} qSOFA:${v.qsofaScore}`)
    .join('\n');

  const promptText = [
    `Evaluate ICU physiological telemetry & early warning trajectory using "${modelSpec.name}".`,
    `Patient: ${record.patient.age}yo ${record.patient.sex}, Unit: ${record.patient.serviceUnit}, Complaint: ${record.patient.primaryComplaint}.`,
    `Recent Vitals Series:\n${vitalsSeries}`,
    `Relevant Labs (latest): ${record.labs.slice(-4).map((l) => `${l.biomarkerCode}=${l.value}${l.unit}(${l.flag})`).join(', ') || 'None'}`,
    'Provide a 6-hour decompensation risk projection, contributing vital-sign XAI drivers, and an actionable clinical escalation checklist.',
  ].join('\n\n');

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: promptText,
    config: {
      systemInstruction: CLINICAL_SYSTEM_GUARDRAIL,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          confidence: { type: Type.NUMBER },
          riskCategory: { type: Type.STRING },
          summary: { type: Type.STRING },
          sixHourProjection: { type: Type.STRING },
          findings: { type: Type.ARRAY, items: { type: Type.STRING } },
          escalationChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
          xaiDrivers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                feature: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                direction: { type: Type.STRING },
                rationale: { type: Type.STRING },
              },
              required: ['feature', 'weight', 'direction', 'rationale'],
            },
          },
        },
        required: ['confidence', 'riskCategory', 'summary', 'sixHourProjection', 'findings', 'escalationChecklist', 'xaiDrivers'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    confidence?: number;
    riskCategory?: string;
    summary?: string;
    sixHourProjection?: string;
    findings?: string[];
    escalationChecklist?: string[];
    xaiDrivers?: XAIDriver[];
  };

  return {
    patientId: record.patient.id,
    module: 'icu',
    targetId: record.vitals[record.vitals.length - 1]?.id ?? null,
    modelId: modelSpec.id,
    modelName: modelSpec.name,
    confidence: Math.min(99, Math.max(50, Number(parsed.confidence ?? 89))),
    riskCategory: normalizeRisk(parsed.riskCategory ?? 'Observation'),
    summary: parsed.summary || 'ICU telemetry trajectory evaluated.',
    findings: parsed.findings ?? [],
    xaiDrivers: parsed.xaiDrivers ?? [],
    roiBoxes: [],
    extraData: {
      sixHourProjection: parsed.sixHourProjection,
      escalationChecklist: parsed.escalationChecklist ?? [],
    },
  };
}

export async function runWorkbenchSynthesis(
  record: PatientFullRecord
): Promise<Omit<AIInference, 'id' | 'createdAt' | 'reviewStatus' | 'clinicianName' | 'clinicianNotes' | 'reviewedAt'>> {
  const ai = getClient();
  const modelSpec = DIAGNOSTIC_MODEL_REGISTRY.find((m) => m.id === 'unified-multimodal-fusion-v4')!;

  const latestVitals = record.vitals[record.vitals.length - 1];
  const latestSymptoms = record.symptoms[0];
  const abnormalLabs = record.labs.filter((l) => l.flag !== 'Normal');
  const domainInferences = record.inferences
    .filter((i) => i.module !== 'workbench')
    .slice(0, 4)
    .map((i) => `[${i.module.toUpperCase()} · ${i.modelName} · ${i.confidence}% · ${i.reviewStatus}]: ${i.summary}`)
    .join('\n');

  const promptText = [
    `Execute Unified Cross-Domain Multimodal Clinical Synthesis for ${record.patient.fullName} (${record.patient.age}yo ${record.patient.sex}, ${record.patient.mrn}).`,
    `Primary Complaint: ${record.patient.primaryComplaint}`,
    `Medical History: ${record.patient.medicalHistory}`,
    `Symptoms: ${latestSymptoms ? `${latestSymptoms.symptoms.join(', ')} (Severity ${latestSymptoms.severityScore}/10, Onset ${latestSymptoms.onsetDays}d) — ${latestSymptoms.clinicalNotes}` : 'None logged'}`,
    `Abnormal Biomarkers: ${abnormalLabs.map((l) => `${l.biomarkerCode}=${l.value}${l.unit}(${l.flag})`).join(', ') || 'All measured biomarkers nominal'}`,
    `Latest ICU Telemetry: ${latestVitals ? `HR ${latestVitals.hr}, BP ${latestVitals.sbp}/${latestVitals.dbp}, SpO2 ${latestVitals.spo2}%, RR ${latestVitals.rr}, Temp ${latestVitals.tempC}C, NEWS2=${latestVitals.news2Score}` : 'None'}`,
    `Imaging Studies Available: ${record.imaging.map((img) => `${img.modality} (${img.title})`).join(', ') || 'None'}`,
    `Prior Module AI Outputs:\n${domainInferences || 'No module-level inferences yet.'}`,
    'Synthesize a cross-domain preliminary differential consideration list (with relative probability percentages), explicit cross-domain correlations, XAI attribution drivers, and recommended next diagnostic steps.',
  ].join('\n\n');

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: promptText,
    config: {
      systemInstruction: CLINICAL_SYSTEM_GUARDRAIL,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          confidence: { type: Type.NUMBER },
          riskCategory: { type: Type.STRING },
          summary: { type: Type.STRING },
          findings: { type: Type.ARRAY, items: { type: Type.STRING } },
          differentialConsiderations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                condition: { type: Type.STRING },
                probability: { type: Type.NUMBER },
                rationale: { type: Type.STRING },
              },
              required: ['condition', 'probability', 'rationale'],
            },
          },
          crossDomainCorrelations: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          xaiDrivers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                feature: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                direction: { type: Type.STRING },
                rationale: { type: Type.STRING },
              },
              required: ['feature', 'weight', 'direction', 'rationale'],
            },
          },
        },
        required: [
          'confidence',
          'riskCategory',
          'summary',
          'findings',
          'differentialConsiderations',
          'crossDomainCorrelations',
          'recommendedNextSteps',
          'xaiDrivers',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    confidence?: number;
    riskCategory?: string;
    summary?: string;
    findings?: string[];
    differentialConsiderations?: Array<{ condition: string; probability: number; rationale: string }>;
    crossDomainCorrelations?: string[];
    recommendedNextSteps?: string[];
    xaiDrivers?: XAIDriver[];
  };

  return {
    patientId: record.patient.id,
    module: 'workbench',
    targetId: null,
    modelId: modelSpec.id,
    modelName: modelSpec.name,
    confidence: Math.min(99, Math.max(50, Number(parsed.confidence ?? 90))),
    riskCategory: normalizeRisk(parsed.riskCategory ?? record.patient.triageLevel),
    summary: parsed.summary || 'Unified multimodal synthesis completed.',
    findings: parsed.findings ?? [],
    xaiDrivers: parsed.xaiDrivers ?? [],
    roiBoxes: [],
    extraData: {
      differentialConsiderations: parsed.differentialConsiderations ?? [],
      crossDomainCorrelations: parsed.crossDomainCorrelations ?? [],
      recommendedNextSteps: parsed.recommendedNextSteps ?? [],
    },
  };
}

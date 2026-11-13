import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acknowledgeAlert,
  addImagingStudy,
  addLabObservation,
  addSymptomAssessment,
  addVitalsSnapshot,
  createPatient,
  getImagingStudyById,
  getPatientFullRecord,
  listAllAlerts,
  listPatients,
  reviewAIInference,
  saveAIInference,
} from './server/db.ts';
import {
  runIcuVitalsInference,
  runImagingInference,
  runPathologyInference,
  runWorkbenchSynthesis,
} from './server/ai.ts';
import { CLINICAL_DOMAINS, DIAGNOSTIC_MODEL_REGISTRY } from './src/registry/clinicalRegistry.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Shivam Meridian MedAI' });
  });

  app.get('/api/bootstrap', (req, res) => {
    try {
      const patients = listPatients();
      const requestedId = typeof req.query.patientId === 'string' ? req.query.patientId : patients[0]?.id;
      const selectedPatient = requestedId ? getPatientFullRecord(requestedId) : null;
      const alerts = listAllAlerts();

      res.json({
        patients,
        alerts,
        models: DIAGNOSTIC_MODEL_REGISTRY,
        domains: CLINICAL_DOMAINS,
        selectedPatient,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load clinical state' });
    }
  });

  app.get('/api/patients/:id', (req, res) => {
    try {
      const record = getPatientFullRecord(req.params.id);
      if (!record) {
        res.status(404).json({ error: 'Patient record not found' });
        return;
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load patient' });
    }
  });

  app.post('/api/patients', (req, res) => {
    try {
      const { fullName, age, sex, primaryComplaint } = req.body ?? {};
      if (!fullName || !age || !sex || !primaryComplaint) {
        res.status(400).json({ error: 'Full name, age, sex, and primary complaint are required.' });
        return;
      }
      const created = createPatient(req.body);
      const record = getPatientFullRecord(created.id);
      res.status(201).json({ patient: created, record });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create patient' });
    }
  });

  app.post('/api/patients/:id/symptoms', (req, res) => {
    try {
      const patient = getPatientFullRecord(req.params.id);
      if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
      const saved = addSymptomAssessment(req.params.id, {
        onsetDays: Number(req.body.onsetDays ?? 1),
        severityScore: Number(req.body.severityScore ?? 5),
        symptoms: Array.isArray(req.body.symptoms) ? req.body.symptoms : [],
        clinicalNotes: String(req.body.clinicalNotes ?? ''),
        recordedBy: String(req.body.recordedBy ?? patient.patient.attendingPhysician),
      });
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record symptom assessment' });
    }
  });

  app.post('/api/patients/:id/imaging', (req, res) => {
    try {
      const patient = getPatientFullRecord(req.params.id);
      if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
      const { modality, anatomicalRegion, title, imageUrl, imageMime, modelId } = req.body ?? {};
      if (!modality || !title || !imageUrl) {
        res.status(400).json({ error: 'Modality, title, and image data are required.' });
        return;
      }
      const study = addImagingStudy(req.params.id, {
        modality,
        anatomicalRegion: anatomicalRegion || 'Unspecified Region',
        title,
        imageUrl,
        imageMime: imageMime || 'image/jpeg',
        modelId: modelId || 'rad-thorax-cnn-v2',
      });
      res.status(201).json(study);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to store imaging study' });
    }
  });

  app.post('/api/patients/:id/labs', (req, res) => {
    try {
      const patient = getPatientFullRecord(req.params.id);
      if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
      const { panelCategory, biomarkerName, biomarkerCode, value, unit, refMin, refMax } = req.body ?? {};
      if (!biomarkerName || value === undefined || !unit) {
        res.status(400).json({ error: 'Biomarker name, numeric value, and unit are required.' });
        return;
      }
      const obs = addLabObservation(req.params.id, {
        panelCategory: panelCategory || 'Oncology',
        biomarkerName,
        biomarkerCode: biomarkerCode || biomarkerName.slice(0, 6).toUpperCase(),
        value: Number(value),
        unit,
        refMin: Number(refMin ?? 0),
        refMax: Number(refMax ?? 10),
      });
      res.status(201).json({ observation: obs, alerts: listAllAlerts() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to log lab observation' });
    }
  });

  app.post('/api/patients/:id/vitals', (req, res) => {
    try {
      const patient = getPatientFullRecord(req.params.id);
      if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
      const snapshot = addVitalsSnapshot(req.params.id, {
        hr: Number(req.body.hr),
        sbp: Number(req.body.sbp),
        dbp: Number(req.body.dbp),
        spo2: Number(req.body.spo2),
        rr: Number(req.body.rr),
        tempC: Number(req.body.tempC),
      });
      res.status(201).json({
        vitals: snapshot,
        alerts: listAllAlerts(),
        patients: listPatients(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record vitals' });
    }
  });

  app.post('/api/ai/analyze-imaging', async (req, res) => {
    try {
      const { patientId, studyId, modelId } = req.body ?? {};
      const record = getPatientFullRecord(patientId);
      const study = getImagingStudyById(studyId);
      if (!record || !study) {
        res.status(404).json({ error: 'Patient or imaging study not found' });
        return;
      }
      const result = await runImagingInference(record, study, modelId || study.modelId);
      const saved = saveAIInference(result);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Gemini imaging error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Imaging AI inference failed' });
    }
  });

  app.post('/api/ai/analyze-pathology', async (req, res) => {
    try {
      const { patientId, modelId, studyId } = req.body ?? {};
      const record = getPatientFullRecord(patientId);
      if (!record) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
      const slideStudy = studyId ? getImagingStudyById(studyId) : record.imaging.find((i) => i.modality === 'Histopathology') ?? null;
      const result = await runPathologyInference(record, modelId || 'path-oncology-ensemble-v2', slideStudy);
      const saved = saveAIInference(result);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Gemini pathology error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Pathology AI inference failed' });
    }
  });

  app.post('/api/ai/analyze-vitals', async (req, res) => {
    try {
      const { patientId } = req.body ?? {};
      const record = getPatientFullRecord(patientId);
      if (!record) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
      const result = await runIcuVitalsInference(record);
      const saved = saveAIInference(result);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Gemini ICU error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'ICU trajectory AI failed' });
    }
  });

  app.post('/api/ai/synthesize-workbench', async (req, res) => {
    try {
      const { patientId } = req.body ?? {};
      const record = getPatientFullRecord(patientId);
      if (!record) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
      const result = await runWorkbenchSynthesis(record);
      const saved = saveAIInference(result);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Gemini workbench synthesis error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unified synthesis failed' });
    }
  });

  app.post('/api/inferences/:id/review', (req, res) => {
    try {
      const { reviewStatus, clinicianName, clinicianNotes } = req.body ?? {};
      if (!reviewStatus || !clinicianName) {
        res.status(400).json({ error: 'Review status and clinician name are required.' });
        return;
      }
      const updated = reviewAIInference(req.params.id, {
        reviewStatus,
        clinicianName,
        clinicianNotes: clinicianNotes || '',
      });
      if (!updated) {
        res.status(404).json({ error: 'Inference record not found' });
        return;
      }
      res.json({ inference: updated, patients: listPatients() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save clinician review' });
    }
  });

  app.patch('/api/alerts/:id', (req, res) => {
    try {
      const updated = acknowledgeAlert(req.params.id, String(req.body?.clinicianName || 'Attending Clinician'));
      if (!updated) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      res.json({ alert: updated, alerts: listAllAlerts() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to acknowledge alert' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shivam Meridian MedAI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

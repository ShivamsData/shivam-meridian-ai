import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Cpu,
  FileText,
  ShieldAlert,
  X,
} from 'lucide-react';
import type {
  BootstrapPayload,
  ClinicalAlert,
  ClinicalDomainSpec,
  DiagnosticModelSpec,
  ImagingStudy,
  LabObservation,
  ModuleId,
  Patient,
  PatientFullRecord,
  ReviewStatus,
  TriageLevel,
} from './types/clinical.ts';
import { CLINICAL_DOMAINS, DIAGNOSTIC_MODEL_REGISTRY } from './registry/clinicalRegistry.ts';
import { TriageStatusTag } from './components/ClinicalPrimitives.tsx';
import { WorkbenchModule } from './components/WorkbenchModule.tsx';
import { RadiologyModule } from './components/RadiologyModule.tsx';
import { PathologyModule } from './components/PathologyModule.tsx';
import { IcuTelemetryModule } from './components/IcuTelemetryModule.tsx';
import {
  ClinicalReportModal,
  ModelRegistryModal,
  NewPatientModal,
} from './components/ClinicalModals.tsx';

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('workbench');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [models, setModels] = useState<DiagnosticModelSpec[]>(DIAGNOSTIC_MODEL_REGISTRY);
  const [domains, setDomains] = useState<ClinicalDomainSpec[]>(CLINICAL_DOMAINS);
  const [selectedRecord, setSelectedRecord] = useState<PatientFullRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiBusyModule, setAiBusyModule] = useState<ModuleId | null>(null);

  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRegistryModal, setShowRegistryModal] = useState(false);

  const loadBootstrap = useCallback(async (patientId?: string) => {
    try {
      setErrorMsg(null);
      const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
      const res = await fetch(`/api/bootstrap${query}`);
      const data = (await res.json()) as BootstrapPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load clinical state');
      setPatients(data.patients);
      setAlerts(data.alerts);
      if (data.models?.length) setModels(data.models);
      if (data.domains?.length) setDomains(data.domains);
      setSelectedRecord(data.selectedPatient);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to connect to clinical server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const refreshPatient = useCallback(async (patientId: string) => {
    const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}`);
    const data = (await res.json()) as PatientFullRecord & { error?: string };
    if (!res.ok) throw new Error(data.error || 'Failed to refresh patient record');
    setSelectedRecord(data);
  }, []);

  const handleSelectPatient = async (patientId: string) => {
    try {
      setErrorMsg(null);
      await refreshPatient(patientId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load patient');
    }
  };

  const handleCreatePatient = async (payload: {
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
    initialSymptoms: string[];
    symptomSeverity: number;
  }) => {
    setErrorMsg(null);
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create patient');
    await loadBootstrap(data.patient.id);
  };

  const handleAddSymptoms = async (
    patientId: string,
    payload: {
      onsetDays: number;
      severityScore: number;
      symptoms: string[];
      clinicalNotes: string;
      recordedBy: string;
    }
  ) => {
    setErrorMsg(null);
    const res = await fetch(`/api/patients/${patientId}/symptoms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to log symptom assessment');
    await refreshPatient(patientId);
  };

  const handleUploadImaging = async (
    patientId: string,
    payload: {
      modality: ImagingStudy['modality'];
      anatomicalRegion: string;
      title: string;
      imageUrl: string;
      imageMime: string;
      modelId: string;
    }
  ): Promise<ImagingStudy> => {
    setErrorMsg(null);
    const res = await fetch(`/api/patients/${patientId}/imaging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload medical scan');
    await refreshPatient(patientId);
    return data as ImagingStudy;
  };

  const handleAddLab = async (
    patientId: string,
    payload: {
      panelCategory: LabObservation['panelCategory'];
      biomarkerName: string;
      biomarkerCode: string;
      value: number;
      unit: string;
      refMin: number;
      refMax: number;
    }
  ) => {
    setErrorMsg(null);
    const res = await fetch(`/api/patients/${patientId}/labs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to record lab observation');
    if (data.alerts) setAlerts(data.alerts);
    await refreshPatient(patientId);
  };

  const handleLogVitals = async (
    patientId: string,
    payload: {
      hr: number;
      sbp: number;
      dbp: number;
      spo2: number;
      rr: number;
      tempC: number;
    }
  ) => {
    setErrorMsg(null);
    const res = await fetch(`/api/patients/${patientId}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to record vitals');
    if (data.alerts) setAlerts(data.alerts);
    if (data.patients) setPatients(data.patients);
    await refreshPatient(patientId);
  };

  const handleRunImagingAI = async (
    patientId: string,
    studyId: string,
    modelId: string
  ) => {
    setAiBusyModule('radiology');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/analyze-imaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, studyId, modelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Imaging AI inference failed');
      await refreshPatient(patientId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Imaging AI failed');
    } finally {
      setAiBusyModule(null);
    }
  };

  const handleRunPathologyAI = async (
    patientId: string,
    modelId: string,
    studyId?: string
  ) => {
    setAiBusyModule('pathology');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/analyze-pathology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, modelId, studyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pathology AI inference failed');
      await refreshPatient(patientId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Pathology AI failed');
    } finally {
      setAiBusyModule(null);
    }
  };

  const handleRunIcuAI = async (patientId: string) => {
    setAiBusyModule('icu');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/analyze-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ICU trajectory AI failed');
      await refreshPatient(patientId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ICU AI failed');
    } finally {
      setAiBusyModule(null);
    }
  };

  const handleRunWorkbenchSynthesis = async (patientId: string) => {
    setAiBusyModule('workbench');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/synthesize-workbench', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unified synthesis failed');
      await refreshPatient(patientId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Workbench synthesis failed');
    } finally {
      setAiBusyModule(null);
    }
  };

  const handleReviewInference = async (
    inferenceId: string,
    payload: {
      reviewStatus: ReviewStatus;
      clinicianName: string;
      clinicianNotes: string;
    }
  ) => {
    setErrorMsg(null);
    const res = await fetch(`/api/inferences/${inferenceId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to record clinician review');
    if (data.patients) setPatients(data.patients);
    if (selectedRecord) {
      await refreshPatient(selectedRecord.patient.id);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    setErrorMsg(null);
    const res = await fetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicianName:
          selectedRecord?.patient.attendingPhysician || 'Attending Clinician',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to acknowledge alert');
    if (data.alerts) setAlerts(data.alerts);
  };

  const openAlertsCount = useMemo(
    () => alerts.filter((a) => !a.acknowledged).length,
    [alerts]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8FF] text-[#131B2E]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 no-print">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#workbench"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('workbench');
            }}
            className="text-lg font-bold font-display tracking-tight text-[#131B2E] whitespace-nowrap shrink-0"
          >
            Shivam Meridian MedAI
          </a>

          {/* Zone 2: 4 Clean Single-Line Module Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {domains.map((dom) => {
              const active = activeModule === dom.id;
              return (
                <button
                  key={dom.id}
                  type="button"
                  onClick={() => setActiveModule(dom.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[#00685F] text-[#00685F] font-semibold'
                      : 'border-transparent text-[#3D4947] hover:text-[#131B2E]'
                  }`}
                >
                  {dom.shortLabel}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setShowNewPatient(true)}
              className="h-10 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg transition-all hover:shadow-[0_0_16px_rgba(6,182,212,0.35)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Patient Case
            </button>
          </div>
        </div>

        {/* Mobile Module Switcher */}
        <div className="md:hidden border-t border-slate-200/80 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {domains.map((dom) => (
            <button
              key={dom.id}
              type="button"
              onClick={() => setActiveModule(dom.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                activeModule === dom.id
                  ? 'bg-[#0D9488] text-white'
                  : 'text-[#3D4947] bg-[#F2F3FF]'
              }`}
            >
              {dom.shortLabel}
            </button>
          ))}
        </div>
      </header>

      {/* Secondary Patient Context & Utility Ribbon */}
      <div className="bg-[#F2F3FF]/75 border-b border-slate-200/80 no-print">
        <div className="max-w-[1440px] mx-auto px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label htmlFor="patient-switcher" className="font-semibold text-[#3D4947]">
              Active Patient:
            </label>
            <select
              id="patient-switcher"
              value={selectedRecord?.patient.id || ''}
              onChange={(e) => handleSelectPatient(e.target.value)}
              className="h-8 px-2.5 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0D9488]"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.mrn})
                </option>
              ))}
            </select>

            {selectedRecord && (
              <>
                <TriageStatusTag
                  level={selectedRecord.patient.triageLevel}
                  compact
                />
                <span className="hidden sm:inline text-[#3D4947]">
                  {selectedRecord.patient.age}y {selectedRecord.patient.sex} ·{' '}
                  {selectedRecord.patient.serviceUnit}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {openAlertsCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveModule('workbench')}
                className="h-8 px-3 text-xs font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                {openAlertsCount} Priority Alert{openAlertsCount > 1 ? 's' : ''}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowRegistryModal(true)}
              className="h-8 px-3 text-xs font-medium text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-[#00685F]" />
              <span>Model Registry</span>
            </button>
            <button
              type="button"
              disabled={!selectedRecord}
              onClick={() => setShowReportModal(true)}
              className="h-8 px-3 text-xs font-medium text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#00685F]" />
              <span>Clinical Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inline Error Banner */}
      {errorMsg && (
        <div className="max-w-[1440px] w-full mx-auto px-6 pt-4 no-print">
          <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-1 hover:bg-[#FEE2E2] rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 h-96 bg-white border border-slate-200 rounded-lg animate-pulse" />
            <div className="lg:col-span-8 h-96 bg-white border border-slate-200 rounded-lg animate-pulse" />
          </div>
        ) : (
          <>
            {activeModule === 'workbench' && (
              <WorkbenchModule
                patients={patients}
                selectedRecord={selectedRecord}
                alerts={alerts}
                onSelectPatient={handleSelectPatient}
                onNavigateModule={setActiveModule}
                onAddSymptoms={handleAddSymptoms}
                onRunWorkbenchSynthesis={handleRunWorkbenchSynthesis}
                onReviewInference={handleReviewInference}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onOpenReport={() => setShowReportModal(true)}
                synthesizing={aiBusyModule === 'workbench'}
              />
            )}

            {activeModule === 'radiology' && (
              <RadiologyModule
                record={selectedRecord}
                models={models}
                onUploadImaging={handleUploadImaging}
                onRunImagingAI={handleRunImagingAI}
                onReviewInference={handleReviewInference}
                analyzing={aiBusyModule === 'radiology'}
              />
            )}

            {activeModule === 'pathology' && (
              <PathologyModule
                record={selectedRecord}
                models={models}
                onAddLab={handleAddLab}
                onUploadSlide={handleUploadImaging}
                onRunPathologyAI={handleRunPathologyAI}
                onReviewInference={handleReviewInference}
                analyzing={aiBusyModule === 'pathology'}
              />
            )}

            {activeModule === 'icu' && (
              <IcuTelemetryModule
                record={selectedRecord}
                onLogVitals={handleLogVitals}
                onRunIcuAI={handleRunIcuAI}
                onReviewInference={handleReviewInference}
                analyzing={aiBusyModule === 'icu'}
              />
            )}
          </>
        )}
      </main>

      {/* Persistent Clinical Regulatory Disclaimer Footer */}
      <footer className="border-t border-slate-200/90 bg-white/95 no-print">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#3D4947]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#00685F] shrink-0" />
            <span className="font-semibold tracking-wide uppercase text-[#131B2E]">
              Investigational Clinical Decision Support Tool
            </span>
            <span aria-hidden="true">·</span>
            <span>
              All AI screening outputs are preliminary and require independent verification by a licensed clinician.
            </span>
          </div>
          <span className="font-mono text-[#3D4947]">
            Shivam Meridian MedAI · Persistent SQLite + Multimodal AI
          </span>
        </div>
      </footer>

      {/* Supporting Modals */}
      <NewPatientModal
        open={showNewPatient}
        onClose={() => setShowNewPatient(false)}
        onCreate={handleCreatePatient}
      />

      <ClinicalReportModal
        open={showReportModal}
        record={selectedRecord}
        onClose={() => setShowReportModal(false)}
      />

      <ModelRegistryModal
        open={showRegistryModal}
        domains={domains}
        models={models}
        onClose={() => setShowRegistryModal(false)}
      />
    </div>
  );
}

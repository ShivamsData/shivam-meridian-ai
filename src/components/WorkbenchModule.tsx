import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  Check,
  FileText,
  FlaskConical,
  Layers,
  Plus,
  Scan,
  Search,
  Sparkles,
} from 'lucide-react';
import type {
  AIInference,
  ClinicalAlert,
  ModuleId,
  Patient,
  PatientFullRecord,
  ReviewStatus,
  TriageLevel,
} from '../types/clinical.ts';
import {
  ClinicianReviewPanel,
  ReviewStatusTag,
  TriageStatusTag,
  XAIDriverList,
} from './ClinicalPrimitives.tsx';

interface WorkbenchModuleProps {
  patients: Patient[];
  selectedRecord: PatientFullRecord | null;
  alerts: ClinicalAlert[];
  onSelectPatient: (patientId: string) => void;
  onNavigateModule: (module: ModuleId) => void;
  onAddSymptoms: (
    patientId: string,
    payload: {
      onsetDays: number;
      severityScore: number;
      symptoms: string[];
      clinicalNotes: string;
      recordedBy: string;
    }
  ) => Promise<void>;
  onRunWorkbenchSynthesis: (patientId: string) => Promise<void>;
  onReviewInference: (
    inferenceId: string,
    payload: {
      reviewStatus: ReviewStatus;
      clinicianName: string;
      clinicianNotes: string;
    }
  ) => Promise<void>;
  onAcknowledgeAlert: (alertId: string) => Promise<void>;
  onOpenReport: () => void;
  synthesizing: boolean;
}

const SYMPTOM_CHIPS = [
  'Fever (>38.0°C)',
  'Dyspnea',
  'Persistent Cough',
  'Chest Pain',
  'Altered Mental Status',
  'Focal Weakness',
  'Unintentional Weight Loss',
  'Tachycardia',
  'Fatigue',
  'Pelvic / Abdominal Pain',
];

export function WorkbenchModule({
  patients,
  selectedRecord,
  alerts,
  onSelectPatient,
  onNavigateModule,
  onAddSymptoms,
  onRunWorkbenchSynthesis,
  onReviewInference,
  onAcknowledgeAlert,
  onOpenReport,
  synthesizing,
}: WorkbenchModuleProps) {
  const [search, setSearch] = useState('');
  const [triageFilter, setTriageFilter] = useState<'All' | TriageLevel>('All');
  const [showSymptomForm, setShowSymptomForm] = useState(false);

  // Symptom assessment form state
  const [onsetDays, setOnsetDays] = useState(3);
  const [severityScore, setSeverityScore] = useState(6);
  const [chosenSymptoms, setChosenSymptoms] = useState<string[]>([
    'Dyspnea',
    'Fatigue',
  ]);
  const [symptomNotes, setSymptomNotes] = useState('');
  const [savingSymptom, setSavingSymptom] = useState(false);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesFilter =
        triageFilter === 'All' || p.triageLevel === triageFilter;
      const matchesQuery =
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.serviceUnit.toLowerCase().includes(q) ||
        p.primaryComplaint.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [patients, search, triageFilter]);

  const unacknowledgedAlerts = useMemo(
    () => alerts.filter((a) => !a.acknowledged),
    [alerts]
  );

  const latestWorkbenchInference: AIInference | undefined = useMemo(
    () => selectedRecord?.inferences.find((i) => i.module === 'workbench'),
    [selectedRecord]
  );

  const latestVitals = selectedRecord?.vitals[selectedRecord.vitals.length - 1];
  const abnormalLabs = useMemo(
    () => selectedRecord?.labs.filter((l) => l.flag !== 'Normal') ?? [],
    [selectedRecord]
  );

  const toggleSymptomOption = (sym: string) => {
    setChosenSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSymptomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSavingSymptom(true);
    try {
      await onAddSymptoms(selectedRecord.patient.id, {
        onsetDays,
        severityScore,
        symptoms: chosenSymptoms,
        clinicalNotes:
          symptomNotes.trim() || 'Clinician symptom update recorded.',
        recordedBy: selectedRecord.patient.attendingPhysician,
      });
      setSymptomNotes('');
      setShowSymptomForm(false);
    } finally {
      setSavingSymptom(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Column: Cohort Triage Queue & Priority Alerts */}
      <aside className="xl:col-span-4 space-y-6">
        {/* Triage Queue Panel */}
        <section className="bg-white border border-slate-200/90 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#131B2E]">
                Patient Triage Queue
              </h2>
              <p className="text-xs text-[#3D4947]">
                {patients.length} active cases prioritized by risk severity
              </p>
            </div>
          </div>

          {/* Search & Triage Filter */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-[#6D7A77] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient, MRN, or unit..."
                className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488] focus:ring-3 focus:ring-[#0D9488]/15"
              />
            </div>

            <div className="flex flex-wrap gap-1 p-1 bg-[#F2F3FF] rounded-lg">
              {(
                [
                  'All',
                  'Critical Action',
                  'Review Needed',
                  'Observation',
                  'Stable',
                ] as const
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTriageFilter(tab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    triageFilter === tab
                      ? 'bg-white text-[#131B2E] shadow-xs'
                      : 'text-[#3D4947] hover:text-[#131B2E]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Queue Rows */}
          <div className="divide-y divide-slate-200/80 border-t border-slate-200/80">
            {filteredPatients.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#3D4947]">
                No patients match the selected triage filter.
              </div>
            ) : (
              filteredPatients.map((p) => {
                const isSelected = selectedRecord?.patient.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPatient(p.id)}
                    className={`w-full text-left py-3.5 px-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F0F9FF]'
                        : 'bg-white hover:bg-[#FAF8FF]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#131B2E] truncate">
                          {p.fullName}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#3D4947] mt-0.5 font-mono tabular-nums">
                          <span>{p.mrn}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {p.age}y {p.sex[0]}
                          </span>
                        </div>
                      </div>
                      <TriageStatusTag level={p.triageLevel} compact />
                    </div>
                    <p className="text-xs text-[#3D4947] mt-1.5 line-clamp-2">
                      {p.primaryComplaint}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Active Clinical Alerts Queue */}
        <section className="bg-white border border-slate-200/90 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#00685F]" />
              <h2 className="text-base font-semibold text-[#131B2E]">
                Clinical Priority Alerts
              </h2>
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-[#3D4947]">
              {unacknowledgedAlerts.length} open
            </span>
          </div>

          {unacknowledgedAlerts.length === 0 ? (
            <p className="text-xs text-[#3D4947] py-4 text-center border-t border-slate-200/80">
              All clinical alerts have been acknowledged.
            </p>
          ) : (
            <div className="divide-y divide-slate-200/80 border-t border-slate-200/80">
              {unacknowledgedAlerts.map((alert) => (
                <div key={alert.id} className="py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <TriageStatusTag level={alert.severity} compact />
                    <span className="text-[11px] font-mono tabular-nums text-[#3D4947]">
                      {alert.module.toUpperCase()} · {alert.mrn}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#131B2E]">
                      {alert.patientName}: {alert.title}
                    </p>
                    <p className="text-xs text-[#3D4947] mt-0.5 leading-relaxed">
                      {alert.detail}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPatient(alert.patientId);
                        onNavigateModule(alert.module);
                      }}
                      className="text-xs font-semibold text-[#00685F] hover:text-[#0D9488] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Inspect Module</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <span aria-hidden="true" className="text-slate-300">
                      |
                    </span>
                    <button
                      type="button"
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      className="text-xs font-medium text-[#3D4947] hover:text-[#131B2E] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>

      {/* Main Column: Patient Profile, Multi-Domain Snapshot & Unified Synthesis */}
      <div className="xl:col-span-8 space-y-6">
        {!selectedRecord ? (
          <div className="bg-white border border-slate-200/90 rounded-lg p-10 text-center text-sm text-[#3D4947]">
            Select a patient from the triage queue to open their integrated clinical workbench.
          </div>
        ) : (
          <>
            {/* Patient Health Profile & Quick Domain Links */}
            <section className="bg-white border border-slate-200/90 rounded-lg p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-[#131B2E] tracking-tight">
                      {selectedRecord.patient.fullName}
                    </h1>
                    <TriageStatusTag level={selectedRecord.patient.triageLevel} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#3D4947]">
                    <span className="font-mono tabular-nums font-medium text-[#131B2E]">
                      {selectedRecord.patient.mrn}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {selectedRecord.patient.age} yrs, {selectedRecord.patient.sex}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Blood {selectedRecord.patient.bloodType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedRecord.patient.serviceUnit}</span>
                    <span aria-hidden="true">·</span>
                    <span>Attending: {selectedRecord.patient.attendingPhysician}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenReport}
                    className="h-10 px-4 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] hover:bg-[#F0F9FF] rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-[#00685F]" />
                    <span>Download Clinical Report</span>
                  </button>
                  <button
                    type="button"
                    disabled={synthesizing}
                    onClick={() => onRunWorkbenchSynthesis(selectedRecord.patient.id)}
                    className="h-10 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg inline-flex items-center gap-2 transition-all hover:shadow-[0_0_16px_rgba(6,182,212,0.35)] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {synthesizing
                        ? 'Synthesizing Domains...'
                        : 'Run Unified AI Synthesis'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Clean Clinical History Row (Whitespace & Hairline Dividers, No Nested Cards) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-200/80 text-sm">
                <div>
                  <div className="text-xs font-semibold text-[#3D4947] mb-1">
                    Presenting Complaint
                  </div>
                  <p className="text-sm text-[#131B2E] leading-relaxed">
                    {selectedRecord.patient.primaryComplaint}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#3D4947] mb-1">
                    Past Medical History
                  </div>
                  <p className="text-sm text-[#131B2E] leading-relaxed">
                    {selectedRecord.patient.medicalHistory}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#3D4947] mb-1">
                    Allergies & Sensitivities
                  </div>
                  <p className="text-sm text-[#131B2E] leading-relaxed">
                    {selectedRecord.patient.allergies}
                  </p>
                </div>
              </div>

              {/* Connected Module Summary Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => onNavigateModule('radiology')}
                  className="text-left p-3.5 rounded-lg bg-[#FAF8FF] hover:bg-[#F0F9FF] border border-slate-200/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#00685F]">
                    <span className="inline-flex items-center gap-1.5">
                      <Scan className="w-4 h-4" />
                      <span>Radiology & Imaging</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-2 text-lg font-bold font-mono tabular-nums text-[#131B2E]">
                    {selectedRecord.imaging.length}{' '}
                    <span className="text-xs font-sans font-normal text-[#3D4947]">
                      studies available
                    </span>
                  </div>
                  <div className="text-xs text-[#3D4947] truncate mt-0.5">
                    {selectedRecord.imaging[0]?.title || 'Upload a scan in Radiology'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateModule('pathology')}
                  className="text-left p-3.5 rounded-lg bg-[#FAF8FF] hover:bg-[#F0F9FF] border border-slate-200/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#00685F]">
                    <span className="inline-flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4" />
                      <span>Pathology & Biomarkers</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-2 text-lg font-bold font-mono tabular-nums text-[#131B2E]">
                    {abnormalLabs.length}{' '}
                    <span className="text-xs font-sans font-normal text-[#3D4947]">
                      out-of-range markers
                    </span>
                  </div>
                  <div className="text-xs text-[#3D4947] truncate mt-0.5">
                    {selectedRecord.labs.length} total longitudinal assays
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateModule('icu')}
                  className="text-left p-3.5 rounded-lg bg-[#FAF8FF] hover:bg-[#F0F9FF] border border-slate-200/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#00685F]">
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      <span>ICU Vitals Telemetry</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-2 text-lg font-bold font-mono tabular-nums text-[#131B2E]">
                    NEWS2: {latestVitals ? latestVitals.news2Score : '—'}{' '}
                    <span className="text-xs font-sans font-normal text-[#3D4947]">
                      · SpO2 {latestVitals ? `${latestVitals.spo2}%` : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-[#3D4947] truncate mt-0.5">
                    {latestVitals
                      ? `HR ${latestVitals.hr} bpm · BP ${latestVitals.sbp}/${latestVitals.dbp}`
                      : 'No telemetry logged'}
                  </div>
                </button>
              </div>
            </section>

            {/* Symptom Assessment & Longitudinal Intake */}
            <section className="bg-white border border-slate-200/90 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-[#131B2E]">
                    Symptom Assessment & Clinical Timeline
                  </h2>
                  <p className="text-xs text-[#3D4947]">
                    Structured symptom history correlated directly into multimodal AI fusion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSymptomForm((v) => !v)}
                  className="h-9 px-3.5 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showSymptomForm ? 'Cancel' : 'Log Symptom Assessment'}</span>
                </button>
              </div>

              {showSymptomForm && (
                <form
                  onSubmit={handleSymptomSubmit}
                  className="p-4 rounded-lg bg-[#FAF8FF] border border-slate-200 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#3D4947] mb-1">
                        Symptom Onset (Days Ago)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={onsetDays}
                        onChange={(e) => setOnsetDays(Number(e.target.value))}
                        className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#3D4947] mb-1">
                        Severity Score ({severityScore}/10)
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={severityScore}
                        onChange={(e) => setSeverityScore(Number(e.target.value))}
                        className="w-full accent-[#0D9488] mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-[#3D4947] mb-2">
                      Select Observed Symptoms
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SYMPTOM_CHIPS.map((sym) => {
                        const active = chosenSymptoms.includes(sym);
                        return (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => toggleSymptomOption(sym)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#0D9488] text-white border-[#0D9488]'
                                : 'bg-white text-[#3D4947] border-slate-300 hover:border-[#0D9488]'
                            }`}
                          >
                            {sym}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#3D4947] mb-1">
                      Clinical Assessment Notes
                    </label>
                    <textarea
                      rows={2}
                      value={symptomNotes}
                      onChange={(e) => setSymptomNotes(e.target.value)}
                      placeholder="Describe progression, physical exam findings, or response to therapy..."
                      className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingSymptom}
                      className="h-9 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {savingSymptom ? 'Saving...' : 'Save Symptom Entry'}
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-slate-200/80 border-t border-slate-200/80">
                {selectedRecord.symptoms.length === 0 ? (
                  <p className="py-4 text-xs text-[#3D4947]">
                    No structured symptom assessments logged yet.
                  </p>
                ) : (
                  selectedRecord.symptoms.map((sym) => (
                    <div key={sym.id} className="py-3 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#3D4947]">
                        <span className="font-medium text-[#131B2E]">
                          {sym.symptoms.join(' · ') || 'General Assessment'}
                        </span>
                        <span className="font-mono tabular-nums">
                          Severity {sym.severityScore}/10 · Onset {sym.onsetDays}d ·{' '}
                          {new Date(sym.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#3D4947] leading-relaxed">
                        {sym.clinicalNotes}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Unified Intelligence Layer Output + Clinician Sign-Off */}
            <section className="clinical-glass border border-[#0D9488]/25 rounded-lg p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F0F9FF] border border-[#06B6D4]/30 flex items-center justify-center text-[#00685F] shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#131B2E]">
                      Unified Multimodal Clinical Intelligence
                    </h2>
                    <p className="text-xs text-[#3D4947]">
                      Cross-domain fusion reconciling imaging, biomarkers, ICU vitals, and symptoms
                    </p>
                  </div>
                </div>
                {latestWorkbenchInference && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F9FF] border border-[#06B6D4]/35 px-3 py-1 text-xs font-semibold text-[#00687A] font-mono tabular-nums">
                      {latestWorkbenchInference.confidence.toFixed(1)}% Confidence
                    </span>
                    <ReviewStatusTag status={latestWorkbenchInference.reviewStatus} />
                  </div>
                )}
              </div>

              {!latestWorkbenchInference ? (
                <div className="py-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <p className="text-sm text-[#3D4947]">
                    No cross-domain synthesis has been generated for this patient yet. Run Unified AI Synthesis to reconcile all 4 clinical domains.
                  </p>
                  <button
                    type="button"
                    disabled={synthesizing}
                    onClick={() => onRunWorkbenchSynthesis(selectedRecord.patient.id)}
                    className="h-10 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {synthesizing ? 'Synthesizing...' : 'Generate Unified Synthesis'}
                  </button>
                </div>
              ) : (
                <div className="space-y-5 pt-4 border-t border-slate-200/80">
                  <p className="text-sm text-[#131B2E] leading-relaxed">
                    {latestWorkbenchInference.summary}
                  </p>

                  {latestWorkbenchInference.extraData?.differentialConsiderations &&
                    latestWorkbenchInference.extraData.differentialConsiderations.length > 0 && (
                      <div className="space-y-2.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                          Preliminary Differential Considerations
                        </h3>
                        <div className="divide-y divide-slate-200/80 border border-slate-200/80 rounded-lg bg-white">
                          {latestWorkbenchInference.extraData.differentialConsiderations.map(
                            (diff, i) => (
                              <div key={i} className="p-3.5 space-y-1">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-semibold text-[#131B2E]">
                                    {diff.condition}
                                  </span>
                                  <span className="font-mono tabular-nums text-xs font-semibold text-[#00685F]">
                                    {diff.probability}% relative weight
                                  </span>
                                </div>
                                <p className="text-xs text-[#3D4947] leading-relaxed">
                                  {diff.rationale}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                        Cross-Domain Correlations & Next Steps
                      </h3>
                      <ul className="space-y-2 text-xs text-[#131B2E] leading-relaxed list-disc pl-4">
                        {(
                          latestWorkbenchInference.extraData?.crossDomainCorrelations ??
                          latestWorkbenchInference.findings
                        ).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                        {(
                          latestWorkbenchInference.extraData?.recommendedNextSteps ?? []
                        ).map((step, idx) => (
                          <li key={`step-${idx}`} className="text-[#00685F] font-medium">
                            Next step: {step}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                        Explainable AI (XAI) Attribution
                      </h3>
                      <XAIDriverList drivers={latestWorkbenchInference.xaiDrivers} />
                    </div>
                  </div>

                  <ClinicianReviewPanel
                    inference={latestWorkbenchInference}
                    defaultClinician={selectedRecord.patient.attendingPhysician}
                    onSubmitReview={onReviewInference}
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

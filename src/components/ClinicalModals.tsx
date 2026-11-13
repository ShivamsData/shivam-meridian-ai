import React, { useState } from 'react';
import {
  Cpu,
  Download,
  FileText,
  Printer,
  ShieldAlert,
  X,
} from 'lucide-react';
import type {
  ClinicalDomainSpec,
  DiagnosticModelSpec,
  PatientFullRecord,
  TriageLevel,
} from '../types/clinical.ts';
import { ReviewStatusTag, TriageStatusTag } from './ClinicalPrimitives.tsx';

export function NewPatientModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
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
  }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState(54);
  const [sex, setSex] = useState('Female');
  const [bloodType, setBloodType] = useState('O+');
  const [serviceUnit, setServiceUnit] = useState('Diagnostic Triage Unit');
  const [triageLevel, setTriageLevel] = useState<TriageLevel>('Review Needed');
  const [primaryComplaint, setPrimaryComplaint] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [allergies, setAllergies] = useState('No known drug allergies');
  const [attendingPhysician, setAttendingPhysician] = useState('Dr. Kavita Rao, MD');
  const [symptomText, setSymptomText] = useState('Dyspnea, Fatigue');
  const [symptomSeverity, setSymptomSeverity] = useState(6);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !primaryComplaint.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({
        fullName: fullName.trim(),
        age,
        sex,
        bloodType,
        serviceUnit,
        triageLevel,
        primaryComplaint: primaryComplaint.trim(),
        medicalHistory: medicalHistory.trim() || 'None reported',
        allergies: allergies.trim() || 'None reported',
        attendingPhysician: attendingPhysician.trim(),
        initialSymptoms: symptomText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        symptomSeverity,
      });
      setFullName('');
      setPrimaryComplaint('');
      setMedicalHistory('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#131B2E]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#131B2E]">
              Register New Clinical Patient Case
            </h2>
            <p className="text-xs text-[#3D4947]">
              Persists demographics, symptom baseline, and initial telemetry into SQLite
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg hover:bg-slate-100 text-[#3D4947] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Patient Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Jordan Vance"
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Age *
              </label>
              <input
                type="number"
                min={0}
                max={120}
                required
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full h-10 px-3 font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Sex
              </label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Blood Type
              </label>
              <input
                type="text"
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Initial Triage Tier
              </label>
              <select
                value={triageLevel}
                onChange={(e) => setTriageLevel(e.target.value as TriageLevel)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              >
                <option value="Critical Action">Critical Action</option>
                <option value="Review Needed">Review Needed</option>
                <option value="Observation">Observation</option>
                <option value="Stable">Stable</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Service Unit / Ward
              </label>
              <input
                type="text"
                value={serviceUnit}
                onChange={(e) => setServiceUnit(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Attending Physician
              </label>
              <input
                type="text"
                value={attendingPhysician}
                onChange={(e) => setAttendingPhysician(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3D4947] mb-1">
              Primary Presenting Complaint *
            </label>
            <textarea
              rows={2}
              required
              value={primaryComplaint}
              onChange={(e) => setPrimaryComplaint(e.target.value)}
              placeholder="Chief complaint, duration, and acute presentation..."
              className="w-full p-3 bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Initial Symptoms (comma-separated)
              </label>
              <input
                type="text"
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Symptom Severity ({symptomSeverity}/10)
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={symptomSeverity}
                onChange={(e) => setSymptomSeverity(Number(e.target.value))}
                className="w-full accent-[#0D9488] mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Medical History
              </label>
              <input
                type="text"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="Chronic conditions, prior surgeries..."
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3D4947] mb-1">
                Allergies
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg cursor-pointer"
            >
              {submitting ? 'Creating Record...' : 'Create Patient Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ClinicalReportModal({
  open,
  record,
  onClose,
}: {
  open: boolean;
  record: PatientFullRecord | null;
  onClose: () => void;
}) {
  if (!open || !record) return null;

  const latestVitals = record.vitals[record.vitals.length - 1];

  const buildMarkdownReport = () => {
    const lines = [
      `# Shivam Meridian MedAI — Clinical Decision-Support Report`,
      `**Generated:** ${new Date().toISOString()}`,
      `**Regulatory Notice:** Preliminary screening & clinical decision-support summary only. All AI outputs require licensed clinician verification.`,
      ``,
      `## Patient Profile`,
      `- **Name:** ${record.patient.fullName} (${record.patient.mrn})`,
      `- **Demographics:** ${record.patient.age} yrs · ${record.patient.sex} · Blood ${record.patient.bloodType}`,
      `- **Unit & Attending:** ${record.patient.serviceUnit} · ${record.patient.attendingPhysician}`,
      `- **Triage Priority:** ${record.patient.triageLevel}`,
      `- **Primary Complaint:** ${record.patient.primaryComplaint}`,
      `- **Medical History:** ${record.patient.medicalHistory}`,
      ``,
      `## ICU Vitals Snapshot`,
      latestVitals
        ? `- HR ${latestVitals.hr} bpm | BP ${latestVitals.sbp}/${latestVitals.dbp} mmHg | SpO2 ${latestVitals.spo2}% | RR ${latestVitals.rr}/min | Temp ${latestVitals.tempC}°C | NEWS2 ${latestVitals.news2Score} | qSOFA ${latestVitals.qsofaScore}`
        : `- No vitals recorded.`,
      ``,
      `## Laboratory Biomarkers (Recent)`,
      ...record.labs
        .slice(-10)
        .map(
          (l) =>
            `- [${l.panelCategory}] ${l.biomarkerName} (${l.biomarkerCode}): ${l.value} ${l.unit} (Ref ${l.refMin}-${l.refMax}) — **${l.flag}**`
        ),
      ``,
      `## AI Screening Inferences & Clinician Sign-Off`,
      ...record.inferences.map((inf) =>
        [
          `### [${inf.module.toUpperCase()}] ${inf.modelName} (${inf.confidence.toFixed(1)}% Confidence)`,
          `- **Review Status:** ${inf.reviewStatus}${inf.clinicianName ? ` by ${inf.clinicianName}` : ''}`,
          `- **Summary:** ${inf.summary}`,
          ...inf.findings.map((f) => `  - ${f}`),
          inf.clinicianNotes ? `- **Clinician Attestation:** ${inf.clinicianNotes}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      ),
    ];
    return lines.join('\n');
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#131B2E]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00685F]" />
            <div>
              <h2 className="text-base font-semibold text-[#131B2E]">
                Structured Clinical Decision-Support Report
              </h2>
              <p className="text-xs text-[#3D4947]">
                Exportable multi-domain audit for {record.patient.fullName} ({record.patient.mrn})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 px-3 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={() =>
                triggerDownload(
                  buildMarkdownReport(),
                  `${record.patient.mrn}_clinical_report.md`,
                  'text/markdown'
                )
              }
              className="h-9 px-3 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .MD</span>
            </button>
            <button
              type="button"
              onClick={() =>
                triggerDownload(
                  JSON.stringify(record, null, 2),
                  `${record.patient.mrn}_clinical_record.json`,
                  'application/json'
                )
              }
              className="h-9 px-3 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-[#3D4947] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-6 space-y-6 text-sm">
          <div className="p-3.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-2.5 text-xs text-[#92400E]">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>CLINICAL DECISION-SUPPORT DISCLAIMER:</strong> AI outputs included in this report are preliminary screening aids only and do not constitute an autonomous medical diagnosis. Verification by a licensed clinician is mandatory.
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#131B2E]">
                {record.patient.fullName}
              </h3>
              <p className="text-xs text-[#3D4947] font-mono tabular-nums mt-1">
                {record.patient.mrn} · {record.patient.age}y {record.patient.sex} · Blood {record.patient.bloodType} · {record.patient.serviceUnit}
              </p>
            </div>
            <TriageStatusTag level={record.patient.triageLevel} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-semibold text-[#3D4947] mb-1">Primary Complaint</div>
              <p className="text-[#131B2E]">{record.patient.primaryComplaint}</p>
            </div>
            <div>
              <div className="font-semibold text-[#3D4947] mb-1">Medical History & Allergies</div>
              <p className="text-[#131B2E]">
                {record.patient.medicalHistory} · Allergies: {record.patient.allergies}
              </p>
            </div>
          </div>

          {latestVitals && (
            <div className="border-t border-slate-200 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#3D4947] mb-2">
                Latest Bedside Vitals & Early Warning Score
              </div>
              <div className="font-mono tabular-nums text-xs text-[#131B2E] bg-[#FAF8FF] border border-slate-200 rounded-lg p-3">
                HR {latestVitals.hr} bpm · BP {latestVitals.sbp}/{latestVitals.dbp} mmHg · SpO2 {latestVitals.spo2}% · RR {latestVitals.rr}/min · Temp {latestVitals.tempC}°C · NEWS2: {latestVitals.news2Score} · qSOFA: {latestVitals.qsofaScore}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
              AI Module Findings & Clinician Attestation Log ({record.inferences.length})
            </div>
            {record.inferences.length === 0 ? (
              <p className="text-xs text-[#3D4947]">No AI module inferences recorded yet.</p>
            ) : (
              record.inferences.map((inf) => (
                <div
                  key={inf.id}
                  className="p-4 rounded-lg border border-slate-200 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-[#131B2E]">
                      [{inf.module.toUpperCase()}] {inf.modelName} ·{' '}
                      <span className="font-mono tabular-nums text-[#00685F]">
                        {inf.confidence.toFixed(1)}%
                      </span>
                    </div>
                    <ReviewStatusTag status={inf.reviewStatus} />
                  </div>
                  <p className="text-xs text-[#131B2E]">{inf.summary}</p>
                  {inf.clinicianName && (
                    <p className="text-xs text-[#3D4947] bg-[#F2F3FF] px-2.5 py-1.5 rounded">
                      Signed by <strong>{inf.clinicianName}</strong>:{' '}
                      {inf.clinicianNotes || 'Approved without additional comments.'}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModelRegistryModal({
  open,
  domains,
  models,
  onClose,
}: {
  open: boolean;
  domains: ClinicalDomainSpec[];
  models: DiagnosticModelSpec[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#131B2E]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#00685F]" />
            <div>
              <h2 className="text-base font-semibold text-[#131B2E]">
                Modular Clinical Domain & Model Registry
              </h2>
              <p className="text-xs text-[#3D4947]">
                Extensible diagnostic architecture supporting CNNs, Vision Transformers, Biomarker Ensembles, and Multimodal Fusion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-[#3D4947] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domains.map((dom) => (
              <div
                key={dom.id}
                className="p-4 rounded-lg border border-slate-200 bg-[#FAF8FF] space-y-1.5"
              >
                <div className="text-sm font-semibold text-[#131B2E]">
                  {dom.label}
                </div>
                <p className="text-xs text-[#3D4947]">{dom.subtitle}</p>
                <div className="text-[11px] font-mono text-[#00685F] pt-1">
                  Pipelines: {dom.extensiblePipelines.join(' · ')}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
              Registered Screening & Decision-Support Models ({models.length})
            </h3>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {models.map((m) => (
                <div key={m.id} className="p-4 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[#131B2E]">
                      {m.name}
                    </div>
                    <div className="text-xs font-mono text-[#00687A]">
                      {m.architecture} · v{m.version}
                    </div>
                  </div>
                  <p className="text-xs text-[#3D4947]">{m.description}</p>
                  <div className="text-[11px] text-[#3D4947] pt-0.5">
                    <span className="font-medium text-[#131B2E]">Targets:</span>{' '}
                    {m.targetDiseases.join(', ')} ·{' '}
                    <span className="font-medium text-[#131B2E]">Modalities:</span>{' '}
                    {m.supportedModalities.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

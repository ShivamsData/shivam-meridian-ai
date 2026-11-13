import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import type {
  AIInference,
  ReviewStatus,
  TriageLevel,
  XAIDriver,
} from '../types/clinical.ts';

export function TriageStatusTag({
  level,
  compact = false,
}: {
  level: TriageLevel;
  compact?: boolean;
}) {
  const config: Record<
    TriageLevel,
    { bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    'Critical Action': {
      bg: 'bg-[#FEF2F2]',
      text: 'text-[#B91C1C]',
      border: 'border-[#FECACA]',
      icon: <AlertOctagon className="w-3.5 h-3.5 shrink-0" />,
    },
    'Review Needed': {
      bg: 'bg-[#FFFBEB]',
      text: 'text-[#B45309]',
      border: 'border-[#FDE68A]',
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
    },
    Observation: {
      bg: 'bg-[#F0F9FF]',
      text: 'text-[#0284C7]',
      border: 'border-[#BAE6FD]',
      icon: <Eye className="w-3.5 h-3.5 shrink-0" />,
    },
    Stable: {
      bg: 'bg-[#F0FDF4]',
      text: 'text-[#15803D]',
      border: 'border-[#BBF7D0]',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
  };

  const c = config[level] ?? config.Observation;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap shrink-0 ${c.bg} ${c.text} ${c.border} ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      {c.icon}
      <span>{level}</span>
    </span>
  );
}

export function ReviewStatusTag({ status }: { status: ReviewStatus }) {
  const styles: Record<
    ReviewStatus,
    { bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    'Pending Clinician Review': {
      bg: 'bg-[#FFFBEB]',
      text: 'text-[#B45309]',
      border: 'border-[#FDE68A]',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
    },
    Approved: {
      bg: 'bg-[#F0FDF4]',
      text: 'text-[#15803D]',
      border: 'border-[#BBF7D0]',
      icon: <ShieldCheck className="w-3.5 h-3.5 shrink-0" />,
    },
    'Revision Requested': {
      bg: 'bg-[#F0F9FF]',
      text: 'text-[#0284C7]',
      border: 'border-[#BAE6FD]',
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
    },
    'Escalated Critical': {
      bg: 'bg-[#FEF2F2]',
      text: 'text-[#B91C1C]',
      border: 'border-[#FECACA]',
      icon: <AlertOctagon className="w-3.5 h-3.5 shrink-0" />,
    },
  };

  const s = styles[status] ?? styles['Pending Clinician Review'];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${s.bg} ${s.text} ${s.border}`}
    >
      {s.icon}
      <span>{status}</span>
    </span>
  );
}

export function XAIDriverList({ drivers }: { drivers: XAIDriver[] }) {
  if (!drivers || drivers.length === 0) {
    return (
      <p className="text-xs text-[#3D4947]">
        No feature attribution drivers recorded for this run.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {drivers.map((d, idx) => {
        const barColor =
          d.direction === 'Increases Risk'
            ? 'bg-[#0D9488]'
            : d.direction === 'Protective'
            ? 'bg-[#0284C7]'
            : 'bg-[#6D7A77]';
        const directionText =
          d.direction === 'Increases Risk'
            ? 'text-[#B45309]'
            : d.direction === 'Protective'
            ? 'text-[#15803D]'
            : 'text-[#3D4947]';

        return (
          <div key={`${d.feature}-${idx}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-[#131B2E] truncate">
                {d.feature}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] font-medium ${directionText}`}>
                  {d.direction}
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#131B2E]">
                  {Math.round(d.weight)}%
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-[#EAEDFF] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                style={{ width: `${Math.min(100, Math.max(4, d.weight))}%` }}
              />
            </div>
            <p className="text-xs text-[#3D4947] leading-relaxed">{d.rationale}</p>
          </div>
        );
      })}
    </div>
  );
}

export function ClinicianReviewPanel({
  inference,
  defaultClinician,
  onSubmitReview,
}: {
  inference: AIInference;
  defaultClinician: string;
  onSubmitReview: (
    inferenceId: string,
    payload: {
      reviewStatus: ReviewStatus;
      clinicianName: string;
      clinicianNotes: string;
    }
  ) => Promise<void>;
}) {
  const [clinicianName, setClinicianName] = useState(
    inference.clinicianName || defaultClinician || 'Dr. Kavita Rao, MD'
  );
  const [notes, setNotes] = useState(inference.clinicianNotes || '');
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async (status: ReviewStatus) => {
    if (!clinicianName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmitReview(inference.id, {
        reviewStatus: status,
        clinicianName: clinicianName.trim(),
        clinicianNotes: notes.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-4 mt-4 border-t border-slate-200/90 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[#131B2E]">
            Clinician Verification & Sign-Off
          </h4>
          <p className="text-xs text-[#3D4947]">
            Preliminary AI decision-support output requires licensed clinician attestation.
          </p>
        </div>
        <ReviewStatusTag status={inference.reviewStatus} />
      </div>

      {inference.reviewedAt && (
        <div className="text-xs text-[#3D4947] bg-[#F2F3FF] px-3 py-2 rounded-lg">
          <span className="font-medium text-[#131B2E]">
            {inference.clinicianName}
          </span>
          <span className="mx-1.5">·</span>
          <span className="font-mono tabular-nums">
            {new Date(inference.reviewedAt).toLocaleString()}
          </span>
          {inference.clinicianNotes && (
            <p className="mt-1 text-[#131B2E]">{inference.clinicianNotes}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#3D4947] mb-1">
            Attending Clinician
          </label>
          <input
            type="text"
            value={clinicianName}
            onChange={(e) => setClinicianName(e.target.value)}
            placeholder="Dr. Name, MD"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488] focus:ring-3 focus:ring-[#0D9488]/15"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-[#3D4947] mb-1">
            Clinical Attestation Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record diagnostic agreement, modifications, or next orders..."
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488] focus:ring-3 focus:ring-[#0D9488]/15"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('Approved')}
          className="h-9 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Approve Findings
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('Revision Requested')}
          className="h-9 px-4 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] hover:bg-[#F0F9FF] rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Request Revision
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleAction('Escalated Critical')}
          className="h-9 px-4 text-xs font-semibold text-[#B91C1C] bg-white border border-[#EF4444]/60 hover:bg-[#FEF2F2] rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Escalate Critical
        </button>
      </div>
    </div>
  );
}

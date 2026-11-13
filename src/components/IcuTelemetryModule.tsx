import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Pause,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import type {
  AIInference,
  PatientFullRecord,
  ReviewStatus,
} from '../types/clinical.ts';
import {
  ClinicianReviewPanel,
  ReviewStatusTag,
  TriageStatusTag,
  XAIDriverList,
} from './ClinicalPrimitives.tsx';

interface IcuTelemetryModuleProps {
  record: PatientFullRecord | null;
  onLogVitals: (
    patientId: string,
    payload: {
      hr: number;
      sbp: number;
      dbp: number;
      spo2: number;
      rr: number;
      tempC: number;
    }
  ) => Promise<void>;
  onRunIcuAI: (patientId: string) => Promise<void>;
  onReviewInference: (
    inferenceId: string,
    payload: {
      reviewStatus: ReviewStatus;
      clinicianName: string;
      clinicianNotes: string;
    }
  ) => Promise<void>;
  analyzing: boolean;
}

export function IcuTelemetryModule({
  record,
  onLogVitals,
  onRunIcuAI,
  onReviewInference,
  analyzing,
}: IcuTelemetryModuleProps) {
  const latestVitals = record?.vitals[record.vitals.length - 1];
  const [streaming, setStreaming] = useState(true);

  const [hr, setHr] = useState(latestVitals?.hr ?? 80);
  const [sbp, setSbp] = useState(latestVitals?.sbp ?? 120);
  const [dbp, setDbp] = useState(latestVitals?.dbp ?? 76);
  const [spo2, setSpo2] = useState(latestVitals?.spo2 ?? 97);
  const [rr, setRr] = useState(latestVitals?.rr ?? 16);
  const [tempC, setTempC] = useState(latestVitals?.tempC ?? 36.8);
  const [savingVitals, setSavingVitals] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);

  // Sync manual inputs when switching patients
  useEffect(() => {
    if (latestVitals) {
      setHr(latestVitals.hr);
      setSbp(latestVitals.sbp);
      setDbp(latestVitals.dbp);
      setSpo2(latestVitals.spo2);
      setRr(latestVitals.rr);
      setTempC(latestVitals.tempC);
    }
  }, [latestVitals?.id]);

  // Real-time physiological waveform canvas (ECG Lead II, SpO2 Pleth, Arterial BP)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const hrVal = latestVitals?.hr ?? 80;
    const rrVal = latestVitals?.rr ?? 16;
    const sbpVal = latestVitals?.sbp ?? 120;
    const dbpVal = latestVitals?.dbp ?? 76;

    const ecgSample = (cycle: number) => {
      // Realistic P-QRS-T synthetic morphology
      const p = 0.12 * Math.exp(-Math.pow((cycle - 0.18) / 0.04, 2));
      const q = -0.15 * Math.exp(-Math.pow((cycle - 0.34) / 0.015, 2));
      const r = 1.0 * Math.exp(-Math.pow((cycle - 0.38) / 0.014, 2));
      const s = -0.28 * Math.exp(-Math.pow((cycle - 0.42) / 0.016, 2));
      const t = 0.25 * Math.exp(-Math.pow((cycle - 0.62) / 0.06, 2));
      return p + q + r + s + t;
    };

    const plethSample = (cycle: number) => {
      const shifted = (cycle + 0.85) % 1;
      const systolic = Math.exp(-Math.pow((shifted - 0.28) / 0.11, 2));
      const dicrotic = 0.42 * Math.exp(-Math.pow((shifted - 0.55) / 0.15, 2));
      return systolic + dicrotic;
    };

    const drawFrame = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#070B14';
      ctx.fillRect(0, 0, w, h);

      // Subtle clinical oscilloscope grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      if (streaming) {
        phaseRef.current += 0.018 * (hrVal / 72);
      }
      const p = phaseRef.current;

      // Channel 1: ECG Lead II (Emerald/Teal)
      ctx.strokeStyle = '#14B8A6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x += 2) {
        const cycle = ((x / 180 + p) % 1 + 1) % 1;
        const y = 62 - ecgSample(cycle) * 38;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Channel 2: SpO2 Plethysmograph (Cyan)
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x += 2) {
        const cycle = ((x / 180 + p) % 1 + 1) % 1;
        const y = 148 - plethSample(cycle) * 34;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Channel 3: Arterial Pressure / Resp Envelope (Amber)
      const pulseAmp = Math.min(34, Math.max(12, (sbpVal - dbpVal) * 0.55));
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 0; x < w; x += 2) {
        const cycle = ((x / 180 + p) % 1 + 1) % 1;
        const respMod = Math.sin((x / 240 + p * (rrVal / hrVal)) * Math.PI * 2) * 5;
        const y = 224 - plethSample(cycle) * pulseAmp + respMod;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Channel labels inside oscilloscope
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#5EEAD4';
      ctx.fillText('II · ECG', 12, 22);
      ctx.fillStyle = '#67E8F9';
      ctx.fillText('PLETH · SpO2', 12, 106);
      ctx.fillStyle = '#FCD34D';
      ctx.fillText(`ART · ${sbpVal}/${dbpVal} mmHg`, 12, 184);

      if (streaming) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    return () => cancelAnimationFrame(rafId);
  }, [streaming, latestVitals?.hr, latestVitals?.sbp, latestVitals?.dbp, latestVitals?.rr]);

  const latestIcuInference: AIInference | undefined = useMemo(
    () => record?.inferences.find((i) => i.module === 'icu'),
    [record]
  );

  const handleLogVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    setSavingVitals(true);
    try {
      await onLogVitals(record.patient.id, { hr, sbp, dbp, spo2, rr, tempC });
    } finally {
      setSavingVitals(false);
    }
  };

  const triggerScenario = async (preset: 'deteriorate' | 'stabilize') => {
    if (!record) return;
    const payload =
      preset === 'deteriorate'
        ? { hr: 124, sbp: 88, dbp: 54, spo2: 90, rr: 26, tempC: 39.1 }
        : { hr: 74, sbp: 122, dbp: 76, spo2: 98, rr: 15, tempC: 36.8 };
    setHr(payload.hr);
    setSbp(payload.sbp);
    setDbp(payload.dbp);
    setSpo2(payload.spo2);
    setRr(payload.rr);
    setTempC(payload.tempC);
    setSavingVitals(true);
    try {
      await onLogVitals(record.patient.id, payload);
    } finally {
      setSavingVitals(false);
    }
  };

  if (!record) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-[#3D4947]">
        Select a patient to view ICU Vitals Telemetry & Early Warning Monitoring.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#131B2E]">
            ICU Vitals Telemetry & Early Warning Monitor
          </h2>
          <p className="text-xs text-[#3D4947]">
            Continuous multi-channel waveforms, deterministic NEWS2/qSOFA scoring, and 6h decompensation AI
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStreaming((s) => !s)}
            className="h-10 px-3.5 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-lg inline-flex items-center gap-2 cursor-pointer"
          >
            {streaming && (
              <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
            )}
            {streaming ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{streaming ? 'Live Telemetry' : 'Stream Paused'}</span>
          </button>

          <button
            type="button"
            disabled={analyzing}
            onClick={() => onRunIcuAI(record.patient.id)}
            className="h-10 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg inline-flex items-center gap-2 transition-all hover:shadow-[0_0_16px_rgba(6,182,212,0.35)] disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {analyzing
                ? 'Evaluating Trajectory...'
                : 'Run 6h Early Warning AI'}
            </span>
          </button>
        </div>
      </div>

      {/* Deterministic Telemetry Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'HEART RATE', value: latestVitals?.hr ?? '—', unit: 'bpm', alert: (latestVitals?.hr ?? 75) > 110 },
          { label: 'ARTERIAL BP', value: latestVitals ? `${latestVitals.sbp}/${latestVitals.dbp}` : '—', unit: 'mmHg', alert: (latestVitals?.sbp ?? 120) <= 100 },
          { label: 'SpO2 SAT', value: latestVitals?.spo2 ?? '—', unit: '%', alert: (latestVitals?.spo2 ?? 98) <= 93 },
          { label: 'RESP RATE', value: latestVitals?.rr ?? '—', unit: '/min', alert: (latestVitals?.rr ?? 16) >= 22 },
          { label: 'CORE TEMP', value: latestVitals?.tempC.toFixed(1) ?? '—', unit: '°C', alert: (latestVitals?.tempC ?? 36.8) >= 38.1 },
          { label: 'NEWS2 SCORE', value: latestVitals?.news2Score ?? '—', unit: 'pts', alert: (latestVitals?.news2Score ?? 0) >= 5 },
          { label: 'qSOFA', value: latestVitals?.qsofaScore ?? '—', unit: '/ 2', alert: (latestVitals?.qsofaScore ?? 0) >= 2 },
        ].map((metric) => (
          <div
            key={metric.label}
            className={`p-4 rounded-lg border ${
              metric.alert
                ? 'bg-[#FEF2F2] border-[#FECACA]'
                : 'bg-white border-slate-200/90'
            }`}
          >
            <div className="text-[11px] font-mono tracking-wider text-[#3D4947]">
              {metric.label}
            </div>
            <div
              className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                metric.alert ? 'text-[#B91C1C]' : 'text-[#131B2E]'
              }`}
            >
              {metric.value}
              <span className="text-xs font-normal text-[#3D4947] ml-1">
                {metric.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Split: Waveform Oscilloscope + Bedside Input/Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 bg-[#070B14] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 font-mono tabular-nums">
            <span className="inline-flex items-center gap-2 text-white font-semibold">
              <Activity className="w-4 h-4 text-[#14B8A6]" />
              <span>MULTI-CHANNEL BEDSIDE TELEMETRY</span>
            </span>
            <span>
              UNIT: {record.patient.serviceUnit} · SWEEP 25 mm/s
            </span>
          </div>
          <div className="p-3">
            <canvas
              ref={canvasRef}
              width={780}
              height={252}
              className="w-full h-auto rounded"
            />
          </div>

          {/* Historical Vitals Table */}
          <div className="border-t border-slate-800 bg-[#0B1120] p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
              Recent Persisted Telemetry Snapshots
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono tabular-nums text-xs text-slate-300">
                <thead className="text-[11px] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 pr-3">Timestamp</th>
                    <th className="py-1.5 px-2">HR</th>
                    <th className="py-1.5 px-2">BP</th>
                    <th className="py-1.5 px-2">SpO2</th>
                    <th className="py-1.5 px-2">RR</th>
                    <th className="py-1.5 px-2">Temp</th>
                    <th className="py-1.5 pl-2 text-right">NEWS2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {[...record.vitals]
                    .reverse()
                    .slice(0, 5)
                    .map((v) => (
                      <tr key={v.id}>
                        <td className="py-1.5 pr-3 text-slate-400">
                          {new Date(v.recordedAt).toLocaleString()}
                        </td>
                        <td className="py-1.5 px-2">{v.hr}</td>
                        <td className="py-1.5 px-2">
                          {v.sbp}/{v.dbp}
                        </td>
                        <td className="py-1.5 px-2">{v.spo2}%</td>
                        <td className="py-1.5 px-2">{v.rr}</td>
                        <td className="py-1.5 px-2">{v.tempC.toFixed(1)}°C</td>
                        <td
                          className={`py-1.5 pl-2 text-right font-semibold ${
                            v.news2Score >= 7
                              ? 'text-rose-400'
                              : v.news2Score >= 5
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {v.news2Score}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Right Control: Log Bedside Vitals & Early Warning Test */}
        <aside className="lg:col-span-4 bg-white border border-slate-200/90 rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-[#131B2E]">
              Record Vitals & Escalation Test
            </h3>
            <p className="text-xs text-[#3D4947]">
              Automatically computes NEWS2/qSOFA and persists clinical alerts
            </p>
          </div>

          <form onSubmit={handleLogVitals} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3D4947] mb-1">
                  HR (bpm)
                </label>
                <input
                  type="number"
                  value={hr}
                  onChange={(e) => setHr(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3D4947] mb-1">
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3D4947] mb-1">
                  Systolic BP
                </label>
                <input
                  type="number"
                  value={sbp}
                  onChange={(e) => setSbp(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3D4947] mb-1">
                  Diastolic BP
                </label>
                <input
                  type="number"
                  value={dbp}
                  onChange={(e) => setDbp(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3D4947] mb-1">
                  Resp Rate (/m)
                </label>
                <input
                  type="number"
                  value={rr}
                  onChange={(e) => setRr(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3D4947] mb-1">
                  Temp (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempC}
                  onChange={(e) => setTempC(Number(e.target.value))}
                  className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingVitals}
              className="w-full h-10 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{savingVitals ? 'Recording...' : 'Log Vitals Snapshot'}</span>
            </button>
          </form>

          <div className="pt-3 border-t border-slate-200/80 space-y-2">
            <div className="text-xs font-semibold text-[#3D4947]">
              Early-Warning Simulation Presets
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={savingVitals}
                onClick={() => triggerScenario('deteriorate')}
                className="h-9 px-2.5 text-xs font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] hover:bg-[#FEE2E2] rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Crisis</span>
              </button>
              <button
                type="button"
                disabled={savingVitals}
                onClick={() => triggerScenario('stabilize')}
                className="h-9 px-2.5 text-xs font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] hover:bg-[#DCFCE7] rounded-lg cursor-pointer"
              >
                Normalize Vitals
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ICU AI Trajectory & Clinician Sign-Off */}
      <section className="clinical-glass border border-[#0D9488]/25 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#131B2E]">
              AI Decompensation Trajectory & Escalation Guidance
            </h3>
            <p className="text-xs text-[#3D4947]">
              {latestIcuInference
                ? `Model: ${latestIcuInference.modelName}`
                : 'Run 6h Early Warning AI to model hemodynamic and sepsis risk'}
            </p>
          </div>
          {latestIcuInference && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#F0F9FF] border border-[#06B6D4]/35 px-3 py-1 text-xs font-semibold font-mono tabular-nums text-[#00687A]">
                {latestIcuInference.confidence.toFixed(1)}% Confidence
              </span>
              <TriageStatusTag level={latestIcuInference.riskCategory} compact />
              <ReviewStatusTag status={latestIcuInference.reviewStatus} />
            </div>
          )}
        </div>

        {!latestIcuInference ? (
          <div className="py-5 border-t border-slate-200/80 text-sm text-[#3D4947]">
            No ICU trajectory assessment recorded yet. Click{' '}
            <strong className="text-[#131B2E]">Run 6h Early Warning AI</strong>{' '}
            above to evaluate recent physiological trends.
          </div>
        ) : (
          <div className="space-y-5 pt-4 border-t border-slate-200/80">
            <p className="text-sm text-[#131B2E] leading-relaxed">
              {latestIcuInference.summary}
            </p>

            {latestIcuInference.extraData?.sixHourProjection && (
              <div className="p-4 rounded-lg bg-[#F0F9FF] border border-[#06B6D4]/30">
                <div className="text-xs font-semibold text-[#00687A] mb-1">
                  6-Hour Clinical Trajectory Projection
                </div>
                <p className="text-xs text-[#131B2E] leading-relaxed">
                  {latestIcuInference.extraData.sixHourProjection}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                  Escalation Checklist & Observations
                </h4>
                <ul className="space-y-2 text-xs text-[#131B2E] list-disc pl-4 leading-relaxed">
                  {(
                    latestIcuInference.extraData?.escalationChecklist ??
                    latestIcuInference.findings
                  ).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                  Physiological Risk Drivers (XAI)
                </h4>
                <XAIDriverList drivers={latestIcuInference.xaiDrivers} />
              </div>
            </div>

            <ClinicianReviewPanel
              inference={latestIcuInference}
              defaultClinician={record.patient.attendingPhysician}
              onSubmitReview={onReviewInference}
            />
          </div>
        )}
      </section>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import {
  FlaskConical,
  Microscope,
  Plus,
  Sparkles,
  Upload,
} from 'lucide-react';
import type {
  AIInference,
  DiagnosticModelSpec,
  ImagingStudy,
  LabObservation,
  PatientFullRecord,
  ReviewStatus,
} from '../types/clinical.ts';
import { resolveClinicalImageSrc } from '../assets/clinicalAssets.ts';
import {
  ClinicianReviewPanel,
  ReviewStatusTag,
  TriageStatusTag,
  XAIDriverList,
} from './ClinicalPrimitives.tsx';

interface PathologyModuleProps {
  record: PatientFullRecord | null;
  models: DiagnosticModelSpec[];
  onAddLab: (
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
  ) => Promise<void>;
  onUploadSlide: (
    patientId: string,
    payload: {
      modality: ImagingStudy['modality'];
      anatomicalRegion: string;
      title: string;
      imageUrl: string;
      imageMime: string;
      modelId: string;
    }
  ) => Promise<ImagingStudy>;
  onRunPathologyAI: (
    patientId: string,
    modelId: string,
    studyId?: string
  ) => Promise<void>;
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

const LAB_PRESETS = [
  { panelCategory: 'Oncology' as const, biomarkerName: 'Carcinoembryonic Antigen', biomarkerCode: 'CEA', unit: 'ng/mL', refMin: 0, refMax: 3.0 },
  { panelCategory: 'Oncology' as const, biomarkerName: 'CA-125', biomarkerCode: 'CA125', unit: 'U/mL', refMin: 0, refMax: 35.0 },
  { panelCategory: 'Sepsis' as const, biomarkerName: 'Serum Lactate', biomarkerCode: 'LAC', unit: 'mmol/L', refMin: 0.5, refMax: 2.0 },
  { panelCategory: 'Sepsis' as const, biomarkerName: 'Procalcitonin', biomarkerCode: 'PCT', unit: 'ng/mL', refMin: 0, refMax: 0.5 },
  { panelCategory: 'Cardiac' as const, biomarkerName: 'NT-proBNP', biomarkerCode: 'NTBNP', unit: 'pg/mL', refMin: 0, refMax: 300.0 },
  { panelCategory: 'Hematology' as const, biomarkerName: 'White Blood Cell Count', biomarkerCode: 'WBC', unit: '10^9/L', refMin: 4.0, refMax: 11.0 },
];

export function PathologyModule({
  record,
  models,
  onAddLab,
  onUploadSlide,
  onRunPathologyAI,
  onReviewInference,
  analyzing,
}: PathologyModuleProps) {
  const [panelFilter, setPanelFilter] = useState<
    'All' | LabObservation['panelCategory']
  >('All');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [hoverPointIdx, setHoverPointIdx] = useState<number | null>(null);
  const [showLabForm, setShowLabForm] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('path-oncology-ensemble-v2');

  // Lab form state
  const [presetIdx, setPresetIdx] = useState(0);
  const [labValue, setLabValue] = useState('12.4');
  const [savingLab, setSavingLab] = useState(false);

  const pathologyModels = useMemo(
    () => models.filter((m) => m.domain === 'pathology'),
    [models]
  );

  const histoSlides = useMemo(
    () =>
      record?.imaging.filter((i) => i.modality === 'Histopathology') ?? [],
    [record]
  );

  const filteredLabs = useMemo(() => {
    if (!record) return [];
    const list =
      panelFilter === 'All'
        ? record.labs
        : record.labs.filter((l) => l.panelCategory === panelFilter);
    return [...list].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
    );
  }, [record, panelFilter]);

  const distinctBiomarkerCodes = useMemo(() => {
    if (!record) return [];
    return Array.from(new Set(record.labs.map((l) => l.biomarkerCode)));
  }, [record]);

  const activeTrendCode =
    selectedCode && distinctBiomarkerCodes.includes(selectedCode)
      ? selectedCode
      : distinctBiomarkerCodes[0] ?? '';

  const trendSeries = useMemo(() => {
    if (!record || !activeTrendCode) return [];
    return record.labs
      .filter((l) => l.biomarkerCode === activeTrendCode)
      .sort(
        (a, b) =>
          new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
      );
  }, [record, activeTrendCode]);

  const latestPathologyInference: AIInference | undefined = useMemo(
    () => record?.inferences.find((i) => i.module === 'pathology'),
    [record]
  );

  const handleLabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    const preset = LAB_PRESETS[presetIdx];
    const numVal = Number(labValue);
    if (Number.isNaN(numVal)) return;
    setSavingLab(true);
    try {
      await onAddLab(record.patient.id, {
        ...preset,
        value: numVal,
      });
      setSelectedCode(preset.biomarkerCode);
      setShowLabForm(false);
    } finally {
      setSavingLab(false);
    }
  };

  const handleSlideUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !record) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await onUploadSlide(record.patient.id, {
          modality: 'Histopathology',
          anatomicalRegion: 'Biopsy Whole-Slide Field',
          title: file.name.replace(/\.[^.]+$/, ''),
          imageUrl: reader.result,
          imageMime: file.type || 'image/jpeg',
          modelId: 'path-histo-vit-v1',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  if (!record) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-[#3D4947]">
        Select a patient to inspect Pathology & Laboratory Biomarker Analysis.
      </div>
    );
  }

  // SVG Chart geometry
  const chartW = 560;
  const chartH = 210;
  const padL = 44;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const refMax = trendSeries[0]?.refMax ?? 10;
  const refMin = trendSeries[0]?.refMin ?? 0;
  const maxVal = Math.max(
    refMax * 1.25,
    ...trendSeries.map((p) => p.value * 1.15),
    1
  );
  const minVal = Math.min(0, refMin);

  const toX = (idx: number, total: number) =>
    total <= 1 ? padL + plotW / 2 : padL + (idx / (total - 1)) * plotW;
  const toY = (val: number) =>
    padT + plotH - ((val - minVal) / Math.max(0.0001, maxVal - minVal)) * plotH;

  const polylinePts = trendSeries
    .map((pt, i) => `${toX(i, trendSeries.length)},${toY(pt.value)}`)
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#131B2E]">
            Pathology, Oncology & Biomarker Screening
          </h2>
          <p className="text-xs text-[#3D4947]">
            Longitudinal assay matrix, reference bounds, and H&E cellular morphology AI
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="h-10 px-3 text-xs font-medium bg-white border border-slate-300 rounded-lg"
          >
            {pathologyModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowLabForm((v) => !v)}
            className="h-10 px-3.5 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showLabForm ? 'Cancel' : 'Log Lab Assay'}</span>
          </button>

          <button
            type="button"
            disabled={analyzing}
            onClick={() =>
              onRunPathologyAI(
                record.patient.id,
                selectedModelId,
                histoSlides[0]?.id
              )
            }
            className="h-10 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg inline-flex items-center gap-2 transition-all hover:shadow-[0_0_16px_rgba(6,182,212,0.35)] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {analyzing
                ? 'Analyzing Biomarkers...'
                : 'Run Biomarker & Pathology AI'}
            </span>
          </button>
        </div>
      </div>

      {/* Inline Log Lab Assay Form */}
      {showLabForm && (
        <form
          onSubmit={handleLabSubmit}
          className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[#3D4947] mb-1">
              Biomarker Panel Assay
            </label>
            <select
              value={presetIdx}
              onChange={(e) => setPresetIdx(Number(e.target.value))}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
            >
              {LAB_PRESETS.map((p, idx) => (
                <option key={p.biomarkerCode} value={idx}>
                  [{p.panelCategory}] {p.biomarkerName} ({p.biomarkerCode}) — Ref{' '}
                  {p.refMin}–{p.refMax} {p.unit}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#3D4947] mb-1">
              Measured Value ({LAB_PRESETS[presetIdx].unit})
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={labValue}
              onChange={(e) => setLabValue(e.target.value)}
              className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={savingLab}
            className="h-10 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg cursor-pointer"
          >
            {savingLab ? 'Recording...' : 'Save Lab Observation'}
          </button>
        </form>
      )}

      {/* Main Split: Biomarker Matrix + Trend & Histopathology */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Sticky-Header Biomarker Matrix */}
        <section className="xl:col-span-7 bg-white border border-slate-200/90 rounded-lg overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#00685F]" />
              <h3 className="text-base font-semibold text-[#131B2E]">
                Laboratory Biomarker Matrix
              </h3>
            </div>

            <div className="flex flex-wrap gap-1 p-1 bg-[#F2F3FF] rounded-lg">
              {(
                ['All', 'Oncology', 'Sepsis', 'Cardiac', 'Hematology', 'Metabolic'] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPanelFilter(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    panelFilter === cat
                      ? 'bg-white text-[#131B2E] shadow-xs'
                      : 'text-[#3D4947] hover:text-[#131B2E]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#FAF8FF] border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-[#3D4947]">
                <tr>
                  <th className="py-3 px-4">Biomarker</th>
                  <th className="py-3 px-3">Panel</th>
                  <th className="py-3 px-3 text-right">Value</th>
                  <th className="py-3 px-3">Reference Range</th>
                  <th className="py-3 px-3">Flag</th>
                  <th className="py-3 px-4 text-right">Measured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {filteredLabs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#3D4947]">
                      No laboratory observations recorded in this category.
                    </td>
                  </tr>
                ) : (
                  filteredLabs.map((obs, idx) => {
                    const ratio = Math.min(
                      100,
                      Math.max(
                        4,
                        ((obs.value - obs.refMin) /
                          Math.max(0.01, obs.refMax * 1.6 - obs.refMin)) *
                          100
                      )
                    );
                    const flagStyle =
                      obs.flag === 'Critical High'
                        ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                        : obs.flag === 'Elevated' || obs.flag === 'Low'
                        ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                        : 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]';

                    return (
                      <tr
                        key={obs.id}
                        onClick={() => setSelectedCode(obs.biomarkerCode)}
                        className={`h-12 cursor-pointer transition-colors ${
                          activeTrendCode === obs.biomarkerCode
                            ? 'bg-[#F0F9FF]'
                            : idx % 2 === 1
                            ? 'bg-[#FAF8FF]/60 hover:bg-[#F0F9FF]/60'
                            : 'bg-white hover:bg-[#F0F9FF]/60'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-[#131B2E]">
                            {obs.biomarkerName}
                          </div>
                          <div className="font-mono text-[11px] text-[#3D4947]">
                            {obs.biomarkerCode}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[#3D4947]">
                          {obs.panelCategory}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-[#131B2E]">
                          {obs.value}{' '}
                          <span className="text-[11px] font-normal text-[#3D4947]">
                            {obs.unit}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 min-w-[140px]">
                          <div className="flex justify-between text-[10px] font-mono tabular-nums text-[#3D4947] mb-1">
                            <span>{obs.refMin}</span>
                            <span>{obs.refMax}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#EAEDFF] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                obs.flag === 'Normal'
                                  ? 'bg-[#0D9488]'
                                  : obs.flag === 'Critical High'
                                  ? 'bg-[#EF4444]'
                                  : 'bg-[#F59E0B]'
                              }`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${flagStyle}`}
                          >
                            {obs.flag}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#3D4947]">
                          {new Date(obs.measuredAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Column: Longitudinal Trend Chart & Histopathology Slide */}
        <div className="xl:col-span-5 space-y-6">
          {/* Interactive Longitudinal Biomarker SVG Chart */}
          <section className="bg-white border border-slate-200/90 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#131B2E]">
                  Longitudinal Trend: {activeTrendCode || 'Select Biomarker'}
                </h3>
                <p className="text-xs text-[#3D4947]">
                  Shaded band indicates reference normal bounds
                </p>
              </div>
              <select
                value={activeTrendCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="h-8 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
              >
                {distinctBiomarkerCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {trendSeries.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#3D4947]">
                Select or log a biomarker assay to plot longitudinal velocity.
              </div>
            ) : (
              <div className="relative">
                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="w-full h-auto overflow-visible"
                >
                  {/* Reference Safe Band */}
                  <rect
                    x={padL}
                    y={toY(refMax)}
                    width={plotW}
                    height={Math.max(2, toY(refMin) - toY(refMax))}
                    fill="rgba(13, 148, 136, 0.08)"
                  />
                  <line
                    x1={padL}
                    x2={padL + plotW}
                    y1={toY(refMax)}
                    y2={toY(refMax)}
                    stroke="#0D9488"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />

                  {/* Axis Grid */}
                  <line
                    x1={padL}
                    x2={padL}
                    y1={padT}
                    y2={padT + plotH}
                    stroke="#CBD5E1"
                    strokeWidth="1"
                  />
                  <line
                    x1={padL}
                    x2={padL + plotW}
                    y1={padT + plotH}
                    y2={padT + plotH}
                    stroke="#CBD5E1"
                    strokeWidth="1"
                  />

                  {/* Y-axis ticks */}
                  <text
                    x={padL - 6}
                    y={padT + 4}
                    textAnchor="end"
                    className="fill-[#3D4947] text-[10px] font-mono"
                  >
                    {maxVal.toFixed(1)}
                  </text>
                  <text
                    x={padL - 6}
                    y={toY(refMax) + 3}
                    textAnchor="end"
                    className="fill-[#00685F] text-[10px] font-mono"
                  >
                    ULN {refMax}
                  </text>
                  <text
                    x={padL - 6}
                    y={padT + plotH}
                    textAnchor="end"
                    className="fill-[#3D4947] text-[10px] font-mono"
                  >
                    {minVal}
                  </text>

                  {/* Polyline */}
                  {trendSeries.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#00687A"
                      strokeWidth="2.5"
                      points={polylinePts}
                    />
                  )}

                  {/* Data Nodes */}
                  {trendSeries.map((pt, i) => {
                    const cx = toX(i, trendSeries.length);
                    const cy = toY(pt.value);
                    const isAbnormal = pt.flag !== 'Normal';
                    return (
                      <g
                        key={pt.id}
                        onMouseEnter={() => setHoverPointIdx(i)}
                        onMouseLeave={() => setHoverPointIdx(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={hoverPointIdx === i ? 6 : 4.5}
                          fill={isAbnormal ? '#F59E0B' : '#0D9488'}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        <text
                          x={cx}
                          y={padT + plotH + 16}
                          textAnchor="middle"
                          className="fill-[#3D4947] text-[9px] font-mono"
                        >
                          {new Date(pt.measuredAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {hoverPointIdx !== null && trendSeries[hoverPointIdx] && (
                  <div className="mt-2 px-3 py-1.5 rounded bg-[#131B2E] text-white text-xs font-mono tabular-nums flex items-center justify-between">
                    <span>
                      {trendSeries[hoverPointIdx].biomarkerCode}:{' '}
                      {trendSeries[hoverPointIdx].value}{' '}
                      {trendSeries[hoverPointIdx].unit}
                    </span>
                    <span>
                      {trendSeries[hoverPointIdx].flag} ·{' '}
                      {new Date(
                        trendSeries[hoverPointIdx].measuredAt
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Histopathology Slide Inspection */}
          <section className="bg-white border border-slate-200/90 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Microscope className="w-4 h-4 text-[#00685F]" />
                <h3 className="text-sm font-semibold text-[#131B2E]">
                  Histopathology Microscopy Field
                </h3>
              </div>
              <label className="h-8 px-3 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-md inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload H&E Slide</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSlideUpload}
                  className="hidden"
                />
              </label>
            </div>

            {histoSlides.length === 0 ? (
              <p className="text-xs text-[#3D4947] py-4">
                No biopsy whole-slide microscopy attached for this patient. Upload an H&E slide to pair morphology with serum biomarkers.
              </p>
            ) : (
              <div className="space-y-2">
                <img
                  src={resolveClinicalImageSrc(histoSlides[0].imageUrl)}
                  alt={histoSlides[0].title}
                  referrerPolicy="no-referrer"
                  className="w-full h-48 object-cover rounded-md border border-slate-200"
                />
                <div className="flex items-center justify-between text-xs text-[#3D4947]">
                  <span className="font-medium text-[#131B2E]">
                    {histoSlides[0].title}
                  </span>
                  <span className="font-mono">{histoSlides[0].studyDate}</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Pathology AI Output & Clinician Verification */}
      <section className="clinical-glass border border-[#0D9488]/25 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#131B2E]">
              Preliminary Pathology & Biomarker AI Screening
            </h3>
            <p className="text-xs text-[#3D4947]">
              {latestPathologyInference
                ? `Pipeline: ${latestPathologyInference.modelName}`
                : 'Run Biomarker & Pathology AI to synthesize longitudinal assay velocity and morphology'}
            </p>
          </div>
          {latestPathologyInference && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#F0F9FF] border border-[#06B6D4]/35 px-3 py-1 text-xs font-semibold font-mono tabular-nums text-[#00687A]">
                {latestPathologyInference.confidence.toFixed(1)}% Confidence
              </span>
              <TriageStatusTag
                level={latestPathologyInference.riskCategory}
                compact
              />
              <ReviewStatusTag status={latestPathologyInference.reviewStatus} />
            </div>
          )}
        </div>

        {!latestPathologyInference ? (
          <div className="py-5 border-t border-slate-200/80 text-sm text-[#3D4947]">
            No pathology inference generated yet for this patient. Click{' '}
            <strong className="text-[#131B2E]">Run Biomarker & Pathology AI</strong>{' '}
            above to evaluate cancer markers, sepsis panels, and biopsy morphology.
          </div>
        ) : (
          <div className="space-y-5 pt-4 border-t border-slate-200/80">
            <p className="text-sm text-[#131B2E] leading-relaxed">
              {latestPathologyInference.summary}
            </p>

            {latestPathologyInference.extraData?.screeningPanels &&
              latestPathologyInference.extraData.screeningPanels.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {latestPathologyInference.extraData.screeningPanels.map(
                    (sp, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-lg bg-white border border-slate-200/80 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-[#131B2E]">{sp.panel}</span>
                          <span className="text-[#00685F]">{sp.status}</span>
                        </div>
                        <p className="text-xs text-[#3D4947]">{sp.signal}</p>
                      </div>
                    )
                  )}
                </div>
              )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                  Screening Observations
                </h4>
                <ul className="space-y-2 text-xs text-[#131B2E] list-disc pl-4 leading-relaxed">
                  {latestPathologyInference.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                  Biomarker & Morphology Attribution (XAI)
                </h4>
                <XAIDriverList drivers={latestPathologyInference.xaiDrivers} />
              </div>
            </div>

            <ClinicianReviewPanel
              inference={latestPathologyInference}
              defaultClinician={record.patient.attendingPhysician}
              onSubmitReview={onReviewInference}
            />
          </div>
        )}
      </section>
    </div>
  );
}

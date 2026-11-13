import React, { useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Eye,
  Layers,
  RotateCcw,
  Scan,
  Sparkles,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  AIInference,
  DiagnosticModelSpec,
  ImagingStudy,
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

interface RadiologyModuleProps {
  record: PatientFullRecord | null;
  models: DiagnosticModelSpec[];
  onUploadImaging: (
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
  onRunImagingAI: (
    patientId: string,
    studyId: string,
    modelId: string
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

export function RadiologyModule({
  record,
  models,
  onUploadImaging,
  onRunImagingAI,
  onReviewInference,
  analyzing,
}: RadiologyModuleProps) {
  const radiologyStudies = useMemo(
    () =>
      record?.imaging.filter((i) => i.modality !== 'Histopathology') ?? [],
    [record]
  );

  const radiologyModels = useMemo(
    () => models.filter((m) => m.domain === 'radiology'),
    [models]
  );

  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const activeStudy = useMemo(
    () =>
      radiologyStudies.find((s) => s.id === selectedStudyId) ??
      radiologyStudies[0] ??
      null,
    [radiologyStudies, selectedStudyId]
  );

  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const activeModelId =
    selectedModelId || activeStudy?.modelId || radiologyModels[0]?.id || 'rad-thorax-cnn-v2';

  // Viewer calibration states
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(110);
  const [zoom, setZoom] = useState(1);
  const [showRoiBoxes, setShowRoiBoxes] = useState(true);
  const [showGradCam, setShowGradCam] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(55);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(
    null
  );

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadModality, setUploadModality] =
    useState<ImagingStudy['modality']>('CT');
  const [uploadRegion, setUploadRegion] = useState('Thorax · Axial');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDataUrl, setUploadDataUrl] = useState('');
  const [uploadMime, setUploadMime] = useState('image/jpeg');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeInference: AIInference | undefined = useMemo(() => {
    if (!record || !activeStudy) return undefined;
    return record.inferences.find(
      (inf) => inf.module === 'radiology' && inf.targetId === activeStudy.id
    );
  }, [record, activeStudy]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMime(file.type || 'image/jpeg');
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !uploadDataUrl || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const created = await onUploadImaging(record.patient.id, {
        modality: uploadModality,
        anatomicalRegion: uploadRegion,
        title: uploadTitle.trim(),
        imageUrl: uploadDataUrl,
        imageMime: uploadMime,
        modelId: activeModelId,
      });
      setSelectedStudyId(created.id);
      setUploadDataUrl('');
      setUploadTitle('');
      setShowUpload(false);
    } finally {
      setUploading(false);
    }
  };

  const resetCalibration = () => {
    setBrightness(100);
    setContrast(110);
    setZoom(1);
    setHeatmapOpacity(55);
  };

  if (!record) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-[#3D4947]">
        Select a patient to open the Radiology & Medical Imaging AI workstation.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control & Calibration Column */}
        <aside className="lg:col-span-4 bg-white border border-slate-200/90 rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#131B2E]">
                Imaging Studies & Pipelines
              </h2>
              <p className="text-xs text-[#3D4947]">
                Select scan, calibration, and vision architecture
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUpload((v) => !v)}
              className="h-9 px-3 text-xs font-semibold text-[#131B2E] bg-white border border-slate-300 hover:border-[#0D9488] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{showUpload ? 'Close' : 'Upload Scan'}</span>
            </button>
          </div>

          {showUpload && (
            <form
              onSubmit={handleUploadSubmit}
              className="p-4 rounded-lg bg-[#FAF8FF] border border-slate-200 space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[#3D4947] mb-1">
                    Modality
                  </label>
                  <select
                    value={uploadModality}
                    onChange={(e) =>
                      setUploadModality(e.target.value as ImagingStudy['modality'])
                    }
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="CT">CT</option>
                    <option value="X-Ray">X-Ray</option>
                    <option value="MRI">MRI</option>
                    <option value="Ultrasound">Ultrasound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3D4947] mb-1">
                    Anatomical Region
                  </label>
                  <input
                    type="text"
                    value={uploadRegion}
                    onChange={(e) => setUploadRegion(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3D4947] mb-1">
                  Study Title
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Axial Chest CT Follow-up"
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3D4947] mb-1">
                  Medical Image File (PNG, JPEG, WebP)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-[#3D4947] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-[#131B2E] hover:file:border-[#0D9488]"
                />
              </div>

              <button
                type="submit"
                disabled={uploading || !uploadDataUrl}
                className="w-full h-9 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg disabled:opacity-50 cursor-pointer"
              >
                {uploading ? 'Storing Study...' : 'Save Medical Image to Record'}
              </button>
            </form>
          )}

          {/* Study Selector */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#3D4947]">
              Available Patient Scans ({radiologyStudies.length})
            </div>
            {radiologyStudies.length === 0 ? (
              <div className="p-4 text-xs text-[#3D4947] bg-[#FAF8FF] border border-slate-200 rounded-lg">
                No radiology scans stored for this patient yet. Use Upload Scan above.
              </div>
            ) : (
              <div className="divide-y divide-slate-200/80 border border-slate-200/80 rounded-lg overflow-hidden">
                {radiologyStudies.map((study) => {
                  const isCurrent = activeStudy?.id === study.id;
                  return (
                    <button
                      key={study.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudyId(study.id);
                        setSelectedModelId(study.modelId);
                      }}
                      className={`w-full text-left p-3 transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#F0F9FF]'
                          : 'bg-white hover:bg-[#FAF8FF]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#131B2E] truncate">
                          {study.title}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] font-semibold text-[#00685F] shrink-0">
                          {study.modality}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#3D4947] mt-0.5">
                        {study.anatomicalRegion} · {study.studyDate}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Model Architecture Selector */}
          <div className="space-y-2 pt-3 border-t border-slate-200/80">
            <label className="block text-xs font-semibold text-[#3D4947]">
              Screening Model Architecture
            </label>
            <select
              value={activeModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="w-full h-10 px-3 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0D9488]"
            >
              {radiologyModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.architecture})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#3D4947] leading-relaxed">
              {
                radiologyModels.find((m) => m.id === activeModelId)
                  ?.description
              }
            </p>
          </div>

          {/* Window/Level & XAI Overlay Calibration */}
          <div className="space-y-3 pt-3 border-t border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3D4947]">
                Viewport & XAI Calibration
              </span>
              <button
                type="button"
                onClick={resetCalibration}
                className="text-[11px] font-medium text-[#00685F] hover:text-[#0D9488] inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-mono tabular-nums">
                <span className="text-[#3D4947]">Window Brightness</span>
                <span className="text-[#131B2E]">{brightness}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={160}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-[#0D9488]"
              />

              <div className="flex justify-between font-mono tabular-nums">
                <span className="text-[#3D4947]">Window Contrast</span>
                <span className="text-[#131B2E]">{contrast}%</span>
              </div>
              <input
                type="range"
                min={60}
                max={180}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full accent-[#0D9488]"
              />

              <div className="flex justify-between font-mono tabular-nums">
                <span className="text-[#3D4947]">Grad-CAM Saliency Opacity</span>
                <span className="text-[#131B2E]">{heatmapOpacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                value={heatmapOpacity}
                onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                className="w-full accent-[#06B6D4]"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRoiBoxes((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border inline-flex items-center gap-1.5 cursor-pointer ${
                  showRoiBoxes
                    ? 'bg-[#F0F9FF] text-[#00687A] border-[#06B6D4]/50'
                    : 'bg-white text-[#3D4947] border-slate-300'
                }`}
              >
                <Scan className="w-3.5 h-3.5" />
                <span>ROI Segmentation</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGradCam((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border inline-flex items-center gap-1.5 cursor-pointer ${
                  showGradCam
                    ? 'bg-[#F0F9FF] text-[#00687A] border-[#06B6D4]/50'
                    : 'bg-white text-[#3D4947] border-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Grad-CAM Saliency</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={!activeStudy || analyzing}
            onClick={() =>
              activeStudy &&
              onRunImagingAI(record.patient.id, activeStudy.id, activeModelId)
            }
            className="w-full h-10 px-4 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#00685F] rounded-lg inline-flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_16px_rgba(6,182,212,0.35)] disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {analyzing
                ? 'Running Multimodal Vision AI...'
                : 'Run AI Segmentation & Screening'}
            </span>
          </button>
        </aside>

        {/* Center Main DICOM-Style Viewport & Explainability Results */}
        <div className="lg:col-span-8 space-y-6">
          {/* Interactive Viewport Stage */}
          <section className="bg-[#0B1120] border border-slate-800 rounded-lg overflow-hidden">
            {/* Viewport Top HUD */}
            <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-3 font-mono tabular-nums">
                <span className="text-white font-semibold">
                  {activeStudy ? activeStudy.title : 'No Study Loaded'}
                </span>
                {activeStudy && (
                  <>
                    <span className="text-slate-500">|</span>
                    <span>{activeStudy.modality}</span>
                    <span className="text-slate-500">|</span>
                    <span>{activeStudy.studyDate}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 font-mono tabular-nums">
                {crosshair && (
                  <span className="inline-flex items-center gap-1 text-[#4CD7F6] mr-2">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>
                      X:{crosshair.x.toFixed(1)}% Y:{crosshair.y.toFixed(1)}%
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
                  aria-label="Zoom out"
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
                  aria-label="Zoom in"
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Canvas Stage */}
            <div className="relative min-h-[420px] flex items-center justify-center overflow-hidden p-4 bg-[#070B14]">
              {!activeStudy ? (
                <div className="text-center space-y-3 text-slate-400 py-16">
                  <Eye className="w-8 h-8 mx-auto text-slate-500" />
                  <p className="text-sm">
                    Upload a medical scan to inspect segmentation overlays.
                  </p>
                </div>
              ) : (
                <div
                  className="relative inline-block max-w-full transition-transform duration-150 cursor-crosshair select-none"
                  style={{ transform: `scale(${zoom})` }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setCrosshair({
                      x: Math.max(0, Math.min(100, x)),
                      y: Math.max(0, Math.min(100, y)),
                    });
                  }}
                  onMouseLeave={() => setCrosshair(null)}
                >
                  <img
                    src={resolveClinicalImageSrc(activeStudy.imageUrl)}
                    alt={activeStudy.title}
                    referrerPolicy="no-referrer"
                    className="max-h-[460px] w-auto object-contain rounded"
                    style={{
                      filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                    }}
                  />

                  {/* Grad-CAM Radial Saliency Heatmap Layer */}
                  {showGradCam &&
                    activeInference?.roiBoxes.map((roi, idx) => (
                      <div
                        key={`heat-${idx}`}
                        className="pointer-events-none absolute rounded-full"
                        style={{
                          left: `${roi.x - roi.width * 0.35}%`,
                          top: `${roi.y - roi.height * 0.35}%`,
                          width: `${roi.width * 1.7}%`,
                          height: `${roi.height * 1.7}%`,
                          opacity: (heatmapOpacity / 100) * roi.heatmapIntensity,
                          background:
                            roi.severity === 'High'
                              ? 'radial-gradient(circle, rgba(239,68,68,0.85) 0%, rgba(245,158,11,0.55) 45%, rgba(6,182,212,0.18) 75%, transparent 100%)'
                              : 'radial-gradient(circle, rgba(6,182,212,0.8) 0%, rgba(13,148,136,0.4) 55%, transparent 100%)',
                          mixBlendMode: 'screen',
                        }}
                      />
                    ))}

                  {/* Segmentation ROI Bounding Layer */}
                  {showRoiBoxes &&
                    activeInference?.roiBoxes.map((roi, idx) => (
                      <div
                        key={`roi-${idx}`}
                        className="pointer-events-none absolute border-2 border-[#4CD7F6] rounded-sm"
                        style={{
                          left: `${roi.x}%`,
                          top: `${roi.y}%`,
                          width: `${roi.width}%`,
                          height: `${roi.height}%`,
                          boxShadow: '0 0 12px rgba(6, 182, 212, 0.45)',
                        }}
                      >
                        <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-[#0B1120]/90 border border-[#4CD7F6]/60 text-[10px] font-mono tabular-nums text-[#ACEDFF] whitespace-nowrap">
                          {roi.label} · {roi.confidence.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>

          {/* AI Imaging Findings & Clinician Review */}
          <section className="clinical-glass border border-[#0D9488]/25 rounded-lg p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#131B2E]">
                  Preliminary Imaging AI Screening & Explainability
                </h2>
                <p className="text-xs text-[#3D4947]">
                  {activeInference
                    ? `Model: ${activeInference.modelName}`
                    : 'Run AI Segmentation & Screening to localize ROIs and attribution drivers'}
                </p>
              </div>
              {activeInference && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#F0F9FF] border border-[#06B6D4]/35 px-3 py-1 text-xs font-semibold font-mono tabular-nums text-[#00687A]">
                    {activeInference.confidence.toFixed(1)}% Confidence
                  </span>
                  <TriageStatusTag level={activeInference.riskCategory} compact />
                  <ReviewStatusTag status={activeInference.reviewStatus} />
                </div>
              )}
            </div>

            {!activeInference ? (
              <div className="py-6 border-t border-slate-200/80 text-sm text-[#3D4947]">
                No AI vision analysis has been saved for the selected scan yet. Click{' '}
                <strong className="text-[#131B2E]">
                  Run AI Segmentation & Screening
                </strong>{' '}
                to generate localized ROI contours and Grad-CAM attribution.
              </div>
            ) : (
              <div className="space-y-5 pt-4 border-t border-slate-200/80">
                <p className="text-sm text-[#131B2E] leading-relaxed">
                  {activeInference.summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                      Localized Observations
                    </h3>
                    <ul className="space-y-2 text-xs text-[#131B2E] list-disc pl-4 leading-relaxed">
                      {activeInference.findings.map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3D4947]">
                      XAI Spatial & Visual Drivers
                    </h3>
                    <XAIDriverList drivers={activeInference.xaiDrivers} />
                  </div>
                </div>

                <ClinicianReviewPanel
                  inference={activeInference}
                  defaultClinician={record.patient.attendingPhysician}
                  onSubmitReview={onReviewInference}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

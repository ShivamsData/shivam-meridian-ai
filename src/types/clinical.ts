export type TriageLevel =
  | 'Critical Action'
  | 'Review Needed'
  | 'Observation'
  | 'Stable';

export type ModuleId =
  | 'workbench'
  | 'radiology'
  | 'pathology'
  | 'icu';

export type ReviewStatus =
  | 'Pending Clinician Review'
  | 'Approved'
  | 'Revision Requested'
  | 'Escalated Critical';

export interface Patient {
  id: string;
  mrn: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface SymptomAssessment {
  id: string;
  patientId: string;
  onsetDays: number;
  severityScore: number;
  symptoms: string[];
  clinicalNotes: string;
  recordedBy: string;
  createdAt: string;
}

export interface ImagingROI {
  label: string;
  x: number; // 0-100 percentage from left
  y: number; // 0-100 percentage from top
  width: number; // 0-100 percentage
  height: number; // 0-100 percentage
  confidence: number;
  heatmapIntensity: number; // 0-1
  severity: 'High' | 'Moderate' | 'Low';
}

export interface ImagingStudy {
  id: string;
  patientId: string;
  modality: 'X-Ray' | 'MRI' | 'CT' | 'Histopathology' | 'Ultrasound';
  anatomicalRegion: string;
  title: string;
  imageUrl: string;
  imageMime: string;
  modelId: string;
  studyDate: string;
  createdAt: string;
}

export interface LabObservation {
  id: string;
  patientId: string;
  panelCategory: 'Oncology' | 'Hematology' | 'Metabolic' | 'Cardiac' | 'Sepsis';
  biomarkerName: string;
  biomarkerCode: string;
  value: number;
  unit: string;
  refMin: number;
  refMax: number;
  flag: 'Normal' | 'Elevated' | 'Critical High' | 'Low';
  measuredAt: string;
}

export interface VitalsPoint {
  id: string;
  patientId: string;
  hr: number;
  sbp: number;
  dbp: number;
  spo2: number;
  rr: number;
  tempC: number;
  news2Score: number;
  qsofaScore: number;
  recordedAt: string;
}

export interface ClinicalAlert {
  id: string;
  patientId: string;
  patientName?: string;
  mrn?: string;
  module: ModuleId;
  severity: TriageLevel;
  title: string;
  detail: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  createdAt: string;
}

export interface XAIDriver {
  feature: string;
  weight: number; // 0-100 contribution
  direction: 'Increases Risk' | 'Protective' | 'Neutral';
  rationale: string;
}

export interface AIInference {
  id: string;
  patientId: string;
  module: ModuleId;
  targetId: string | null;
  modelId: string;
  modelName: string;
  confidence: number;
  riskCategory: TriageLevel;
  summary: string;
  findings: string[];
  xaiDrivers: XAIDriver[];
  roiBoxes: ImagingROI[];
  extraData?: {
    differentialConsiderations?: Array<{ condition: string; probability: number; rationale: string }>;
    crossDomainCorrelations?: string[];
    recommendedNextSteps?: string[];
    sixHourProjection?: string;
    escalationChecklist?: string[];
    screeningPanels?: Array<{ panel: string; signal: string; status: string }>;
  };
  reviewStatus: ReviewStatus;
  clinicianName: string | null;
  clinicianNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface DiagnosticModelSpec {
  id: string;
  name: string;
  domain: ModuleId;
  architecture:
    | 'CNN Lesion Classifier'
    | 'Vision Transformer Segmentation'
    | 'Multimodal Fusion Engine'
    | 'Biomarker Ensemble'
    | 'Time-Series Early Warning';
  supportedModalities: string[];
  targetDiseases: string[];
  version: string;
  description: string;
}

export interface ClinicalDomainSpec {
  id: ModuleId;
  label: string;
  shortLabel: string;
  subtitle: string;
  extensiblePipelines: string[];
}

export interface PatientFullRecord {
  patient: Patient;
  symptoms: SymptomAssessment[];
  imaging: ImagingStudy[];
  labs: LabObservation[];
  vitals: VitalsPoint[];
  alerts: ClinicalAlert[];
  inferences: AIInference[];
}

export interface BootstrapPayload {
  patients: Patient[];
  alerts: ClinicalAlert[];
  models: DiagnosticModelSpec[];
  domains: ClinicalDomainSpec[];
  selectedPatient: PatientFullRecord | null;
}

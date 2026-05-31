// ─── Auth ──────────────────────────────────────────────────────────────────────
export interface Doctor {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'superadmin' | 'admin' | 'doctor' | 'receptionist';
  specialization: string;
  registrationNumber?: string;
  clinicId: string;
  preferredLanguage: 'marathi' | 'hindi' | 'english';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Clinic {
  _id: string;
  name: string;
  phone: string;
  address?: { line1?: string; city?: string; state?: string; pincode?: string };
  opdTiming?: {
    morning?: { open: string; close: string };
    evening?: { open: string; close: string };
  };
  supportedLanguages: string[];
  whatsappEnabled: boolean;
  whatsappNumber?: string;
  consultationFee: number;
  subscriptionPlan: 'trial' | 'basic' | 'pro' | 'enterprise';
  trialEndsAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    doctor: Doctor;
    clinic: Clinic;
    accessToken: string;
    refreshToken: string;
  };
}

// ─── Patient ───────────────────────────────────────────────────────────────────
export interface Patient {
  _id: string;
  clinicId: string;
  patientId: string;
  name: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  address?: string;
  bloodGroup?: string;
  allergies: string[];
  chronicConditions: string[];
  registeredVia: 'voice' | 'manual' | 'walk-in';
  voiceTranscript?: string;
  totalVisits: number;
  lastVisit?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreatePatientDto {
  name: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  registeredVia?: 'voice' | 'manual' | 'walk-in';
  voiceTranscript?: string;
  chiefComplaint?: string;
}

// ─── Token/Queue ───────────────────────────────────────────────────────────────
export interface OpdToken {
  _id: string;
  clinicId: string;
  patientId: Patient;
  doctorId: string;
  tokenNumber: number;
  displayNumber: string;
  date: string;
  chiefComplaint?: string;
  status: 'waiting' | 'in-consultation' | 'completed' | 'skipped' | 'cancelled';
  registeredVia: 'voice' | 'manual' | 'walk-in';
  calledAt?: string;
  consultationStartedAt?: string;
  consultationEndedAt?: string;
  createdAt: string;
}

export interface TokenStats {
  total: number;
  waiting: number;
  inConsultation: number;
  completed: number;
  skipped: number;
}

export interface TodayTokensResponse {
  tokens: OpdToken[];
  stats: TokenStats;
  current: OpdToken | null;
  next: OpdToken | null;
}

// ─── Prescription ──────────────────────────────────────────────────────────────
export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  routeOfAdmin?: 'oral' | 'topical' | 'injection' | 'inhalation' | 'other';
}

export interface Prescription {
  _id: string;
  clinicId: string;
  patientId: Patient;
  doctorId: Doctor;
  tokenId?: string;
  visitId?: string;
  prescriptionNumber: string;
  diagnosis?: string;
  symptoms: string[];
  medicines: Medicine[];
  advices: string[];
  followUpDate?: string;
  generatedViaVoice: boolean;
  whatsappSent: boolean;
  whatsappSentAt?: string;
  printCount: number;
  createdAt: string;
}

export interface CreatePrescriptionDto {
  patientId: string;
  tokenId?: string;
  diagnosis?: string;
  symptoms?: string[];
  medicines: Medicine[];
  advices?: string[];
  followUpDate?: string;
  generatedViaVoice?: boolean;
  voiceTranscript?: string;
  consultationFee?: number;
  paymentStatus?: 'paid' | 'pending' | 'waived';
  paymentMode?: string;
  vitalSigns?: VitalSigns;
  clinicalNotes?: string;
}

// ─── Visit ─────────────────────────────────────────────────────────────────────
export interface VitalSigns {
  bloodPressure?: { systolic: number; diastolic: number };
  pulse?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  spo2?: number;
}

export interface Visit {
  _id: string;
  clinicId: string;
  patientId: Patient;
  doctorId: Doctor;
  tokenId?: string;
  prescriptionId?: Prescription;
  visitDate: string;
  chiefComplaints: string[];
  diagnosis?: string;
  vitalSigns?: VitalSigns;
  clinicalNotes?: string;
  consultationFee: number;
  paymentStatus: 'paid' | 'pending' | 'waived';
  paymentMode: string;
  followUpDate?: string;
  createdAt: string;
}

// ─── Reports ───────────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalPatients: number;
  todayOPD: number;
  pendingTokens: number;
  todayPrescriptions: number;
  todayRevenue: number;
}

export interface DailyData {
  date: string;
  patients: number;
  revenue: number;
}

// ─── API Response wrappers ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

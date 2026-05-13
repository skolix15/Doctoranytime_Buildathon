import mongoose, { Document, Schema } from 'mongoose';

export interface IPatient extends Document {
  email: string;
  passwordHash: string;
  googleId?: string;
  profile: {
    firstName: string;
    lastName: string;
    dateOfBirth?: Date;
    gender?: string;
    phone?: string;
    avatar?: string;
    address?: { street: string; city: string; coords?: { lat: number; lng: number } };
    language: string;
    height?: number;
    weight?: number;
    bloodType?: string;
  };
  familyMembers: Array<{
    id: string;
    name: string;
    relation: string;
    dateOfBirth?: Date;
    gender?: string;
    height?: number;
    weight?: number;
    bloodType?: string;
    conditions: string[];
    allergies: string[];
    medications: string[];
    notes?: string;
  }>;
  aiContext: {
    communicationStyle?: string;
    knownConditions: string[];
    allergies: string[];
    preferences?: object;
    lastSessionSummary?: string;
    healthSummary?: string;
    totalSessions: number;
  };
  cachedInsights?: {
    data: any[];
    generatedAt: Date;
  };
  healthMetrics: Array<{
    metricType: string;
    value: number;
    unit: string;
    recordedAt: Date;
    source: string;
    category?: string;
  }>;
  preferences: {
    notificationChannels: string[];
    language?: string;
    budgetRange?: string;
    locationCoords?: { lat: number; lng: number };
  };
  savedDoctors: string[];
  createdAt: Date;
}

const PatientSchema = new Schema<IPatient>({
  email: { type: String, unique: true, required: true },
  passwordHash: String,
  googleId: String,
  profile: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    gender: String,
    phone: String,
    avatar: String,
    address: {
      street: String,
      city: String,
      coords: { lat: Number, lng: Number }
    },
    language: { type: String, default: 'el' },
    height: Number,
    weight: Number,
    bloodType: String
  },
  familyMembers: [{
    id: String,
    name: String,
    relation: String,
    dateOfBirth: Date,
    gender: String,
    height: Number,
    weight: Number,
    bloodType: String,
    conditions: [String],
    allergies: [String],
    medications: [String],
    notes: String
  }],
  aiContext: {
    communicationStyle: String,
    knownConditions: [String],
    allergies: [String],
    preferences: Object,
    lastSessionSummary: String,
    healthSummary: String,
    totalSessions: { type: Number, default: 0 }
  },
  healthMetrics: [{
    metricType: { type: String },
    value: { type: Number },
    unit: { type: String },
    recordedAt: { type: Date },
    source: { type: String, default: 'manual' },
    category: { type: String }
  }],
  preferences: {
    notificationChannels: [String],
    language: String,
    budgetRange: String,
    locationCoords: { lat: Number, lng: Number }
  },
  savedDoctors: [String],
  cachedInsights: {
    data: [Schema.Types.Mixed],
    generatedAt: Date
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IPatient>('Patient', PatientSchema);

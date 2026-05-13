import mongoose, { Document, Schema } from 'mongoose';

export interface IDoctor extends Document {
  email: string;
  passwordHash?: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    bio?: string;
    languages: string[];
    title?: string;
  };
  specialties: string[];
  subSpecialties: string[];
  conditions: string[];
  locations: Array<{
    clinicName: string;
    address: string;
    city: string;
    coords?: { lat: number; lng: number };
    phone?: string;
  }>;
  availability: Array<{
    dayOfWeek: number;
    slots: Array<{ start: string; end: string }>;
    appointmentType: string;
  }>;
  subscription: {
    plan?: string;
    status?: string;
    expiresAt?: Date;
  };
  stats: {
    totalPatients: number;
    avgRating: number;
    rebookRate: number;
    answerCount: number;
  };
  cvData: {
    education: string[];
    certifications: string[];
    experience: string[];
    publications: string[];
  };
  communicationStyle?: string;
  embeddingVector?: number[];
  isActive: boolean;
}

const DoctorSchema = new Schema<IDoctor>({
  email: { type: String, unique: true },
  passwordHash: String,
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: String,
    languages: [String],
    title: String
  },
  specialties: [String],
  subSpecialties: [String],
  conditions: [String],
  locations: [{
    clinicName: String,
    address: String,
    city: String,
    coords: { lat: Number, lng: Number },
    phone: String
  }],
  availability: [{
    dayOfWeek: { type: Number },
    slots: [{ start: { type: String }, end: { type: String } }],
    appointmentType: { type: String }
  }],
  subscription: {
    plan: String,
    status: String,
    expiresAt: Date
  },
  stats: {
    totalPatients: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    rebookRate: { type: Number, default: 0 },
    answerCount: { type: Number, default: 0 }
  },
  cvData: {
    education: [String],
    certifications: [String],
    experience: [String],
    publications: [String]
  },
  communicationStyle: String,
  embeddingVector: [Number],
  isActive: { type: Boolean, default: true }
});

export default mongoose.model<IDoctor>('Doctor', DoctorSchema);

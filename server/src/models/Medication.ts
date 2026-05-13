import mongoose, { Document, Schema } from 'mongoose';

export interface IMedication extends Document {
  patientId: mongoose.Types.ObjectId;
  familyMemberId?: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy?: mongoose.Types.ObjectId;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  reminders: Array<{ time: string; channel: string }>;
  plainDescription?: string;
  sideEffects?: string;
  createdAt: Date;
}

const MedicationSchema = new Schema<IMedication>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
  familyMemberId: String,
  name: String,
  dosage: String,
  frequency: String,
  prescribedBy: { type: Schema.Types.ObjectId, ref: 'Doctor' },
  startDate: Date,
  endDate: Date,
  isActive: Boolean,
  reminders: [{ time: String, channel: String }],
  plainDescription: String,
  sideEffects: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IMedication>('Medication', MedicationSchema);

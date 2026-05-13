import mongoose, { Document, Schema } from 'mongoose';

export interface IAppointment extends Document {
  patientId: mongoose.Types.ObjectId;
  familyMemberId?: string;
  doctorId: mongoose.Types.ObjectId;
  dateTime: Date;
  type: string;
  service: string;
  status: string;
  aiBrief?: string;
  sourceContext?: string;
  notes?: string;
  doctorNotes?: string;
  diagnosis?: Array<{ code: string; description: string }>;
  prescriptions?: Array<{ medication: string; dosage: string; duration: string }>;
  followUpDate?: Date;
  createdAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
  familyMemberId: String,
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
  dateTime: Date,
  type: String,
  service: String,
  status: { type: String, default: 'pending' },
  aiBrief: String,
  sourceContext: String,
  notes: String,
  doctorNotes: String,
  diagnosis: [{ code: String, description: String }],
  prescriptions: [{ medication: String, dosage: String, duration: String }],
  followUpDate: Date,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IAppointment>('Appointment', AppointmentSchema);

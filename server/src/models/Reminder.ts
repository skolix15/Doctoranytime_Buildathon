import mongoose, { Document, Schema } from 'mongoose';

export interface IReminder extends Document {
  patientId: mongoose.Types.ObjectId;
  familyMemberId?: string;
  type: 'medication' | 'examination' | 'appointment';
  title: string;
  description?: string;
  referenceId?: string;
  remindAt: Date;
  recurring?: {
    enabled: boolean;
    days: number[];   // 0=Sun…6=Sat
    time: string;     // HH:MM
  };
  acknowledged: boolean;
  createdAt: Date;
}

const ReminderSchema = new Schema<IReminder>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  familyMemberId: String,
  type: { type: String, enum: ['medication', 'examination', 'appointment'], required: true },
  title: { type: String, required: true },
  description: String,
  referenceId: String,
  remindAt: { type: Date, required: true },
  recurring: {
    enabled: { type: Boolean, default: false },
    days: [Number],
    time: String
  },
  acknowledged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IReminder>('Reminder', ReminderSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface IAssistantSession extends Document {
  patientId: mongoose.Types.ObjectId;
  activeFamilyMemberId?: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: Date;
    sources?: Array<{
      doctorId?: mongoose.Types.ObjectId;
      doctorName?: string;
      qnaId?: mongoose.Types.ObjectId;
      answerSnippet?: string;
    }>;
    confidenceScore?: number;
    intent?: string;
    urgencyLevel?: string;
  }>;
  sessionSummary?: string;
  bookingTriggered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssistantSessionSchema = new Schema<IAssistantSession>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  activeFamilyMemberId: String,
  messages: [{
    role: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
    sources: [{
      doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
      doctorName: String,
      qnaId: Schema.Types.ObjectId,
      answerSnippet: String
    }],
    confidenceScore: Number,
    intent: String,
    urgencyLevel: String
  }],
  sessionSummary: String,
  bookingTriggered: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<IAssistantSession>('AssistantSession', AssistantSessionSchema);

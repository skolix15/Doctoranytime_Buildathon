import mongoose, { Document, Schema } from 'mongoose';

export interface IMedDocument extends Document {
  patientId: mongoose.Types.ObjectId;
  familyMemberId?: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  category: string;
  tags: string[];
  extractedText?: string;
  aiSummary?: string;
  sharedWith: Array<{
    doctorId: mongoose.Types.ObjectId;
    sharedAt: Date;
    expiresAt?: Date;
  }>;
  uploadedAt: Date;
}

const MedDocumentSchema = new Schema<IMedDocument>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
  familyMemberId: String,
  fileName: String,
  fileUrl: String,
  mimeType: String,
  category: String,
  tags: [String],
  extractedText: String,
  aiSummary: String,
  sharedWith: [{
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
    sharedAt: Date,
    expiresAt: Date
  }],
  uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IMedDocument>('MedDocument', MedDocumentSchema);

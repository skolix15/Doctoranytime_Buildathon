import mongoose, { Document, Schema } from 'mongoose';

export interface ITestResult extends Document {
  patientId: mongoose.Types.ObjectId;
  familyMemberId?: string;
  uploadedFileUrl?: string;
  testDate: Date;
  labName?: string;
  testType: string;
  values: Array<{
    name: string;
    value: string;
    unit: string;
    referenceRange?: string;
    status: string;
    aiExplanation?: string;
  }>;
  attachedFiles: Array<{
    fileName: string;
    fileUrl: string;
    mimeType: string;
    uploadedAt: Date;
  }>;
  aiSummary?: string;
  rawExtractedText?: string;
  createdAt: Date;
}

const TestResultSchema = new Schema<ITestResult>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
  familyMemberId: String,
  uploadedFileUrl: String,
  testDate: Date,
  labName: String,
  testType: String,
  values: [{
    name: String,
    value: String,
    unit: String,
    referenceRange: String,
    status: String,
    aiExplanation: String
  }],
  attachedFiles: [{
    fileName: String,
    fileUrl: String,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  aiSummary: String,
  rawExtractedText: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ITestResult>('TestResult', TestResultSchema);

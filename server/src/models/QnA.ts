import mongoose, { Document, Schema } from 'mongoose';

export interface IQnA extends Document {
  question: string;
  questionEmbedding?: number[];
  specialty?: string;
  tags: string[];
  answers: Array<{
    _id?: mongoose.Types.ObjectId;
    doctorId: mongoose.Types.ObjectId;
    text: string;
    answeredAt: Date;
    votes: number;
    rating?: number;
  }>;
  bestAnswerId?: mongoose.Types.ObjectId;
  confidenceScore?: number;
  viewCount: number;
  createdAt: Date;
}

const QnASchema = new Schema<IQnA>({
  question: { type: String, required: true },
  questionEmbedding: [Number],
  specialty: String,
  tags: [String],
  answers: [{
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
    text: String,
    answeredAt: { type: Date, default: Date.now },
    votes: { type: Number, default: 0 },
    rating: Number
  }],
  bestAnswerId: Schema.Types.ObjectId,
  confidenceScore: Number,
  viewCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IQnA>('QnA', QnASchema);

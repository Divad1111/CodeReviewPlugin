/**
 * ReviewSummary model - per-author review summaries.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ISummaryDoc extends Document {
  summaryId: string;
  sessionId: string;
  author: string;
  summary: string;
  updatedAt: string;
  ownerUsername: string;
}

const SummarySchema = new Schema<ISummaryDoc>({
  summaryId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  author: { type: String, required: true },
  summary: { type: String, required: true },
  updatedAt: { type: String, required: true },
  ownerUsername: { type: String, required: true },
});

SummarySchema.index({ sessionId: 1, author: 1 });
SummarySchema.index({ ownerUsername: 1 });

export const Summary = mongoose.model<ISummaryDoc>('Summary', SummarySchema);

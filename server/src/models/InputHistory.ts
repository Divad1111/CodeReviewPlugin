/**
 * InputHistory model - stores previously used URLs and authors.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IInputHistoryDoc extends Document {
  type: 'repo_url' | 'author';
  value: string;
  usedAt: string;
  ownerUsername: string;
}

const InputHistorySchema = new Schema<IInputHistoryDoc>({
  type: { type: String, enum: ['repo_url', 'author'], required: true },
  value: { type: String, required: true },
  usedAt: { type: String, required: true },
  ownerUsername: { type: String, required: true },
});

InputHistorySchema.index({ ownerUsername: 1, type: 1 });
InputHistorySchema.index({ ownerUsername: 1, type: 1, value: 1 }, { unique: true });

export const InputHistory = mongoose.model<IInputHistoryDoc>('InputHistory', InputHistorySchema);

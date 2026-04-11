/**
 * ReviewLog model - per-file review status.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IReviewLogDoc extends Document {
  reviewLogId: string;
  sessionId: string;
  filePath: string;
  author: string;
  status: 'pending' | 'approved' | 'flagged';
  reviewedAt?: string;
  baseRevision?: number;
  endRevision?: number;
  aiAudited: boolean;
  ownerUsername: string;
}

const ReviewLogSchema = new Schema<IReviewLogDoc>({
  reviewLogId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  filePath: { type: String, required: true },
  author: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'flagged'], default: 'pending' },
  reviewedAt: { type: String },
  baseRevision: { type: Number },
  endRevision: { type: Number },
  aiAudited: { type: Boolean, default: false },
  ownerUsername: { type: String, required: true },
});

ReviewLogSchema.index({ sessionId: 1 });
ReviewLogSchema.index({ sessionId: 1, author: 1 });
ReviewLogSchema.index({ ownerUsername: 1 });

export const ReviewLog = mongoose.model<IReviewLogDoc>('ReviewLog', ReviewLogSchema);

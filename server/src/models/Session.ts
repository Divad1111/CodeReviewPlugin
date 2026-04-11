/**
 * Session model - audit sessions stored in MongoDB.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ISessionDoc extends Document {
  sessionId: string;
  name: string;
  createdAt: string;
  repoUrl: string;
  startDate: string;
  endDate: string;
  authors: string[];
  ownerUsername: string;
}

const SessionSchema = new Schema<ISessionDoc>({
  sessionId: { type: String, required: true, unique: true },
  name: { type: String, required: true, default: 'Untitled Session' },
  createdAt: { type: String, required: true },
  repoUrl: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  authors: { type: [String], required: true },
  ownerUsername: { type: String, required: true },
});

SessionSchema.index({ ownerUsername: 1 });
SessionSchema.index({ authors: 1 });

export const Session = mongoose.model<ISessionDoc>('Session', SessionSchema);

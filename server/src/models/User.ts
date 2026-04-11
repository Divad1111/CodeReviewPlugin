/**
 * User model - stores reviewer and reviewee accounts.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDoc extends Document {
  username: string;
  passwordHash: string;
  role: 'reviewer' | 'reviewee';
  parentReviewer: string | null;
  createdAt: Date;
}

const UserSchema = new Schema<IUserDoc>({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['reviewer', 'reviewee'], required: true },
  parentReviewer: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ parentReviewer: 1 });

export const User = mongoose.model<IUserDoc>('User', UserSchema);

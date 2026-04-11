/**
 * Settings model - per-user settings.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ISettingsDoc extends Document {
  ownerUsername: string;
  svnUsername?: string;
  svnPassword?: string;
  aiModel: string;
  codingStandards?: string;
  excludePatterns?: string;
  debugMode: boolean;
  language?: string;
}

const SettingsSchema = new Schema<ISettingsDoc>({
  ownerUsername: { type: String, required: true, unique: true },
  svnUsername: { type: String },
  svnPassword: { type: String },
  aiModel: { type: String, default: 'DeepSeek' },
  codingStandards: { type: String },
  excludePatterns: { type: String },
  debugMode: { type: Boolean, default: false },
  language: { type: String },
});

export const Settings = mongoose.model<ISettingsDoc>('Settings', SettingsSchema);

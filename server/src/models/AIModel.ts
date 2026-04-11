/**
 * AIModel model - per-user AI model configurations.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IAIModelDoc extends Document {
  modelId: string;
  name: string;
  endpoint: string;
  modelName: string;
  apiKey?: string;
  isDefault: boolean;
  ownerUsername: string;
}

const AIModelSchema = new Schema<IAIModelDoc>({
  modelId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  endpoint: { type: String, required: true },
  modelName: { type: String, required: true },
  apiKey: { type: String },
  isDefault: { type: Boolean, default: false },
  ownerUsername: { type: String, required: true },
});

AIModelSchema.index({ ownerUsername: 1 });

export const AIModel = mongoose.model<IAIModelDoc>('AIModel', AIModelSchema);

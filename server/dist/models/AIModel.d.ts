/**
 * AIModel model - per-user AI model configurations.
 */
import mongoose, { Document } from 'mongoose';
export interface IAIModelDoc extends Document {
    modelId: string;
    name: string;
    endpoint: string;
    modelName: string;
    apiKey?: string;
    isDefault: boolean;
    ownerUsername: string;
}
export declare const AIModel: mongoose.Model<IAIModelDoc, {}, {}, {}, mongoose.Document<unknown, {}, IAIModelDoc, {}, {}> & IAIModelDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AIModel.d.ts.map
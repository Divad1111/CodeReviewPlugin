/**
 * Settings model - per-user settings.
 */
import mongoose, { Document } from 'mongoose';
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
export declare const Settings: mongoose.Model<ISettingsDoc, {}, {}, {}, mongoose.Document<unknown, {}, ISettingsDoc, {}, {}> & ISettingsDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Settings.d.ts.map
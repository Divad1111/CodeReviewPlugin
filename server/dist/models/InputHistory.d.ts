/**
 * InputHistory model - stores previously used URLs and authors.
 */
import mongoose, { Document } from 'mongoose';
export interface IInputHistoryDoc extends Document {
    type: 'repo_url' | 'author';
    value: string;
    usedAt: string;
    ownerUsername: string;
}
export declare const InputHistory: mongoose.Model<IInputHistoryDoc, {}, {}, {}, mongoose.Document<unknown, {}, IInputHistoryDoc, {}, {}> & IInputHistoryDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=InputHistory.d.ts.map
/**
 * Session model - audit sessions stored in MongoDB.
 */
import mongoose, { Document } from 'mongoose';
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
export declare const Session: mongoose.Model<ISessionDoc, {}, {}, {}, mongoose.Document<unknown, {}, ISessionDoc, {}, {}> & ISessionDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Session.d.ts.map
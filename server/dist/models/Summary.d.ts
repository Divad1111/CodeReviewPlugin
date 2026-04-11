/**
 * ReviewSummary model - per-author review summaries.
 */
import mongoose, { Document } from 'mongoose';
export interface ISummaryDoc extends Document {
    summaryId: string;
    sessionId: string;
    author: string;
    summary: string;
    updatedAt: string;
    ownerUsername: string;
}
export declare const Summary: mongoose.Model<ISummaryDoc, {}, {}, {}, mongoose.Document<unknown, {}, ISummaryDoc, {}, {}> & ISummaryDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Summary.d.ts.map
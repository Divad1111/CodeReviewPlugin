/**
 * ReviewLog model - per-file review status.
 */
import mongoose, { Document } from 'mongoose';
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
export declare const ReviewLog: mongoose.Model<IReviewLogDoc, {}, {}, {}, mongoose.Document<unknown, {}, IReviewLogDoc, {}, {}> & IReviewLogDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ReviewLog.d.ts.map
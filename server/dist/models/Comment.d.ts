/**
 * Comment model - review comments on specific lines.
 */
import mongoose, { Document } from 'mongoose';
export interface ICommentDoc extends Document {
    commentId: string;
    reviewLogId: string;
    lineNumber: number;
    codeSnippet?: string;
    commentText: string;
    revision?: string;
    createdAt: string;
    ownerUsername: string;
}
export declare const Comment: mongoose.Model<ICommentDoc, {}, {}, {}, mongoose.Document<unknown, {}, ICommentDoc, {}, {}> & ICommentDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Comment.d.ts.map
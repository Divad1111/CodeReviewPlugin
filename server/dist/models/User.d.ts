/**
 * User model - stores reviewer and reviewee accounts.
 */
import mongoose, { Document } from 'mongoose';
export interface IUserDoc extends Document {
    username: string;
    passwordHash: string;
    role: 'reviewer' | 'reviewee';
    parentReviewer: string | null;
    createdAt: Date;
}
export declare const User: mongoose.Model<IUserDoc, {}, {}, {}, mongoose.Document<unknown, {}, IUserDoc, {}, {}> & IUserDoc & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map
/**
 * Comment model - review comments on specific lines.
 */

import mongoose, { Schema, Document } from 'mongoose';

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

const CommentSchema = new Schema<ICommentDoc>({
  commentId: { type: String, required: true, unique: true },
  reviewLogId: { type: String, required: true },
  lineNumber: { type: Number, required: true },
  codeSnippet: { type: String },
  commentText: { type: String, required: true },
  revision: { type: String },
  createdAt: { type: String, required: true },
  ownerUsername: { type: String, required: true },
});

CommentSchema.index({ reviewLogId: 1 });
CommentSchema.index({ ownerUsername: 1 });

export const Comment = mongoose.model<ICommentDoc>('Comment', CommentSchema);

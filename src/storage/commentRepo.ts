/**
 * Comment CRUD operations.
 */

import * as crypto from 'crypto';
import { getDatabase, saveDatabase } from './database';
import { ReviewComment } from '../svn/types';

/**
 * Add a comment to a review log.
 */
export function addComment(
  reviewLogId: string,
  lineNumber: number,
  commentText: string,
  storagePath: string,
  codeSnippet?: string,
  revision?: string
): ReviewComment {
  const db = getDatabase();
  const comment: ReviewComment = {
    id: crypto.randomUUID(),
    reviewLogId,
    lineNumber,
    codeSnippet,
    commentText,
    revision,
    createdAt: new Date().toISOString(),
  };

  db.run(
    `INSERT INTO Comments (id, review_log_id, line_number, code_snippet, comment_text, revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [comment.id, comment.reviewLogId, comment.lineNumber,
     comment.codeSnippet ?? null, comment.commentText,
     comment.revision ?? null, comment.createdAt]
  );

  saveDatabase(storagePath);
  return comment;
}

/**
 * Get all comments for a review log.
 */
export function getCommentsByReviewLog(reviewLogId: string): ReviewComment[] {
  const db = getDatabase();
  const results = db.exec(
    'SELECT id, review_log_id, line_number, code_snippet, comment_text, revision, created_at FROM Comments WHERE review_log_id = ? ORDER BY line_number',
    [reviewLogId]
  );

  if (results.length === 0) {return [];}

  return results[0].values.map((row: any[]): ReviewComment => ({
    id: row[0] as string,
    reviewLogId: row[1] as string,
    lineNumber: row[2] as number,
    codeSnippet: row[3] as string | undefined,
    commentText: row[4] as string,
    revision: row[5] as string | undefined,
    createdAt: row[6] as string,
  }));
}

/**
 * Delete a comment.
 */
export function deleteComment(commentId: string, storagePath: string): void {
  const db = getDatabase();
  db.run('DELETE FROM Comments WHERE id = ?', [commentId]);
  saveDatabase(storagePath);
}

/**
 * Get the count of comments for a review log.
 */
export function getCommentCount(reviewLogId: string): number {
  const db = getDatabase();
  const results = db.exec(
    'SELECT COUNT(*) FROM Comments WHERE review_log_id = ?',
    [reviewLogId]
  );

  if (results.length === 0 || results[0].values.length === 0) {return 0;}
  return results[0].values[0][0] as number;
}

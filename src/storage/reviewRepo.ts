/**
 * ReviewLog CRUD operations.
 */

import * as crypto from 'crypto';
import { getDatabase, saveDatabase } from './database';
import { ReviewLog } from '../svn/types';

/**
 * Create or update a review log entry for a file.
 */
export function upsertReviewLog(
  sessionId: string,
  filePath: string,
  author: string,
  storagePath: string,
  baseRevision?: number,
  endRevision?: number
): ReviewLog {
  const db = getDatabase();

  // Check if exists
  const existing = db.exec(
    'SELECT id FROM ReviewLogs WHERE session_id = ? AND file_path = ? AND author = ?',
    [sessionId, filePath, author]
  );

  if (existing.length > 0 && existing[0].values.length > 0) {
    const id = existing[0].values[0][0] as string;
    if (baseRevision !== undefined && endRevision !== undefined) {
      db.run(
        'UPDATE ReviewLogs SET base_revision = ?, end_revision = ? WHERE id = ?',
        [baseRevision, endRevision, id]
      );
    }
    saveDatabase(storagePath);
    return getReviewLogById(id)!;
  }

  const reviewLog: ReviewLog = {
    id: crypto.randomUUID(),
    sessionId,
    filePath,
    author,
    status: 'pending',
    baseRevision,
    endRevision,
  };

  db.run(
    `INSERT INTO ReviewLogs (id, session_id, file_path, author, status, base_revision, end_revision)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reviewLog.id, reviewLog.sessionId, reviewLog.filePath, reviewLog.author, reviewLog.status,
     reviewLog.baseRevision ?? null, reviewLog.endRevision ?? null]
  );

  saveDatabase(storagePath);
  return reviewLog;
}

/**
 * Get a review log by ID.
 */
export function getReviewLogById(id: string): ReviewLog | null {
  const db = getDatabase();
  const results = db.exec(
    'SELECT id, session_id, file_path, author, status, reviewed_at, base_revision, end_revision FROM ReviewLogs WHERE id = ?',
    [id]
  );

  if (results.length === 0 || results[0].values.length === 0) {return null;}

  const row = results[0].values[0];
  return mapRowToReviewLog(row);
}

/**
 * Get all review logs for a session.
 */
export function getReviewLogsBySession(sessionId: string): ReviewLog[] {
  const db = getDatabase();
  const results = db.exec(
    'SELECT id, session_id, file_path, author, status, reviewed_at, base_revision, end_revision FROM ReviewLogs WHERE session_id = ? ORDER BY author, file_path',
    [sessionId]
  );

  if (results.length === 0) {return [];}
  return results[0].values.map(mapRowToReviewLog);
}

/**
 * Get review logs for a specific author in a session.
 */
export function getReviewLogsByAuthor(sessionId: string, author: string): ReviewLog[] {
  const db = getDatabase();
  const results = db.exec(
    'SELECT id, session_id, file_path, author, status, reviewed_at, base_revision, end_revision FROM ReviewLogs WHERE session_id = ? AND author = ? ORDER BY file_path',
    [sessionId, author]
  );

  if (results.length === 0) {return [];}
  return results[0].values.map(mapRowToReviewLog);
}

/**
 * Update the review status of a file.
 */
export function updateReviewStatus(
  reviewLogId: string,
  status: 'pending' | 'approved' | 'flagged',
  storagePath: string
): void {
  const db = getDatabase();
  const reviewedAt = status !== 'pending' ? new Date().toISOString() : null;
  db.run(
    'UPDATE ReviewLogs SET status = ?, reviewed_at = ? WHERE id = ?',
    [status, reviewedAt, reviewLogId]
  );
  saveDatabase(storagePath);
}

/**
 * Delete all review logs (and their comments) for a specific author in a session.
 */
export function deleteReviewLogsByAuthor(sessionId: string, author: string, storagePath: string): void {
  const db = getDatabase();
  // Delete comments first
  db.run(
    `DELETE FROM Comments WHERE review_log_id IN
     (SELECT id FROM ReviewLogs WHERE session_id = ? AND author = ?)`,
    [sessionId, author]
  );
  db.run(
    'DELETE FROM ReviewLogs WHERE session_id = ? AND author = ?',
    [sessionId, author]
  );
  saveDatabase(storagePath);
}

function mapRowToReviewLog(row: any[]): ReviewLog {
  return {
    id: row[0] as string,
    sessionId: row[1] as string,
    filePath: row[2] as string,
    author: row[3] as string,
    status: row[4] as ReviewLog['status'],
    reviewedAt: row[5] as string | undefined,
    baseRevision: row[6] as number | undefined,
    endRevision: row[7] as number | undefined,
  };
}

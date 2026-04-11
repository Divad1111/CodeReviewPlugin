/**
 * ReviewSummary CRUD operations.
 */

import * as crypto from 'crypto';
import { getDatabase, saveDatabase } from './database';

export interface ReviewSummary {
  id: string;
  sessionId: string;
  author: string;
  summary: string;
  updatedAt: string;
}

/**
 * Get the summary for a specific author in a session.
 */
export function getSummary(sessionId: string, author: string): ReviewSummary | null {
  const db = getDatabase();
  const results = db.exec(
    'SELECT id, session_id, author, summary, updated_at FROM ReviewSummaries WHERE session_id = ? AND author = ?',
    [sessionId, author]
  );

  if (results.length === 0 || results[0].values.length === 0) {
    return null;
  }

  const row = results[0].values[0];
  return {
    id: row[0] as string,
    sessionId: row[1] as string,
    author: row[2] as string,
    summary: row[3] as string,
    updatedAt: row[4] as string
  };
}

/**
 * Upsert a summary for an author.
 */
export function upsertSummary(sessionId: string, author: string, summary: string, storagePath: string): void {
  const db = getDatabase();
  const existing = getSummary(sessionId, author);
  const now = new Date().toISOString();

  if (existing) {
    db.run(
      'UPDATE ReviewSummaries SET summary = ?, updated_at = ? WHERE id = ?',
      [summary, now, existing.id]
    );
  } else {
    db.run(
      'INSERT INTO ReviewSummaries (id, session_id, author, summary, updated_at) VALUES (?, ?, ?, ?, ?)',
      [crypto.randomUUID(), sessionId, author, summary, now]
    );
  }

  saveDatabase(storagePath);
}

/**
 * Delete a summary.
 */
export function deleteSummary(sessionId: string, author: string, storagePath: string): void {
  const db = getDatabase();
  db.run(
    'DELETE FROM ReviewSummaries WHERE session_id = ? AND author = ?',
    [sessionId, author]
  );
  saveDatabase(storagePath);
}

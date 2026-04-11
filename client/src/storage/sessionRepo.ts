/**
 * Session CRUD operations.
 */

import * as crypto from 'crypto';
import { getDatabase, saveDatabase } from './database';
import { AuditSession } from '../svn/types';

/**
 * Create a new audit session.
 */
export function createSession(
  name: string,
  repoUrl: string,
  startDate: string,
  endDate: string,
  authors: string[],
  storagePath: string
): AuditSession {
  const db = getDatabase();
  const session: AuditSession = {
    id: crypto.randomUUID(),
    name: name || 'Untitled Session',
    createdAt: new Date().toISOString(),
    repoUrl,
    startDate,
    endDate,
    authors,
  };

  db.run(
    `INSERT INTO Sessions (id, name, created_at, repo_url, start_date, end_date, authors)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.name, session.createdAt, session.repoUrl, session.startDate, session.endDate, JSON.stringify(session.authors)]
  );

  saveDatabase(storagePath);
  return session;
}

/**
 * Rename an existing audit session.
 */
export function renameSession(sessionId: string, newName: string, storagePath: string): void {
  const db = getDatabase();
  db.run(
    'UPDATE Sessions SET name = ? WHERE id = ?',
    [newName, sessionId]
  );
  saveDatabase(storagePath);
}

/**
 * Update the list of authors for an audit session.
 */
export function updateSessionAuthors(sessionId: string, authors: string[], storagePath: string): void {
  const db = getDatabase();
  db.run(
    'UPDATE Sessions SET authors = ? WHERE id = ?',
    [JSON.stringify(authors), sessionId]
  );
  saveDatabase(storagePath);
}

/**
 * Get all sessions, ordered by creation date descending.
 */
export function getSessions(): AuditSession[] {
  const db = getDatabase();
  const results = db.exec('SELECT id, name, created_at, repo_url, start_date, end_date, authors FROM Sessions ORDER BY created_at DESC');

  if (results.length === 0) {return [];}

  return results[0].values.map((row: any[]) => ({
    id: row[0] as string,
    name: row[1] as string,
    createdAt: row[2] as string,
    repoUrl: row[3] as string,
    startDate: row[4] as string,
    endDate: row[5] as string,
    authors: JSON.parse(row[6] as string),
  }));
}

/**
 * Get a single session by ID.
 */
export function getSessionById(sessionId: string): AuditSession | null {
  const db = getDatabase();
  const results = db.exec(
    'SELECT id, name, created_at, repo_url, start_date, end_date, authors FROM Sessions WHERE id = ?',
    [sessionId]
  );

  if (results.length === 0 || results[0].values.length === 0) {return null;}

  const row = results[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    createdAt: row[2] as string,
    repoUrl: row[3] as string,
    startDate: row[4] as string,
    endDate: row[5] as string,
    authors: JSON.parse(row[6] as string),
  };
}

/**
 * Delete a session and all related data.
 */
export function deleteSession(sessionId: string, storagePath: string): void {
  const db = getDatabase();
  // Delete comments first (via review logs)
  db.run(
    `DELETE FROM Comments WHERE review_log_id IN
     (SELECT id FROM ReviewLogs WHERE session_id = ?)`,
    [sessionId]
  );
  db.run('DELETE FROM ReviewLogs WHERE session_id = ?', [sessionId]);
  db.run('DELETE FROM Sessions WHERE id = ?', [sessionId]);
  saveDatabase(storagePath);
}

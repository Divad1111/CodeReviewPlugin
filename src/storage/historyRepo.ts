/**
 * InputHistory CRUD — stores previously used repo URLs and author names
 * so they can be suggested/reused in the new session form.
 */

import { getDatabase, saveDatabase } from './database';

export interface HistoryItem {
  type: 'repo_url' | 'author';
  value: string;
}

/**
 * Record a value (URL or author name) into history.
 * If it already exists, update its `used_at` timestamp.
 */
export function recordHistory(
  type: 'repo_url' | 'author',
  value: string,
  storagePath: string
): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  // UPSERT: insert or update used_at on conflict
  db.run(
    `INSERT INTO InputHistory (type, value, used_at)
     VALUES (?, ?, ?)
     ON CONFLICT(type, value) DO UPDATE SET used_at = excluded.used_at`,
    [type, value, now]
  );
  saveDatabase(storagePath);
}

/**
 * Get all historical values for a given type, ordered by most recently used.
 */
export function getHistory(type: 'repo_url' | 'author'): string[] {
  const db = getDatabase();
  const results = db.exec(
    'SELECT value FROM InputHistory WHERE type = ? ORDER BY used_at DESC',
    [type]
  );

  if (results.length === 0) { return []; }
  return results[0].values.map((row: any[]) => row[0] as string);
}

/**
 * Delete a historical value from history.
 */
export function deleteHistory(
  type: 'repo_url' | 'author',
  value: string,
  storagePath: string
): void {
  const db = getDatabase();
  db.run(
    'DELETE FROM InputHistory WHERE type = ? AND value = ?',
    [type, value]
  );
  saveDatabase(storagePath);
}

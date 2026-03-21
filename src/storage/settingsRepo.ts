/**
 * Settings CRUD operations.
 */

import { getDatabase, saveDatabase } from './database';

export interface AppSettings {
  svnUsername?: string;
  svnPassword?: string;
  aiModel: string;
  aiApiKey?: string;
  codingStandards?: string;
}

/**
 * Get the global settings.
 */
export function getSettings(): AppSettings {
  const db = getDatabase();
  const results = db.exec("SELECT svn_username, svn_password, ai_model, ai_api_key, coding_standards FROM Settings WHERE id = 'global'");

  if (results.length === 0 || results[0].values.length === 0) {
    return { aiModel: 'DeepSeek' };
  }

  const row = results[0].values[0];
  return {
    svnUsername: (row[0] as string) || '',
    svnPassword: (row[1] as string) || '',
    aiModel: (row[2] as string) || 'DeepSeek',
    aiApiKey: (row[3] as string) || '',
    codingStandards: (row[4] as string) || '',
  };
}

/**
 * Update the global settings.
 */
export function updateSettings(settings: AppSettings, storagePath: string): void {
  const db = getDatabase();
  db.run(
    `UPDATE Settings 
     SET svn_username = ?, svn_password = ?, ai_model = ?, ai_api_key = ?, coding_standards = ?
     WHERE id = 'global'`,
    [
      settings.svnUsername || null,
      settings.svnPassword || null,
      settings.aiModel,
      settings.aiApiKey || null,
      settings.codingStandards || null
    ]
  );
  saveDatabase(storagePath);
}

import * as crypto from 'crypto';
import { getDatabase, saveDatabase } from './database';

export interface AIModelConfig {
  id: string;
  name: string;
  endpoint: string;
  modelName: string;
  apiKey?: string;
  isDefault: boolean;
}

export interface AppSettings {
  svnUsername?: string;
  svnPassword?: string;
  aiModel: string; // Current selected model name
  codingStandards?: string;
  debugMode?: boolean;
  language?: string;
}

/**
 * Get all configured AI models.
 */
export function getAIModels(): AIModelConfig[] {
  const db = getDatabase();
  const results = db.exec('SELECT id, name, endpoint, model_name, api_key, is_default FROM AIModels ORDER BY is_default DESC, name ASC');

  if (results.length === 0) {return [];}

  return results[0].values.map((row: any[]) => ({
    id: row[0] as string,
    name: row[1] as string,
    endpoint: row[2] as string,
    modelName: row[3] as string,
    apiKey: (row[4] as string) || '',
    isDefault: row[5] === 1,
  }));
}

/**
 * Add or update an AI model.
 */
export function upsertAIModel(model: Omit<AIModelConfig, 'id' | 'isDefault'>, storagePath: string, id?: string): void {
  const db = getDatabase();
  if (id) {
    db.run(
      'UPDATE AIModels SET name = ?, endpoint = ?, model_name = ?, api_key = ? WHERE id = ?',
      [model.name, model.endpoint, model.modelName, model.apiKey || null, id]
    );
  } else {
    db.run(
      'INSERT INTO AIModels (id, name, endpoint, model_name, api_key, is_default) VALUES (?, ?, ?, ?, ?, 0)',
      [crypto.randomUUID(), model.name, model.endpoint, model.modelName, model.apiKey || null]
    );
  }
  saveDatabase(storagePath);
}

/**
 * Get a specific AI model configuration by name.
 */
export function getAIModelByName(name: string): AIModelConfig | null {
  const db = getDatabase();
  const results = db.exec('SELECT id, name, endpoint, model_name, api_key, is_default FROM AIModels WHERE name = ?', [name]);

  if (results.length === 0 || results[0].values.length === 0) {return null;}

  const row = results[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    endpoint: row[2] as string,
    modelName: row[3] as string,
    apiKey: (row[4] as string) || '',
    isDefault: row[5] === 1,
  };
}

/**
 * Delete an AI model (as long as it's not default).
 */
export function deleteAIModel(id: string, storagePath: string): void {
  const db = getDatabase();
  db.run('DELETE FROM AIModels WHERE id = ? AND is_default = 0', [id]);
  saveDatabase(storagePath);
}

/**
 * Get the global settings.
 */
export function getSettings(): AppSettings {
  const db = getDatabase();
  const results = db.exec("SELECT svn_username, svn_password, ai_model, coding_standards, debug_mode, language FROM Settings WHERE id = 'global'");

  if (results.length === 0 || results[0].values.length === 0) {
    return { aiModel: 'DeepSeek' };
  }

  const row = results[0].values[0];
  return {
    svnUsername: (row[0] as string) || '',
    svnPassword: (row[1] as string) || '',
    aiModel: (row[2] as string) || 'DeepSeek',
    codingStandards: (row[3] as string) || '',
    debugMode: row[4] === 1,
    language: (row[5] as string) || '',
  };
}

/**
 * Update the global settings.
 */
export function updateSettings(settings: AppSettings, storagePath: string): void {
  const db = getDatabase();
  db.run(
    `UPDATE Settings 
     SET svn_username = ?, svn_password = ?, ai_model = ?, coding_standards = ?, debug_mode = ?, language = ?
     WHERE id = 'global'`,
    [
      settings.svnUsername || null,
      settings.svnPassword || null,
      settings.aiModel,
      settings.codingStandards || null,
      settings.debugMode ? 1 : 0,
      settings.language || null
    ]
  );
  saveDatabase(storagePath);
}


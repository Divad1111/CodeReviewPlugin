/**
 * SQLite database initialization and management using sql.js (WASM).
 */

import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;

/**
 * Initialize the SQLite database.
 * Creates or opens svn_audit.db in the given storage directory.
 */
export async function initDatabase(storagePath: string): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      // In production (esbuild), the WASM file is in out/ alongside extension.js
      // When running via tsc, __dirname is out/storage, so we also check out/ or node_modules directly
      const paths = [
        path.join(__dirname, file),
        path.join(__dirname, '..', file),
        path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file)
      ];

      for (const p of paths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }

      return path.join(__dirname, file);
    },
  });

  const dbPath = path.join(storagePath, 'svn_audit.db');

  // Ensure directory exists
  fs.mkdirSync(storagePath, { recursive: true });

  // Load existing database or create new
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Run migrations
  runMigrations(db);

  // Save to disk
  saveDatabase(storagePath);

  return db;
}

/**
 * Get the current database instance.
 * Throws if not initialized.
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Save the in-memory database to disk.
 */
export function saveDatabase(storagePath: string): void {
  if (!db) {return;}
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = path.join(storagePath, 'svn_audit.db');
  fs.writeFileSync(dbPath, buffer);
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run database schema migrations.
 */
function runMigrations(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS Sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled Session',
      created_at TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      authors TEXT NOT NULL
    )
  `);

  // Migration for existing databases that don't have the 'name' column
  try {
    // Try to query the name column, if it fails, the column doesn't exist
    database.exec('SELECT name FROM Sessions LIMIT 1');
  } catch (e) {
    // Column doesn't exist, add it
    database.run('ALTER TABLE Sessions ADD COLUMN name TEXT NOT NULL DEFAULT "Untitled Session"');
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS ReviewLogs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      author TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewed_at TEXT,
      base_revision INTEGER,
      end_revision INTEGER,
      ai_audited INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES Sessions(id) ON DELETE CASCADE
    )
  `);

  // Migration for existing databases to add ai_audited column
  try {
    database.exec('SELECT ai_audited FROM ReviewLogs LIMIT 1');
  } catch (e) {
    database.run('ALTER TABLE ReviewLogs ADD COLUMN ai_audited INTEGER DEFAULT 0');
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS Comments (
      id TEXT PRIMARY KEY,
      review_log_id TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      code_snippet TEXT,
      comment_text TEXT NOT NULL,
      revision TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (review_log_id) REFERENCES ReviewLogs(id) ON DELETE CASCADE
    )
  `);

  // InputHistory: remember previously used URLs and authors for autocomplete
  database.run(`
    CREATE TABLE IF NOT EXISTS InputHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      used_at TEXT NOT NULL,
      UNIQUE(type, value)
    )
  `);

  // Create indexes for common queries
  database.run(`
    CREATE INDEX IF NOT EXISTS idx_reviewlogs_session
    ON ReviewLogs(session_id)
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_comments_reviewlog
    ON Comments(review_log_id)
  `);

  // Settings table: store SVN and AI configuration
  database.run(`
    CREATE TABLE IF NOT EXISTS Settings (
      id TEXT PRIMARY KEY,
      svn_username TEXT,
      svn_password TEXT,
      ai_model TEXT,
      ai_api_key TEXT,
      coding_standards TEXT,
      debug_mode INTEGER DEFAULT 0,
      language TEXT
    )
  `);

  // Migration for Settings: add language column
  try {
    database.exec("SELECT language FROM Settings LIMIT 1");
  } catch (e) {
    database.run("ALTER TABLE Settings ADD COLUMN language TEXT");
  }

  // Insert default row if empty
  const hasSettings = database.exec("SELECT COUNT(*) FROM Settings WHERE id = 'global'");
  if (hasSettings.length > 0 && hasSettings[0].values[0][0] === 0) {
    database.run(
      "INSERT INTO Settings (id, ai_model) VALUES ('global', 'DeepSeek')"
    );
  }

  // AI Models table: dynamic model management
  database.run(`
    CREATE TABLE IF NOT EXISTS AIModels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      model_name TEXT NOT NULL,
      api_key TEXT,
      is_default INTEGER DEFAULT 0
    )
  `);

  // Insert DeepSeek if not exists
  const hasDeepSeek = database.exec("SELECT COUNT(*) FROM AIModels WHERE name = 'DeepSeek'");
  if (hasDeepSeek.length > 0 && hasDeepSeek[0].values[0][0] === 0) {
     const id = require('crypto').randomUUID();
     database.run(
      `INSERT INTO AIModels (id, name, endpoint, model_name, is_default) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, 'DeepSeek', 'https://api.deepseek.com/v1/chat/completions', 'deepseek-chat', 1]
    );
  }
}

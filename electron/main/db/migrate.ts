import type Database from 'better-sqlite3'

interface Migration {
  id: string
  up: (db: Database.Database) => void
}

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)
}

function getAppliedMigrations(db: Database.Database): Set<string> {
  ensureMigrationsTable(db)
  const stmt = db.prepare('SELECT id FROM migrations ORDER BY applied_at ASC')
  const rows = stmt.all() as { id: string }[]
  return new Set(rows.map((r) => r.id))
}

function applyMigration(db: Database.Database, migration: Migration): void {
  const now = Date.now()
  const insert = db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)')
  db.transaction(() => {
    migration.up(db)
    insert.run(migration.id, now)
  })()
}

const migrations: readonly Migration[] = [
  {
    id: '001_init',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL,
          priority INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

        CREATE TABLE IF NOT EXISTS task_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          original_name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          stored_path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

        CREATE TABLE IF NOT EXISTS time_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER NULL,
          duration_seconds INTEGER NOT NULL,
          source TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);

        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NULL,
          type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON activity_logs(task_id);

        CREATE TABLE IF NOT EXISTS vault_secrets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          enc_payload_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `)
    }
  }
  ,
  {
    id: '002_active_timer',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS active_timer (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          task_id INTEGER NOT NULL,
          start_time INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
      `)
    }
  },
  {
    id: '003_users_and_assigned',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          role TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `)
      const info = db.prepare("SELECT COUNT(*) AS c FROM pragma_table_info('tasks') WHERE name = 'assigned_user_id'").get() as { c: number }
      if (info.c === 0) {
        db.exec(`ALTER TABLE tasks ADD COLUMN assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON tasks(assigned_user_id)`)
    }
  }
] as const

export function migrate(db: Database.Database): void {
  const applied = getAppliedMigrations(db)
  for (const m of migrations) {
    if (!applied.has(m.id)) {
      applyMigration(db, m)
    }
  }
}


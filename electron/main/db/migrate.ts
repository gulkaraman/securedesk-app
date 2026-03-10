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
  ,
  {
    id: '004_active_timer_sessions',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS active_timer_sessions (
          task_id INTEGER NOT NULL,
          user_id INTEGER NULL,
          project_id INTEGER NOT NULL,
          start_time INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_active_timer_sessions_unique
          ON active_timer_sessions(task_id, COALESCE(user_id, -1));

        CREATE INDEX IF NOT EXISTS idx_active_timer_sessions_project_id
          ON active_timer_sessions(project_id);
      `)

      const old = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='active_timer'")
        .get() as { name: string } | undefined
      if (old) {
        db.exec(`
          INSERT OR IGNORE INTO active_timer_sessions (task_id, user_id, project_id, start_time, created_at)
          SELECT at.task_id,
                 t.assigned_user_id,
                 t.project_id,
                 at.start_time,
                 at.created_at
          FROM active_timer at
          JOIN tasks t ON t.id = at.task_id
          WHERE at.id = 1;
        `)
        db.exec(`DROP TABLE active_timer`)
      }
    }
  },
  {
    id: '005_time_entries_project_user',
    up: (db) => {
      const hasProject = db.prepare("SELECT COUNT(*) AS c FROM pragma_table_info('time_entries') WHERE name = 'project_id'").get() as { c: number }
      if (hasProject.c === 0) db.exec(`ALTER TABLE time_entries ADD COLUMN project_id INTEGER NULL`)
      const hasUser = db.prepare("SELECT COUNT(*) AS c FROM pragma_table_info('time_entries') WHERE name = 'user_id'").get() as { c: number }
      if (hasUser.c === 0) db.exec(`ALTER TABLE time_entries ADD COLUMN user_id INTEGER NULL`)

      db.exec(`
        UPDATE time_entries
        SET project_id = (SELECT project_id FROM tasks WHERE tasks.id = time_entries.task_id)
        WHERE project_id IS NULL;

        UPDATE time_entries
        SET user_id = (SELECT assigned_user_id FROM tasks WHERE tasks.id = time_entries.task_id)
        WHERE user_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
        CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
      `)
    }
  }
  ,
  {
    id: '006_active_timer_sessions_fix_schema',
    up: (db) => {
      const cols = db.prepare("SELECT name FROM pragma_table_info('active_timer_sessions')").all() as Array<{ name: string }>
      const names = new Set(cols.map((c) => c.name))
      // If table doesn't exist, pragma returns empty. Migration 004 would have created it.
      if (cols.length === 0) return
      if (names.has('user_id') && names.has('project_id')) return

      // Rebuild table with correct schema and backfill using tasks
      db.exec(`
        CREATE TABLE IF NOT EXISTS active_timer_sessions_new (
          task_id INTEGER NOT NULL,
          user_id INTEGER NULL,
          project_id INTEGER NOT NULL,
          start_time INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
      `)
      db.exec(`
        INSERT OR IGNORE INTO active_timer_sessions_new (task_id, user_id, project_id, start_time, created_at)
        SELECT ats.task_id,
               t.assigned_user_id,
               t.project_id,
               ats.start_time,
               ats.created_at
        FROM active_timer_sessions ats
        JOIN tasks t ON t.id = ats.task_id;
      `)
      db.exec(`DROP TABLE active_timer_sessions`)
      db.exec(`ALTER TABLE active_timer_sessions_new RENAME TO active_timer_sessions`)
      // Deduplicate before creating UNIQUE index (keep earliest created_at per (task_id,user_id))
      db.exec(`
        DELETE FROM active_timer_sessions
        WHERE rowid NOT IN (
          SELECT MIN(rowid)
          FROM active_timer_sessions
          GROUP BY task_id, COALESCE(user_id, -1)
        );
      `)
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_active_timer_sessions_unique
          ON active_timer_sessions(task_id, COALESCE(user_id, -1));
        CREATE INDEX IF NOT EXISTS idx_active_timer_sessions_project_id
          ON active_timer_sessions(project_id);
      `)
    }
  }
  ,
  {
    id: '007_time_entries_started_ended_ms',
    up: (db) => {
      const hasStarted = db.prepare("SELECT COUNT(*) AS c FROM pragma_table_info('time_entries') WHERE name = 'started_at_ms'").get() as { c: number }
      if (hasStarted.c === 0) db.exec(`ALTER TABLE time_entries ADD COLUMN started_at_ms INTEGER NULL`)
      const hasEnded = db.prepare("SELECT COUNT(*) AS c FROM pragma_table_info('time_entries') WHERE name = 'ended_at_ms'").get() as { c: number }
      if (hasEnded.c === 0) db.exec(`ALTER TABLE time_entries ADD COLUMN ended_at_ms INTEGER NULL`)

      // backfill from existing columns
      db.exec(`
        UPDATE time_entries SET started_at_ms = start_time WHERE started_at_ms IS NULL;
        UPDATE time_entries SET ended_at_ms = end_time WHERE ended_at_ms IS NULL;
        CREATE INDEX IF NOT EXISTS idx_time_entries_started_at_ms ON time_entries(started_at_ms);
      `)
    }
  }
  ,
  {
    id: '008_active_timer_sessions_task_key_and_started_at_ms',
    up: (db) => {
      const cols = db.prepare("SELECT name FROM pragma_table_info('active_timer_sessions')").all() as Array<{ name: string }>
      if (cols.length === 0) return
      const names = new Set(cols.map((c) => c.name))

      const hasStartedAtMs = names.has('started_at_ms')
      const hasStartTime = names.has('start_time')

      if (!hasStartedAtMs) {
        db.exec(`ALTER TABLE active_timer_sessions ADD COLUMN started_at_ms INTEGER NULL`)
      }

      if (hasStartTime) {
        db.exec(`UPDATE active_timer_sessions SET started_at_ms = start_time WHERE started_at_ms IS NULL`)
      }

      // Drop old unique index if exists (task+user). Then enforce task-only uniqueness.
      const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_active_timer_sessions_unique'").get() as { name: string } | undefined
      if (idx) db.exec(`DROP INDEX idx_active_timer_sessions_unique`)

      // Deduplicate by task_id (keep earliest created_at)
      db.exec(`
        DELETE FROM active_timer_sessions
        WHERE rowid NOT IN (
          SELECT MIN(rowid)
          FROM active_timer_sessions
          GROUP BY task_id
        );
      `)

      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_active_timer_sessions_unique_task
          ON active_timer_sessions(task_id);
      `)

      // Cleanup invalid started_at_ms
      db.exec(`
        DELETE FROM active_timer_sessions
        WHERE started_at_ms IS NULL OR started_at_ms <= 0;
      `)
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


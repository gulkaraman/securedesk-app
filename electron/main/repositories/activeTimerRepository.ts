import type Database from 'better-sqlite3'
import type { Id } from '@shared/models'

export interface ActiveTimerRow {
  taskId: number
  projectId: number
  userId: number | null
  startedAtMs: number
  createdAt: number
}

export interface ActiveTimerSessionRow {
  projectId: number
  projectName: string
  taskId: number
  taskTitle: string
  userId: number | null
  userName: string | null
  startedAtMs: number
}

export class ActiveTimerRepository {
  public constructor(private readonly db: Database.Database) {}

  public getAll(): ActiveTimerRow[] {
    const stmt = this.db.prepare(
      'SELECT task_id AS taskId, project_id AS projectId, user_id AS userId, COALESCE(started_at_ms, start_time) AS startedAtMs, created_at AS createdAt FROM active_timer_sessions ORDER BY created_at ASC'
    )
    return stmt.all() as ActiveTimerRow[]
  }

  public getActiveSessions(): ActiveTimerSessionRow[] {
    const stmt = this.db.prepare(
      `SELECT
        ats.project_id AS projectId,
        p.name AS projectName,
        ats.task_id AS taskId,
        t.title AS taskTitle,
        ats.user_id AS userId,
        CASE
          WHEN u.id IS NULL THEN NULL
          ELSE (u.first_name || ' ' || u.last_name || ' (' || u.role || ')')
        END AS userName,
        COALESCE(ats.started_at_ms, ats.start_time) AS startedAtMs
      FROM active_timer_sessions ats
      JOIN tasks t ON t.id = ats.task_id
      JOIN projects p ON p.id = ats.project_id
      LEFT JOIN users u ON u.id = ats.user_id
      WHERE COALESCE(ats.started_at_ms, ats.start_time) IS NOT NULL
        AND COALESCE(ats.started_at_ms, ats.start_time) > 0
      ORDER BY ats.created_at ASC`
    )
    return stmt.all() as ActiveTimerSessionRow[]
  }

  /** Idempotent start: will not create duplicates for taskId (single running per task). */
  public start(taskId: Id, userId: Id | null, projectId: Id, startedAtMs: number): void {
    const now = Date.now()
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO active_timer_sessions (task_id, user_id, project_id, started_at_ms, start_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    stmt.run(taskId, userId, projectId, startedAtMs, startedAtMs, now)
  }

  public removeByTaskAndGet(taskId: Id): ActiveTimerRow | null {
    const row = this.db
      .prepare(
        'SELECT task_id AS taskId, project_id AS projectId, user_id AS userId, COALESCE(started_at_ms, start_time) AS startedAtMs, created_at AS createdAt FROM active_timer_sessions WHERE task_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(taskId) as ActiveTimerRow | undefined
    if (!row) return null
    this.db.prepare('DELETE FROM active_timer_sessions WHERE task_id = ?').run(taskId)
    return row
  }

  public removeAll(): void {
    this.db.prepare('DELETE FROM active_timer_sessions').run()
  }
}


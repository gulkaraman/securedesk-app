import type Database from 'better-sqlite3'
import type { Id } from '@shared/models'

export interface ActiveTimerRow {
  taskId: number
  startTime: number
  createdAt: number
}

export class ActiveTimerRepository {
  public constructor(private readonly db: Database.Database) {}

  public get(): ActiveTimerRow | null {
    const stmt = this.db.prepare(
      'SELECT task_id AS taskId, start_time AS startTime, created_at AS createdAt FROM active_timer WHERE id = 1'
    )
    const row = stmt.get() as ActiveTimerRow | undefined
    return row ?? null
  }

  public start(taskId: Id, startTime: number): void {
    const stmt = this.db.prepare(
      `INSERT INTO active_timer (id, task_id, start_time, created_at)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET task_id = excluded.task_id, start_time = excluded.start_time, created_at = excluded.created_at`
    )
    stmt.run(taskId, startTime, startTime)
  }

  public clear(): void {
    this.db.prepare('DELETE FROM active_timer WHERE id = 1').run()
  }
}


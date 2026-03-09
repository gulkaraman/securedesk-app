import type Database from 'better-sqlite3'
import type { CreateTimeEntryInput, Id, StopTimeEntryInput, TimeEntry, TimeEntrySource } from '@shared/models'

interface TimeEntryRow {
  id: number
  taskId: number
  startTime: number
  endTime: number | null
  durationSeconds: number
  source: TimeEntrySource
  createdAt: number
}

function toTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    taskId: row.taskId,
    startTime: row.startTime,
    endTime: row.endTime,
    durationSeconds: row.durationSeconds,
    source: row.source,
    createdAt: row.createdAt
  }
}

export class TimeEntryRepository {
  public constructor(private readonly db: Database.Database) {}

  public listByTask(taskId: Id): TimeEntry[] {
    const stmt = this.db.prepare(
      `SELECT
        id,
        task_id AS taskId,
        start_time AS startTime,
        end_time AS endTime,
        duration_seconds AS durationSeconds,
        source,
        created_at AS createdAt
      FROM time_entries
      WHERE task_id = ?
      ORDER BY start_time DESC`
    )
    const rows = stmt.all(taskId) as TimeEntryRow[]
    return rows.map(toTimeEntry)
  }

  public create(input: CreateTimeEntryInput): TimeEntry {
    const ts = Date.now()
    const insert = this.db.prepare(
      `INSERT INTO time_entries (task_id, start_time, end_time, duration_seconds, source, created_at)
       VALUES (?, ?, NULL, 0, ?, ?)`
    )
    const info = insert.run(input.taskId, input.startTime, input.source, ts)
    const id = Number(info.lastInsertRowid)
    const created = this.getById(id)
    if (!created) throw new Error('Failed to load created time entry')
    return created
  }

  public createCompleted(params: {
    taskId: Id
    startTime: number
    endTime: number
    durationSeconds: number
    source: TimeEntrySource
  }): TimeEntry {
    const ts = Date.now()
    const insert = this.db.prepare(
      `INSERT INTO time_entries (task_id, start_time, end_time, duration_seconds, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    const info = insert.run(
      params.taskId,
      params.startTime,
      params.endTime,
      params.durationSeconds,
      params.source,
      ts
    )
    const id = Number(info.lastInsertRowid)
    const created = this.getById(id)
    if (!created) throw new Error('Failed to load created time entry')
    return created
  }

  public stop(input: StopTimeEntryInput): TimeEntry | null {
    const existing = this.getById(input.id)
    if (!existing) return null

    const endTime = input.endTime
    const durationSeconds = Math.max(0, Math.floor((endTime - existing.startTime) / 1000))
    const source = input.source ?? existing.source

    const stmt = this.db.prepare(
      'UPDATE time_entries SET end_time = ?, duration_seconds = ?, source = ? WHERE id = ?'
    )
    stmt.run(endTime, durationSeconds, source, input.id)
    return this.getById(input.id)
  }

  public delete(id: Id): boolean {
    const stmt = this.db.prepare('DELETE FROM time_entries WHERE id = ?')
    const info = stmt.run(id)
    return info.changes > 0
  }

  private getById(id: Id): TimeEntry | null {
    const stmt = this.db.prepare(
      `SELECT
        id,
        task_id AS taskId,
        start_time AS startTime,
        end_time AS endTime,
        duration_seconds AS durationSeconds,
        source,
        created_at AS createdAt
      FROM time_entries
      WHERE id = ?`
    )
    const row = stmt.get(id) as TimeEntryRow | undefined
    return row ? toTimeEntry(row) : null
  }
}


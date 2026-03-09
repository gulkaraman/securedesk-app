import type Database from 'better-sqlite3'
import type { ActivityLog, CreateActivityLogInput, Id } from '@shared/models'

interface ActivityLogRow {
  id: number
  taskId: number | null
  type: string
  payloadJson: string
  createdAt: number
}

function toActivityLog(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    taskId: row.taskId,
    type: row.type,
    payloadJson: row.payloadJson,
    createdAt: row.createdAt
  }
}

export class ActivityLogRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(limit: number): ActivityLog[] {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)))
    const stmt = this.db.prepare(
      `SELECT
        id,
        task_id AS taskId,
        type,
        payload_json AS payloadJson,
        created_at AS createdAt
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT ?`
    )
    const rows = stmt.all(safeLimit) as ActivityLogRow[]
    return rows.map(toActivityLog)
  }

  public create(input: CreateActivityLogInput): ActivityLog {
    const ts = Date.now()
    const insert = this.db.prepare(
      'INSERT INTO activity_logs (task_id, type, payload_json, created_at) VALUES (?, ?, ?, ?)'
    )
    const taskId: Id | null = input.taskId ?? null
    const info = insert.run(taskId, input.type, input.payloadJson, ts)
    const id = Number(info.lastInsertRowid)
    const created = this.getById(id)
    if (!created) throw new Error('Failed to load created activity log')
    return created
  }

  private getById(id: Id): ActivityLog | null {
    const stmt = this.db.prepare(
      `SELECT
        id,
        task_id AS taskId,
        type,
        payload_json AS payloadJson,
        created_at AS createdAt
      FROM activity_logs
      WHERE id = ?`
    )
    const row = stmt.get(id) as ActivityLogRow | undefined
    return row ? toActivityLog(row) : null
  }
}


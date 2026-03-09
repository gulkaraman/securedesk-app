import type Database from 'better-sqlite3'
import type { CreateTaskAttachmentInput, Id, TaskAttachment } from '@shared/models'

interface TaskAttachmentRow {
  id: number
  taskId: number
  originalName: string
  storedName: string
  storedPath: string
  mimeType: string
  size: number
  createdAt: number
}

function toTaskAttachment(row: TaskAttachmentRow): TaskAttachment {
  return {
    id: row.id,
    taskId: row.taskId,
    originalName: row.originalName,
    storedName: row.storedName,
    storedPath: row.storedPath,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt
  }
}

export class TaskAttachmentRepository {
  public constructor(private readonly db: Database.Database) {}

  public listByTask(taskId: Id): TaskAttachment[] {
    const stmt = this.db.prepare(
      `SELECT
        id,
        task_id AS taskId,
        original_name AS originalName,
        stored_name AS storedName,
        stored_path AS storedPath,
        mime_type AS mimeType,
        size,
        created_at AS createdAt
      FROM task_attachments
      WHERE task_id = ?
      ORDER BY created_at DESC`
    )
    const rows = stmt.all(taskId) as TaskAttachmentRow[]
    return rows.map(toTaskAttachment)
  }

  public create(input: CreateTaskAttachmentInput): TaskAttachment {
    const ts = Date.now()
    const insert = this.db.prepare(
      `INSERT INTO task_attachments
        (task_id, original_name, stored_name, stored_path, mime_type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const info = insert.run(
      input.taskId,
      input.originalName,
      input.storedName,
      input.storedPath,
      input.mimeType,
      input.size,
      ts
    )
    const id = Number(info.lastInsertRowid)
    const stmt = this.db.prepare(
      `SELECT
        id,
        task_id AS taskId,
        original_name AS originalName,
        stored_name AS storedName,
        stored_path AS storedPath,
        mime_type AS mimeType,
        size,
        created_at AS createdAt
      FROM task_attachments
      WHERE id = ?`
    )
    const row = stmt.get(id) as TaskAttachmentRow | undefined
    if (!row) throw new Error('Failed to load created attachment')
    return toTaskAttachment(row)
  }

  public getById(id: Id): TaskAttachment | null {
    const stmt = this.db.prepare(
      `SELECT
        id,
        task_id AS taskId,
        original_name AS originalName,
        stored_name AS storedName,
        stored_path AS storedPath,
        mime_type AS mimeType,
        size,
        created_at AS createdAt
      FROM task_attachments
      WHERE id = ?`
    )
    const row = stmt.get(id) as TaskAttachmentRow | undefined
    return row ? toTaskAttachment(row) : null
  }

  public delete(id: Id): boolean {
    const stmt = this.db.prepare('DELETE FROM task_attachments WHERE id = ?')
    const info = stmt.run(id)
    return info.changes > 0
  }
}


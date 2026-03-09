import type Database from 'better-sqlite3'
import type { CreateTaskInput, Id, Task, TaskStatus, UpdateTaskInput } from '@shared/models'

interface TaskRow {
  id: number
  projectId: number
  title: string
  description: string
  status: TaskStatus
  priority: number
  assignedUserId: number | null
  createdAt: number
  updatedAt: number
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedUserId: row.assignedUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export class TaskRepository {
  public constructor(private readonly db: Database.Database) {}

  public listByProject(projectId: Id): Task[] {
    const stmt = this.db.prepare(
      `SELECT
        id,
        project_id AS projectId,
        title,
        description,
        status,
        priority,
        assigned_user_id AS assignedUserId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM tasks
      WHERE project_id = ?
      ORDER BY priority ASC, updated_at DESC`
    )
    const rows = stmt.all(projectId) as TaskRow[]
    return rows.map(toTask)
  }

  public getById(id: Id): Task | null {
    const stmt = this.db.prepare(
      `SELECT
        id,
        project_id AS projectId,
        title,
        description,
        status,
        priority,
        assigned_user_id AS assignedUserId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM tasks
      WHERE id = ?`
    )
    const row = stmt.get(id) as TaskRow | undefined
    return row ? toTask(row) : null
  }

  public create(input: CreateTaskInput): Task {
    const ts = Date.now()
    const title = input.title.trim()
    const description = input.description.trim()
    const status: TaskStatus = input.status ?? 'todo'
    const priority = input.priority ?? 0
    const assignedUserId = input.assignedUserId ?? null

    const insert = this.db.prepare(
      `INSERT INTO tasks (project_id, title, description, status, priority, assigned_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const info = insert.run(input.projectId, title, description, status, priority, assignedUserId, ts, ts)
    const id = Number(info.lastInsertRowid)
    const created = this.getById(id)
    if (!created) throw new Error('Failed to load created task')
    return created
  }

  public update(input: UpdateTaskInput): Task | null {
    const existing = this.getById(input.id)
    if (!existing) return null

    const title = input.title !== undefined ? input.title.trim() : existing.title
    const description = input.description !== undefined ? input.description.trim() : existing.description
    const status = input.status ?? existing.status
    const priority = input.priority ?? existing.priority
    const assignedUserId = input.assignedUserId !== undefined ? input.assignedUserId : existing.assignedUserId
    const ts = Date.now()

    const stmt = this.db.prepare(
      'UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assigned_user_id = ?, updated_at = ? WHERE id = ?'
    )
    stmt.run(title, description, status, priority, assignedUserId, ts, input.id)
    return this.getById(input.id)
  }

  public delete(id: Id): boolean {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?')
    const info = stmt.run(id)
    return info.changes > 0
  }
}


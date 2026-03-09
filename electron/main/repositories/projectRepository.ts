import type Database from 'better-sqlite3'
import type { CreateProjectInput, Id, Project, UpdateProjectInput } from '@shared/models'

interface ProjectRow {
  id: number
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export class ProjectRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(): Project[] {
    const stmt = this.db.prepare(
      'SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM projects ORDER BY id ASC'
    )
    const rows = stmt.all() as ProjectRow[]
    return rows.map(toProject)
  }

  public getById(id: Id): Project | null {
    const stmt = this.db.prepare(
      'SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM projects WHERE id = ?'
    )
    const row = stmt.get(id) as ProjectRow | undefined
    return row ? toProject(row) : null
  }

  public create(input: CreateProjectInput): Project {
    const ts = Date.now()
    const name = input.name.trim()
    const description = (input.description ?? '').trim()

    const insert = this.db.prepare(
      'INSERT INTO projects (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    const info = insert.run(name, description, ts, ts)
    const id = Number(info.lastInsertRowid)

    const created = this.getById(id)
    if (!created) throw new Error('Failed to load created project')
    return created
  }

  public update(input: UpdateProjectInput): Project | null {
    const existing = this.getById(input.id)
    if (!existing) return null

    const nextName = input.name !== undefined ? input.name.trim() : existing.name
    const nextDesc = input.description !== undefined ? input.description.trim() : existing.description
    const ts = Date.now()

    const stmt = this.db.prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?')
    stmt.run(nextName, nextDesc, ts, input.id)

    return this.getById(input.id)
  }

  public delete(id: Id): boolean {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?')
    const info = stmt.run(id)
    return info.changes > 0
  }
}


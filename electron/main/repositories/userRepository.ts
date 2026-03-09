import type Database from 'better-sqlite3'
import type { CreateUserInput, Id, UpdateUserInput, User } from '@shared/models'

interface UserRow {
  id: number
  firstName: string
  lastName: string
  role: string
  createdAt: number
  updatedAt: number
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export class UserRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(): User[] {
    const stmt = this.db.prepare(
      `SELECT id, first_name AS firstName, last_name AS lastName, role,
              created_at AS createdAt, updated_at AS updatedAt
       FROM users ORDER BY last_name ASC, first_name ASC`
    )
    const rows = stmt.all() as UserRow[]
    return rows.map(toUser)
  }

  public getById(id: Id): User | null {
    const stmt = this.db.prepare(
      `SELECT id, first_name AS firstName, last_name AS lastName, role,
              created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE id = ?`
    )
    const row = stmt.get(id) as UserRow | undefined
    return row ? toUser(row) : null
  }

  public create(input: CreateUserInput): User {
    const ts = Date.now()
    const insert = this.db.prepare(
      `INSERT INTO users (first_name, last_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    const info = insert.run(
      input.firstName.trim(),
      input.lastName.trim(),
      input.role.trim(),
      ts,
      ts
    )
    const id = Number(info.lastInsertRowid)
    const created = this.getById(id)
    if (!created) throw new Error('Failed to load created user')
    return created
  }

  public update(input: UpdateUserInput): User | null {
    const existing = this.getById(input.id)
    if (!existing) return null
    const firstName = input.firstName !== undefined ? input.firstName.trim() : existing.firstName
    const lastName = input.lastName !== undefined ? input.lastName.trim() : existing.lastName
    const role = input.role !== undefined ? input.role.trim() : existing.role
    const ts = Date.now()
    this.db.prepare('UPDATE users SET first_name = ?, last_name = ?, role = ?, updated_at = ? WHERE id = ?').run(firstName, lastName, role, ts, input.id)
    return this.getById(input.id)
  }

  public delete(id: Id): boolean {
    this.db.prepare('UPDATE tasks SET assigned_user_id = NULL WHERE assigned_user_id = ?').run(id)
    const info = this.db.prepare('DELETE FROM users WHERE id = ?').run(id)
    return info.changes > 0
  }
}

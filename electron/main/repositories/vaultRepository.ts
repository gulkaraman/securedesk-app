import type Database from 'better-sqlite3'
import type { CreateVaultSecretInput, Id, UpdateVaultSecretInput, VaultSecret } from '@shared/models'

interface VaultSecretRow {
  id: number
  title: string
  encPayloadJson: string
  createdAt: number
  updatedAt: number
}

function toVaultSecret(row: VaultSecretRow): VaultSecret {
  return {
    id: row.id,
    title: row.title,
    encPayloadJson: row.encPayloadJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export class VaultRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(): VaultSecret[] {
    const stmt = this.db.prepare(
      `SELECT
        id,
        title,
        enc_payload_json AS encPayloadJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM vault_secrets
      ORDER BY updated_at DESC`
    )
    const rows = stmt.all() as VaultSecretRow[]
    return rows.map(toVaultSecret)
  }

  public getById(id: Id): VaultSecret | null {
    const stmt = this.db.prepare(
      `SELECT
        id,
        title,
        enc_payload_json AS encPayloadJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM vault_secrets
      WHERE id = ?`
    )
    const row = stmt.get(id) as VaultSecretRow | undefined
    return row ? toVaultSecret(row) : null
  }

  public create(input: CreateVaultSecretInput): VaultSecret {
    const ts = Date.now()
    const insert = this.db.prepare(
      'INSERT INTO vault_secrets (title, enc_payload_json, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    const info = insert.run(input.title.trim(), input.encPayloadJson, ts, ts)
    const id = Number(info.lastInsertRowid)
    const created = this.getById(id)
    if (!created) throw new Error('Failed to load created secret')
    return created
  }

  public update(input: UpdateVaultSecretInput): VaultSecret | null {
    const existing = this.getById(input.id)
    if (!existing) return null

    const title = input.title !== undefined ? input.title.trim() : existing.title
    const encPayloadJson = input.encPayloadJson ?? existing.encPayloadJson
    const ts = Date.now()

    const stmt = this.db.prepare('UPDATE vault_secrets SET title = ?, enc_payload_json = ?, updated_at = ? WHERE id = ?')
    stmt.run(title, encPayloadJson, ts, input.id)
    return this.getById(input.id)
  }

  public delete(id: Id): boolean {
    const stmt = this.db.prepare('DELETE FROM vault_secrets WHERE id = ?')
    const info = stmt.run(id)
    return info.changes > 0
  }
}


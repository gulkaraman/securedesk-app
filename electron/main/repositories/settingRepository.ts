import type Database from 'better-sqlite3'
import type { AppSetting } from '@shared/models'

export class SettingRepository {
  public constructor(private readonly db: Database.Database) {}

  public list(): AppSetting[] {
    const stmt = this.db.prepare('SELECT key, value FROM app_settings ORDER BY key ASC')
    const rows = stmt.all() as AppSetting[]
    return rows
  }

  public get(key: string): AppSetting | null {
    const stmt = this.db.prepare('SELECT key, value FROM app_settings WHERE key = ?')
    const row = stmt.get(key) as AppSetting | undefined
    return row ?? null
  }

  public set(key: string, value: string): AppSetting {
    const stmt = this.db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    stmt.run(key, value)
    const updated = this.get(key)
    if (!updated) throw new Error('Failed to load updated setting')
    return updated
  }
}


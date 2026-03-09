/**
 * Single SQLite connection for the main process only.
 * Renderer never touches the DB; all access goes through IPC handlers.
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { getAppPaths } from '../paths'

let db: Database.Database | null = null

function createConnection(): Database.Database {
  if (!app.isReady()) {
    throw new Error('App must be ready before opening database')
  }

  const { databaseFile } = getAppPaths()
  const instance = new Database(databaseFile)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  return instance
}

export function getDb(): Database.Database {
  if (db) return db
  db = createConnection()
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}


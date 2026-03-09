import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface AppPaths {
  root: string
  databaseDir: string
  attachmentsDir: string
  exportsDir: string
  logsDir: string
  databaseFile: string
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

export function getAppPaths(): AppPaths {
  const root = app.getPath('userData')

  const databaseDir = path.join(root, 'database')
  const attachmentsDir = path.join(root, 'attachments')
  const exportsDir = path.join(root, 'exports')
  const logsDir = path.join(root, 'logs')

  ensureDir(root)
  ensureDir(databaseDir)
  ensureDir(attachmentsDir)
  ensureDir(exportsDir)
  ensureDir(logsDir)

  const databaseFile = path.join(databaseDir, 'app.sqlite3')

  return {
    root,
    databaseDir,
    attachmentsDir,
    exportsDir,
    logsDir,
    databaseFile
  }
}


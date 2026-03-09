import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { dialog, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { NotFoundError, ValidationError } from '@shared/errors'
import type { TaskAttachment } from '@shared/models'
import { TaskAttachmentRepository } from '../repositories/taskAttachmentRepository'
import { TaskRepository } from '../repositories/taskRepository'
import { getAppPaths } from '../paths'

const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

function safeExt(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase()
  if (ext.length === 0) return ''
  if (ext.length > 16) return ''
  if (!/^\.[a-z0-9]+$/.test(ext)) return ''
  return ext
}

function detectMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.pdf':
      return 'application/pdf'
    case '.txt':
      return 'text/plain'
    case '.json':
      return 'application/json'
    case '.csv':
      return 'text/csv'
    case '.zip':
      return 'application/zip'
    default:
      return 'application/octet-stream'
  }
}

function assertWithinRoot(root: string, candidate: string): void {
  const rootResolved = path.resolve(root)
  const candResolved = path.resolve(candidate)
  const prefix = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep
  if (!candResolved.startsWith(prefix)) {
    throw new ValidationError('Unsafe path rejected')
  }
}

export class AttachmentFileService {
  private readonly taskRepo: TaskRepository
  private readonly attachmentRepo: TaskAttachmentRepository

  public constructor(db: Database.Database) {
    this.taskRepo = new TaskRepository(db)
    this.attachmentRepo = new TaskAttachmentRepository(db)
  }

  public async pickAndAttach(ownerWindow: BrowserWindow, taskId: number): Promise<TaskAttachment | null> {
    if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError('Geçersiz görev')

    const task = this.taskRepo.getById(taskId)
    if (!task) throw new NotFoundError('Görev bulunamadı')

    const result = await dialog.showOpenDialog(ownerWindow, {
      title: 'Dosya seç',
      properties: ['openFile'],
      buttonLabel: 'Ekle'
    })
    if (result.canceled) return null
    const filePath = result.filePaths.at(0)
    if (!filePath) return null

    const st = fs.statSync(filePath)
    if (!st.isFile()) throw new ValidationError('Seçilen öğe bir dosya değil')
    if (st.size > MAX_FILE_SIZE_BYTES) throw new ValidationError('Dosya çok büyük')

    const originalName = path.basename(filePath)
    const ext = safeExt(originalName)
    const storedName = `${crypto.randomUUID()}${ext}`

    const { attachmentsDir } = getAppPaths()
    const destDir = path.join(attachmentsDir, String(task.projectId), String(task.id))
    ensureDir(destDir)
    const destPath = path.join(destDir, storedName)
    assertWithinRoot(attachmentsDir, destPath)

    fs.copyFileSync(filePath, destPath, fs.constants.COPYFILE_EXCL)

    const relativeStoredPath = path.join(String(task.projectId), String(task.id), storedName)

    const mimeType = detectMimeType(originalName)
    const created = this.attachmentRepo.create({
      taskId: task.id,
      originalName,
      storedName,
      storedPath: relativeStoredPath,
      mimeType,
      size: st.size
    })

    return created
  }

  public async openAttachment(attachment: TaskAttachment): Promise<boolean> {
    const { attachmentsDir } = getAppPaths()
    const abs = path.join(attachmentsDir, attachment.storedPath)
    assertWithinRoot(attachmentsDir, abs)
    const errMsg = await shell.openPath(abs)
    if (errMsg) throw new ValidationError(errMsg)
    return true
  }

  public showInFolder(attachment: TaskAttachment): boolean {
    const { attachmentsDir } = getAppPaths()
    const abs = path.join(attachmentsDir, attachment.storedPath)
    assertWithinRoot(attachmentsDir, abs)
    shell.showItemInFolder(abs)
    return true
  }

  public deleteFileForAttachment(attachment: TaskAttachment): void {
    const { attachmentsDir } = getAppPaths()
    const abs = path.join(attachmentsDir, attachment.storedPath)
    assertWithinRoot(attachmentsDir, abs)
    try {
      fs.unlinkSync(abs)
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e) {
        const code = (e as { code?: unknown }).code
        if (code === 'ENOENT') return
      }
      throw e
    }
  }
}


import type Database from 'better-sqlite3'
import type { Id } from '@shared/models'
import { DbError } from '@shared/errors'
import { TaskRepository } from '../repositories/taskRepository'
import { TaskAttachmentRepository } from '../repositories/taskAttachmentRepository'
import { AttachmentFileService } from './attachmentFileService'

export class TaskCascadeService {
  public constructor(private readonly db: Database.Database) {}

  public deleteTask(id: Id): boolean {
    const tx = this.db.transaction(() => {
      const taskRepo = new TaskRepository(this.db)
      const task = taskRepo.getById(id)
      if (!task) return false

      try {
        const attachmentRepo = new TaskAttachmentRepository(this.db)
        const fileService = new AttachmentFileService(this.db)

        const attachments = attachmentRepo.listByTask(task.id)
        for (const att of attachments) {
          fileService.deleteFileForAttachment(att)
          attachmentRepo.delete(att.id)
        }

        this.db.prepare('DELETE FROM time_entries WHERE task_id = ?').run(task.id)
        this.db.prepare('DELETE FROM activity_logs WHERE task_id = ?').run(task.id)
        this.db.prepare('DELETE FROM active_timer WHERE task_id = ?').run(task.id)
        const info = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id)
        return info.changes > 0
      } catch {
        throw new DbError('Görev ve bağlı kayıtlar silinirken hata oluştu')
      }
    })

    return tx()
  }
}


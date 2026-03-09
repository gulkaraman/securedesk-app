import type Database from 'better-sqlite3'
import type { Id } from '@shared/models'
import { DbError } from '@shared/errors'
import { ProjectRepository } from '../repositories/projectRepository'
import { TaskAttachmentRepository } from '../repositories/taskAttachmentRepository'
import { AttachmentFileService } from './attachmentFileService'

export class ProjectCascadeService {
  public constructor(
    private readonly db: Database.Database,
    private readonly projectRepo: ProjectRepository
  ) {}

  public deleteProject(id: Id): boolean {
    const tx = this.db.transaction(() => {
      const project = this.projectRepo.getById(id)
      if (!project) return false

      try {
        const attachmentRepo = new TaskAttachmentRepository(this.db)
        const fileService = new AttachmentFileService(this.db)

        const taskIdsStmt = this.db.prepare('SELECT id FROM tasks WHERE project_id = ?')
        const taskRows = taskIdsStmt.all(id) as { id: number }[]
        const taskIds = taskRows.map((r) => r.id)

        for (const taskId of taskIds) {
          const attachments = attachmentRepo.listByTask(taskId)
          for (const att of attachments) {
            fileService.deleteFileForAttachment(att)
            attachmentRepo.delete(att.id)
          }
        }

        this.db.prepare('DELETE FROM time_entries WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)').run(id)
        this.db
          .prepare('DELETE FROM activity_logs WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)')
          .run(id)
        this.db.prepare('DELETE FROM tasks WHERE project_id = ?').run(id)
        const info = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
        return info.changes > 0
      } catch {
        throw new DbError('Projeye bağlı veriler temizlenirken hata oluştu')
      }
    })

    return tx()
  }
}


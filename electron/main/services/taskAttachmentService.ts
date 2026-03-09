import type { CreateTaskAttachmentInput, Id, TaskAttachment } from '@shared/models'
import { ValidationError } from '@shared/errors'
import { TaskAttachmentRepository } from '../repositories/taskAttachmentRepository'

export class TaskAttachmentService {
  public constructor(private readonly repo: TaskAttachmentRepository) {}

  public listByTask(taskId: Id): TaskAttachment[] {
    return this.repo.listByTask(taskId)
  }

  public create(input: CreateTaskAttachmentInput): TaskAttachment {
    if (input.originalName.trim().length === 0) throw new ValidationError('Attachment originalName is required')
    if (input.storedName.trim().length === 0) throw new ValidationError('Attachment storedName is required')
    if (input.storedPath.trim().length === 0) throw new ValidationError('Attachment storedPath is required')
    if (input.mimeType.trim().length === 0) throw new ValidationError('Attachment mimeType is required')
    if (input.size < 0) throw new ValidationError('Attachment size must be >= 0')
    return this.repo.create(input)
  }

  public delete(id: Id): boolean {
    return this.repo.delete(id)
  }
}


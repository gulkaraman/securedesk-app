import type { CreateTimeEntryInput, Id, StopTimeEntryInput, TimeEntry } from '@shared/models'
import { ValidationError } from '@shared/errors'
import { TimeEntryRepository } from '../repositories/timeEntryRepository'
import { TaskRepository } from '../repositories/taskRepository'

export class TimeEntryService {
  public constructor(
    private readonly repo: TimeEntryRepository,
    private readonly taskRepo: TaskRepository
  ) {}

  public listByTask(taskId: Id): TimeEntry[] {
    return this.repo.listByTask(taskId)
  }

  public create(input: CreateTimeEntryInput): TimeEntry {
    if (!Number.isFinite(input.taskId) || input.taskId <= 0) {
      throw new ValidationError('Geçerli bir görev seçmelisiniz')
    }
    const task = this.taskRepo.getById(input.taskId)
    if (!task) {
      throw new ValidationError('Geçerli bir görev seçmelisiniz')
    }
    return this.repo.create(input)
  }

  public stop(input: StopTimeEntryInput): TimeEntry | null {
    return this.repo.stop(input)
  }

  public delete(id: Id): boolean {
    return this.repo.delete(id)
  }
}


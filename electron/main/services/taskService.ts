import type { CreateTaskInput, Id, Task, UpdateTaskInput } from '@shared/models'
import { ValidationError } from '@shared/errors'
import { TaskRepository } from '../repositories/taskRepository'
import { ProjectRepository } from '../repositories/projectRepository'

export class TaskService {
  public constructor(
    private readonly repo: TaskRepository,
    private readonly projectRepo: ProjectRepository
  ) {}

  public listByProject(projectId: Id): Task[] {
    return this.repo.listByProject(projectId)
  }

  public get(id: Id): Task | null {
    return this.repo.getById(id)
  }

  public create(input: CreateTaskInput): Task {
    if (!Number.isFinite(input.projectId) || input.projectId <= 0) {
      throw new ValidationError('Geçerli bir proje seçmelisiniz')
    }
    if (input.title.trim().length === 0) throw new ValidationError('Başlık gerekli')
    if (input.description.trim().length === 0) throw new ValidationError('Açıklama gerekli')
    const project = this.projectRepo.getById(input.projectId)
    if (!project) {
      throw new ValidationError('Geçerli bir proje seçmelisiniz')
    }
    try {
      return this.repo.create(input)
    } catch (e: unknown) {
      if (e instanceof Error && /FOREIGN KEY|SQLITE|constraint|UNIQUE/i.test(e.message)) {
        throw new ValidationError('İşlem başarısız. Veri tutarlılığı hatası.')
      }
      throw e
    }
  }

  public update(input: UpdateTaskInput): Task | null {
    if (input.title?.trim().length === 0) throw new ValidationError('Başlık boş olamaz')
    if (input.description?.trim().length === 0) throw new ValidationError('Açıklama boş olamaz')
    return this.repo.update(input)
  }

  public delete(id: Id): boolean {
    return this.repo.delete(id)
  }
}


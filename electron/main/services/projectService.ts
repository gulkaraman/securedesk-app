import type { CreateProjectInput, Id, Project, UpdateProjectInput } from '@shared/models'
import { ValidationError } from '@shared/errors'
import { ProjectRepository } from '../repositories/projectRepository'

export class ProjectService {
  public constructor(private readonly repo: ProjectRepository) {}

  public list(): Project[] {
    return this.repo.list()
  }

  public get(id: Id): Project | null {
    return this.repo.getById(id)
  }

  public create(input: CreateProjectInput): Project {
    const name = input.name.trim()
    if (name.length === 0) throw new ValidationError('Project name is required')
    const next: CreateProjectInput = input.description !== undefined ? { name, description: input.description } : { name }
    return this.repo.create(next)
  }

  public update(input: UpdateProjectInput): Project | null {
    if (input.name?.trim().length === 0) throw new ValidationError('Project name cannot be empty')
    return this.repo.update(input)
  }

  public delete(id: Id): boolean {
    return this.repo.delete(id)
  }
}


import type { CreateUserInput, Id, UpdateUserInput, User } from '@shared/models'
import { ValidationError } from '@shared/errors'
import { UserRepository } from '../repositories/userRepository'

export class UserService {
  public constructor(private readonly repo: UserRepository) {}

  public list(): User[] {
    return this.repo.list()
  }

  public get(id: Id): User | null {
    return this.repo.getById(id)
  }

  public create(input: CreateUserInput): User {
    const firstName = input.firstName.trim()
    const lastName = input.lastName.trim()
    const role = input.role.trim()
    if (firstName.length === 0) throw new ValidationError('Ad gerekli')
    if (lastName.length === 0) throw new ValidationError('Soyad gerekli')
    if (role.length === 0) throw new ValidationError('Görev gerekli')
    return this.repo.create({ firstName, lastName, role })
  }

  public update(input: UpdateUserInput): User | null {
    if (input.firstName?.trim().length === 0) throw new ValidationError('Ad boş olamaz')
    if (input.lastName?.trim().length === 0) throw new ValidationError('Soyad boş olamaz')
    if (input.role?.trim().length === 0) throw new ValidationError('Görev boş olamaz')
    return this.repo.update(input)
  }

  public delete(id: Id): boolean {
    return this.repo.delete(id)
  }
}

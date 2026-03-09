import type {
  CreateVaultNoteInput,
  Id,
  UpdateVaultNoteInput,
  VaultSecret,
  VaultSecretDecrypted,
  VaultSecretListItem
} from '@shared/models'
import { ForbiddenError, ValidationError } from '@shared/errors'
import { decrypt, encrypt } from './vaultCryptoService'
import type { VaultKeyService } from './vaultKeyService'
import { VaultRepository } from '../repositories/vaultRepository'

export class VaultService {
  public constructor(
    private readonly repo: VaultRepository,
    private readonly keyService: VaultKeyService
  ) {}

  private requireUnlocked(): void {
    if (!this.keyService.isUnlocked()) {
      throw new ForbiddenError('Kasa kilitli. Önce açın.')
    }
  }

  public list(): VaultSecretListItem[] {
    this.requireUnlocked()
    const rows = this.repo.list()
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  }

  public get(id: Id): VaultSecretDecrypted | null {
    this.requireUnlocked()
    const key = this.keyService.getDerivedKey()
    if (!key) return null
    const row = this.repo.getById(id)
    if (!row) return null
    const body = decrypt(row.encPayloadJson, key)
    return {
      id: row.id,
      title: row.title,
      body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }

  public create(input: CreateVaultNoteInput): VaultSecret {
    this.requireUnlocked()
    const key = this.keyService.getDerivedKey()
    if (!key) throw new ForbiddenError('Kasa kilitli')
    if (input.title.trim().length === 0) throw new ValidationError('Başlık gerekli')
    const encPayloadJson = encrypt(input.body, key)
    return this.repo.create({ title: input.title.trim(), encPayloadJson })
  }

  public update(input: UpdateVaultNoteInput): VaultSecret | null {
    this.requireUnlocked()
    const key = this.keyService.getDerivedKey()
    if (!key) throw new ForbiddenError('Kasa kilitli')
    const existing = this.repo.getById(input.id)
    if (!existing) return null
    let encPayloadJson = existing.encPayloadJson
    if (input.body !== undefined) {
      encPayloadJson = encrypt(input.body, key)
    }
    const title = input.title !== undefined ? input.title.trim() : existing.title
    if (title.length === 0) throw new ValidationError('Başlık boş olamaz')
    return this.repo.update({ id: input.id, title, encPayloadJson })
  }

  public delete(id: Id): boolean {
    this.requireUnlocked()
    return this.repo.delete(id)
  }
}

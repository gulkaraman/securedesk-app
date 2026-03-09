import crypto from 'node:crypto'
import type { SettingRepository } from '../repositories/settingRepository'
import { ValidationError } from '@shared/errors'

const VAULT_SALT_KEY = 'vault_salt'
const VAULT_ITERATIONS_KEY = 'vault_iterations'
const VAULT_KEY_VERIFIER_KEY = 'vault_key_verifier'
const PBKDF2_ITERATIONS = 310_000
const KEY_LEN = 32
const SALT_LEN = 16

export type VaultStatus = 'never_set' | 'locked' | 'unlocked'

export class VaultKeyService {
  private derivedKey: Buffer | null = null

  public constructor(private readonly settingRepo: SettingRepository) {}

  public getStatus(): VaultStatus {
    const verifier = this.settingRepo.get(VAULT_KEY_VERIFIER_KEY)
    if (!verifier) return 'never_set'
    return this.derivedKey !== null ? 'unlocked' : 'locked'
  }

  public isUnlocked(): boolean {
    return this.derivedKey !== null
  }

  public setMasterKey(masterKey: string): void {
    if (this.settingRepo.get(VAULT_KEY_VERIFIER_KEY)) {
      throw new ValidationError('Kasa zaten kuruldu. Açmak için Unlock kullanın.')
    }
    if (typeof masterKey !== 'string' || masterKey.length < 1) {
      throw new ValidationError('Master key gerekli')
    }
    const salt = crypto.randomBytes(SALT_LEN)
    const key = this.deriveKey(masterKey, salt, PBKDF2_ITERATIONS)
    const verifier = crypto.createHash('sha256').update(key).digest('hex')
    this.settingRepo.set(VAULT_SALT_KEY, salt.toString('base64'))
    this.settingRepo.set(VAULT_ITERATIONS_KEY, String(PBKDF2_ITERATIONS))
    this.settingRepo.set(VAULT_KEY_VERIFIER_KEY, verifier)
    this.derivedKey = key
  }

  public unlock(masterKey: string): void {
    const saltSetting = this.settingRepo.get(VAULT_SALT_KEY)
    const iterationsSetting = this.settingRepo.get(VAULT_ITERATIONS_KEY)
    const verifierSetting = this.settingRepo.get(VAULT_KEY_VERIFIER_KEY)
    if (!saltSetting || !iterationsSetting || !verifierSetting) {
      throw new ValidationError('Kasa henüz kurulmamış')
    }
    if (typeof masterKey !== 'string' || masterKey.length < 1) {
      throw new ValidationError('Master key gerekli')
    }
    const salt = Buffer.from(saltSetting.value, 'base64')
    const iterations = parseInt(iterationsSetting.value, 10)
    if (!Number.isFinite(iterations) || iterations < 100_000) {
      throw new ValidationError('Geçersiz kasa ayarı')
    }
    const key = this.deriveKey(masterKey, salt, iterations)
    const expectedVerifier = crypto.createHash('sha256').update(key).digest('hex')
    if (expectedVerifier !== verifierSetting.value) {
      throw new ValidationError('Yanlış master key')
    }
    this.derivedKey = key
  }

  public lock(): void {
    this.derivedKey = null
  }

  public getDerivedKey(): Buffer | null {
    return this.derivedKey
  }

  private deriveKey(password: string, salt: Buffer, iterations: number): Buffer {
    return crypto.pbkdf2Sync(password, salt, iterations, KEY_LEN, 'sha256')
  }
}

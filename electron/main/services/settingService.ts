import type { AppSetting } from '@shared/models'
import { ValidationError } from '@shared/errors'
import { SettingRepository } from '../repositories/settingRepository'

export class SettingService {
  public constructor(private readonly repo: SettingRepository) {}

  public list(): AppSetting[] {
    return this.repo.list()
  }

  public get(key: string): AppSetting | null {
    return this.repo.get(key)
  }

  public set(key: string, value: string): AppSetting {
    if (key.trim().length === 0) throw new ValidationError('Setting key is required')
    return this.repo.set(key, value)
  }
}


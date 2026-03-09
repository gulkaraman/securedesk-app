import type { ActivityLog, CreateActivityLogInput } from '@shared/models'
import { ValidationError } from '@shared/errors'
import { ActivityLogRepository } from '../repositories/activityLogRepository'

export class ActivityLogService {
  public constructor(private readonly repo: ActivityLogRepository) {}

  public list(limit: number): ActivityLog[] {
    return this.repo.list(limit)
  }

  public create(input: CreateActivityLogInput): ActivityLog {
    if (input.type.trim().length === 0) throw new ValidationError('ActivityLog type is required')
    if (input.payloadJson.trim().length === 0) throw new ValidationError('ActivityLog payloadJson is required')
    return this.repo.create(input)
  }
}


import type Database from 'better-sqlite3'
import { NotFoundError, ValidationError } from '@shared/errors'
import type { Id, TimeEntry, UnixMs } from '@shared/models'
import { ActiveTimerRepository } from '../repositories/activeTimerRepository'
import { TaskRepository } from '../repositories/taskRepository'
import { ProjectRepository } from '../repositories/projectRepository'
import { UserRepository } from '../repositories/userRepository'
import { TimeEntryRepository } from '../repositories/timeEntryRepository'

export interface ActiveTimerSession {
  projectId: Id
  projectName: string
  taskId: Id
  taskTitle: string
  userId: Id | null
  userName: string | null
  startTime: UnixMs
}

export interface TodayTimeEntryItem {
  id: number
  taskId: number
  taskTitle: string
  startTime: number
  endTime: number | null
  durationSeconds: number
  source: string
}

export interface TodayTaskSummaryItem {
  taskId: number
  taskTitle: string
  totalSeconds: number
}

function startOfLocalDayMs(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export class TimerService {
  private readonly activeRepo: ActiveTimerRepository
  private readonly taskRepo: TaskRepository
  private readonly projectRepo: ProjectRepository
  private readonly userRepo: UserRepository
  private readonly timeRepo: TimeEntryRepository

  public constructor(private readonly db: Database.Database) {
    this.activeRepo = new ActiveTimerRepository(db)
    this.taskRepo = new TaskRepository(db)
    this.projectRepo = new ProjectRepository(db)
    this.userRepo = new UserRepository(db)
    this.timeRepo = new TimeEntryRepository(db)
  }

  public getActive(): ActiveTimerSession[] {
    const rows = this.activeRepo.getActiveSessions()
    return rows.map((r) => ({
      projectId: r.projectId,
      projectName: r.projectName,
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      userId: r.userId,
      userName: r.userName,
      startTime: r.startedAtMs
    }))
  }

  public start(taskId: Id, userId: Id | null, startTime: UnixMs): ActiveTimerSession {
    if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError('Invalid taskId')
    const task = this.taskRepo.getById(taskId)
    if (!task) throw new NotFoundError('Task not found')
    const project = this.projectRepo.getById(task.projectId)
    if (!project) throw new NotFoundError('Project not found')
    const effectiveUserId = userId ?? task.assignedUserId ?? null
    if (effectiveUserId !== null) {
      const u = this.userRepo.getById(effectiveUserId)
      if (!u) throw new NotFoundError('User not found')
    }
    // Single running timer per task. If already running, treat as success and return existing.
    this.activeRepo.start(taskId, effectiveUserId, task.projectId, startTime)
    const active = this.getActive().find((s) => s.taskId === taskId)
    return active ?? {
      projectId: task.projectId,
      projectName: project.name,
      taskId: task.id,
      taskTitle: task.title,
      userId: effectiveUserId,
      userName: null,
      startTime
    }
  }

  public stop(taskId: Id, _userId: Id | null, endTime: UnixMs, source: 'manual' | 'auto_stop'): TimeEntry {
    const active = this.activeRepo.removeByTaskAndGet(taskId)
    if (!active) throw new NotFoundError('No active timer for this task')

    const durationSeconds = Math.max(0, Math.floor((endTime - active.startedAtMs) / 1000))
    const entry = this.timeRepo.createCompleted({
      taskId: active.taskId,
      projectId: active.projectId,
      userId: active.userId,
      startTime: active.startedAtMs,
      endTime,
      durationSeconds,
      source
    })
    return entry
  }

  // No startup recovery: active timers persist in DB and are reloaded via getActive().

  public listTodayEntries(now: UnixMs): TodayTimeEntryItem[] {
    const start = startOfLocalDayMs(now)
    const end = start + 24 * 60 * 60 * 1000
    const stmt = this.db.prepare(
      `SELECT
        te.id AS id,
        te.task_id AS taskId,
        t.title AS taskTitle,
        COALESCE(te.started_at_ms, te.start_time) AS startTime,
        COALESCE(te.ended_at_ms, te.end_time) AS endTime,
        te.duration_seconds AS durationSeconds,
        te.source AS source
      FROM time_entries te
      JOIN tasks t ON t.id = te.task_id
      WHERE COALESCE(te.started_at_ms, te.start_time) >= ? AND COALESCE(te.started_at_ms, te.start_time) < ?
      ORDER BY COALESCE(te.started_at_ms, te.start_time) DESC`
    )
    return stmt.all(start, end) as TodayTimeEntryItem[]
  }

  public todaySummaryByTask(now: UnixMs): TodayTaskSummaryItem[] {
    const start = startOfLocalDayMs(now)
    const end = start + 24 * 60 * 60 * 1000
    const stmt = this.db.prepare(
      `SELECT
        te.task_id AS taskId,
        t.title AS taskTitle,
        SUM(te.duration_seconds) AS totalSeconds
      FROM time_entries te
      JOIN tasks t ON t.id = te.task_id
      WHERE COALESCE(te.started_at_ms, te.start_time) >= ? AND COALESCE(te.started_at_ms, te.start_time) < ?
      GROUP BY te.task_id
      ORDER BY totalSeconds DESC`
    )
    return stmt.all(start, end) as TodayTaskSummaryItem[]
  }

  public totalsForTask(taskId: Id): { todaySeconds: number; totalSeconds: number } {
    const now = Date.now()
    const start = startOfLocalDayMs(now)
    const end = start + 24 * 60 * 60 * 1000

    const stmtToday = this.db.prepare(
      'SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM time_entries WHERE task_id = ? AND COALESCE(started_at_ms, start_time) >= ? AND COALESCE(started_at_ms, start_time) < ?'
    )
    const today = stmtToday.get(taskId, start, end) as { s: number }

    const stmtAll = this.db.prepare(
      'SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM time_entries WHERE task_id = ?'
    )
    const all = stmtAll.get(taskId) as { s: number }

    return { todaySeconds: today.s, totalSeconds: all.s }
  }
}


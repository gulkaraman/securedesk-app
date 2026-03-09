import type Database from 'better-sqlite3'
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors'
import type { Id, TimeEntry, UnixMs } from '@shared/models'
import { ActiveTimerRepository, type ActiveTimerRow } from '../repositories/activeTimerRepository'
import { TaskRepository } from '../repositories/taskRepository'
import { TimeEntryRepository } from '../repositories/timeEntryRepository'

export interface ActiveTimerSession {
  taskId: Id
  taskTitle: string
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
  private readonly timeRepo: TimeEntryRepository

  public constructor(private readonly db: Database.Database) {
    this.activeRepo = new ActiveTimerRepository(db)
    this.taskRepo = new TaskRepository(db)
    this.timeRepo = new TimeEntryRepository(db)
  }

  public getActive(): ActiveTimerSession | null {
    const row = this.activeRepo.get()
    if (!row) return null
    const task = this.taskRepo.getById(row.taskId)
    if (!task) {
      this.activeRepo.clear()
      return null
    }
    return { taskId: task.id, taskTitle: task.title, startTime: row.startTime }
  }

  public start(taskId: Id, startTime: UnixMs): ActiveTimerSession {
    if (!Number.isInteger(taskId) || taskId <= 0) throw new ValidationError('Invalid taskId')
    const task = this.taskRepo.getById(taskId)
    if (!task) throw new NotFoundError('Task not found')

    const existing = this.activeRepo.get()
    if (existing && existing.taskId !== taskId) {
      throw new ConflictError('Another timer is already active', {
        activeTaskId: String(existing.taskId)
      })
    }

    this.activeRepo.start(taskId, startTime)
    return { taskId: task.id, taskTitle: task.title, startTime }
  }

  public stop(endTime: UnixMs, source: 'manual' | 'auto_stop'): TimeEntry {
    const active = this.activeRepo.get()
    if (!active) throw new NotFoundError('No active timer')

    const durationSeconds = Math.max(0, Math.floor((endTime - active.startTime) / 1000))
    const entry = this.timeRepo.createCompleted({
      taskId: active.taskId,
      startTime: active.startTime,
      endTime,
      durationSeconds,
      source
    })
    this.activeRepo.clear()
    return entry
  }

  public recoverOnStartup(now: UnixMs): { stoppedEntry: TimeEntry; row: ActiveTimerRow } | null {
    const row = this.activeRepo.get()
    if (!row) return null
    const stoppedEntry = this.stop(now, 'auto_stop')
    return { stoppedEntry, row }
  }

  public listTodayEntries(now: UnixMs): TodayTimeEntryItem[] {
    const start = startOfLocalDayMs(now)
    const end = start + 24 * 60 * 60 * 1000
    const stmt = this.db.prepare(
      `SELECT
        te.id AS id,
        te.task_id AS taskId,
        t.title AS taskTitle,
        te.start_time AS startTime,
        te.end_time AS endTime,
        te.duration_seconds AS durationSeconds,
        te.source AS source
      FROM time_entries te
      JOIN tasks t ON t.id = te.task_id
      WHERE te.start_time >= ? AND te.start_time < ?
      ORDER BY te.start_time DESC`
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
      WHERE te.start_time >= ? AND te.start_time < ?
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
      'SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM time_entries WHERE task_id = ? AND start_time >= ? AND start_time < ?'
    )
    const today = stmtToday.get(taskId, start, end) as { s: number }

    const stmtAll = this.db.prepare(
      'SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM time_entries WHERE task_id = ?'
    )
    const all = stmtAll.get(taskId) as { s: number }

    return { todaySeconds: today.s, totalSeconds: all.s }
  }
}


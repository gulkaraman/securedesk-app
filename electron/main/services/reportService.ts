import type Database from 'better-sqlite3'
import type {
  Id,
  UnixMs,
  WeeklyReportByUserRequest,
  WeeklyReportDayItem,
  WeeklyReportDetailItem,
  WeeklyReportRequest,
  WeeklyReportSummary,
  WeeklyReportTaskItem
} from '@shared/models'

function startOfWeekMs(baseMs: UnixMs): UnixMs {
  const d = new Date(baseMs)
  const day = d.getDay() // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day // move to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export class ReportService {
  public constructor(private readonly db: Database.Database) {}

  public getWeeklyReport(request: WeeklyReportRequest): WeeklyReportSummary {
    const base = request.baseDateMs
    const rangeStart = startOfWeekMs(base)
    const rangeEnd = rangeStart + 7 * 24 * 60 * 60 * 1000

    const totalSeconds = this.getTotalSeconds(rangeStart, rangeEnd)
    const perDay = this.getPerDay(rangeStart, rangeEnd)
    const perTask = this.getPerTask(rangeStart, rangeEnd)
    const completedTasksCount = this.getCompletedTasksCount(rangeStart, rangeEnd)
    const detail = this.getDetail(rangeStart, rangeEnd)

    return {
      rangeStart,
      rangeEnd,
      totalSeconds,
      perDay,
      perTask,
      completedTasksCount,
      detail
    }
  }

  public getWeeklyReportByUser(request: WeeklyReportByUserRequest): WeeklyReportSummary {
    const base = request.baseDateMs
    const rangeStart = startOfWeekMs(base)
    const rangeEnd = rangeStart + 7 * 24 * 60 * 60 * 1000
    const userId = request.userId

    const totalSeconds = this.getTotalSecondsByUser(rangeStart, rangeEnd, userId)
    const perDay = this.getPerDayByUser(rangeStart, rangeEnd, userId)
    const perTask = this.getPerTaskByUser(rangeStart, rangeEnd, userId)
    const completedTasksCount = this.getCompletedTasksCountByUser(rangeStart, rangeEnd, userId)

    return {
      rangeStart,
      rangeEnd,
      totalSeconds,
      perDay,
      perTask,
      completedTasksCount,
      detail: []
    }
  }

  private getDetail(start: UnixMs, end: UnixMs): WeeklyReportDetailItem[] {
    const dayMs = 24 * 60 * 60 * 1000
    const stmt = this.db.prepare(
      `SELECT
        CAST((te.start_time - ?) / ? AS INTEGER) AS dayIndex,
        te.task_id AS taskId,
        t.title AS taskTitle,
        SUM(te.duration_seconds) AS totalSeconds
       FROM time_entries te
       JOIN tasks t ON t.id = te.task_id
       WHERE te.start_time >= ? AND te.start_time < ?
       GROUP BY dayIndex, te.task_id
       ORDER BY dayIndex, totalSeconds DESC`
    )
    const rows = stmt.all(start, dayMs, start, end) as {
      dayIndex: number
      taskId: Id
      taskTitle: string
      totalSeconds: number
    }[]
    return rows.map((r) => ({
      dateMs: start + r.dayIndex * dayMs,
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      totalSeconds: r.totalSeconds
    }))
  }

  private getTotalSeconds(start: UnixMs, end: UnixMs): number {
    const stmt = this.db.prepare(
      'SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM time_entries WHERE start_time >= ? AND start_time < ?'
    )
    const row = stmt.get(start, end) as { s: number }
    return row.s
  }

  private getPerDay(start: UnixMs, end: UnixMs): WeeklyReportDayItem[] {
    const dayMs = 24 * 60 * 60 * 1000
    const buckets: WeeklyReportDayItem[] = []
    for (let i = 0; i < 7; i += 1) {
      buckets.push({ date: start + i * dayMs, totalSeconds: 0 })
    }

    const stmt = this.db.prepare(
      'SELECT start_time AS startTime, duration_seconds AS durationSeconds FROM time_entries WHERE start_time >= ? AND start_time < ?'
    )
    const rows = stmt.all(start, end) as { startTime?: number | null; durationSeconds?: number | null }[]
    for (const row of rows) {
      const startTime = row.startTime ?? 0
      const dur = row.durationSeconds ?? 0
      const index = Math.floor((startTime - start) / dayMs)
      if (index < 0 || index >= buckets.length) {
        continue
      }
      const bucket = buckets[index]
      if (bucket !== undefined) bucket.totalSeconds += dur
    }
    return buckets
  }

  private getPerTask(start: UnixMs, end: UnixMs): WeeklyReportTaskItem[] {
    const stmt = this.db.prepare(
      `SELECT
        te.task_id AS taskId,
        t.title AS taskTitle,
        SUM(te.duration_seconds) AS totalSeconds,
        MAX(te.end_time) AS lastWorkedAt
      FROM time_entries te
      JOIN tasks t ON t.id = te.task_id
      WHERE te.start_time >= ? AND te.start_time < ?
      GROUP BY te.task_id
      ORDER BY totalSeconds DESC`
    )
    const rows = stmt.all(start, end) as {
      taskId: Id
      taskTitle: string
      totalSeconds: number
      lastWorkedAt: number | null
    }[]

    return rows.map((row) => ({
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      totalSeconds: row.totalSeconds,
      lastWorkedAt: row.lastWorkedAt
    }))
  }

  private getCompletedTasksCount(start: UnixMs, end: UnixMs): number {
    const stmt = this.db.prepare(
      "SELECT COUNT(1) AS c FROM tasks WHERE status = 'done' AND updated_at >= ? AND updated_at < ?"
    )
    const row = stmt.get(start, end) as { c: number }
    return row.c
  }

  private getTotalSecondsByUser(start: UnixMs, end: UnixMs, userId: Id): number {
    const stmt = this.db.prepare(
      `SELECT COALESCE(SUM(te.duration_seconds), 0) AS s
       FROM time_entries te
       JOIN tasks t ON t.id = te.task_id AND t.assigned_user_id = ?
       WHERE te.start_time >= ? AND te.start_time < ?`
    )
    const row = stmt.get(userId, start, end) as { s: number }
    return row.s
  }

  private getPerDayByUser(start: UnixMs, end: UnixMs, userId: Id): WeeklyReportDayItem[] {
    const dayMs = 24 * 60 * 60 * 1000
    const buckets: WeeklyReportDayItem[] = []
    for (let i = 0; i < 7; i += 1) {
      buckets.push({ date: start + i * dayMs, totalSeconds: 0 })
    }
    const stmt = this.db.prepare(
      `SELECT te.start_time AS startTime, te.duration_seconds AS durationSeconds
       FROM time_entries te
       JOIN tasks t ON t.id = te.task_id AND t.assigned_user_id = ?
       WHERE te.start_time >= ? AND te.start_time < ?`
    )
    const rows = stmt.all(userId, start, end) as { startTime?: number | null; durationSeconds?: number | null }[]
    for (const row of rows) {
      const startTime = row.startTime ?? 0
      const dur = row.durationSeconds ?? 0
      const index = Math.floor((startTime - start) / dayMs)
      if (index < 0 || index >= buckets.length) continue
      const bucket = buckets[index]
      if (bucket !== undefined) bucket.totalSeconds += dur
    }
    return buckets
  }

  private getPerTaskByUser(start: UnixMs, end: UnixMs, userId: Id): WeeklyReportTaskItem[] {
    const stmt = this.db.prepare(
      `SELECT
        te.task_id AS taskId,
        t.title AS taskTitle,
        SUM(te.duration_seconds) AS totalSeconds,
        MAX(te.end_time) AS lastWorkedAt
       FROM time_entries te
       JOIN tasks t ON t.id = te.task_id AND t.assigned_user_id = ?
       WHERE te.start_time >= ? AND te.start_time < ?
       GROUP BY te.task_id
       ORDER BY totalSeconds DESC`
    )
    const rows = stmt.all(userId, start, end) as {
      taskId: Id
      taskTitle: string
      totalSeconds: number
      lastWorkedAt: number | null
    }[]
    return rows.map((row) => ({
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      totalSeconds: row.totalSeconds,
      lastWorkedAt: row.lastWorkedAt
    }))
  }

  private getCompletedTasksCountByUser(start: UnixMs, end: UnixMs, userId: Id): number {
    const stmt = this.db.prepare(
      "SELECT COUNT(1) AS c FROM tasks WHERE assigned_user_id = ? AND status = 'done' AND updated_at >= ? AND updated_at < ?"
    )
    const row = stmt.get(userId, start, end) as { c: number }
    return row.c
  }
}


export type Id = number
export type UnixMs = number

export interface Project {
  id: Id
  name: string
  description: string
  createdAt: UnixMs
  updatedAt: UnixMs
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Task {
  id: Id
  projectId: Id
  title: string
  description: string
  status: TaskStatus
  priority: number
  assignedUserId: Id | null
  createdAt: UnixMs
  updatedAt: UnixMs
}

export interface User {
  id: Id
  firstName: string
  lastName: string
  role: string
  createdAt: UnixMs
  updatedAt: UnixMs
}

export interface TaskAttachment {
  id: Id
  taskId: Id
  originalName: string
  storedName: string
  storedPath: string
  mimeType: string
  size: number
  createdAt: UnixMs
}

export type TimeEntrySource = 'manual' | 'auto_stop'

export interface TimeEntry {
  id: Id
  taskId: Id
  startTime: UnixMs
  endTime: UnixMs | null
  durationSeconds: number
  source: TimeEntrySource
  createdAt: UnixMs
}

export interface ActivityLog {
  id: Id
  taskId: Id | null
  type: string
  payloadJson: string
  createdAt: UnixMs
}

export interface VaultSecret {
  id: Id
  title: string
  encPayloadJson: string
  createdAt: UnixMs
  updatedAt: UnixMs
}

export interface AppSetting {
  key: string
  value: string
}

export interface ActiveTimerSession {
  taskId: Id
  taskTitle: string
  startTime: UnixMs
}

export interface TodayTimeEntryItem {
  id: Id
  taskId: Id
  taskTitle: string
  startTime: UnixMs
  endTime: UnixMs | null
  durationSeconds: number
  source: string
}

export interface TodayTaskSummaryItem {
  taskId: Id
  taskTitle: string
  totalSeconds: number
}

export interface TaskTimeTotals {
  todaySeconds: number
  totalSeconds: number
}

export interface WeeklyReportRequest {
  baseDateMs: UnixMs
}

export interface WeeklyReportByUserRequest {
  baseDateMs: UnixMs
  userId: Id
}

export interface WeeklyReportDayItem {
  date: UnixMs
  totalSeconds: number
}

export interface WeeklyReportTaskItem {
  taskId: Id
  taskTitle: string
  totalSeconds: number
  lastWorkedAt: UnixMs | null
}

export interface WeeklyReportDetailItem {
  dateMs: UnixMs
  taskId: Id
  taskTitle: string
  totalSeconds: number
}

export interface WeeklyReportSummary {
  rangeStart: UnixMs
  rangeEnd: UnixMs
  totalSeconds: number
  completedTasksCount: number
  perDay: WeeklyReportDayItem[]
  perTask: WeeklyReportTaskItem[]
  detail: WeeklyReportDetailItem[]
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectInput {
  id: Id
  name?: string
  description?: string
}

export interface CreateTaskInput {
  projectId: Id
  title: string
  description: string
  status?: TaskStatus
  priority?: number
  assignedUserId?: Id | null
}

export interface UpdateTaskInput {
  id: Id
  title?: string
  description?: string
  status?: TaskStatus
  priority?: number
  assignedUserId?: Id | null
}

export interface CreateUserInput {
  firstName: string
  lastName: string
  role: string
}

export interface UpdateUserInput {
  id: Id
  firstName?: string
  lastName?: string
  role?: string
}

export interface CreateTaskAttachmentInput {
  taskId: Id
  originalName: string
  storedName: string
  storedPath: string
  mimeType: string
  size: number
}

export interface CreateTimeEntryInput {
  taskId: Id
  startTime: UnixMs
  source: TimeEntrySource
}

export interface StopTimeEntryInput {
  id: Id
  endTime: UnixMs
  source?: TimeEntrySource
}

export interface CreateActivityLogInput {
  taskId?: Id | null
  type: string
  payloadJson: string
}

export type VaultStatus = 'never_set' | 'locked' | 'unlocked'

export interface VaultSecretListItem {
  id: Id
  title: string
  createdAt: UnixMs
  updatedAt: UnixMs
}

export interface VaultSecretDecrypted {
  id: Id
  title: string
  body: string
  createdAt: UnixMs
  updatedAt: UnixMs
}

export interface CreateVaultNoteInput {
  title: string
  body: string
}

export interface UpdateVaultNoteInput {
  id: Id
  title?: string
  body?: string
}

export interface CreateVaultSecretInput {
  title: string
  encPayloadJson: string
}

export interface UpdateVaultSecretInput {
  id: Id
  title?: string
  encPayloadJson?: string
}


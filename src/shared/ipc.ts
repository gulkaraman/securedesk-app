/**
 * Typed IPC contract: channel names, argument types, and return types.
 * Preload uses this to expose window.api; main handlers must match these signatures.
 * See docs/ARCHITECTURE.md §5 for the IPC flow.
 */
import type {
  ActivityLog,
  AppSetting,
  ActiveTimerSession,
  CreateActivityLogInput,
  CreateProjectInput,
  CreateTaskAttachmentInput,
  CreateTaskInput,
  CreateTimeEntryInput,
  CreateUserInput,
  CreateVaultNoteInput,
  Id,
  Project,
  StopTimeEntryInput,
  Task,
  TaskAttachment,
  TimeEntry,
  TodayTaskSummaryItem,
  TodayTimeEntryItem,
  TaskTimeTotals,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateUserInput,
  UpdateVaultNoteInput,
  User,
  VaultSecret,
  VaultSecretDecrypted,
  VaultSecretListItem,
  VaultStatus,
  WeeklyReportByUserRequest,
  WeeklyReportRequest,
  WeeklyReportSummary
} from './models'
import type { Result } from './result'

export interface IpcInvokeMap {
  // Projects
  'projects:list': { args: []; result: Result<Project[]> }
  'projects:get': { args: [Id]; result: Result<Project> }
  'projects:create': { args: [CreateProjectInput]; result: Result<Project> }
  'projects:update': { args: [UpdateProjectInput]; result: Result<Project> }
  'projects:delete': { args: [Id]; result: Result<boolean> }

  // Users
  'users:list': { args: []; result: Result<User[]> }
  'users:get': { args: [Id]; result: Result<User> }
  'users:create': { args: [CreateUserInput]; result: Result<User> }
  'users:update': { args: [UpdateUserInput]; result: Result<User> }
  'users:delete': { args: [Id]; result: Result<boolean> }

  // Tasks
  'tasks:listByProject': { args: [Id]; result: Result<Task[]> }
  'tasks:get': { args: [Id]; result: Result<Task> }
  'tasks:create': { args: [CreateTaskInput]; result: Result<Task> }
  'tasks:update': { args: [UpdateTaskInput]; result: Result<Task> }
  'tasks:delete': { args: [Id]; result: Result<boolean> }

  // Attachments
  'taskAttachments:listByTask': { args: [Id]; result: Result<TaskAttachment[]> }
  'taskAttachments:create': { args: [CreateTaskAttachmentInput]; result: Result<TaskAttachment> }
  'taskAttachments:delete': { args: [Id]; result: Result<boolean> }
  'taskAttachments:pickAndAttach': { args: [Id]; result: Result<TaskAttachment | null> }
  'taskAttachments:open': { args: [Id]; result: Result<boolean> }
  'taskAttachments:showInFolder': { args: [Id]; result: Result<boolean> }

  // Time entries
  'timeEntries:listByTask': { args: [Id]; result: Result<TimeEntry[]> }
  'timeEntries:create': { args: [CreateTimeEntryInput]; result: Result<TimeEntry> }
  'timeEntries:stop': { args: [StopTimeEntryInput]; result: Result<TimeEntry> }
  'timeEntries:delete': { args: [Id]; result: Result<boolean> }

  // Timer
  'timer:getActive': { args: []; result: Result<ActiveTimerSession[]> }
  'timer:start': { args: [Id, Id | null]; result: Result<ActiveTimerSession> }
  'timer:stop': { args: [Id]; result: Result<TimeEntry> }
  'timer:todayEntries': { args: []; result: Result<TodayTimeEntryItem[]> }
  'timer:todaySummary': { args: []; result: Result<TodayTaskSummaryItem[]> }
  'timer:taskTotals': { args: [Id]; result: Result<TaskTimeTotals> }

  // Reports
  'reports:getWeekly': { args: [WeeklyReportRequest]; result: Result<WeeklyReportSummary> }
  'reports:exportWeeklyPdf': { args: [WeeklyReportRequest]; result: Result<boolean> }
  'reports:getWeeklyByUser': { args: [WeeklyReportByUserRequest]; result: Result<WeeklyReportSummary> }
  'reports:exportWeeklyPdfByUser': { args: [WeeklyReportByUserRequest]; result: Result<boolean> }

  // Activity log
  'activityLogs:list': { args: [number]; result: Result<ActivityLog[]> }
  'activityLogs:create': { args: [CreateActivityLogInput]; result: Result<ActivityLog> }

  // Vault
  'vault:getStatus': { args: []; result: Result<VaultStatus> }
  'vault:setMasterKey': { args: [string]; result: Result<boolean> }
  'vault:unlock': { args: [string]; result: Result<boolean> }
  'vault:lock': { args: []; result: Result<undefined> }
  'vaultSecrets:list': { args: []; result: Result<VaultSecretListItem[]> }
  'vaultSecrets:get': { args: [Id]; result: Result<VaultSecretDecrypted> }
  'vaultSecrets:create': { args: [CreateVaultNoteInput]; result: Result<VaultSecret> }
  'vaultSecrets:update': { args: [UpdateVaultNoteInput]; result: Result<VaultSecret> }
  'vaultSecrets:delete': { args: [Id]; result: Result<boolean> }

  // Settings
  'settings:list': { args: []; result: Result<AppSetting[]> }
  'settings:get': { args: [string]; result: Result<AppSetting> }
  'settings:set': { args: [string, string]; result: Result<AppSetting> }

  'window:minimize': { args: []; result: undefined }
  'window:toggleMaximize': { args: []; result: boolean }
  'window:close': { args: []; result: undefined }
  'window:isMaximized': { args: []; result: boolean }
}

export type IpcChannel = keyof IpcInvokeMap
export type IpcArgs<C extends IpcChannel> = IpcInvokeMap[C]['args']
export type IpcResult<C extends IpcChannel> = IpcInvokeMap[C]['result']

export interface IpcEventMap {
  'window:maximized-changed': { args: [boolean] }
}

export type IpcEventChannel = keyof IpcEventMap
export type IpcEventArgs<C extends IpcEventChannel> = IpcEventMap[C]['args']

export interface RendererApi {
  projects: {
    list: () => Promise<Result<Project[]>>
    get: (id: Id) => Promise<Result<Project>>
    create: (input: CreateProjectInput) => Promise<Result<Project>>
    update: (input: UpdateProjectInput) => Promise<Result<Project>>
    delete: (id: Id) => Promise<Result<boolean>>
  }
  users: {
    list: () => Promise<Result<User[]>>
    get: (id: Id) => Promise<Result<User>>
    create: (input: CreateUserInput) => Promise<Result<User>>
    update: (input: UpdateUserInput) => Promise<Result<User>>
    delete: (id: Id) => Promise<Result<boolean>>
  }
  tasks: {
    listByProject: (projectId: Id) => Promise<Result<Task[]>>
    get: (id: Id) => Promise<Result<Task>>
    create: (input: CreateTaskInput) => Promise<Result<Task>>
    update: (input: UpdateTaskInput) => Promise<Result<Task>>
    delete: (id: Id) => Promise<Result<boolean>>
  }
  taskAttachments: {
    listByTask: (taskId: Id) => Promise<Result<TaskAttachment[]>>
    create: (input: CreateTaskAttachmentInput) => Promise<Result<TaskAttachment>>
    delete: (id: Id) => Promise<Result<boolean>>
    pickAndAttach: (taskId: Id) => Promise<Result<TaskAttachment | null>>
    open: (attachmentId: Id) => Promise<Result<boolean>>
    showInFolder: (attachmentId: Id) => Promise<Result<boolean>>
  }
  timeEntries: {
    listByTask: (taskId: Id) => Promise<Result<TimeEntry[]>>
    create: (input: CreateTimeEntryInput) => Promise<Result<TimeEntry>>
    stop: (input: StopTimeEntryInput) => Promise<Result<TimeEntry>>
    delete: (id: Id) => Promise<Result<boolean>>
  }
  timer: {
    getActive: () => Promise<Result<ActiveTimerSession[]>>
    start: (taskId: Id, userId: Id | null) => Promise<Result<ActiveTimerSession>>
    stop: (taskId: Id) => Promise<Result<TimeEntry>>
    todayEntries: () => Promise<Result<TodayTimeEntryItem[]>>
    todaySummary: () => Promise<Result<TodayTaskSummaryItem[]>>
    taskTotals: (taskId: Id) => Promise<Result<TaskTimeTotals>>
  }
  reports: {
    getWeekly: (request: WeeklyReportRequest) => Promise<Result<WeeklyReportSummary>>
    exportWeeklyPdf: (request: WeeklyReportRequest) => Promise<Result<boolean>>
    getWeeklyByUser: (request: WeeklyReportByUserRequest) => Promise<Result<WeeklyReportSummary>>
    exportWeeklyPdfByUser: (request: WeeklyReportByUserRequest) => Promise<Result<boolean>>
  }
  activityLogs: {
    list: (limit: number) => Promise<Result<ActivityLog[]>>
    create: (input: CreateActivityLogInput) => Promise<Result<ActivityLog>>
  }
  vault: {
    getStatus: () => Promise<Result<VaultStatus>>
    setMasterKey: (masterKey: string) => Promise<Result<boolean>>
    unlock: (masterKey: string) => Promise<Result<boolean>>
    lock: () => Promise<Result<undefined>>
  }
  vaultSecrets: {
    list: () => Promise<Result<VaultSecretListItem[]>>
    get: (id: Id) => Promise<Result<VaultSecretDecrypted>>
    create: (input: CreateVaultNoteInput) => Promise<Result<VaultSecret>>
    update: (input: UpdateVaultNoteInput) => Promise<Result<VaultSecret>>
    delete: (id: Id) => Promise<Result<boolean>>
  }
  settings: {
    list: () => Promise<Result<AppSetting[]>>
    get: (key: string) => Promise<Result<AppSetting>>
    set: (key: string, value: string) => Promise<Result<AppSetting>>
  }
  window: {
    minimize: () => Promise<void>
    close: () => Promise<void>
    toggleMaximize: () => Promise<boolean>
    isMaximized: () => Promise<boolean>
    onMaximizedChanged: (listener: (isMaximized: boolean) => void) => () => void
  }
}


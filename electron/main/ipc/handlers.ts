/**
 * IPC handlers: bridge between renderer (window.api) and main process services.
 * Each handler wraps service calls and returns Result<T>; see src/shared/ipc.ts for the contract.
 */
import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcChannel } from '@shared/ipc'
import type {
  CreateActivityLogInput,
  CreateProjectInput,
  CreateTaskAttachmentInput,
  CreateTaskInput,
  CreateTimeEntryInput,
  CreateUserInput,
  CreateVaultNoteInput,
  StopTimeEntryInput,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateUserInput,
  UpdateVaultNoteInput,
  WeeklyReportByUserRequest,
  WeeklyReportRequest
} from '@shared/models'
import { err, ok, type Result } from '@shared/result'
import { NotFoundError, ValidationError, toAppError } from '@shared/errors'
import { getDb } from '../db/connection'
import { migrate } from '../db/migrate'
import { seedDemoData } from '../db/seed'
import { ActivityLogRepository } from '../repositories/activityLogRepository'
import { ProjectRepository } from '../repositories/projectRepository'
import { SettingRepository } from '../repositories/settingRepository'
import { TaskAttachmentRepository } from '../repositories/taskAttachmentRepository'
import { TaskRepository } from '../repositories/taskRepository'
import { UserRepository } from '../repositories/userRepository'
import { TimeEntryRepository } from '../repositories/timeEntryRepository'
import { VaultRepository } from '../repositories/vaultRepository'
import { AttachmentFileService } from '../services/attachmentFileService'
import { ActivityLogService } from '../services/activityLogService'
import { ProjectService } from '../services/projectService'
import { SettingService } from '../services/settingService'
import { TaskAttachmentService } from '../services/taskAttachmentService'
import { TaskService } from '../services/taskService'
import { UserService } from '../services/userService'
import { TimeEntryService } from '../services/timeEntryService'
import { TimerService } from '../services/timerService'
import { IdleTimerService } from '../services/idleTimerService'
import { ReportService } from '../services/reportService'
import { VaultKeyService } from '../services/vaultKeyService'
import { VaultService } from '../services/vaultService'
import { ProjectCascadeService } from '../services/projectCascadeService'
import { TaskCascadeService } from '../services/taskCascadeService'

function assertChannel(channel: string): asserts channel is IpcChannel {
  // runtime no-op; compile-time guard only
  void channel
}

const DEMO_PROJECT_NAME = 'Demo Project'

function removeDemoProjectIfExists(db: ReturnType<typeof getDb>, projectCascadeService: ProjectCascadeService): void {
  const projectRepo = new ProjectRepository(db)
  const projects = projectRepo.list()
  const demo = projects.find((p) => p.name === DEMO_PROJECT_NAME)
  if (demo) {
    projectCascadeService.deleteProject(demo.id)
  }
}

export function registerIpcHandlers(): void {
  const db = getDb()
  migrate(db)
  seedDemoData(db)

  const projectRepo = new ProjectRepository(db)
  const userRepo = new UserRepository(db)
  const taskRepo = new TaskRepository(db)
  const projectService = new ProjectService(projectRepo)
  const userService = new UserService(userRepo)
  const taskService = new TaskService(taskRepo, projectRepo)
  const taskAttachmentService = new TaskAttachmentService(new TaskAttachmentRepository(db))
  const timeEntryService = new TimeEntryService(new TimeEntryRepository(db), taskRepo)
  const activityLogService = new ActivityLogService(new ActivityLogRepository(db))
  const timerService = new TimerService(db)
  const settingService = new SettingService(new SettingRepository(db))
  const vaultKeyService = new VaultKeyService(new SettingRepository(db))
  const vaultService = new VaultService(new VaultRepository(db), vaultKeyService)
  const projectCascadeService = new ProjectCascadeService(db, projectRepo)
  removeDemoProjectIfExists(db, projectCascadeService)
  const taskCascadeService = new TaskCascadeService(db)
  // idleTimerService is created for side effects (event subscriptions)
  // and does not need to be referenced afterwards.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const idleTimerService = new IdleTimerService(timerService, activityLogService)
  const reportService = new ReportService(db)
  // Startup strategy: keep active timers as-is and let renderer read them via timer:getActive.


  const wrap = <T>(fn: () => T): Result<T> => {
    try {
      return ok(fn())
    } catch (e: unknown) {
      return err(toAppError(e))
    }
  }

  const wrapAsync = async <T>(fn: () => Promise<T>): Promise<Result<T>> => {
    try {
      return ok(await fn())
    } catch (e: unknown) {
      return err(toAppError(e))
    }
  }

  // Projects
  ipcMain.handle('projects:list', () => wrap(() => projectService.list()))
  ipcMain.handle('projects:get', (_event, id: number) =>
    wrap(() => {
      const p = projectService.get(id)
      if (!p) throw new NotFoundError('Project not found')
      return p
    })
  )
  ipcMain.handle('projects:create', (_event, input: CreateProjectInput) => wrap(() => projectService.create(input)))
  ipcMain.handle('projects:update', (_event, input: UpdateProjectInput) =>
    wrap(() => {
      const updated = projectService.update(input)
      if (!updated) throw new NotFoundError('Project not found')
      return updated
    })
  )
  ipcMain.handle('projects:delete', (_event, id: number) =>
    wrap(() => {
      const deleted = projectCascadeService.deleteProject(id)
      if (!deleted) throw new NotFoundError('Project not found')
      return true
    })
  )

  // Users
  ipcMain.handle('users:list', () => wrap(() => userService.list()))
  ipcMain.handle('users:get', (_event, id: number) =>
    wrap(() => {
      const u = userService.get(id)
      if (!u) throw new NotFoundError('Kullanıcı bulunamadı')
      return u
    })
  )
  ipcMain.handle('users:create', (_event, input: CreateUserInput) => wrap(() => userService.create(input)))
  ipcMain.handle('users:update', (_event, input: UpdateUserInput) =>
    wrap(() => {
      const updated = userService.update(input)
      if (!updated) throw new NotFoundError('Kullanıcı bulunamadı')
      return updated
    })
  )
  ipcMain.handle('users:delete', (_event, id: number) =>
    wrap(() => {
      const deleted = userService.delete(id)
      if (!deleted) throw new NotFoundError('Kullanıcı bulunamadı')
      return true
    })
  )

  // Tasks
  ipcMain.handle('tasks:listByProject', (_event, projectId: number) => wrap(() => taskService.listByProject(projectId)))
  ipcMain.handle('tasks:get', (_event, id: number) =>
    wrap(() => {
      const t = taskService.get(id)
      if (!t) throw new NotFoundError('Görev bulunamadı')
      return t
    })
  )
  ipcMain.handle('tasks:create', (_event, input: CreateTaskInput) =>
    wrap(() => {
      const created = taskService.create(input)
      activityLogService.create({
        taskId: created.id,
        type: 'task_created',
        payloadJson: JSON.stringify({
          taskId: created.id,
          title: created.title,
          projectId: created.projectId
        })
      })
      return created
    })
  )
  ipcMain.handle('tasks:update', (_event, input: UpdateTaskInput) =>
    wrap(() => {
      const updated = taskService.update(input)
      if (!updated) throw new NotFoundError('Görev bulunamadı')
      return updated
    })
  )
  ipcMain.handle('tasks:delete', (_event, id: number) =>
    wrap(() => {
      const deleted = taskCascadeService.deleteTask(id)
      if (!deleted) throw new NotFoundError('Görev bulunamadı')
      // Log with taskId: null because the task is already deleted (FK would fail otherwise)
      activityLogService.create({
        taskId: null,
        type: 'task_deleted',
        payloadJson: JSON.stringify({ taskId: id })
      })
      return true
    })
  )

  // Attachments
  ipcMain.handle('taskAttachments:listByTask', (_event, taskId: number) => wrap(() => taskAttachmentService.listByTask(taskId)))
  ipcMain.handle('taskAttachments:create', (_event, input: CreateTaskAttachmentInput) =>
    wrap(() => taskAttachmentService.create(input))
  )
  ipcMain.handle('taskAttachments:pickAndAttach', async (event, taskId: number) =>
    await wrapAsync(async () => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new ValidationError('Aktif pencere yok')
      const fileService = new AttachmentFileService(db)
      const created = await fileService.pickAndAttach(win, taskId)
      if (!created) return null

      activityLogService.create({
        taskId: created.taskId,
        type: 'attachment_added',
        payloadJson: JSON.stringify({
          taskId: created.taskId,
          attachmentId: created.id,
          originalName: created.originalName,
          storedName: created.storedName,
          size: created.size
        })
      })

      return created
    })
  )

  ipcMain.handle('taskAttachments:open', async (_event, attachmentId: number) =>
    await wrapAsync(async () => {
      const repo = new TaskAttachmentRepository(db)
      const att = repo.getById(attachmentId)
      if (!att) throw new NotFoundError('Ek bulunamadı')
      const fileService = new AttachmentFileService(db)
      return await fileService.openAttachment(att)
    })
  )

  ipcMain.handle('taskAttachments:showInFolder', (_event, attachmentId: number) =>
    wrap(() => {
      const repo = new TaskAttachmentRepository(db)
      const att = repo.getById(attachmentId)
      if (!att) throw new NotFoundError('Ek bulunamadı')
      const fileService = new AttachmentFileService(db)
      return fileService.showInFolder(att)
    })
  )

  ipcMain.handle('taskAttachments:delete', (_event, attachmentId: number) =>
    wrap(() => {
      const repo = new TaskAttachmentRepository(db)
      const att = repo.getById(attachmentId)
      if (!att) throw new NotFoundError('Ek bulunamadı')

      const fileService = new AttachmentFileService(db)
      fileService.deleteFileForAttachment(att)

      const deleted = repo.delete(attachmentId)
      if (!deleted) throw new NotFoundError('Ek bulunamadı')

      activityLogService.create({
        taskId: att.taskId,
        type: 'attachment_removed',
        payloadJson: JSON.stringify({
          taskId: att.taskId,
          attachmentId: att.id,
          storedName: att.storedName
        })
      })

      return true
    })
  )

  // Time entries
  ipcMain.handle('timeEntries:listByTask', (_event, taskId: number) => wrap(() => timeEntryService.listByTask(taskId)))
  ipcMain.handle('timeEntries:create', (_event, input: CreateTimeEntryInput) => wrap(() => timeEntryService.create(input)))
  ipcMain.handle('timeEntries:stop', (_event, input: StopTimeEntryInput) =>
    wrap(() => {
      const stopped = timeEntryService.stop(input)
      if (!stopped) throw new NotFoundError('TimeEntry not found')
      return stopped
    })
  )
  ipcMain.handle('timeEntries:delete', (_event, id: number) => wrap(() => timeEntryService.delete(id)))

  // Timer (multiple concurrent sessions)
  ipcMain.handle('timer:getActive', () => wrap(() => timerService.getActive()))
  ipcMain.handle('timer:start', (_event, taskId: number, userId: number | null) =>
    wrap(() => {
      const session = timerService.start(taskId, userId, Date.now())
      activityLogService.create({
        taskId: session.taskId,
        type: 'timer_started',
        payloadJson: JSON.stringify({
          taskId: session.taskId,
          startTime: session.startTime,
          source: 'manual'
        })
      })
      return session
    })
  )
  ipcMain.handle('timer:stop', (_event, taskId: number) =>
    wrap(() => {
      const entry = timerService.stop(taskId, null, Date.now(), 'manual')
      activityLogService.create({
        taskId: entry.taskId,
        type: 'timer_stopped',
        payloadJson: JSON.stringify({
          taskId: entry.taskId,
          startTime: entry.startTime,
          endTime: entry.endTime,
          durationSeconds: entry.durationSeconds,
          source: entry.source
        })
      })
      return entry
    })
  )
  ipcMain.handle('timer:todayEntries', () => wrap(() => timerService.listTodayEntries(Date.now())))
  ipcMain.handle('timer:todaySummary', () => wrap(() => timerService.todaySummaryByTask(Date.now())))
  ipcMain.handle('timer:taskTotals', (_event, taskId: number) => wrap(() => timerService.totalsForTask(taskId)))
  // Reports
  ipcMain.handle('reports:getWeekly', (_event, req) =>
    wrap(() => reportService.getWeeklyReport(req as WeeklyReportRequest))
  )
  ipcMain.handle('reports:getWeeklyByUser', (_event, req) =>
    wrap(() => reportService.getWeeklyReportByUser(req as WeeklyReportByUserRequest))
  )
  ipcMain.handle('reports:exportWeeklyPdf', async (event, req: WeeklyReportRequest) =>
    await wrapAsync(async () => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new ValidationError('Aktif pencere yok')
      const dateStr = new Date(req.baseDateMs).toISOString().slice(0, 10)
      const defaultPath = path.join(app.getPath('documents'), `weekly-report-${dateStr}.pdf`)
      const result = await dialog.showSaveDialog(win, {
        defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (result.canceled || !result.filePath) return false
      const pdfBuffer = await event.sender.printToPDF({ printBackground: true, pageSize: 'A4' })
      fs.writeFileSync(result.filePath, pdfBuffer)
      return true
    })
  )
  ipcMain.handle('reports:exportWeeklyPdfByUser', async (event, req: WeeklyReportByUserRequest) =>
    await wrapAsync(async () => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new ValidationError('Aktif pencere yok')
      const user = userService.get(req.userId)
      if (!user) throw new NotFoundError('Kullanıcı bulunamadı')
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yyyy = now.getFullYear()
      const hh = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      const adSoyad = `${user.firstName}${user.lastName}`.replace(/\s/g, '')
      const fileName = `${adSoyad}_${dd}.${mm}.${String(yyyy)}_${hh}-${min}.pdf`
      const defaultPath = path.join(app.getPath('documents'), fileName)
      const result = await dialog.showSaveDialog(win, {
        defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (result.canceled || !result.filePath) return false
      const pdfBuffer = await event.sender.printToPDF({ printBackground: true, pageSize: 'A4' })
      fs.writeFileSync(result.filePath, pdfBuffer)
      return true
    })
  )

  // Activity logs
  ipcMain.handle('activityLogs:list', (_event, limit: number) => wrap(() => activityLogService.list(limit)))
  ipcMain.handle('activityLogs:create', (_event, input: CreateActivityLogInput) =>
    wrap(() => activityLogService.create(input))
  )

  // Vault
  ipcMain.handle('vault:getStatus', () => wrap(() => vaultKeyService.getStatus()))
  ipcMain.handle('vault:setMasterKey', (_event, masterKey: string) =>
    wrap(() => {
      vaultKeyService.setMasterKey(masterKey)
      return true
    })
  )
  ipcMain.handle('vault:unlock', (_event, masterKey: string) =>
    wrap(() => {
      vaultKeyService.unlock(masterKey)
      return true
    })
  )
  ipcMain.handle('vault:lock', () =>
    wrap(() => {
      vaultKeyService.lock()
      return undefined
    })
  )
  ipcMain.handle('vaultSecrets:list', () => wrap(() => vaultService.list()))
  ipcMain.handle('vaultSecrets:get', (_event, id: number) =>
    wrap(() => {
      const s = vaultService.get(id)
      if (!s) throw new NotFoundError('Not bulunamadı')
      return s
    })
  )
  ipcMain.handle('vaultSecrets:create', (_event, input: CreateVaultNoteInput) =>
    wrap(() => vaultService.create(input))
  )
  ipcMain.handle('vaultSecrets:update', (_event, input: UpdateVaultNoteInput) =>
    wrap(() => {
      const updated = vaultService.update(input)
      if (!updated) throw new NotFoundError('Not bulunamadı')
      return updated
    })
  )
  ipcMain.handle('vaultSecrets:delete', (_event, id: number) => wrap(() => vaultService.delete(id)))

  // Settings
  ipcMain.handle('settings:list', () => wrap(() => settingService.list()))
  ipcMain.handle('settings:get', (_event, key: string) =>
    wrap(() => {
      const s = settingService.get(key)
      if (!s) throw new NotFoundError('Setting not found')
      return s
    })
  )
  ipcMain.handle('settings:set', (_event, key: string, value: string) => wrap(() => settingService.set(key, value)))

  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false

    if (win.isMaximized()) {
      win.unmaximize()
      return false
    }
    win.maximize()
    return true
  })

  // Keep a reference to IpcChannel in this module so accidental typos surface early in TS.
  // (This does not change runtime behavior.)
  assertChannel('projects:list')
}


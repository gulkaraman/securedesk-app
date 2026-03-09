import { Notification, powerMonitor } from 'electron'
import type { TimerService } from './timerService'
import type { ActivityLogService } from './activityLogService'

interface IdleTimerOptions {
  idleThresholdSeconds: number
  pollIntervalSeconds: number
}

const DEFAULT_OPTIONS: IdleTimerOptions = {
  idleThresholdSeconds: 600,
  pollIntervalSeconds: 60
}

export class IdleTimerService {
  private readonly timerService: TimerService
  private readonly activityLogService: ActivityLogService
  private readonly options: IdleTimerOptions
  private intervalId: NodeJS.Timeout | null = null

  public constructor(timerService: TimerService, activityLogService: ActivityLogService, options?: Partial<IdleTimerOptions>) {
    this.timerService = timerService
    this.activityLogService = activityLogService
    this.options = { ...DEFAULT_OPTIONS, ...(options ?? {}) }
    this.startPolling()
    powerMonitor.on('suspend', () => {
      this.handleSuspendOrLock('suspend')
    })
    powerMonitor.on('lock-screen', () => {
      this.handleSuspendOrLock('lock-screen')
    })
  }

  private startPolling(): void {
    if (this.intervalId) return
    this.intervalId = setInterval(() => {
      this.checkIdle()
    }, this.options.pollIntervalSeconds * 1000)
  }

  private stopPolling(): void {
    if (!this.intervalId) return
    clearInterval(this.intervalId)
    this.intervalId = null
  }

  private checkIdle(): void {
    const idleSeconds = powerMonitor.getSystemIdleTime()
    if (idleSeconds < this.options.idleThresholdSeconds) return
    this.autoStop('idle', idleSeconds)
  }

  private handleSuspendOrLock(reason: 'suspend' | 'lock-screen'): void {
    this.autoStop(reason, powerMonitor.getSystemIdleTime())
  }

  private autoStop(reason: 'idle' | 'suspend' | 'lock-screen', idleSeconds: number): void {
    const active = this.timerService.getActive()
    if (!active) return

    const now = Date.now()
    const entry = this.timerService.stop(now, 'auto_stop')

    this.activityLogService.create({
      taskId: entry.taskId,
      type: 'idle_detected',
      payloadJson: JSON.stringify({
        taskId: entry.taskId,
        idleSeconds,
        reason
      })
    })

    this.activityLogService.create({
      taskId: entry.taskId,
      type: 'timer_auto_stopped',
      payloadJson: JSON.stringify({
        taskId: entry.taskId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationSeconds: entry.durationSeconds,
        source: entry.source,
        reason
      })
    })

    const notification = new Notification({
      title: 'Süre takibi durduruldu',
      body: '10 dakikalık hareketsizlik nedeniyle süre takibi otomatik durduruldu.'
    })
    notification.show()
  }

  public dispose(): void {
    this.stopPolling()
  }
}


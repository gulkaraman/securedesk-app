import { useEffect, useSyncExternalStore } from 'react'
import type { ActiveTimerSession, Id } from '@shared/models'
import { unwrap } from '@shared/result'

export interface TimerState {
  active: ActiveTimerSession[]
  nowMs: number
  loading: boolean
  error: string | null
}

let state: TimerState = {
  active: [],
  nowMs: Date.now(),
  loading: false,
  error: null
}

const listeners = new Set<() => void>()
let mountedConsumers = 0

function emit(): void {
  for (const l of listeners) l()
}

function setState(partial: Partial<TimerState>): void {
  state = { ...state, ...partial }
  emit()
}

let tickInterval: number | null = null
const scheduledStopByKey = new Map<string, ReturnType<typeof setTimeout>>()

function toFiniteMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const asNumber = Number(trimmed)
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber
    }

    const asDate = Date.parse(trimmed)
    if (Number.isFinite(asDate) && asDate > 0) {
      return asDate
    }
  }

  return null
}

interface NormalizedTimer extends ActiveTimerSession {
  endedAtMs?: number
}

function normalizeTimer(input: unknown): NormalizedTimer | null {
  if (!input || typeof input !== 'object') return null

  const raw = input as Record<string, unknown>

  const startTime =
    toFiniteMs(raw.startTime) ??
    toFiniteMs(raw.startedAtMs) ??
    toFiniteMs(raw.started_at_ms) ??
    toFiniteMs(raw.startedAt)

  if (startTime == null) return null

  const endedAtMs = toFiniteMs(raw.endedAtMs) ?? toFiniteMs(raw.ended_at_ms) ?? toFiniteMs(raw.endedAt) ?? undefined
  const projectName = typeof raw.projectName === 'string' ? raw.projectName : ''
  const taskTitle = typeof raw.taskTitle === 'string' ? raw.taskTitle : ''
  const userName =
    raw.userName == null
      ? null
      : typeof raw.userName === 'string'
        ? raw.userName
        : typeof raw.userId === 'number' || typeof raw.userId === 'string'
          ? String(raw.userId)
          : null

  const base: ActiveTimerSession = {
    projectId: Number(raw.projectId),
    projectName,
    taskId: Number(raw.taskId),
    taskTitle,
    userId: raw.userId == null ? null : Number(raw.userId),
    userName,
    startTime
  }

  const result: NormalizedTimer = endedAtMs != null ? { ...base, endedAtMs } : base
  return result
}

async function refreshActive(): Promise<void> {
  setState({ loading: true, error: null })

  try {
    const res = await window.api.timer.getActive()
    const next = unwrap(res)

    const safe = (Array.isArray(next) ? next : [])
      .map((item) => normalizeTimer(item))
      .filter((item): item is NormalizedTimer => item !== null)

    setState({
      active: safe,
      nowMs: Date.now(),
      loading: false,
      error: null
    })
  } catch (e: unknown) {
    setState({
      error: e instanceof Error ? e.message : 'Timer yüklenemedi',
      loading: false
    })
  }
}

function key(taskId: Id): string {
  return String(taskId)
}

function clearScheduledStopFor(taskId: Id): void {
  const id = scheduledStopByKey.get(key(taskId))
  if (id != null) {
    clearTimeout(id)
    scheduledStopByKey.delete(key(taskId))
  }
}

function clearAllScheduledStops(): void {
  for (const id of scheduledStopByKey.values()) clearTimeout(id)
  scheduledStopByKey.clear()
}

function ensureTicking(): void {
  if (tickInterval !== null) return

  tickInterval = window.setInterval(() => {
    setState({ nowMs: Date.now() })
  }, 250)
}

function stopTicking(): void {
  if (tickInterval === null) return
  window.clearInterval(tickInterval)
  tickInterval = null
}

export const timerStore = {
  getSnapshot(): TimerState {
    return state
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  async init(): Promise<void> {
    await refreshActive()
    ensureTicking()
  },

  async start(taskId: Id, userId: Id | null = null): Promise<void> {
    setState({ loading: true, error: null })

    try {
      await window.api.timer.start(taskId, userId)
      await refreshActive()
    } catch (e: unknown) {
      setState({
        error: e instanceof Error ? e.message : 'Başlatılamadı',
        loading: false
      })
    }
  },

  async startMany(taskIds: Id[], userId: Id | null = null): Promise<void> {
    setState({ loading: true, error: null })

    try {
      const uniqueTaskIds = Array.from(new Map(taskIds.map((id) => [String(id), id])).values())

      await Promise.all(uniqueTaskIds.map((id) => window.api.timer.start(id, userId)))
      await refreshActive()
    } catch (e: unknown) {
      setState({
        error: e instanceof Error ? e.message : 'Toplu başlatılamadı',
        loading: false
      })
    }
  },

  async startWithDuration(taskId: Id, durationMinutes: number, userId: Id | null = null): Promise<void> {
    clearScheduledStopFor(taskId)
    setState({ loading: true, error: null })

    try {
      await window.api.timer.start(taskId, userId)
      await refreshActive()

      const ms = Math.max(1, Math.floor(durationMinutes)) * 60 * 1000
      const timeoutId = setTimeout(() => {
        scheduledStopByKey.delete(key(taskId))
        void timerStore.stop(taskId)
      }, ms)

      scheduledStopByKey.set(key(taskId), timeoutId)
    } catch (e: unknown) {
      setState({
        error: e instanceof Error ? e.message : 'Başlatılamadı',
        loading: false
      })
    }
  },

  async stop(taskId: Id): Promise<void> {
    clearScheduledStopFor(taskId)
    setState({ loading: true, error: null })

    try {
      await window.api.timer.stop(taskId)
      await refreshActive()
    } catch (e: unknown) {
      setState({
        error: e instanceof Error ? e.message : 'Durdurulamadı',
        loading: false
      })
    }
  },

  async stopMany(taskIds: Id[]): Promise<void> {
    setState({ loading: true, error: null })

    try {
      const uniqueTaskIds = Array.from(new Map(taskIds.map((id) => [String(id), id])).values())

      uniqueTaskIds.forEach((id) => {
        clearScheduledStopFor(id)
      })

      await Promise.all(uniqueTaskIds.map((id) => window.api.timer.stop(id)))
      await refreshActive()
    } catch (e: unknown) {
      setState({
        error: e instanceof Error ? e.message : 'Toplu durdurulamadı',
        loading: false
      })
    }
  },

  cleanup(): void {
    clearAllScheduledStops()
    stopTicking()
  }
} as const

export function useTimerState(): TimerState {
  const snap = useSyncExternalStore(
    (listener) => timerStore.subscribe(listener),
    () => timerStore.getSnapshot(),
    () => timerStore.getSnapshot()
  )

  useEffect(() => {
    mountedConsumers += 1
    void timerStore.init()

    return () => {
      mountedConsumers = Math.max(0, mountedConsumers - 1)
      if (mountedConsumers === 0) {
        timerStore.cleanup()
      }
    }
  }, [])

  return snap
}

export function isValidRunningTimer(timer: unknown): timer is NormalizedTimer {
  return normalizeTimer(timer) !== null
}

export function getValidActiveTimers(list: ActiveTimerSession[] | null | undefined): ActiveTimerSession[] {
  if (!Array.isArray(list) || list.length === 0) return []

  return list
    .map((item) => normalizeTimer(item))
    .filter((item): item is NormalizedTimer => item !== null)
}

export function getElapsedSeconds(timer: unknown, nowMs: number = Date.now()): number {
  const safeTimer = normalizeTimer(timer)
  if (!safeTimer) return 0

  const safeNow = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now()
  const safeEnd =
    typeof safeTimer.endedAtMs === 'number' && Number.isFinite(safeTimer.endedAtMs)
      ? safeTimer.endedAtMs
      : safeNow

  const diffSeconds = Math.floor((safeEnd - safeTimer.startTime) / 1000)

  return Number.isFinite(diffSeconds) && diffSeconds >= 0 ? diffSeconds : 0
}
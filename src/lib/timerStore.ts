import { useEffect, useSyncExternalStore } from 'react'
import type { ActiveTimerSession, Id } from '@shared/models'
import { unwrap } from '@shared/result'

export interface TimerState {
  active: ActiveTimerSession | null
  nowMs: number
  loading: boolean
  error: string | null
}

let state: TimerState = {
  active: null,
  nowMs: Date.now(),
  loading: false,
  error: null
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function setState(partial: Partial<TimerState>): void {
  state = { ...state, ...partial }
  emit()
}

let tickInterval: number | null = null
let scheduledStopTimeoutId: ReturnType<typeof setTimeout> | null = null

async function refreshActive(): Promise<void> {
  setState({ loading: true, error: null })
  try {
    const res = await window.api.timer.getActive()
    setState({ active: unwrap(res), loading: false })
  } catch (e: unknown) {
    setState({ error: e instanceof Error ? e.message : 'Timer yüklenemedi', loading: false })
  }
}

function clearScheduledStop(): void {
  if (scheduledStopTimeoutId !== null) {
    clearTimeout(scheduledStopTimeoutId)
    scheduledStopTimeoutId = null
  }
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
  async start(taskId: Id): Promise<void> {
    clearScheduledStop()
    setState({ loading: true, error: null })
    try {
      const res = await window.api.timer.start(taskId)
      setState({ active: unwrap(res), loading: false })
    } catch (e: unknown) {
      setState({ error: e instanceof Error ? e.message : 'Başlatılamadı', loading: false })
    }
  },
  async startWithDuration(taskId: Id, durationMinutes: number): Promise<void> {
    clearScheduledStop()
    setState({ loading: true, error: null })
    try {
      const res = await window.api.timer.start(taskId)
      setState({ active: unwrap(res), loading: false })
      const ms = Math.max(1, Math.floor(durationMinutes)) * 60 * 1000
      scheduledStopTimeoutId = setTimeout(() => {
        scheduledStopTimeoutId = null
        void timerStore.stop()
      }, ms)
    } catch (e: unknown) {
      setState({ error: e instanceof Error ? e.message : 'Başlatılamadı', loading: false })
    }
  },
  async stop(): Promise<void> {
    clearScheduledStop()
    setState({ loading: true, error: null })
    try {
      await window.api.timer.stop()
      setState({ active: null, loading: false })
    } catch (e: unknown) {
      setState({ error: e instanceof Error ? e.message : 'Durdurulamadı', loading: false })
    }
  },
  cleanup(): void {
    clearScheduledStop()
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
    void timerStore.init()
    return () => {
      timerStore.cleanup()
    }
  }, [])

  return snap
}

export function getElapsedSeconds(active: ActiveTimerSession | null, nowMs: number): number {
  if (!active) return 0
  return Math.max(0, Math.floor((nowMs - active.startTime) / 1000))
}


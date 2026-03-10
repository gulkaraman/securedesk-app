import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Project, Task, TodayTaskSummaryItem, TodayTimeEntryItem } from '@shared/models'
import { unwrap } from '@shared/result'
import { DataTable } from '../../components/DataTable'
import { getElapsedSeconds, timerStore, useTimerState } from '@lib/timerStore'
import { formatDuration } from '@lib/time'
import { TodaySummaryChart } from './components/TodaySummaryChart'

export function TimerPage() {
  const timer = useTimerState()
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [customMinutes, setCustomMinutes] = useState<string>('')
  const [entries, setEntries] = useState<TodayTimeEntryItem[]>([])
  const [summary, setSummary] = useState<TodayTaskSummaryItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterTaskIds, setFilterTaskIds] = useState<Set<number>>(new Set())

  const refresh = async () => {
    setBusy(true)
    setError(null)

    try {
      const e = unwrap(await window.api.timer.todayEntries())
      const s = unwrap(await window.api.timer.todaySummary())
      setEntries(e)
      setSummary(s)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi')
    } finally {
      setBusy(false)
    }
  }

  const refreshProjects = async () => {
    const res = await window.api.projects.list()
    setProjects(unwrap(res))
  }

  const refreshTasks = async (projectId: number) => {
    const res = await window.api.tasks.listByProject(projectId)
    const next = unwrap(res)
    setTasks(next)

    if (next.length === 0 || (selectedTaskId !== null && !next.some((t) => t.id === selectedTaskId))) {
      setSelectedTaskId(null)
    }
  }

  useEffect(() => {
    void (async () => {
      await Promise.all([refresh(), refreshProjects()])
    })()
  }, [])

  useEffect(() => {
    if (selectedProjectId === null) {
      setTasks([])
      setSelectedTaskId(null)
      return
    }

    void refreshTasks(selectedProjectId)
  }, [selectedProjectId])

  const toggleTaskFilter = useCallback((index: number) => {
    const taskId = summary[index]?.taskId
    if (taskId == null) return

    setFilterTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [summary])

  const clearFilters = useCallback(() => {
    setFilterTaskIds(new Set())
  }, [])

  const hasFilters = filterTaskIds.size > 0

  const filteredEntries = useMemo(() => {
    if (filterTaskIds.size === 0) return entries
    return entries.filter((e) => filterTaskIds.has(e.taskId))
  }, [entries, filterTaskIds])

  const activeTaskCount = timer.active.length

  const activeTotalSeconds = useMemo(() => {
    return timer.active.reduce((sum, session) => {
      return sum + getElapsedSeconds(session, timer.nowMs)
    }, 0)
  }, [timer.active, timer.nowMs])

  const selectedTask = useMemo(() => {
    if (selectedTaskId === null) return null
    return tasks.find((t) => t.id === selectedTaskId) ?? null
  }, [tasks, selectedTaskId])

  const selectedTaskSessions = useMemo(() => {
    if (selectedTaskId === null) return []
    return timer.active.filter((session) => session.taskId === selectedTaskId)
  }, [selectedTaskId, timer.active])

  const isSelectedTaskRunning = selectedTaskSessions.length > 0

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Zaman Takibi</div>
        <button type="button" className="btn" onClick={() => void refresh()} disabled={busy}>
          Yenile
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {timer.error ? <div className="error">{timer.error}</div> : null}

      <div className="grid2">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Aktif sayaç özeti</div>
          </div>

          <div className="form">
            <div className="note-meta">Aktif görev sayısı: {activeTaskCount}</div>
            <div className="note-meta">Toplam anlık süre: {formatDuration(activeTotalSeconds)}</div>

            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void timerStore.stopMany(timer.active.map((t) => t.taskId))
                }}
                disabled={busy || timer.loading || timer.active.length === 0}
              >
                Tümünü Durdur
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Görev seç ve sayaç başlat</div>
          </div>

          <div className="form">
            <div className="form-row">
              <label>
                Proje
                <select
                  className="input"
                  value={selectedProjectId !== null ? String(selectedProjectId) : ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') {
                      setSelectedProjectId(null)
                      return
                    }

                    const next = Number(raw)
                    setSelectedProjectId(Number.isFinite(next) ? next : null)
                  }}
                  disabled={busy}
                >
                  <option value="">Proje seç</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedProjectId !== null && tasks.length > 0 ? (
              <div className="form-row">
                <div className="note-meta" style={{ marginBottom: 4 }}>
                  Bu projedeki görevlerden birine tıklayarak seçim yap.
                </div>

                <div className="panel" style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {tasks.map((t) => {
                    const isTaskRunning = timer.active.some((session) => session.taskId === t.id)

                    return (
                      <div
                        key={t.id}
                        className={selectedTaskId === t.id ? 'note-card note-card-active' : 'note-card'}
                        style={{ cursor: 'pointer', marginBottom: 4 }}
                        onClick={() => {
                          setSelectedTaskId(t.id)
                        }}
                      >
                        <div className="note-title">{t.title}</div>
                        <div className="note-meta">{t.description}</div>
                        <div className="note-meta">{isTaskRunning ? 'Durum: Çalışıyor' : 'Durum: Pasif'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className="form-row">
              <label>
                Süre (dakika)
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={480}
                  placeholder="dk"
                  value={customMinutes}
                  onChange={(e) => {
                    setCustomMinutes(e.target.value)
                  }}
                />
              </label>
            </div>

            {selectedTask ? (
              <div className="note-meta" style={{ marginBottom: 8 }}>
                Seçili görev: {selectedTask.title}
              </div>
            ) : null}

            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {!isSelectedTaskRunning ? (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (selectedTaskId === null) return
                      void timerStore.start(selectedTaskId, null)
                    }}
                    disabled={busy || selectedTaskId === null}
                  >
                    Süresiz başlat
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (selectedTaskId === null) return
                      const n = Number(customMinutes)
                      if (!Number.isFinite(n) || n < 1) return
                      void timerStore.startWithDuration(selectedTaskId, n, null)
                    }}
                    disabled={
                      busy ||
                      selectedTaskId === null ||
                      !Number.isFinite(Number(customMinutes)) ||
                      Number(customMinutes) < 1
                    }
                  >
                    Süreli başlat
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (selectedTaskId === null) return
                    void timerStore.stop(selectedTaskId)
                  }}
                  disabled={busy || selectedTaskId === null}
                >
                  Seçili görevi durdur
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {summary.length > 0 ? (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-header">
            <div className="panel-title">Bugün görev bazlı süre (dilime tıklayarak filtreleyin)</div>
            {hasFilters ? (
              <button type="button" className="btn" onClick={clearFilters}>
                Filtreleri temizle
              </button>
            ) : null}
          </div>

          <div className="chart-wrap" style={{ minHeight: 200 }}>
            <TodaySummaryChart summary={summary} onSegmentClick={toggleTaskFilter} />
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-header">
          <div className="panel-title">Görev Bazlı Özet (Bugün)</div>
        </div>

        <DataTable<TodayTaskSummaryItem>
          keyField="taskId"
          rows={summary}
          columns={[
            { id: 'taskTitle', label: 'Görev', sortKey: 'taskTitle' },
            {
              id: 'totalSeconds',
              label: 'Toplam (sn)',
              sortKey: 'totalSeconds',
              align: 'right'
            }
          ]}
          emptyMessage="Özet yok."
        />
      </div>
    </div>
  )
}
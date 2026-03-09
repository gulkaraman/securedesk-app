import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TodayTaskSummaryItem, TodayTimeEntryItem } from '@shared/models'
import { unwrap } from '@shared/result'
import { DataTable } from '../../components/DataTable'
import { getElapsedSeconds, useTimerState } from '@lib/timerStore'
import { TodaySummaryChart } from './components/TodaySummaryChart'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

export function TimerPage() {
  const timer = useTimerState()
  const elapsed = useMemo(() => getElapsedSeconds(timer.active, timer.nowMs), [timer.active, timer.nowMs])
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

  useEffect(() => {
    void refresh()
  }, [])

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

  const clearFilters = useCallback(() => { setFilterTaskIds(new Set()); }, [])
  const hasFilters = filterTaskIds.size > 0

  const filteredEntries = useMemo(() => {
    if (filterTaskIds.size === 0) return entries
    return entries.filter((e) => filterTaskIds.has(e.taskId))
  }, [entries, filterTaskIds])

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
            <div className="panel-title">Aktif Görev</div>
          </div>
          {timer.active ? (
            <div className="form">
              <div className="note-title">{timer.active.taskTitle}</div>
              <div className="note-meta">Başlangıç: {formatTime(timer.active.startTime)}</div>
              <div className="note-meta">Süre: {elapsed}s</div>
            </div>
          ) : (
            <div className="empty">Aktif sayaç yok.</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Bugünkü Kayıtlar</div>
          </div>
          <DataTable<TodayTimeEntryItem>
            keyField="id"
            rows={filteredEntries}
            columns={[
              { id: 'taskTitle', label: 'Görev', sortKey: 'taskTitle' },
              {
                id: 'startTime',
                label: 'Başlangıç',
                sortKey: 'startTime',
                render: (row) => formatTime(row.startTime)
              },
              {
                id: 'endTime',
                label: 'Bitiş',
                sortKey: 'endTime',
                render: (row) => (row.endTime ? formatTime(row.endTime) : '…')
              },
              { id: 'durationSeconds', label: 'Süre (sn)', sortKey: 'durationSeconds', align: 'right' },
              { id: 'source', label: 'Kaynak', sortKey: 'source' }
            ]}
            emptyMessage={hasFilters ? 'Seçilen görevlere ait kayıt yok.' : 'Bugün kayıt yok.'}
          />
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WeeklyReportDetailItem, WeeklyReportSummary, WeeklyReportTaskItem } from '@shared/models'
import { unwrap } from '@shared/result'
import { DataTable } from '../../components/DataTable'
import { formatDuration, formatDateLabel } from '@lib/time'
import { WeeklyByDayChart } from './components/WeeklyByDayChart'
import { WeeklyByTaskChart } from './components/WeeklyByTaskChart'

function formatDateRange(startMs: number, endMs: number): string {
  const s = new Date(startMs)
  const e = new Date(endMs - 1)
  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${String(
      d.getFullYear()
    )}`
  return `${fmt(s)} - ${fmt(e)}`
}

export function ReportsPage() {
  const [report, setReport] = useState<WeeklyReportSummary | null>(null)
  const [baseDateMs, setBaseDateMs] = useState<number>(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filterDayIndices, setFilterDayIndices] = useState<Set<number>>(new Set())
  const [filterTaskIndices, setFilterTaskIndices] = useState<Set<number>>(new Set())

  const loadReport = async (base: number) => {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.reports.getWeekly({ baseDateMs: base })
      setReport(unwrap(res))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Rapor yüklenemedi')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void loadReport(baseDateMs)
  }, [baseDateMs])

  const totalDuration = useMemo(() => (report ? formatDuration(report.totalSeconds) : '0s'), [report])

  const detail = report?.detail ?? []
  const filteredDetail = useMemo(() => {
    if (filterDayIndices.size === 0 && filterTaskIndices.size === 0) return detail
    const topTasks = (report?.perTask ?? []).slice(0, 6)
    const selectedTaskIds = new Set(
      [...filterTaskIndices].map((i) => topTasks[i]?.taskId).filter((id): id is number => id != null)
    )
    const selectedDayDates = new Set(
      report?.perDay ? [...filterDayIndices].map((i) => report.perDay[i]?.date).filter((d): d is number => d != null) : []
    )
    return detail.filter((row) => {
      const dayMatch = filterDayIndices.size === 0 || selectedDayDates.has(row.dateMs)
      const taskMatch = filterTaskIndices.size === 0 || selectedTaskIds.has(row.taskId)
      return dayMatch && taskMatch
    })
  }, [detail, report, filterDayIndices, filterTaskIndices])

  const detailRowsWithKey = useMemo(
    () => filteredDetail.map((r, i) => ({ ...r, _rowKey: `${String(r.dateMs)}-${String(r.taskId)}-${String(i)}` })),
    [filteredDetail]
  )

  const toggleDayFilter = useCallback((index: number) => {
    setFilterDayIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])
  const toggleTaskFilter = useCallback((index: number) => {
    setFilterTaskIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])
  const clearFilters = useCallback(() => {
    setFilterDayIndices(new Set())
    setFilterTaskIndices(new Set())
  }, [])
  const hasFilters = filterDayIndices.size > 0 || filterTaskIndices.size > 0

  const handleExportPdf = async () => {
    setExportBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await window.api.reports.exportWeeklyPdf({ baseDateMs })
      if (!res.ok) {
        setError(res.error.message)
      } else if (res.value) {
        setSuccess('PDF başarıyla kaydedildi.')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'PDF dışa aktarılamadı')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Haftalık Rapor</div>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const oneWeekMs = 7 * 24 * 60 * 60 * 1000
              setBaseDateMs((prev) => prev - oneWeekMs)
            }}
            disabled={busy}
          >
            Önceki hafta
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const oneWeekMs = 7 * 24 * 60 * 60 * 1000
              setBaseDateMs((prev) => prev + oneWeekMs)
            }}
            disabled={busy}
          >
            Sonraki hafta
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void handleExportPdf()}
            disabled={busy || exportBusy || !report}
          >
            {exportBusy ? 'PDF hazırlanıyor…' : 'PDF İndir'}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {success ? <div className="success">{success}</div> : null}

      {report ? (
        <>
          {report.totalSeconds === 0 ? (
            <>
              <div className="form">
                <div className="note-meta">Tarih aralığı: {formatDateRange(report.rangeStart, report.rangeEnd)}</div>
                <div className="note-meta">Toplam çalışma süresi: {totalDuration}</div>
                <div className="note-meta">Tamamlanan görev sayısı: {report.completedTasksCount}</div>
              </div>
              <div className="empty">Bu hafta için zaman kaydı bulunamadı.</div>
            </>
          ) : (
            <>
              <div className="charts-row">
                <div className="panel chart-panel">
                  <div className="panel-header">
                    <div className="panel-title">Gün Bazlı Süre (Saat) — dilime tıklayarak filtreleyin</div>
                  </div>
                  <div className="chart-wrap">
                    <WeeklyByDayChart days={report.perDay} onSegmentClick={toggleDayFilter} />
                  </div>
                </div>
                <div className="panel chart-panel">
                  <div className="panel-header">
                    <div className="panel-title">Görev Bazlı Dağılım — dilime tıklayarak filtreleyin</div>
                  </div>
                  <div className="chart-wrap">
                    <WeeklyByTaskChart tasks={report.perTask} onSegmentClick={toggleTaskFilter} />
                  </div>
                </div>
              </div>

              <div className="form" style={{ marginTop: 12 }}>
                <div className="note-meta">Tarih aralığı: {formatDateRange(report.rangeStart, report.rangeEnd)}</div>
                <div className="note-meta">Toplam çalışma süresi: {totalDuration}</div>
                <div className="note-meta">Tamamlanan görev sayısı: {report.completedTasksCount}</div>
              </div>

              <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-header">
                  <div className="panel-title">Görev Özeti</div>
                </div>
                <DataTable<WeeklyReportTaskItem>
                  keyField="taskId"
                  rows={report.perTask}
                  columns={[
                    { id: 'taskTitle', label: 'Görev', sortKey: 'taskTitle' },
                    {
                      id: 'totalSeconds',
                      label: 'Toplam süre',
                      sortKey: 'totalSeconds',
                      render: (row) => formatDuration(row.totalSeconds)
                    },
                    {
                      id: 'lastWorkedAt',
                      label: 'Son çalışma',
                      sortKey: 'lastWorkedAt',
                      render: (row) => (row.lastWorkedAt ? new Date(row.lastWorkedAt).toLocaleString() : '—')
                    }
                  ]}
                  emptyMessage="Bu hafta süre kaydı olan görev yok."
                />
              </div>

              <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-header">
                  <div className="panel-title">Detay (gün / görev dilimine tıklayarak filtreleyin)</div>
                  {hasFilters ? (
                    <button type="button" className="btn" onClick={clearFilters}>
                      Filtreleri temizle
                    </button>
                  ) : null}
                </div>
                <DataTable<WeeklyReportDetailItem & { _rowKey: string }>
                  keyField="_rowKey"
                  rows={detailRowsWithKey}
                  columns={[
                    {
                      id: 'dateMs',
                      label: 'Gün',
                      sortKey: 'dateMs',
                      render: (row) => formatDateLabel(row.dateMs)
                    },
                    { id: 'taskTitle', label: 'Görev', sortKey: 'taskTitle' },
                    {
                      id: 'totalSeconds',
                      label: 'Süre',
                      sortKey: 'totalSeconds',
                      render: (row) => formatDuration(row.totalSeconds)
                    }
                  ]}
                  emptyMessage={hasFilters ? 'Seçilen filtreye uygun kayıt yok.' : 'Detay kaydı yok.'}
                />
              </div>
            </>
          )}
        </>
      ) : (
        <div className="empty">Rapor yükleniyor…</div>
      )}
    </div>
  )
}

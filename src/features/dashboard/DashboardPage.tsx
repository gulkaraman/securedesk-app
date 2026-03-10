import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Chart, ChartConfiguration } from 'chart.js'
import type { Project, TodayTaskSummaryItem, User, WeeklyReportDetailItem, WeeklyReportSummary } from '@shared/models'
import { unwrap } from '@shared/result'
import { formatDuration, formatDateLabel } from '@lib/time'
import { getElapsedSeconds, useTimerState } from '@lib/timerStore'
import { DataTable } from '../../components/DataTable'
import { WeeklyByDayChart } from '@features/reports/components/WeeklyByDayChart'

interface ProjectWithCount extends Project {
  taskCount: number
}

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectCounts, setProjectCounts] = useState<ProjectWithCount[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportSummary | null>(null)
  const [todaySummary, setTodaySummary] = useState<TodayTaskSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterDayIndices, setFilterDayIndices] = useState<Set<number>>(new Set())
  const [filterProjectIds, setFilterProjectIds] = useState<Set<number>>(new Set())
  const timer = useTimerState()

  useEffect(() => {
    const cancelledRef = { current: false }
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const [projectsRes, usersRes, weeklyRes, todayRes] = await Promise.all([
          window.api.projects.list(),
          window.api.users.list(),
          window.api.reports.getWeekly({ baseDateMs: Date.now() }),
          window.api.timer.todaySummary()
        ])

        if (cancelledRef.current) return

        const projList = unwrap(projectsRes)
        setProjects(projList)
        setUsers(unwrap(usersRes))
        setWeeklyReport(unwrap(weeklyRes))
        setTodaySummary(unwrap(todayRes))

        const withCounts: ProjectWithCount[] = await Promise.all(
          projList.map(async (p) => {
            const tr = await window.api.tasks.listByProject(p.id)
            const count = tr.ok ? tr.value.length : 0
            return { ...p, taskCount: count }
          })
        )

        if (!cancelledRef.current) setProjectCounts(withCounts)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Dashboard yüklenemedi')
      } finally {
        setLoading(false)
      }
    })()

    return () => {
      cancelledRef.current = true
    }
  }, [])

  const totalTasks = projectCounts.reduce((s, p) => s + p.taskCount, 0)
  const todayTotalSeconds = todaySummary.reduce((s, t) => s + t.totalSeconds, 0)

  const activeTaskCount = timer.active.length
  const activeTotalSeconds = useMemo(() => {
    return timer.active.reduce((sum, session) => sum + getElapsedSeconds(session, timer.nowMs), 0)
  }, [timer.active, timer.nowMs])

  const toggleDayFilter = useCallback((index: number) => {
    setFilterDayIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const toggleProjectFilter = useCallback((index: number) => {
    const p = projectCounts[index]
    if (!p) return

    setFilterProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(p.id)) next.delete(p.id)
      else next.add(p.id)
      return next
    })
  }, [projectCounts])

  const clearDayFilters = useCallback(() => {
    setFilterDayIndices(new Set())
  }, [])

  const clearProjectFilters = useCallback(() => {
    setFilterProjectIds(new Set())
  }, [])

  const detail = weeklyReport?.detail ?? []

  const filteredDetail = useMemo(() => {
    if (filterDayIndices.size === 0) return detail

    const selectedDates = new Set(
      (weeklyReport?.perDay ?? [])
        .filter((_, i) => filterDayIndices.has(i))
        .map((d) => d.date)
    )

    return detail.filter((row) => selectedDates.has(row.dateMs))
  }, [detail, weeklyReport, filterDayIndices])

  const detailRowsWithKey = useMemo(
    () => filteredDetail.map((r, i) => ({ ...r, _rowKey: `${String(r.dateMs)}-${String(r.taskId)}-${String(i)}` })),
    [filteredDetail]
  )

  const filteredProjectCounts = useMemo(() => {
    if (filterProjectIds.size === 0) return projectCounts
    return projectCounts.filter((p) => filterProjectIds.has(p.id))
  }, [projectCounts, filterProjectIds])

  const hasDayFilters = filterDayIndices.size > 0
  const hasProjectFilters = filterProjectIds.size > 0

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Dashboard</div>
        </div>
        <div className="empty">Yükleniyor…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Dashboard</div>
        </div>
        <div className="error">{error}</div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Özet</div>
        </div>

        <div className="dashboard-stats">
          <div className="dashboard-stat">
            <span className="dashboard-stat-value">{projects.length}</span>
            <span className="dashboard-stat-label">Proje</span>
          </div>
          <div className="dashboard-stat">
            <span className="dashboard-stat-value">{totalTasks}</span>
            <span className="dashboard-stat-label">Görev</span>
          </div>
          <div className="dashboard-stat">
            <span className="dashboard-stat-value">{users.length}</span>
            <span className="dashboard-stat-label">Kullanıcı</span>
          </div>
        </div>
      </div>

      {activeTaskCount > 0 ? (
        <div className="panel dashboard-active-timer">
          <div className="panel-header">
            <div className="panel-title">Aktif Sayaç Özeti</div>
          </div>
          <div className="form">
            <div className="note-meta">Aktif görev sayısı: {activeTaskCount}</div>
            <div className="note-meta">Toplam anlık süre: {formatDuration(activeTotalSeconds)}</div>
          </div>
        </div>
      ) : null}

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Bu hafta — dilime tıklayarak filtreleyin</div>
            {hasDayFilters ? (
              <button type="button" className="btn" onClick={clearDayFilters}>
                Filtreleri temizle
              </button>
            ) : null}
          </div>

          {weeklyReport ? (
            <>
              <div className="form">
                <div className="note-meta">
                  Toplam süre: <strong>{formatDuration(weeklyReport.totalSeconds)}</strong>
                </div>
                <div className="note-meta">Tamamlanan görev: {weeklyReport.completedTasksCount}</div>
              </div>

              {weeklyReport.totalSeconds > 0 ? (
                <>
                  <div className="chart-wrap dashboard-chart">
                    <WeeklyByDayChart days={weeklyReport.perDay} onSegmentClick={toggleDayFilter} />
                  </div>

                  <DataTable<WeeklyReportDetailItem & { _rowKey: string }>
                    keyField="_rowKey"
                    rows={detailRowsWithKey}
                    columns={[
                      { id: 'dateMs', label: 'Gün', sortKey: 'dateMs', render: (row) => formatDateLabel(row.dateMs) },
                      { id: 'taskTitle', label: 'Görev', sortKey: 'taskTitle' },
                      { id: 'totalSeconds', label: 'Süre', sortKey: 'totalSeconds', render: (row) => formatDuration(row.totalSeconds) }
                    ]}
                    emptyMessage={hasDayFilters ? 'Seçilen güne ait kayıt yok.' : 'Detay yok.'}
                  />
                </>
              ) : (
                <div className="empty">Bu hafta henüz zaman kaydı yok.</div>
              )}
            </>
          ) : (
            <div className="empty">Rapor yok</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Bugün</div>
          </div>

          <div className="form">
            <div className="note-meta">
              Toplam: <strong>{formatDuration(todayTotalSeconds)}</strong>
            </div>
          </div>

          {todaySummary.length > 0 ? (
            <ul className="dashboard-today-list">
              {todaySummary.map((t) => (
                <li key={t.taskId} className="dashboard-today-item">
                  <span className="dashboard-today-title">{t.taskTitle}</span>
                  <span className="dashboard-today-dur">{formatDuration(t.totalSeconds)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">Bugün henüz zaman kaydı yok.</div>
          )}
        </div>
      </div>

      {projectCounts.length > 0 ? (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Projelere göre görev sayısı — dilime tıklayarak filtreleyin</div>
            {hasProjectFilters ? (
              <button type="button" className="btn" onClick={clearProjectFilters}>
                Filtreleri temizle
              </button>
            ) : null}
          </div>

          <div className="chart-wrap dashboard-chart dashboard-chart-wide">
            <ProjectsTaskChart data={projectCounts} onSegmentClick={toggleProjectFilter} />
          </div>

          <DataTable<ProjectWithCount>
            keyField="id"
            rows={filteredProjectCounts}
            columns={[
              { id: 'name', label: 'Proje', sortKey: 'name' },
              { id: 'taskCount', label: 'Görev sayısı', sortKey: 'taskCount', align: 'right' }
            ]}
            emptyMessage={hasProjectFilters ? 'Seçilen filtreye uygun proje yok.' : 'Proje yok.'}
          />
        </div>
      ) : null}
    </div>
  )
}

function ProjectsTaskChart({
  data,
  onSegmentClick
}: {
  data: ProjectWithCount[]
  onSegmentClick?: (index: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const abort = { aborted: false }

    void (async () => {
      const { Chart: ChartJs } = await import('chart.js/auto')
      if (abort.aborted) return
      if (!canvasRef.current) return

      const labels = data.map((p) => p.name)
      const counts = data.map((p) => p.taskCount)

      const cfg: ChartConfiguration<'bar', number[], string> = {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Görev sayısı',
              data: counts,
              backgroundColor: 'rgba(124, 92, 255, 0.6)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements, chart) => {
            if (!onSegmentClick) return

            const first = elements[0]
            if (first) {
              onSegmentClick(first.index)
              return
            }

            const e = event as unknown as { native?: { offsetX?: number } }
            const x = e.native?.offsetX
            const scale = chart.scales.x
            if (!scale || typeof x !== 'number') return

            const rawIndex = scale.getValueForPixel(x)
            const index = typeof rawIndex === 'number' ? Math.round(rawIndex) : Number(rawIndex)
            if (!Number.isFinite(index) || index < 0 || index >= data.length) return

            onSegmentClick(index)
          },
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      }

      chartRef.current = new ChartJs(canvasRef.current, cfg)
    })()

    return () => {
      abort.aborted = true
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [data, onSegmentClick])

  return <canvas ref={canvasRef} />
}
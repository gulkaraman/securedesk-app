import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Chart, ChartConfiguration } from 'chart.js'
import type { Project } from '@shared/models'
import { unwrap } from '@shared/result'
import { DataTable, type DataTableColumn } from '../../components/DataTable'

interface ProjectWithCount extends Project {
  taskCount: number
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectCounts, setProjectCounts] = useState<ProjectWithCount[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filterProjectIds, setFilterProjectIds] = useState<Set<number>>(new Set())

  const loadProjects = async () => {
    const res = await window.api.projects.list()
    const list = unwrap(res)
    setProjects(list)
    const withCounts: ProjectWithCount[] = await Promise.all(
      list.map(async (p) => {
        const tr = await window.api.tasks.listByProject(p.id)
        const count = tr.ok ? tr.value.length : 0
        return { ...p, taskCount: count }
      })
    )
    setProjectCounts(withCounts)
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadProjects()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Projeler yüklenemedi')
      }
    })()
  }, [])

  const handleCreate = (e: React.SyntheticEvent<HTMLFormElement>): void => {
    e.preventDefault()
    void (async () => {
    setError(null)
    setSuccess(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Proje adı gerekli')
      return
    }
    setBusy(true)
    try {
      const trimmedDesc = description.trim()
      const input = trimmedDesc ? { name: trimmedName, description: trimmedDesc } : { name: trimmedName }
      const res = await window.api.projects.create(input)
      if (res.ok) {
        setName('')
        setDescription('')
        setSuccess('Proje oluşturuldu.')
        await loadProjects()
      } else {
        setError(res.error.message)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Proje oluşturulamadı')
    } finally {
      setBusy(false)
    }
    })()
  }

  const toggleProjectFilter = useCallback((index: number) => {
    const proj = projectCounts[index]
    if (!proj) return
    setFilterProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(proj.id)) next.delete(proj.id)
      else next.add(proj.id)
      return next
    })
  }, [projectCounts])
  const clearFilters = useCallback(() => {
    setFilterProjectIds(new Set())
  }, [])
  const hasFilters = filterProjectIds.size > 0
  const filteredProjects = useMemo(() => {
    if (filterProjectIds.size === 0) return projects
    return projects.filter((p) => filterProjectIds.has(p.id))
  }, [projects, filterProjectIds])

  const columns: DataTableColumn<Project>[] = [
    { id: 'name', label: 'Proje adı', sortKey: 'name' },
    {
      id: 'description',
      label: 'Açıklama',
      sortKey: 'description',
      render: (row) => row.description || '—'
    },
    {
      id: 'createdAt',
      label: 'Oluşturulma',
      sortKey: 'createdAt',
      render: (row) => new Date(row.createdAt).toLocaleString()
    }
  ]

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Projeler</div>
      </div>

      <form className="form" onSubmit={handleCreate}>
        <div className="form-row">
          <label>
            Proje adı
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              placeholder="Proje adı"
              disabled={busy}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Açıklama
            <textarea
              className="input"
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              placeholder="İsteğe bağlı açıklama"
              rows={2}
              disabled={busy}
            />
          </label>
        </div>
        <div className="form-row">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Proje oluştur'}
          </button>
        </div>
      </form>

      {error ? <div className="error">{error}</div> : null}
      {success ? <div className="success">{success}</div> : null}

      {projectCounts.length > 0 ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div className="panel-title">Projelere göre görev sayısı — dilime tıklayarak filtreleyin</div>
            {hasFilters ? (
              <button type="button" className="btn" onClick={clearFilters}>
                Filtreleri temizle
              </button>
            ) : null}
          </div>
          <div className="chart-wrap" style={{ height: 220 }}>
            <ProjectsTaskCountChart data={projectCounts} onSegmentClick={toggleProjectFilter} />
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div className="panel-title">{hasFilters ? 'Filtrelenmiş projeler' : 'Tüm projeler'}</div>
        </div>
        <DataTable<Project>
          keyField="id"
          rows={filteredProjects}
          columns={columns}
          searchPlaceholder="Proje ara…"
          emptyMessage={hasFilters ? 'Seçilen filtreye uygun proje yok.' : 'Henüz proje yok. Yukarıdaki formdan oluşturabilirsiniz.'}
        />
      </div>
    </div>
  )
}

interface ProjectsTaskCountChartProps {
  data: ProjectWithCount[]
  onSegmentClick?: (index: number) => void
}

function ProjectsTaskCountChart({ data, onSegmentClick }: ProjectsTaskCountChartProps) {
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
              data: counts
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (_, elements) => {
            if (elements.length > 0 && onSegmentClick) {
              const first = elements[0]
              if (first != null) onSegmentClick(first.index)
            }
          },
          plugins: {
            legend: { display: false }
          },
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

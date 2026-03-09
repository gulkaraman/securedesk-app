import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import type { CreateTaskInput, Project, Task, TaskStatus, User } from '@shared/models'
import type { Result } from '@shared/result'
import { unwrap } from '@shared/result'
import { TaskColumn } from './components/TaskColumn'
import { TaskDetailsPanel } from './components/TaskDetailsPanel'
import { TaskEditor } from './components/TaskEditor'
import { ProjectCreateModal } from './components/ProjectCreateModal'

export function TasksPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showProjectEditor, setShowProjectEditor] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)

  const selected = useMemo(() => {
    if (selectedId === null) return null
    return tasks.find((n) => n.id === selectedId) ?? null
  }, [tasks, selectedId])

  const refreshProjects = async () => {
    const res = await window.api.projects.list()
    const next = unwrap(res)
    setProjects(next)
  }

  const refreshUsers = async () => {
    const res = await window.api.users.list()
    setUsers(unwrap(res))
  }

  const refreshTasks = async (pid: number) => {
    const res = await window.api.tasks.listByProject(pid)
    const next = unwrap(res)
    setTasks(next)
    const first = next.at(0)
    if (first && selectedId === null) setSelectedId(first.id)
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshProjects()
        await refreshUsers()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Görevler yüklenemedi')
      }
    })()
  }, [])

  useEffect(() => {
    if (projectId === null) return
    void (async () => {
      try {
        await refreshTasks(projectId)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Görevler yüklenemedi')
      }
    })()
  }, [projectId])
  const onSaveTask = async (input: CreateTaskInput | { id: number } & Partial<CreateTaskInput>): Promise<Result<Task>> => {
    setBusy(true)
    setError(null)
    try {
      if ('id' in input) {
        const res = await window.api.tasks.update(input)
        if (res.ok) {
          setTasks((prev) => prev.map((t) => (t.id === res.value.id ? res.value : t)))
        }
        return res
      }
      const res = await window.api.tasks.create(input)
      if (res.ok) {
        setTasks((prev) => [res.value, ...prev])
      }
      return res
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Görev kaydı başarısız')
      return { ok: false, error: { code: 'UNKNOWN', message: 'Görev kaydı başarısız' } }
    } finally {
      setBusy(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const [activeType, activeIdStr] = String(active.id).split('-')
    const [overType, overKey] = String(over.id).split('-')
    if (activeType !== 'task' || overType !== 'column') return
    const id = Number(activeIdStr)
    const nextStatus = overKey as TaskStatus
    setTasks((prev) => {
      const current = prev.find((t) => t.id === id)
      if (!current || current.status === nextStatus) return prev
      return prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
    })
    try {
      const update: Partial<CreateTaskInput> & { id: number; status: TaskStatus } = {
        id,
        status: nextStatus
      }
      const res = await window.api.tasks.update(update)
      if (!res.ok) {
        setError(res.error.message)
      } else {
        const payload = {
          type: 'task.status_changed',
          from: res.value.status,
          to: nextStatus,
          taskId: res.value.id
        }
        await window.api.activityLogs.create({
          taskId: res.value.id,
          type: 'task.status_changed',
          payloadJson: JSON.stringify(payload)
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Durum güncellenemedi')
    }
  }

  const todo = tasks.filter((t) => t.status === 'todo')
  const inProgress = tasks.filter((t) => t.status === 'in_progress')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Görevler</div>
        <div className="row">
          <select
            className="input"
            value={projectId ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              setSelectedId(null)
              if (raw === '') {
                setProjectId(null)
                return
              }
              const next = Number(raw)
              setProjectId(Number.isFinite(next) ? next : null)
            }}
            disabled={busy}
          >
            <option value="">Proje seç</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setShowProjectEditor(true)
            }}
            disabled={busy}
          >
            Yeni Proje
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setEditingTask(undefined)
              setShowEditor(true)
            }}
            disabled={busy || projectId === null}
          >
            Yeni Görev
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void (async () => {
                try {
                  if (projectId === null) {
                    await refreshProjects()
                    return
                  }
                  await refreshTasks(projectId)
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Yenileme başarısız')
                }
              })()
            }}
            disabled={busy}
          >
            Yenile
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {projectId === null ? (
        <div className="empty">
          {projects.length === 0
            ? 'Proje yok. "Yeni Proje" ile ilk projenizi oluşturun.'
            : 'Listeden bir proje seçin veya "Yeni Proje" ile ekleyin.'}
        </div>
      ) : (
        <div className="layout">
          <DndContext
            onDragEnd={(event) => {
              void handleDragEnd(event)
            }}
          >
            <div className="kanban">
              <TaskColumn
                status="todo"
                title="Yapılacaklar"
                tasks={todo}
                onTaskClick={(t) => {
                  setSelectedId(t.id)
                  setEditingTask(t)
                }}
              />
              <TaskColumn
                status="in_progress"
                title="Sürüyor"
                tasks={inProgress}
                onTaskClick={(t) => {
                  setSelectedId(t.id)
                  setEditingTask(t)
                }}
              />
              <TaskColumn
                status="done"
                title="Tamamlandı"
                tasks={done}
                onTaskClick={(t) => {
                  setSelectedId(t.id)
                  setEditingTask(t)
                }}
              />
            </div>
          </DndContext>

          <TaskDetailsPanel
            task={selected}
            onClose={() => {
              setSelectedId(null)
              setEditingTask(undefined)
            }}
            onDeleteTask={async (taskId) => {
              const res = await window.api.tasks.delete(taskId)
              if (res.ok) {
                await refreshTasks(projectId)
                setSelectedId(null)
                setEditingTask(undefined)
              }
              return res
            }}
          />
        </div>
      )}

      {showProjectEditor ? (
        <ProjectCreateModal
          onSave={async (input) => {
            setBusy(true)
            setError(null)
            try {
              const res = await window.api.projects.create(input)
              if (res.ok) {
                await refreshProjects()
              }
              return res
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : 'Proje eklenemedi')
              return { ok: false, error: { code: 'UNKNOWN', message: 'Proje eklenemedi' } }
            } finally {
              setBusy(false)
            }
          }}
          onClose={() => {
            setShowProjectEditor(false)
          }}
        />
      ) : null}

      {showEditor ? (
        <TaskEditor
          projects={projects}
          users={users}
          initialProjectId={projectId}
          initialTask={editingTask ?? null}
          busy={busy}
          onSave={onSaveTask}
          onClose={() => {
            setShowEditor(false)
          }}
        />
      ) : null}
    </div>
  )
}


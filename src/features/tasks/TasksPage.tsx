import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import type { CreateTaskInput, Project, Task, TaskStatus, UpdateTaskInput, User } from '@shared/models'
import type { Result } from '@shared/result'
import { unwrap } from '@shared/result'
import { timerStore, useTimerState } from '@lib/timerStore'
import { TaskColumn } from './components/TaskColumn'
import { TaskDetailsPanel } from './components/TaskDetailsPanel'
import { TaskEditor } from './components/TaskEditor'
import { ProjectCreateModal } from './components/ProjectCreateModal'

export function TasksPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showProjectEditor, setShowProjectEditor] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [quickMinutes, setQuickMinutes] = useState<string>('')
  const timer = useTimerState()

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

    if (next.length === 0 || (selectedId !== null && !next.some((t) => t.id === selectedId))) {
      setSelectedId(null)
    }
  }

  const getAllTasksAcrossProjects = async (): Promise<Task[]> => {
    const all = await Promise.all(
      projects.map(async (project) => {
        const res = await window.api.tasks.listByProject(project.id)
        return unwrap(res)
      })
    )

    return all.flat()
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

  useEffect(() => {
    if (selectedId === null) return

    const stillVisible = tasks.some(
      (t) => t.id === selectedId && (selectedUserId === null || t.assignedUserId === selectedUserId)
    )

    if (!stillVisible) setSelectedId(null)
  }, [selectedId, selectedUserId, tasks])

  const onSaveTask = async (
    input: CreateTaskInput | ({ id: number } & Partial<CreateTaskInput>)
  ): Promise<Result<Task>> => {
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

  const usersForProject = useMemo(() => {
    if (projectId === null) return []

    const userIds = new Set<number>()
    for (const t of tasks) {
      if (t.assignedUserId != null) userIds.add(t.assignedUserId)
    }

    return users.filter((u) => userIds.has(u.id))
  }, [projectId, tasks, users])

  const filteredTasks = useMemo(() => {
    if (selectedUserId === null) return tasks
    return tasks.filter((t) => t.assignedUserId === selectedUserId)
  }, [tasks, selectedUserId])

  const selectedTask = useMemo(() => {
    if (selectedId === null) return null
    return filteredTasks.find((t) => t.id === selectedId) ?? null
  }, [filteredTasks, selectedId])

  const todo = filteredTasks.filter((t) => t.status === 'todo')
  const inProgress = filteredTasks.filter((t) => t.status === 'in_progress')
  const done = filteredTasks.filter((t) => t.status === 'done')

  const handleStartTask = (task: Task): void => {
    void timerStore.start(task.id, task.assignedUserId ?? null)
  }

  const handleStopTask = (task: Task, _userId: number | null): void => {
    void timerStore.stop(task.id)
  }

  const getActiveSessionsForTask = (task: Task) => {
    return timer.active.filter((s) => s.taskId === task.id)
  }

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
              setSelectedUserId(null)

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

          {projectId !== null && (
            <select
              className="input"
              value={selectedUserId !== null ? String(selectedUserId) : ''}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  setSelectedUserId(null)
                  return
                }

                const next = Number(raw)
                setSelectedUserId(Number.isFinite(next) ? next : null)
              }}
              disabled={busy || usersForProject.length === 0}
            >
              <option value="">Tüm kullanıcılar</option>
              {usersForProject.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.firstName} {u.lastName} ({u.role})
                </option>
              ))}
            </select>
          )}

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
                setBusy(true)
                setError(null)

                try {
                  const allTasks = await getAllTasksAcrossProjects()
                  const taskIds = allTasks.map((task) => task.id)

                  if (taskIds.length === 0) return

                  await timerStore.startMany(taskIds)
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Tüm sayaçlar başlatılamadı')
                } finally {
                  setBusy(false)
                }
              })()
            }}
            disabled={busy || timer.loading || projects.length === 0}
          >
            Tüm Sayaçları Başlat
          </button>

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

      {projectId !== null && selectedTask !== null ? (
        <div className="panel" style={{ marginTop: 8 }}>
          <div className="panel-header">
            <div className="panel-title">Seçili görev için süre başlat</div>
          </div>

          <div className="form">
            <div className="note-meta" style={{ marginBottom: 4 }}>
              Proje: {projects.find((p) => p.id === projectId)?.name ?? '—'} · Görev: {selectedTask.title}
            </div>

            <div className="form-row">
              <label>
                Süre (dakika)
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={480}
                  placeholder="dk"
                  value={quickMinutes}
                  onChange={(e) => {
                    setQuickMinutes(e.target.value)
                  }}
                />
              </label>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void timerStore.start(selectedTask.id, selectedTask.assignedUserId ?? null)
                }}
                disabled={busy}
              >
                Süresiz başlat
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => {
                  const n = Number(quickMinutes)
                  if (!Number.isFinite(n) || n < 1) return
                  void timerStore.startWithDuration(selectedTask.id, n, selectedTask.assignedUserId ?? null)
                }}
                disabled={busy || !Number.isFinite(Number(quickMinutes)) || Number(quickMinutes) < 1}
              >
                Süreli başlat
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                selectedTaskId={selectedId}
                onStartTask={handleStartTask}
                getActiveSessionsForTask={getActiveSessionsForTask}
                onStopTask={handleStopTask}
                onTaskClick={(t) => {
                  setSelectedId(t.id)
                  setEditingTask(t)
                  setShowEditor(true)
                }}
              />

              <TaskColumn
                status="in_progress"
                title="Sürüyor"
                tasks={inProgress}
                selectedTaskId={selectedId}
                onStartTask={handleStartTask}
                getActiveSessionsForTask={getActiveSessionsForTask}
                onStopTask={handleStopTask}
                onTaskClick={(t) => {
                  setSelectedId(t.id)
                  setEditingTask(t)
                  setShowEditor(true)
                }}
              />

              <TaskColumn
                status="done"
                title="Tamamlandı"
                tasks={done}
                selectedTaskId={selectedId}
                onStartTask={handleStartTask}
                getActiveSessionsForTask={getActiveSessionsForTask}
                onStopTask={handleStopTask}
                onTaskClick={(t) => {
                  setSelectedId(t.id)
                  setEditingTask(t)
                  setShowEditor(true)
                }}
              />
            </div>
          </DndContext>

          <TaskDetailsPanel
            task={selectedTask}
            users={users}
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
            onUpdateTask={async (input: UpdateTaskInput) => {
              const res = await window.api.tasks.update(input)
              if (res.ok) {
                setTasks((prev) => prev.map((t) => (t.id === res.value.id ? res.value : t)))
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
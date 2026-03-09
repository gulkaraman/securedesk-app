import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CreateTaskInput, Project, Task, TaskStatus, User } from '@shared/models'
import type { Result } from '@shared/result'

interface TaskEditorProps {
  projects: Project[]
  users: User[]
  initialProjectId: number | null
  initialTask: Task | null
  busy: boolean
  onSave: (input: CreateTaskInput | { id: number } & Partial<CreateTaskInput>) => Promise<Result<Task>>
  onClose: () => void
}

export function TaskEditor({ projects, users, initialProjectId, initialTask, busy, onSave, onClose }: TaskEditorProps) {
  const resolvedProjectId =
    projects.length > 0
      ? (initialTask ? initialTask.projectId : initialProjectId ?? projects[0]?.id ?? null)
      : null
  const validProjectId =
    resolvedProjectId !== null && projects.some((p) => p.id === resolvedProjectId)
      ? resolvedProjectId
      : projects[0]?.id ?? null

  const [projectId, setProjectId] = useState<number | null>(() => validProjectId)
  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [description, setDescription] = useState(initialTask?.description ?? '')
  const [priority, setPriority] = useState(initialTask?.priority ?? 0)
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status ?? 'todo')
  const [assignedUserId, setAssignedUserId] = useState<number | null>(initialTask?.assignedUserId ?? null)
  const [error, setError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  const isEdit = initialTask !== null

  useLayoutEffect(() => {
    if (!isEdit && projects.length > 0) {
      const id = initialProjectId !== null && projects.some((p) => p.id === initialProjectId)
        ? initialProjectId
        : projects[0]?.id ?? null
      if (id !== null) setProjectId(id)
    }
  }, [isEdit, initialProjectId, projects])

  useEffect(() => {
    if (!isEdit && projectId === null && projects.length > 0) {
      setProjectId(initialProjectId ?? projects[0]?.id ?? null)
    }
  }, [isEdit, projectId, projects, initialProjectId])

  const handleSubmit = async () => {
    if (projects.length === 0) {
      setError('Önce bir proje oluşturmalısınız')
      return
    }
    if (projectId === null) {
      setError('Geçerli bir proje seçmelisiniz')
      return
    }
    if (title.trim().length === 0) {
      setError('Başlık gerekli')
      return
    }
    if (description.trim().length === 0) {
      setError('Açıklama gerekli')
      return
    }
    if (busy) return
    setError(null)
    const base: CreateTaskInput = {
      projectId,
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      assignedUserId: assignedUserId
    }
    const payload = initialTask ? { id: initialTask.id, ...base } : base
    try {
      const result = await onSave(payload)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi')
    }
  }

  useEffect(() => {
    if (!isEdit) {
      const fallback = initialProjectId ?? projects[0]?.id ?? null
      if (fallback !== null) {
        setProjectId(fallback)
      }
    }
  }, [isEdit, initialProjectId, projects])

  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="panel-header">
          <div className="panel-title">{isEdit ? 'Görev Düzenle' : 'Yeni Görev'}</div>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Kapat
          </button>
        </div>

        <div className="form">
          {error ? <div className="error">{error}</div> : null}

          <select
            className="input"
            value={projectId !== null ? String(projectId) : projects.length > 0 ? String(projects[0]?.id ?? '') : ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                setProjectId(projects.length > 0 ? projects[0]?.id ?? null : null)
                return
              }
              const next = Number(raw)
              setProjectId(Number.isFinite(next) ? next : null)
            }}
            disabled={busy || projects.length === 0}
          >
            {projects.length === 0 ? (
              <option value="">Proje yok</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))
            )}
          </select>

          <input
            className="input"
            placeholder="Başlık"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
            }}
            ref={titleInputRef}
          />

          <textarea
            className="textarea"
            placeholder="Açıklama (zorunlu)"
            value={description}
            onChange={(e) => { setDescription(e.target.value) }}
          />

          <label className="form-row">
            Atanan kullanıcı
            <select
              className="input"
              value={assignedUserId !== null ? String(assignedUserId) : ''}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  setAssignedUserId(null)
                  return
                }
                const next = Number(raw)
                setAssignedUserId(Number.isFinite(next) ? next : null)
              }}
              disabled={busy}
            >
              <option value="">Atanmadı</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.firstName} {u.lastName} ({u.role})
                </option>
              ))}
            </select>
          </label>

          <div className="row">
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TaskStatus)
              }}
            >
              <option value="todo">Yapılacaklar</option>
              <option value="in_progress">Sürüyor</option>
              <option value="done">Tamamlandı</option>
            </select>

            <input
              className="input"
              type="number"
              value={priority}
              onChange={(e) => {
                const next = Number(e.target.value)
                setPriority(Number.isFinite(next) ? next : 0)
              }}
            />
          </div>

          <div className="row">
            <div className="note-meta">
              {projects.length === 0
                ? 'Önce bir proje oluşturmalısınız.'
                : 'Dosya ekleme: Görev kaydedildikten sonra göreve tıklayıp "Dosya ekle" ile ekleyebilirsiniz.'}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void handleSubmit()
              }}
              disabled={busy || projects.length === 0}
            >
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


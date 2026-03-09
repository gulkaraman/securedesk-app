import { useEffect, useMemo, useState } from 'react'
import type { Task, TaskAttachment } from '@shared/models'
import type { Result } from '@shared/result'
import { unwrap } from '@shared/result'
import { getElapsedSeconds, timerStore, useTimerState } from '@lib/timerStore'

interface TaskDetailsPanelProps {
  task: Task | null
  onClose: () => void
  onDeleteTask?: (taskId: number) => Promise<Result<boolean>>
}

function formatBytes(size: number): string {
  if (size < 1024) return `${String(size)} B`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'Yapılacaklar',
  in_progress: 'Sürüyor',
  done: 'Tamamlandı'
}

const DURATION_PRESETS = [
  { label: '10 dk', minutes: 10 },
  { label: '15 dk', minutes: 15 },
  { label: '20 dk', minutes: 20 },
  { label: '30 dk', minutes: 30 },
  { label: '45 dk', minutes: 45 },
  { label: '1 saat', minutes: 60 }
]

export function TaskDetailsPanel({ task, onClose, onDeleteTask }: TaskDetailsPanelProps) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [assigneeName, setAssigneeName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalsText, setTotalsText] = useState<string | null>(null)
  const [customMinutes, setCustomMinutes] = useState<string>('')
  const timer = useTimerState()
  const elapsed = useMemo(() => getElapsedSeconds(timer.active, timer.nowMs), [timer.active, timer.nowMs])

  const refresh = async (taskId: number) => {
    const res = await window.api.taskAttachments.listByTask(taskId)
    const next = unwrap(res)
    setAttachments(next)
  }

  useEffect(() => {
    if (!task) {
      setAttachments([])
      setAssigneeName(null)
      return
    }
    void (async () => {
      try {
        await refresh(task.id)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Ekler yüklenemedi')
      }
    })()
  }, [task?.id])

  useEffect(() => {
    const assignedUserId = task?.assignedUserId
    if (assignedUserId == null) {
      setAssigneeName(null)
      return
    }
    void (async () => {
      try {
        const res = await window.api.users.get(assignedUserId)
        if (res.ok) {
          const u = res.value
          setAssigneeName(`${u.firstName} ${u.lastName} (${u.role})`)
        } else {
          setAssigneeName(null)
        }
      } catch {
        setAssigneeName(null)
      }
    })()
  }, [task?.assignedUserId])

  if (!task) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Görev Detayı</div>
        </div>
        <div className="empty">Bir görev seç.</div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">{task.title}</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {timer.active?.taskId === task.id ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                void timerStore.stop()
              }}
              disabled={timer.loading || busy}
            >
              Durdur ({elapsed}s)
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void timerStore.start(task.id)
                }}
                disabled={timer.loading || busy || (timer.active !== null && timer.active.taskId !== task.id)}
              >
                Süresiz başlat
              </button>
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  type="button"
                  className="btn"
                  onClick={() => {
                    void timerStore.startWithDuration(task.id, p.minutes)
                  }}
                  disabled={timer.loading || busy || (timer.active !== null && timer.active.taskId !== task.id)}
                >
                  {p.label}
                </button>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
                  style={{ width: 56 }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const n = Number(customMinutes)
                    if (Number.isFinite(n) && n >= 1) {
                      void timerStore.startWithDuration(task.id, n)
                    }
                  }}
                  disabled={
                    timer.loading ||
                    busy ||
                    (timer.active !== null && timer.active.taskId !== task.id) ||
                    !Number.isFinite(Number(customMinutes)) ||
                    Number(customMinutes) < 1
                  }
                >
                  dk başlat
                </button>
              </span>
            </>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              void (async () => {
                setBusy(true)
                setError(null)
                try {
                  const res = await window.api.taskAttachments.pickAndAttach(task.id)
                  const created = unwrap(res)
                  if (created) {
                    await refresh(task.id)
                  }
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Dosya eklenemedi')
                } finally {
                  setBusy(false)
                }
              })()
            }}
            disabled={busy}
          >
            Dosya ekle
          </button>
          {onDeleteTask ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!confirm('Bu görevi silmek istiyor musunuz?')) return
                setBusy(true)
                setError(null)
                void (async () => {
                  try {
                    const res = await onDeleteTask(task.id)
                    if (!res.ok) setError(res.error.message)
                    else onClose()
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'Silinemedi')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              disabled={busy}
            >
              Görev sil
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Kapat
          </button>
        </div>
      </div>
      <div className="form">
        {error ? <div className="error">{error}</div> : null}
        {timer.error ? <div className="error">{timer.error}</div> : null}
        <div className="note-meta">Durum: {STATUS_LABEL[task.status] ?? task.status}</div>
        <div className="note-meta">Öncelik: {task.priority}</div>
        {assigneeName ? (
          <div className="note-meta">Atanan: {assigneeName}</div>
        ) : task.assignedUserId ? (
          <div className="note-meta">Atanan: …</div>
        ) : null}
        <textarea className="textarea" value={task.description} readOnly />

        <div className="panel" style={{ marginTop: 10 }}>
          <div className="panel-header">
            <div className="panel-title">Ekler</div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await refresh(task.id)
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'Ekler yenilenemedi')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              disabled={busy}
            >
              Yenile
            </button>
          </div>
          {attachments.length === 0 ? (
            <div className="empty">Henüz ek yok.</div>
          ) : (
            <div className="list">
              {attachments.map((a) => (
                <div key={a.id} className="note-card">
                  <p className="note-title">{a.originalName}</p>
                  <p className="note-meta">
                    {formatBytes(a.size)} • {a.mimeType} • {formatDate(a.createdAt)}
                  </p>
                  <div className="row">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        void (async () => {
                          setBusy(true)
                          setError(null)
                          try {
                            const res = await window.api.taskAttachments.open(a.id)
                            unwrap(res)
                          } catch (e: unknown) {
                            setError(e instanceof Error ? e.message : 'Açılamadı')
                          } finally {
                            setBusy(false)
                          }
                        })()
                      }}
                      disabled={busy}
                    >
                      Dosyayı aç
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        void (async () => {
                          setBusy(true)
                          setError(null)
                          try {
                            const res = await window.api.taskAttachments.showInFolder(a.id)
                            unwrap(res)
                          } catch (e: unknown) {
                            setError(e instanceof Error ? e.message : 'Gösterilemedi')
                          } finally {
                            setBusy(false)
                          }
                        })()
                      }}
                      disabled={busy}
                    >
                      Klasörde göster
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        void (async () => {
                          if (!confirm('Bu eki silmek istiyor musunuz?')) return
                          setBusy(true)
                          setError(null)
                          try {
                            const res = await window.api.taskAttachments.delete(a.id)
                            const okDelete = unwrap(res)
                            if (okDelete) await refresh(task.id)
                          } catch (e: unknown) {
                            setError(e instanceof Error ? e.message : 'Silinemedi')
                          } finally {
                            setBusy(false)
                          }
                        })()
                      }}
                      disabled={busy}
                    >
                      Eki sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 10 }}>
          <div className="panel-header">
            <div className="panel-title">Süre</div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    const res = await window.api.timer.taskTotals(task.id)
                    const totals = unwrap(res)
                    setTotalsText(`Bugün: ${String(totals.todaySeconds)}s • Toplam: ${String(totals.totalSeconds)}s`)
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'Süre yüklenemedi')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              disabled={busy}
            >
              Yenile
            </button>
          </div>
          {totalsText ? (
            <div className="note-meta">{totalsText}</div>
          ) : (
            <div className="empty">Bugün ve toplam süreler “Yenile” ile güncellenir.</div>
          )}
        </div>
      </div>
    </div>
  )
}


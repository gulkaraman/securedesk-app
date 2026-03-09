import { useState } from 'react'
import type { CreateProjectInput, Project } from '@shared/models'
import type { Result } from '@shared/result'

interface ProjectCreateModalProps {
  onSave: (input: CreateProjectInput) => Promise<Result<Project>>
  onClose: () => void
}

export function ProjectCreateModal({ onSave, onClose }: ProjectCreateModalProps): React.ReactElement {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError('Proje adı gerekli')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const result = await onSave({ name: trimmed, description: description.trim() })
      if (result.ok) {
        onClose()
      } else {
        setError(result.error.message)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="panel-header">
          <div className="panel-title">Yeni Proje</div>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Kapat
          </button>
        </div>
        <div className="form">
          {error ? <div className="error">{error}</div> : null}
          <input
            className="input"
            placeholder="Proje adı"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
            }}
          />
          <textarea
            className="textarea"
            placeholder="Açıklama (isteğe bağlı)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
            }}
            rows={3}
          />
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                void handleSubmit()
              }}
              disabled={busy || name.trim().length === 0}
            >
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

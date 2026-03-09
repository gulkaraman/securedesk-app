import { useCallback, useEffect, useState } from 'react'
import type { CreateVaultNoteInput, VaultSecretDecrypted, VaultSecretListItem, VaultStatus } from '@shared/models'
import { unwrap } from '@shared/result'

export function VaultPage() {
  const [status, setStatus] = useState<VaultStatus | null>(null)
  const [masterKey, setMasterKey] = useState('')
  const [confirmKey, setConfirmKey] = useState('')
  const [list, setList] = useState<VaultSecretListItem[]>([])
  const [selected, setSelected] = useState<VaultSecretDecrypted | null>(null)
  const [editing, setEditing] = useState<CreateVaultNoteInput | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    const res = await window.api.vault.getStatus()
    setStatus(unwrap(res))
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const loadList = useCallback(async () => {
    const res = await window.api.vaultSecrets.list()
    setList(unwrap(res))
  }, [])

  useEffect(() => {
    if (status === 'unlocked') void loadList()
  }, [status, loadList])

  const handleSetMasterKey = async () => {
    if (masterKey.length < 1 || masterKey !== confirmKey) {
      setError('Anahtar boş olamaz ve iki alan eşleşmeli')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await window.api.vault.setMasterKey(masterKey)
      unwrap(res)
      setMasterKey('')
      setConfirmKey('')
      await loadStatus()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kurulum başarısız')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    if (masterKey.length < 1) {
      setError('Anahtar girin')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await window.api.vault.unlock(masterKey)
      unwrap(res)
      setMasterKey('')
      await loadStatus()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Açılamadı')
    } finally {
      setBusy(false)
    }
  }

  const handleLock = async () => {
    setBusy(true)
    setError(null)
    try {
      await window.api.vault.lock()
      setSelected(null)
      setEditing(null)
      await loadStatus()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kilitlenemedi')
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async (input: CreateVaultNoteInput) => {
    setError(null)
    setBusy(true)
    try {
      unwrap(await window.api.vaultSecrets.create(input))
      setEditing(null)
      setEditingId(null)
      await loadList()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Not eklenemedi')
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async (id: number, input: { title?: string; body?: string }) => {
    setError(null)
    setBusy(true)
    try {
      unwrap(await window.api.vaultSecrets.update({ id, ...input }))
      setEditing(null)
      setEditingId(null)
      if (selected?.id === id) {
        const res = await window.api.vaultSecrets.get(id)
        setSelected(unwrap(res))
      }
      await loadList()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: number) => {
    setError(null)
    setBusy(true)
    try {
      unwrap(await window.api.vaultSecrets.delete(id))
      if (selected?.id === id) setSelected(null)
      setEditing(null)
      await loadList()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Silinemedi')
    } finally {
      setBusy(false)
    }
  }

  const openNote = async (id: number) => {
    const res = await window.api.vaultSecrets.get(id)
    setSelected(unwrap(res))
    setEditing(null)
  }

  if (status === null) {
    return <div className="panel"><div className="empty">Yükleniyor…</div></div>
  }

  if (status === 'never_set') {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Kasa – İlk Kurulum</div>
        </div>
        <div className="form">
          {error ? <div className="error">{error}</div> : null}
          <p className="note-meta">Kasa için bir anahtar (master key) belirleyin. Bu anahtar notlarınızı şifreler; unutmayın.</p>
          <input
            type="password"
            className="input"
            placeholder="Master key"
            value={masterKey}
            onChange={(e) => { setMasterKey(e.target.value) }}
            disabled={busy}
          />
          <input
            type="password"
            className="input"
            placeholder="Tekrar girin"
            value={confirmKey}
            onChange={(e) => { setConfirmKey(e.target.value) }}
            disabled={busy}
          />
          <button type="button" className="btn" onClick={() => {
              void handleSetMasterKey()
            }} disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Kur'}
          </button>
        </div>
      </div>
    )
  }

  if (status === 'locked') {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Kasa – Kilidi Aç</div>
        </div>
        <div className="form">
          {error ? <div className="error">{error}</div> : null}
          <input
            type="password"
            className="input"
            placeholder="Master key"
            value={masterKey}
            onChange={(e) => { setMasterKey(e.target.value) }}
            disabled={busy}
          />
          <button type="button" className="btn" onClick={() => {
              void handleUnlock()
            }} disabled={busy}>
            {busy ? 'Açılıyor…' : 'Aç'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Kasa</div>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setEditing({ title: '', body: '' })
              setEditingId(null)
              setSelected(null)
            }}
            disabled={busy}
          >
            Yeni not
          </button>
          <button type="button" className="btn" onClick={() => {
              void handleLock()
            }} disabled={busy}>
            Kilitle
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {editing !== null ? (
        <div className="form" style={{ marginTop: 12 }}>
          <input
            className="input"
            placeholder="Başlık"
            value={editing.title}
            onChange={(e) => { setEditing((p) => (p ? { ...p, title: e.target.value } : null)) }}
            disabled={busy}
          />
          <textarea
            className="textarea"
            placeholder="İçerik (şifreli saklanır)"
            value={editing.body}
            onChange={(e) => { setEditing((p) => (p ? { ...p, body: e.target.value } : null)) }}
            disabled={busy}
            rows={6}
          />
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!editing.title.trim()) {
                  setError('Başlık gerekli')
                  return
                }
                if (editingId !== null) {
                  void handleUpdate(editingId, { title: editing.title, body: editing.body })
                } else {
                  void handleCreate(editing)
                }
              }}
              disabled={busy}
            >
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing(null)
                setEditingId(null)
                setError(null)
              }}
              disabled={busy}
            >
              İptal
            </button>
          </div>
        </div>
      ) : null}

      {selected !== null && editing === null ? (
        <div className="form" style={{ marginTop: 12 }}>
          <div className="panel-header">
            <div className="panel-title">{selected.title}</div>
            <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing({ title: selected.title, body: selected.body })
                setEditingId(selected.id)
                setSelected(null)
              }}
              disabled={busy}
            >
              Düzenle
            </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                if (selected.id) void handleDelete(selected.id)
              }}
                disabled={busy}
              >
                Sil
              </button>
              <button type="button" className="btn" onClick={() => { setSelected(null); setError(null) }} disabled={busy}>
                Kapat
              </button>
            </div>
          </div>
          <pre className="note-meta" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {selected.body || '(Boş)'}
          </pre>
        </div>
      ) : null}

      {editing === null && selected === null ? (
        <div className="list" style={{ marginTop: 12 }}>
          {list.length === 0 ? (
            <div className="empty">Henüz not yok. Yeni not ekleyin.</div>
          ) : (
            list.map((item) => (
              <div
                key={item.id}
                className="note-card"
                style={{ cursor: 'pointer' }}
                onClick={() => { void openNote(item.id) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void openNote(item.id)
                }}
                role="button"
                tabIndex={0}
              >
                <p className="note-title">{item.title}</p>
                <p className="note-meta">{new Date(item.updatedAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

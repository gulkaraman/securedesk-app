import { useEffect, useState } from 'react'
import { unwrap } from '@shared/result'
import type { VaultStatus } from '@shared/models'

interface VaultStartupPromptProps {
  onDismiss: () => void
}

export function VaultStartupPrompt({ onDismiss }: VaultStartupPromptProps) {
  const [status, setStatus] = useState<VaultStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [masterKey, setMasterKey] = useState('')
  const [confirmKey, setConfirmKey] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await window.api.vault.getStatus()
        setStatus(unwrap(res))
      } catch (e: unknown) {
        setStatus('locked')
        setError(e instanceof Error ? e.message : 'Kasa durumu okunamadı')
      }
    })()
  }, [])

  if (status === null) return null
  if (status === 'unlocked') return null

  const doSetup = async () => {
    if (masterKey.length < 1 || masterKey !== confirmKey) {
      setError('Anahtar boş olamaz ve iki alan eşleşmeli')
      return
    }
    setBusy(true)
    setError(null)
    try {
      unwrap(await window.api.vault.setMasterKey(masterKey))
      setMasterKey('')
      setConfirmKey('')
      onDismiss()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kurulum başarısız')
    } finally {
      setBusy(false)
    }
  }

  const doUnlock = async () => {
    if (masterKey.length < 1) {
      setError('Anahtar girin')
      return
    }
    setBusy(true)
    setError(null)
    try {
      unwrap(await window.api.vault.unlock(masterKey))
      setMasterKey('')
      onDismiss()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Açılamadı')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="panel-header">
          <div className="panel-title">Kasa</div>
          <button type="button" className="btn" onClick={onDismiss} disabled={busy}>
            Şimdi değil
          </button>
        </div>
        <div className="form">
          {error ? <div className="error">{error}</div> : null}
          {status === 'never_set' ? (
            <>
              <div className="note-meta">İlk kullanım: Master Key belirleyin (unutmayın).</div>
              <input
                type="password"
                className="input"
                placeholder="Master key"
                value={masterKey}
                onChange={(e) => {
                  setMasterKey(e.target.value)
                }}
                disabled={busy}
              />
              <input
                type="password"
                className="input"
                placeholder="Tekrar girin"
                value={confirmKey}
                onChange={(e) => {
                  setConfirmKey(e.target.value)
                }}
                disabled={busy}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void doSetup()
                }}
                disabled={busy}
              >
                {busy ? 'Kaydediliyor…' : 'Kur'}
              </button>
            </>
          ) : (
            <>
              <div className="note-meta">Kasa kilitli. Master Key ile açabilirsiniz.</div>
              <input
                type="password"
                className="input"
                placeholder="Master key"
                value={masterKey}
                onChange={(e) => {
                  setMasterKey(e.target.value)
                }}
                disabled={busy}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void doUnlock()
                }}
                disabled={busy}
              >
                {busy ? 'Açılıyor…' : 'Aç'}
              </button>
            </>
          )}
          <div className="note-meta">Not: Bu ekranı daha sonra “Kasa” sayfasından da açabilirsiniz.</div>
        </div>
      </div>
    </div>
  )
}


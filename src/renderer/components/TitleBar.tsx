import { useEffect, useState } from 'react'

function Icon({ d }: { d: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized).catch(() => undefined)
    const unsub = window.api.window.onMaximizedChanged((value) => {
      setIsMaximized(value)
    })

    return () => {
      unsub()
    }
  }, [])

  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <div className="appmark" />
        <div>
          <div className="title">Yerel Suit</div>
          <div className="subtitle">Güvenli İş & Kaynak Yönetimi</div>
        </div>
      </div>

      <div className="titlebar-right">
        <button
          type="button"
          className="winbtn"
          aria-label="Minimize"
          onClick={() => {
            void window.api.window.minimize()
          }}
        >
          <Icon d="M2 6h8" />
        </button>

        <button
          type="button"
          className="winbtn"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          onClick={() => {
            void window.api.window.toggleMaximize().then(setIsMaximized)
          }}
        >
          {isMaximized ? <Icon d="M3 4h5v5" /> : <Icon d="M3 3h6v6" />}
        </button>

        <button
          type="button"
          className="winbtn close"
          aria-label="Close"
          onClick={() => {
            void window.api.window.close()
          }}
        >
          <Icon d="M3 3l6 6M9 3L3 9" />
        </button>
      </div>
    </div>
  )
}


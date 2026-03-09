import { useMemo, useState } from 'react'
import { DashboardPage } from '@features/dashboard/DashboardPage'
import { ProjectsPage } from '@features/projects/ProjectsPage'
import { ReportsPage } from '@features/reports/ReportsPage'
import { TasksPage } from '@features/tasks/TasksPage'
import { TimerPage } from '@features/timer/TimerPage'
import { UsersPage } from '@features/users/UsersPage'
import { VaultPage } from '@features/vault/VaultPage'
import { ROUTES, type RouteKey } from '@lib/navigation'
import { getElapsedSeconds, timerStore, useTimerState } from '@lib/timerStore'
import { TitleBar } from './components/TitleBar'
import { VaultStartupPrompt } from './components/VaultStartupPrompt'

function getPage(route: RouteKey): React.ReactElement {
  switch (route) {
    case 'dashboard':
      return <DashboardPage />
    case 'tasks':
      return <TasksPage />
    case 'projects':
      return <ProjectsPage />
    case 'users':
      return <UsersPage />
    case 'timer':
      return <TimerPage />
    case 'vault':
      return <VaultPage />
    case 'reports':
      return <ReportsPage />
  }
}

export function App() {
  const [route, setRoute] = useState<RouteKey>('dashboard')
  const timer = useTimerState()
  const [vaultPromptDismissed, setVaultPromptDismissed] = useState(false)

  const page = useMemo(() => getPage(route), [route])
  const elapsed = useMemo(() => getElapsedSeconds(timer.active, timer.nowMs), [timer.active, timer.nowMs])

  return (
    <div className="app">
      {!vaultPromptDismissed ? (
        <VaultStartupPrompt
          onDismiss={() => {
            setVaultPromptDismissed(true)
          }}
        />
      ) : null}
      <TitleBar />

      <div className="shell">
        <aside className="sidebar">
          <div className="panel" style={{ marginBottom: 10 }}>
            <div className="panel-header">
              <div className="panel-title">Aktif Sayaç</div>
            </div>
            {timer.active ? (
              <div className="form">
                <div className="note-meta">{timer.active.taskTitle}</div>
                <div className="note-meta">Süre: {elapsed}s</div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void timerStore.stop()
                  }}
                  disabled={timer.loading}
                >
                  Durdur
                </button>
              </div>
            ) : (
              <div className="empty">Aktif sayaç yok.</div>
            )}
            {timer.error ? <div className="error">{timer.error}</div> : null}
          </div>
          <div className="nav">
            {ROUTES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={r.key === route ? 'navbtn active' : 'navbtn'}
                onClick={() => {
                  setRoute(r.key)
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="content">{page}</main>
      </div>
    </div>
  )
}


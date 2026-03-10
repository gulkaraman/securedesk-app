import { useMemo, useState } from 'react'
import { DashboardPage } from '@features/dashboard/DashboardPage'
import { ProjectsPage } from '@features/projects/ProjectsPage'
import { ReportsPage } from '@features/reports/ReportsPage'
import { TasksPage } from '@features/tasks/TasksPage'
import { TimerPage } from '@features/timer/TimerPage'
import { UsersPage } from '@features/users/UsersPage'
import { VaultPage } from '@features/vault/VaultPage'
import { ROUTES, type RouteKey } from '@lib/navigation'
import { getElapsedSeconds, getValidActiveTimers, timerStore, useTimerState } from '@lib/timerStore'
import { formatDuration } from '@lib/time'
import { unwrap } from '@shared/result'
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
  const [route, setRoute] = useState<RouteKey>('tasks')
  const [vaultPromptDismissed, setVaultPromptDismissed] = useState(false)
  const timer = useTimerState()

  const page = useMemo(() => getPage(route), [route])
  const activeTimers = useMemo(() => getValidActiveTimers(timer.active), [timer.active])

  const summaryStartMs = useMemo(() => {
    if (activeTimers.length === 0) return null
    return Math.min(...activeTimers.map((t) => t.startTime))
  }, [activeTimers])

  const summaryElapsedSeconds = useMemo(() => {
    if (summaryStartMs == null) return 0
    return getElapsedSeconds({ startTime: summaryStartMs }, timer.nowMs)
  }, [summaryStartMs, timer.nowMs])

  const startAllTasks = async (): Promise<void> => {
    try {
      const projectsRes = await window.api.projects.list()
      const allProjects = unwrap(projectsRes)

      const taskGroups = await Promise.all(
        allProjects.map(async (project) => {
          const res = await window.api.tasks.listByProject(project.id)
          return unwrap(res)
        })
      )

      const taskIds = [...new Set(taskGroups.flat().map((task) => task.id))]
      if (taskIds.length === 0) return

      await timerStore.startMany(taskIds)
    } catch (e) {
      console.error('Toplu başlatma başarısız', e)
    }
  }

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

            <div className="form">
              <div style={{ marginBottom: 10 }}>
                <div className="note-meta">Aktif görev sayısı: {activeTimers.length}</div>
                <div className="note-meta">Aktif süre: {formatDuration(summaryElapsedSeconds)}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void startAllTasks()
                  }}
                  disabled={timer.loading}
                >
                  Aktif Sayaçları Başlat
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void timerStore.stopMany(activeTimers.map((t) => t.taskId))
                  }}
                  disabled={timer.loading || activeTimers.length === 0}
                >
                  Aktif Sayaçları Durdur
                </button>
              </div>
            </div>

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
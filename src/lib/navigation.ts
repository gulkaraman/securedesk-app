export type RouteKey = 'dashboard' | 'tasks' | 'projects' | 'users' | 'timer' | 'vault' | 'reports'

export interface RouteDef {
  key: RouteKey
  label: string
}

export const ROUTES: readonly RouteDef[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'tasks', label: 'Görevler' },
  { key: 'projects', label: 'Projeler' },
  { key: 'users', label: 'Kullanıcılar' },
  { key: 'timer', label: 'Zaman Takibi' },
  { key: 'vault', label: 'Kasa' },
  { key: 'reports', label: 'Raporlar' }
] as const


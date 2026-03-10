export function formatDuration(totalSeconds: number | null | undefined): string {
  const safeSeconds =
    typeof totalSeconds === 'number' && Number.isFinite(totalSeconds) && totalSeconds >= 0
      ? Math.floor(totalSeconds)
      : 0

  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) return `${hours}sa ${minutes}dk ${seconds}sn`
  if (minutes > 0) return `${minutes}dk ${seconds}sn`
  return `${seconds}sn`
}
export function formatDateLabel(dateMs: number): string {
  const d = new Date(dateMs)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${day}.${month}`
}


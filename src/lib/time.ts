export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${String(h)}h`)
  if (m > 0) parts.push(`${String(m)}m`)
  if (s > 0 && h === 0) parts.push(`${String(s)}s`)
  return parts.join(' ')
}

export function formatDateLabel(dateMs: number): string {
  const d = new Date(dateMs)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${day}.${month}`
}


import { useMemo, useState } from 'react'

export interface DataTableColumn<T> {
  id: string
  label: string
  sortKey?: keyof T
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right'
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  keyField: keyof T
  searchPlaceholder?: string
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

function getSortValue<T>(row: T, col: DataTableColumn<T>): string | number {
  const key = col.sortKey ?? (col.id as keyof T)
  const v = row[key]
  if (typeof v === 'string' || typeof v === 'number') return v
  return String(v ?? '')
}

export function DataTable<T>({
  columns,
  rows,
  keyField,
  searchPlaceholder = 'Ara…',
  emptyMessage = 'Kayıt yok.',
  onRowClick
}: DataTableProps<T>): React.ReactElement {
  const [sortId, setSortId] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')

  const getCellDisplay = (row: T, col: DataTableColumn<T>): React.ReactNode => {
    if (col.render) return col.render(row)
    const v = row[col.id as keyof T]
    if (v === undefined || v === null) return '—'
    return String(v)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((row) =>
      columns.some((col) => String(getSortValue(row, col)).toLowerCase().includes(q))
    )
  }, [rows, search, columns])

  const sorted = useMemo(() => {
    if (!sortId) return filtered
    const col = columns.find((c) => c.id === sortId)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const va = getSortValue(a, col)
      const vb = getSortValue(b, col)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortId, sortDir, columns])

  const onSort = (id: string): void => {
    const col = columns.find((c) => c.id === id)
    if (!col) return
    if (sortId === id) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortId(id)
      setSortDir('asc')
    }
  }

  const hasSearch = rows.length > 3

  return (
    <div className="data-table-container">
      {hasSearch ? (
        <div className="data-table-toolbar">
          <input
            type="text"
            className="input data-table-search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
            }}
          />
        </div>
      ) : null}
      <div className="table-wrap">
        {sorted.length === 0 ? (
          <div className="empty">{emptyMessage}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    align={col.align ?? 'left'}
                    className="sortable"
                    onClick={() => { onSort(col.id) }}
                  >
                    {col.label}
                    {sortId === col.id ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => {
                    if (onRowClick) onRowClick(row)
                  }}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.id} align={col.align ?? 'left'}>
                      {getCellDisplay(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

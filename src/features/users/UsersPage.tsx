import { useEffect, useState } from 'react'
import type { User } from '@shared/models'
import { unwrap } from '@shared/result'
import { DataTable, type DataTableColumn } from '../../components/DataTable'

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadUsers = async () => {
    const res = await window.api.users.list()
    setUsers(unwrap(res))
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadUsers()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Kullanıcılar yüklenemedi')
      }
    })()
  }, [])

  const handleCreate = (e: React.SyntheticEvent<HTMLFormElement>): void => {
    e.preventDefault()
    void (async () => {
      setError(null)
      setSuccess(null)
      const trimmedFirst = firstName.trim()
      const trimmedLast = lastName.trim()
      const trimmedRole = role.trim()
      if (!trimmedFirst || !trimmedLast || !trimmedRole) {
        setError('Ad, soyad ve görev alanları zorunludur.')
        return
      }
      setBusy(true)
      try {
        const res = await window.api.users.create({
          firstName: trimmedFirst,
          lastName: trimmedLast,
          role: trimmedRole
        })
        if (res.ok) {
          setFirstName('')
          setLastName('')
          setRole('')
          setSuccess('Kullanıcı oluşturuldu.')
          await loadUsers()
        } else {
          setError(res.error.message)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Kullanıcı oluşturulamadı')
      } finally {
        setBusy(false)
      }
    })()
  }

  const columns: DataTableColumn<User>[] = [
    { id: 'firstName', label: 'Ad', sortKey: 'firstName' },
    { id: 'lastName', label: 'Soyad', sortKey: 'lastName' },
    { id: 'role', label: 'Görev', sortKey: 'role' },
    {
      id: 'createdAt',
      label: 'Oluşturulma',
      sortKey: 'createdAt',
      render: (row) => new Date(row.createdAt).toLocaleString()
    }
  ]

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Kullanıcılar</div>
      </div>

      <form className="form" onSubmit={handleCreate}>
        <div className="form-row">
          <label>
            Ad
            <input
              type="text"
              className="input"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); }}
              placeholder="Ad"
              disabled={busy}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Soyad
            <input
              type="text"
              className="input"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); }}
              placeholder="Soyad"
              disabled={busy}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Görev
            <input
              type="text"
              className="input"
              value={role}
              onChange={(e) => { setRole(e.target.value); }}
              placeholder="Görev / rol"
              disabled={busy}
            />
          </label>
        </div>
        <div className="form-row">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Kullanıcı oluştur'}
          </button>
        </div>
      </form>

      {error ? <div className="error">{error}</div> : null}
      {success ? <div className="success">{success}</div> : null}

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div className="panel-title">Tüm kullanıcılar</div>
        </div>
        <DataTable<User>
          keyField="id"
          rows={users}
          columns={columns}
          searchPlaceholder="Kullanıcı ara…"
          emptyMessage="Henüz kullanıcı yok. Yukarıdaki formdan oluşturabilirsiniz. Oluşturulan kullanıcılara görev atayabilirsiniz."
        />
      </div>
    </div>
  )
}

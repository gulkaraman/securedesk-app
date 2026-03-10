import { useDraggable } from '@dnd-kit/core'
import type { ActiveTimerSession, Task } from '@shared/models'

interface TaskCardProps {
  task: Task
  isSelected: boolean
  onClick: () => void
  onStart?: (() => void) | undefined
  activeSessions?: ActiveTimerSession[] | undefined
  onStop?: ((userId: number | null) => void) | undefined
}

export function TaskCard({ task, isSelected, onClick, onStart, activeSessions, onStop }: TaskCardProps) {
  const dragId = `task-${task.id.toString()}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId
  })

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${String(transform.x)}px, ${String(transform.y)}px, 0)`,
        opacity: isDragging ? 0.8 : 1
      }
    : {}

  const hasActiveSession = Array.isArray(activeSessions) && activeSessions.length > 0
  const firstActiveSession = hasActiveSession ? activeSessions[0] : null
  const hasActions = Boolean(onStart ?? onStop)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isSelected ? 'note-card note-card-active' : 'note-card'}
    >
      <div
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
      >
        <div
          style={{ flex: 1, cursor: 'pointer' }}
          onClick={() => {
            onClick()
          }}
        >
          <p className="note-title" style={{ margin: 0 }}>
            {task.title}
          </p>
          <p className="note-meta">{task.description}</p>
        </div>

        <button
          type="button"
          className="btn"
          style={{ padding: '4px 8px', minWidth: 0 }}
          onPointerDown={(e) => {
            e.stopPropagation()
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          {...listeners}
          {...attributes}
          title="Taşı"
        >
          ⋮⋮
        </button>
      </div>

      {hasActions && (
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          {!hasActiveSession && onStart ? (
            <button
              type="button"
              className="btn"
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
                onStart()
              }}
            >
              Başlat
            </button>
          ) : null}

          {hasActiveSession && onStop && firstActiveSession ? (
            <button
              type="button"
              className="btn"
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
                onStop(firstActiveSession.userId ?? null)
              }}
            >
              Durdur
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
import { useDraggable } from '@dnd-kit/core'
import type { Task } from '@shared/models'

interface TaskCardProps {
  task: Task
  onClick: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="note-card"
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      <p className="note-title">{task.title}</p>
      <p className="note-meta">{task.description}</p>
    </div>
  )
}


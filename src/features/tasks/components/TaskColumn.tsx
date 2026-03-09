import { useDroppable } from '@dnd-kit/core'
import type { Task, TaskStatus } from '@shared/models'
import { TaskCard } from './TaskCard'

interface TaskColumnProps {
  status: TaskStatus
  title: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

export function TaskColumn({ status, title, tasks, onTaskClick }: TaskColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`
  })

  return (
    <div className="kanban-column" ref={setNodeRef}>
      <div className="kanban-column-header">
        <span>{title}</span>
        <span className="kanban-pill">{tasks.length}</span>
      </div>
      <div className={isOver ? 'kanban-column-body over' : 'kanban-column-body'}>
        {tasks.length === 0 ? <div className="empty">Bu sütunda görev yok.</div> : null}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onClick={() => {
              onTaskClick(t)
            }}
          />
        ))}
      </div>
    </div>
  )
}


import { useDroppable } from '@dnd-kit/core'
import type { ActiveTimerSession, Task, TaskStatus } from '@shared/models'
import { TaskCard } from './TaskCard'

interface TaskColumnProps {
  status: TaskStatus
  title: string
  tasks: Task[]
  selectedTaskId: number | null
  onTaskClick: (task: Task) => void
  onStartTask?: (task: Task) => void
  getActiveSessionsForTask?: (task: Task) => ActiveTimerSession[]
  onStopTask?: (task: Task, userId: number | null) => void
  onAttachFile?: (task: Task) => void
}

export function TaskColumn({
  status,
  title,
  tasks,
  selectedTaskId,
  onTaskClick,
  onStartTask,
  getActiveSessionsForTask,
  onStopTask,
  onAttachFile
}: TaskColumnProps) {
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
            isSelected={selectedTaskId === t.id}
            onAttachFile={
              onAttachFile
                ? () => {
                    onAttachFile(t)
                  }
                : undefined
            }
            onStart={
              onStartTask
                ? () => {
                    onStartTask(t)
                  }
                : undefined
            }
            activeSessions={getActiveSessionsForTask ? getActiveSessionsForTask(t) : undefined}
            onStop={
              onStopTask
                ? (uid) => {
                    onStopTask(t, uid)
                  }
                : undefined
            }
            onClick={() => {
              onTaskClick(t)
            }}
          />
        ))}
      </div>
    </div>
  )
}
import { useState } from 'react'
import type { OfficeAgent } from '../../office-provider'
import type { AssignmentRecord } from '../../world'
import { CompleteTaskForm } from '../forms/CompleteTaskForm'
import { TaskResultDisplay } from '../shared/TaskResultDisplay'
import { Markdown } from '../shared/Markdown'

export function TasksPanel({ assignments, agents, onCancelTask }: {
  assignments: AssignmentRecord[]
  agents: OfficeAgent[]
  onCancelTask: (agentId: string) => Promise<boolean>
}) {
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)

  return (
    <div className="tasks-panel" role="tabpanel">
      {assignments.length === 0 && <p className="feed-empty">No queued tasks</p>}
      {assignments.map(a => {
        const agent = agents.find(ag => ag.id === a.targetAgentId)
        return (
          <div key={a.id} className={`task-card task-${a.priority} ${a.status === 'done' ? 'task-done' : ''}`}>
            <div className="task-head">
              <strong>{a.taskTitle}</strong>
              <span className="task-priority">{a.priority}</span>
            </div>
            <div className="task-meta">
              <span>{agent?.name ?? a.targetAgentId}</span>
              <span>{a.status}</span>
              <span>{a.routingTarget.replace('_', ' ')}</span>
            </div>
            {a.taskBrief && <div className="task-brief"><Markdown text={a.taskBrief} /></div>}
            {a.status === 'active' && completingTaskId !== a.id && (
              <div className="task-action-row">
                <button className="complete-task-btn" onClick={() => setCompletingTaskId(a.id)}>Complete</button>
                <button className="cancel-task-btn" onClick={() => onCancelTask(a.targetAgentId)}>Cancel</button>
              </div>
            )}
            {completingTaskId === a.id && (
              <CompleteTaskForm assignmentId={a.id} taskTitle={a.taskTitle} onClose={() => setCompletingTaskId(null)} />
            )}
            {a.status === 'done' && <TaskResultDisplay assignment={a} />}
          </div>
        )
      })}
    </div>
  )
}

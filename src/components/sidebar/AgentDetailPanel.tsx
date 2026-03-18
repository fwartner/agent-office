import { useState } from 'react'
import type { PresenceState } from '../../data'
import type { OfficeAgent } from '../../office-provider'
import type { AgentRuntimeStatus } from '../../office-state'
import type { AssignmentRecord, ActivityItem } from '../../world'
import { characterSprites } from '../../world'
import { presenceLabels, activityIcons } from '../../utils/presence'
import { safeTime, relativeTime } from '../../utils/time'
import { AgentForm } from '../forms/AgentForm'
import { AssignmentForm } from '../forms/AssignmentForm'
import { CompleteTaskForm } from '../forms/CompleteTaskForm'
import { TaskResultDisplay } from '../shared/TaskResultDisplay'
import { InlineMarkdown } from '../shared/Markdown'

export function AgentDetailPanel({ agent, room, presenceColors, assignments, activity, agentRuntimeStatuses, onDelete, onCancelTask, onClose }: {
  agent: OfficeAgent
  room: { name: string } | undefined
  presenceColors: Record<PresenceState, string>
  assignments: AssignmentRecord[]
  activity: ActivityItem[]
  agentRuntimeStatuses: AgentRuntimeStatus[]
  onDelete: (id: string) => Promise<boolean>
  onCancelTask: (agentId: string) => Promise<boolean>
  onClose: () => void
}) {
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)

  const color = presenceColors[agent.effectivePresence]

  const liveFeed = [
    {
      id: `presence-${agent.id}`,
      kind: 'presence' as const,
      text: `${agent.name} is currently ${presenceLabels[agent.effectivePresence].toLowerCase()}`,
      createdAt: new Date().toISOString(),
    },
    {
      id: `focus-${agent.id}`,
      kind: 'system' as const,
      text: `Focus: ${agent.focus}`,
      createdAt: new Date().toISOString(),
    },
    ...assignments.map(a => ({
      id: `assignment-live-${a.id}`,
      kind: 'assignment' as const,
      text: `${a.status.toUpperCase()} · ${a.taskTitle}${a.taskBrief ? ` - ${a.taskBrief}` : ''}`,
      createdAt: a.createdAt,
    })),
    ...activity.map(item => ({
      id: `activity-live-${item.id}`,
      kind: item.kind,
      text: item.text,
      createdAt: item.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12)

  return (
    <div className="detail-card" style={{ borderColor: `${color}44` }}>
      <div className="detail-head">
        <div className="detail-avatar" style={{ background: `${color}22`, borderColor: `${color}66` }}>
          {characterSprites[agent.id] ? (
            <img
              src={characterSprites[agent.id].portrait ?? characterSprites[agent.id].idle}
              alt={agent.name}
              className="detail-avatar-art"
              draggable={false}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <span className="detail-avatar-letter">{agent.name[0]}</span>
          )}
        </div>
        <div>
          <h3>{agent.name}</h3>
          <span style={{ color }}>
            {presenceLabels[agent.effectivePresence]}
          </span>
        </div>
      </div>
      <dl className="detail-fields">
        <dt>Role</dt><dd>{agent.role}</dd>
        <dt>Team</dt><dd>{agent.team}</dd>
        <dt>Room</dt><dd>{room?.name}</dd>
        <dt>Focus</dt><dd>{agent.focus}</dd>
        <dt>Mode</dt><dd>{agent.collaborationMode}</dd>
        <dt>Priority</dt><dd>{agent.criticalTask ? 'Critical' : 'Non-critical'}</dd>
        {agent.systemPrompt && (
          <>
            <dt>Prompt</dt>
            <dd><details className="prompt-preview"><summary>View system prompt</summary><pre className="prompt-text">{agent.systemPrompt}</pre></details></dd>
          </>
        )}
        <dt>Runtime</dt>
        <dd>
          {(() => {
            const rs = agentRuntimeStatuses.find(s => s.agentId === agent.id)
            if (!rs) return <span style={{ color: '#888' }}>Offline</span>
            if (rs.busy) return (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#4a9eff' }}>Working...</span>
                <button className="cancel-task-btn" onClick={() => onCancelTask(agent.id)}>Cancel</button>
              </span>
            )
            return <span style={{ color: '#4ade80' }}>Connected</span>
          })()}
        </dd>
      </dl>
      <div className="agent-livefeed">
        <div className="agent-livefeed-head">
          <strong>Live output</strong>
          <span>{liveFeed.length} events</span>
        </div>
        <div className="agent-livefeed-status">
          <span className="live-pill" style={{ color, borderColor: `${color}66` }}>
            {presenceLabels[agent.effectivePresence]}
          </span>
          <span className="live-meta">{assignments.length > 0 ? `${assignments.length} task(s)` : 'No active task queue'}</span>
        </div>
        <div className="agent-livefeed-list">
          {liveFeed.length === 0 ? (
            <p className="feed-empty">No agent output yet</p>
          ) : (
            liveFeed.map(item => (
              <div key={item.id} className={`feed-entry livefeed-entry feed-${item.kind}`}>
                <span className="feed-icon">{activityIcons[item.kind] ?? '\u25CB'}</span>
                <div className="feed-body">
                  <span className="feed-text"><InlineMarkdown text={item.text} /></span>
                  <span className="feed-time">{safeTime(item.createdAt)} · {relativeTime(item.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Active/Done tasks for this agent */}
      {assignments.filter(a => a.status === 'active' || a.status === 'done').length > 0 && (
        <div className="agent-tasks-section">
          {assignments.filter(a => a.status === 'active').map(a => (
            <div key={a.id} className="task-card task-inline">
              <div className="task-head"><strong>{a.taskTitle}</strong><span className="task-priority">{a.priority}</span></div>
              {completingTaskId === a.id ? (
                <CompleteTaskForm assignmentId={a.id} taskTitle={a.taskTitle} onClose={() => setCompletingTaskId(null)} />
              ) : (
                <button className="complete-task-btn" onClick={() => setCompletingTaskId(a.id)}>Complete</button>
              )}
            </div>
          ))}
          {assignments.filter(a => a.status === 'done' && a.result).map(a => (
            <div key={a.id} className="task-card task-done task-inline">
              <div className="task-head"><strong>{a.taskTitle}</strong><span className="task-priority">done</span></div>
              <TaskResultDisplay assignment={a} />
            </div>
          ))}
        </div>
      )}
      {showAgentForm ? (
        <AgentForm agent={agent} onClose={() => setShowAgentForm(false)} />
      ) : showAssignForm ? (
        <AssignmentForm targetAgentId={agent.id} onClose={() => setShowAssignForm(false)} />
      ) : (
        <div className="agent-actions">
          <button className="assign-btn" onClick={() => setShowAssignForm(true)}>
            Assign task
          </button>
          <div className="agent-crud-row">
            <button className="agent-edit-btn" onClick={() => setShowAgentForm(true)}>Edit</button>
            {deleteConfirm ? (
              <div className="delete-confirm">
                <span>Delete?</span>
                <button className="delete-yes" onClick={() => { onDelete(agent.id); setDeleteConfirm(false); onClose() }}>Yes</button>
                <button className="delete-no" onClick={() => setDeleteConfirm(false)}>No</button>
              </div>
            ) : (
              <button className="agent-delete-btn" onClick={() => setDeleteConfirm(true)}>Delete</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

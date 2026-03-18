import { useState } from 'react'
import type { OfficeAgent } from '../../office-provider'
import { relativeTime } from '../../utils/time'

export function TaskHistoryPanel({ assignments, agents }: {
  assignments: Array<{ id: string; targetAgentId: string; taskTitle: string; status: string; priority: string; createdAt: string; completedAt?: string; durationMs?: number; result?: string }>
  agents: OfficeAgent[]
}) {
  const [filterAgent, setFilterAgent] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = assignments.filter(a => {
    if (filterAgent && a.targetAgentId !== filterAgent) return false
    if (filterStatus && a.status !== filterStatus) return false
    return true
  })

  // Stats
  const done = assignments.filter(a => a.status === 'done')
  const avgDuration = done.length > 0
    ? Math.round(done.reduce((s, a) => s + (a.durationMs || 0), 0) / done.length / 1000)
    : 0

  // Tasks per agent for bar chart
  const agentCounts: Record<string, number> = {}
  for (const a of done) {
    agentCounts[a.targetAgentId] = (agentCounts[a.targetAgentId] || 0) + 1
  }
  const maxCount = Math.max(1, ...Object.values(agentCounts))

  function exportData() {
    const csv = ['id,agent,title,status,priority,created,completed']
    for (const a of filtered) {
      csv.push(`${a.id},${a.targetAgentId},"${a.taskTitle}",${a.status},${a.priority},${a.createdAt},${a.completedAt || ''}`)
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = 'task-history.csv'; link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="history-panel">
      <div className="history-stats">
        <div className="stat-card"><span className="stat-value">{done.length}</span><span className="stat-label">Completed</span></div>
        <div className="stat-card"><span className="stat-value">{avgDuration}s</span><span className="stat-label">Avg time</span></div>
        <div className="stat-card"><span className="stat-value">{assignments.filter(a => a.status === 'blocked').length}</span><span className="stat-label">Blocked</span></div>
      </div>
      {Object.keys(agentCounts).length > 0 && (
        <div className="history-chart">
          {Object.entries(agentCounts).map(([agentId, count]) => {
            const agent = agents.find(a => a.id === agentId)
            return (
              <div key={agentId} className="chart-bar-row">
                <span className="chart-label">{agent?.name ?? agentId}</span>
                <div className="chart-bar" style={{ width: `${(count / maxCount) * 100}%` }} />
                <span className="chart-value">{count}</span>
              </div>
            )
          })}
        </div>
      )}
      <div className="history-filters">
        <select className="assign-select" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="assign-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
          <option value="active">Active</option>
          <option value="queued">Queued</option>
        </select>
        <button className="agent-edit-btn" onClick={exportData}>Export CSV</button>
      </div>
      {filtered.length === 0 && <p className="feed-empty">No matching tasks</p>}
      {filtered.slice(0, 50).map(a => {
        const agent = agents.find(ag => ag.id === a.targetAgentId)
        return (
          <div key={a.id} className={`task-card task-${a.priority} ${a.status === 'done' ? 'task-done' : ''}`}>
            <div className="task-head"><strong>{a.taskTitle}</strong><span className="task-priority">{a.priority}</span></div>
            <div className="task-meta">
              <span>{agent?.name ?? a.targetAgentId}</span>
              <span>{a.status}</span>
              {a.completedAt && <span>{relativeTime(a.completedAt)}</span>}
              {a.durationMs && <span>{Math.round(a.durationMs / 1000)}s</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

import type { PresenceState } from '../../data'
import type { OfficeAgent } from '../../office-provider'
import { presenceLabels, presenceIcons } from '../../utils/presence'

export function AgentRoster({ agents, rooms, presenceColors, selectedAgentId, onAgentClick, onAddAgent }: {
  agents: OfficeAgent[]
  rooms: Array<{ id: string; name: string }>
  presenceColors: Record<PresenceState, string>
  selectedAgentId: string | null
  onAgentClick: (agentId: string) => void
  onAddAgent: () => void
}) {
  return (
    <div className="agent-roster" role="tabpanel">
      <button className="add-agent-btn" onClick={onAddAgent} aria-label="Add agent">+ Add Agent</button>
      {agents.length === 0 && <p className="feed-empty">No agents yet. Add one to get started.</p>}
      {agents.map(agent => {
        const color = presenceColors[agent.effectivePresence]
        const room = rooms.find(r => r.id === agent.roomId)
        return (
          <button
            key={agent.id}
            className={`roster-card ${selectedAgentId === agent.id ? 'active' : ''}`}
            onClick={() => onAgentClick(agent.id)}
          >
            <div className="roster-head">
              <span className="roster-dot" aria-hidden="true" style={{ background: color }}>{presenceIcons[agent.effectivePresence]}</span>
              <strong>{agent.name}</strong>
              <span className="roster-state" style={{ color }}>{presenceLabels[agent.effectivePresence]}</span>
            </div>
            <div className="roster-meta">
              <span>{agent.role}</span>
              <span>{room?.name}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

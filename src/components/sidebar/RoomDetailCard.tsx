import type { PresenceState, Room } from '../../data'
import type { OfficeAgent } from '../../office-provider'
import { presenceLabels, presenceIcons } from '../../utils/presence'

export function RoomDetailCard({ room, agents, presenceColors, onClose }: {
  room: Room
  agents: OfficeAgent[]
  presenceColors: Record<PresenceState, string>
  onClose: () => void
}) {
  const roomAgents = agents.filter(a => a.roomId === room.id)
  return (
    <div className="room-detail-card">
      <div className="room-detail-head">
        <div>
          <h3>{room.name}</h3>
          <span className="room-detail-team">{room.team}</span>
        </div>
        <button className="assign-close" aria-label="Close" onClick={onClose}>&times;</button>
      </div>
      <p className="room-detail-purpose">{room.purpose}</p>
      {roomAgents.length > 0 ? (
        <div className="room-detail-agents">
          {roomAgents.map(a => (
            <div key={a.id} className="room-agent-row">
              <span className="roster-dot" aria-hidden="true" style={{ background: presenceColors[a.effectivePresence] }}>{presenceIcons[a.effectivePresence]}</span>
              <span>{a.name}</span>
              <span className="roster-state" style={{ color: presenceColors[a.effectivePresence] }}>
                {presenceLabels[a.effectivePresence]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="feed-empty">No agents in this room</p>
      )}
    </div>
  )
}

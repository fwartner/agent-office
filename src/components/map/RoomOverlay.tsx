import type { Room } from '../../data'

export function RoomOverlay({ room, highlight, agentCount, onClick }: {
  room: Room
  highlight: boolean
  agentCount: number
  onClick: () => void
}) {
  return (
    <div
      className={`room-overlay ${highlight ? 'highlight' : ''}`}
      style={{
        left: `${room.zone.x}%`,
        top: `${room.zone.y}%`,
        width: `${room.zone.w}%`,
        height: `${room.zone.h}%`
      }}
      role="button"
      tabIndex={0}
      aria-label={`${room.name}, ${agentCount} agent${agentCount !== 1 ? 's' : ''}`}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <span className="room-label">{room.name}</span>
      {agentCount > 0 && <span className="room-count">{agentCount}</span>}
    </div>
  )
}

import { useState } from 'react'
import type { PresenceState, Room } from '../../data'
import type { OfficeAgent } from '../../office-provider'
import { presenceLabels, presenceIcons } from '../../utils/presence'

export function LeftSidebar({ agents, rooms, presenceColors, selectedAgentId, onAgentClick, onRoomClick, onAddAgent, onAddRoom, selectedRoomId }: {
  agents: OfficeAgent[]
  rooms: Room[]
  presenceColors: Record<PresenceState, string>
  selectedAgentId: string | null
  selectedRoomId: string | null
  onAgentClick: (agentId: string) => void
  onRoomClick: (roomId: string) => void
  onAddAgent: () => void
  onAddRoom: () => void
}) {
  const [search, setSearch] = useState('')

  const filteredAgents = search
    ? agents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.role.toLowerCase().includes(search.toLowerCase()) ||
        a.team.toLowerCase().includes(search.toLowerCase())
      )
    : agents

  const roomsWithAgents = rooms.map(room => ({
    room,
    agents: filteredAgents.filter(a => a.roomId === room.id)
  }))

  return (
    <nav className="left-sidebar" aria-label="Room navigation">
      <div className="left-sidebar-header">
        <input
          type="search"
          className="sidebar-search"
          placeholder="Search agents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search agents"
        />
      </div>
      <div className="left-sidebar-tree">
        {roomsWithAgents.map(({ room, agents: roomAgents }) => (
          <details key={room.id} className="room-tree-node" open={roomAgents.length > 0 || selectedRoomId === room.id}>
            <summary
              className={`room-tree-summary ${selectedRoomId === room.id ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); onRoomClick(room.id) }}
            >
              <span className="room-tree-name">{room.name}</span>
              <span className="room-tree-count">{roomAgents.length}</span>
            </summary>
            {roomAgents.length > 0 && (
              <div className="room-tree-agents">
                {roomAgents.map(agent => {
                  const color = presenceColors[agent.effectivePresence]
                  return (
                    <button
                      key={agent.id}
                      className={`tree-agent-row ${selectedAgentId === agent.id ? 'active' : ''}`}
                      onClick={() => onAgentClick(agent.id)}
                    >
                      <span className="tree-agent-dot" style={{ background: color }}>{presenceIcons[agent.effectivePresence]}</span>
                      <span className="tree-agent-name">{agent.name}</span>
                      <span className="tree-agent-focus">{agent.focus}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </details>
        ))}
      </div>
      <div className="left-sidebar-actions">
        <button className="sidebar-action-btn" onClick={onAddAgent}>+ Agent</button>
        <button className="sidebar-action-btn" onClick={onAddRoom}>+ Room</button>
      </div>
    </nav>
  )
}

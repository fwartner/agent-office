import { useState } from 'react'
import type { PresenceState } from '../../data'
import type { OfficeAgent } from '../../office-provider'
import type { AgentRuntimeStatus } from '../../office-state'
import type { AssignmentRecord, ActivityItem } from '../../world'
import type { DecisionRecord, MessageRecord } from '../../data'
import { PresenceSummary } from '../sidebar/PresenceSummary'
import { TasksPanel } from '../sidebar/TasksPanel'
import { ActivityFeed } from '../sidebar/ActivityFeed'
import { DecisionsPanel } from '../sidebar/DecisionsPanel'
import { ChatPanel } from '../sidebar/ChatPanel'
import { TaskHistoryPanel } from '../sidebar/TaskHistoryPanel'
import { AgentDetailPanel } from '../sidebar/AgentDetailPanel'
import { RoomDetailCard } from '../sidebar/RoomDetailCard'
import { AgentForm } from '../forms/AgentForm'
import { SettingsPanel } from '../../SettingsPanel'
import type { Room } from '../../data'

export type RightTab = 'tasks' | 'activity' | 'chat' | 'decisions' | 'history' | 'settings'

export function RightSidebar({
  agents, rooms, presenceColors, assignments, activity, decisions, messages,
  agentRuntimeStatuses, dataSource, selectedAgent, selectedRoom,
  selectedRoomId, pendingResultCount, showAgentForm,
  onDeselectAgent, onDeleteAgent, onCancelTask, onCreateDecision, onUpdateDecision, onSendMessage,
  onCloseAgentForm, onCloseRoomDetail,
}: {
  agents: OfficeAgent[]
  rooms: Room[]
  presenceColors: Record<PresenceState, string>
  assignments: AssignmentRecord[]
  activity: ActivityItem[]
  decisions: DecisionRecord[]
  messages: MessageRecord[]
  agentRuntimeStatuses: AgentRuntimeStatus[]
  dataSource: 'seed' | 'live'
  selectedAgent: OfficeAgent | undefined
  selectedRoom: Room | undefined
  selectedRoomId: string | null
  pendingResultCount: number
  showAgentForm: 'create' | null
  onDeselectAgent: () => void
  onDeleteAgent: (id: string) => Promise<boolean>
  onCancelTask: (agentId: string) => Promise<boolean>
  onCreateDecision: (input: { title: string; detail: string; proposedBy?: string }) => Promise<boolean>
  onUpdateDecision: (id: string, input: { status?: string }) => Promise<boolean>
  onSendMessage: (input: { fromAgentId: string; toAgentId?: string; roomId?: string; message: string }) => Promise<boolean>
  onCloseAgentForm: () => void
  onCloseRoomDetail: () => void
}) {
  const [tab, setTab] = useState<RightTab>('tasks')

  const selectedAssignments = selectedAgent
    ? assignments.filter(a => a.targetAgentId === selectedAgent.id)
    : []
  const selectedActivity = selectedAgent
    ? activity.filter(item => item.agentId === selectedAgent.id)
    : []

  // Show agent detail as slide-over when agent is selected
  if (selectedAgent) {
    const agentRoom = rooms.find(r => r.id === selectedAgent.roomId)
    return (
      <div className="right-sidebar-content">
        <AgentDetailPanel
          agent={selectedAgent}
          room={agentRoom}
          presenceColors={presenceColors}
          assignments={selectedAssignments}
          activity={selectedActivity}
          agentRuntimeStatuses={agentRuntimeStatuses}
          onDelete={onDeleteAgent}
          onCancelTask={onCancelTask}
          onClose={onDeselectAgent}
        />
      </div>
    )
  }

  // Show room detail when room is clicked
  if (selectedRoom) {
    return (
      <div className="right-sidebar-content">
        <RoomDetailCard room={selectedRoom} agents={agents} presenceColors={presenceColors} onClose={onCloseRoomDetail} />
      </div>
    )
  }

  // Show agent create form
  if (showAgentForm === 'create') {
    return (
      <div className="right-sidebar-content" style={{ padding: 10 }}>
        <AgentForm onClose={onCloseAgentForm} />
      </div>
    )
  }

  return (
    <div className="right-sidebar-content">
      <PresenceSummary agents={agents} presenceColors={presenceColors} />

      <div className="side-tabs" role="tablist">
        <button className={`side-tab ${tab === 'tasks' ? 'active' : ''}`} role="tab" aria-selected={tab === 'tasks'} onClick={() => setTab('tasks')}>
          Tasks{assignments.length > 0 ? ` (${assignments.length})` : ''}
          {pendingResultCount > 0 && <span className="result-badge">{pendingResultCount}</span>}
        </button>
        <button className={`side-tab ${tab === 'activity' ? 'active' : ''}`} role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>Feed</button>
        <button className={`side-tab ${tab === 'chat' ? 'active' : ''}`} role="tab" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>Chat</button>
        <button className={`side-tab ${tab === 'decisions' ? 'active' : ''}`} role="tab" aria-selected={tab === 'decisions'} onClick={() => setTab('decisions')}>
          Votes{decisions.length > 0 ? ` (${decisions.length})` : ''}
        </button>
        <button className={`side-tab ${tab === 'settings' ? 'active' : ''}`} role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}>&#x2699;</button>
      </div>

      {tab === 'tasks' && <TasksPanel assignments={assignments} agents={agents} onCancelTask={onCancelTask} />}
      {tab === 'activity' && <ActivityFeed activity={activity} dataSource={dataSource} />}
      {tab === 'chat' && <ChatPanel messages={messages} agents={agents} rooms={rooms} currentRoomId={selectedRoomId} onSend={onSendMessage} />}
      {tab === 'decisions' && <DecisionsPanel decisions={decisions} agents={agents} createDecision={onCreateDecision} updateDecision={onUpdateDecision} />}
      {tab === 'settings' && <SettingsPanel />}
    </div>
  )
}

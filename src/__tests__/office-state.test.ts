import { describe, it, expect } from 'vitest'
import type {
  OfficePresenceState,
  OfficeAgentRecord,
  OfficeRoomRecord,
  OfficePresenceRecord,
  OfficeWorldEntityRecord,
  OfficeAssignmentRecord,
  OfficeActivityRecord,
  OfficeDecisionRecord,
  OfficeStateSnapshot,
} from '../office-state'

describe('office-state types', () => {
  it('OfficePresenceState allows valid states', () => {
    const states: OfficePresenceState[] = [
      'off_hours', 'available', 'active', 'in_meeting', 'paused', 'blocked'
    ]
    expect(states).toHaveLength(6)
  })

  it('OfficeAgentRecord shape is valid', () => {
    const agent: OfficeAgentRecord = {
      id: 'test',
      name: 'Test',
      role: 'Tester',
      team: 'QA',
      internalStaff: true,
      officeVisible: true,
      characterId: null,
      spriteSheet: null,
    }
    expect(agent.id).toBe('test')
    expect(agent.internalStaff).toBe(true)
  })

  it('OfficeRoomRecord shape is valid', () => {
    const room: OfficeRoomRecord = {
      id: 'r1',
      name: 'Room 1',
      team: 'Team A',
      purpose: null,
      zoneX: 0,
      zoneY: 0,
      zoneW: 50,
      zoneH: 50,
    }
    expect(room.zoneW).toBe(50)
  })

  it('OfficeAssignmentRecord shape is valid', () => {
    const assignment: OfficeAssignmentRecord = {
      id: 'a1',
      targetAgentId: 'forge',
      taskTitle: 'Fix bug',
      taskBrief: 'Details',
      priority: 'high',
      status: 'queued',
      routingTarget: 'agent_runtime',
      source: 'office_ui',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    expect(assignment.priority).toBe('high')
    expect(assignment.status).toBe('queued')
  })

  it('OfficeStateSnapshot has all required fields', () => {
    const snapshot: OfficeStateSnapshot = {
      agents: [],
      rooms: [],
      presence: [],
      worldEntities: [],
      assignments: [],
      activityFeed: [],
      decisions: [],
    }
    expect(Object.keys(snapshot)).toHaveLength(7)
  })
})

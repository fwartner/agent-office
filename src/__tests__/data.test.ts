import { describe, it, expect } from 'vitest'
import {
  agents,
  rooms,
  agentSeats,
  workdayPolicy,
  seedOfficeSnapshot,
  type PresenceState,
  type AgentCard,
  type Room,
} from '../data'

const VALID_PRESENCE: PresenceState[] = ['off_hours', 'available', 'active', 'in_meeting', 'paused', 'blocked']

describe('data — agents', () => {
  it('exports a non-empty array of agents', () => {
    expect(agents.length).toBeGreaterThan(0)
  })

  it('every agent has required fields', () => {
    for (const agent of agents) {
      expect(agent.id).toBeTruthy()
      expect(agent.name).toBeTruthy()
      expect(agent.role).toBeTruthy()
      expect(agent.team).toBeTruthy()
      expect(agent.roomId).toBeTruthy()
      expect(VALID_PRESENCE).toContain(agent.presence)
      expect(agent.focus).toBeTruthy()
      expect(typeof agent.criticalTask).toBe('boolean')
      expect(agent.collaborationMode).toBeTruthy()
    }
  })

  it('agent IDs are unique', () => {
    const ids = agents.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every agent references an existing room', () => {
    const roomIds = new Set(rooms.map(r => r.id))
    for (const agent of agents) {
      expect(roomIds.has(agent.roomId)).toBe(true)
    }
  })
})

describe('data — rooms', () => {
  it('exports a non-empty array of rooms', () => {
    expect(rooms.length).toBeGreaterThan(0)
  })

  it('every room has required fields', () => {
    for (const room of rooms) {
      expect(room.id).toBeTruthy()
      expect(room.name).toBeTruthy()
      expect(room.team).toBeTruthy()
      expect(room.purpose).toBeTruthy()
      expect(Array.isArray(room.agents)).toBe(true)
      expect(room.zone).toBeDefined()
      expect(typeof room.zone.x).toBe('number')
      expect(typeof room.zone.y).toBe('number')
      expect(typeof room.zone.w).toBe('number')
      expect(typeof room.zone.h).toBe('number')
    }
  })

  it('room IDs are unique', () => {
    const ids = rooms.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('zone coordinates are within valid range (0-100%)', () => {
    for (const room of rooms) {
      expect(room.zone.x).toBeGreaterThanOrEqual(0)
      expect(room.zone.y).toBeGreaterThanOrEqual(0)
      expect(room.zone.x + room.zone.w).toBeLessThanOrEqual(100)
      expect(room.zone.y + room.zone.h).toBeLessThanOrEqual(100)
    }
  })
})

describe('data — agentSeats', () => {
  it('every agent has a seat entry', () => {
    for (const agent of agents) {
      expect(agentSeats[agent.id]).toBeDefined()
    }
  })

  it('seat positions are within 0-100% range', () => {
    for (const [, seat] of Object.entries(agentSeats)) {
      expect(seat.xPct).toBeGreaterThanOrEqual(0)
      expect(seat.xPct).toBeLessThanOrEqual(100)
      expect(seat.yPct).toBeGreaterThanOrEqual(0)
      expect(seat.yPct).toBeLessThanOrEqual(100)
    }
  })
})

describe('data — workdayPolicy', () => {
  it('has a valid timezone', () => {
    expect(workdayPolicy.timezone).toBe('Europe/Berlin')
  })

  it('has days and hours', () => {
    expect(workdayPolicy.days).toBeTruthy()
    expect(workdayPolicy.hours).toBeTruthy()
  })

  it('has pause and shared-place rules', () => {
    expect(workdayPolicy.pauseRule).toBeTruthy()
    expect(workdayPolicy.sharedPlaceRule).toBeTruthy()
  })
})

describe('data — seedOfficeSnapshot', () => {
  it('has all required fields', () => {
    expect(seedOfficeSnapshot.agents).toBe(agents)
    expect(seedOfficeSnapshot.rooms).toBe(rooms)
    expect(seedOfficeSnapshot.agentSeats).toBe(agentSeats)
    expect(seedOfficeSnapshot.workdayPolicy).toBe(workdayPolicy)
    expect(seedOfficeSnapshot.source).toBe('seed')
    expect(seedOfficeSnapshot.lastUpdatedAt).toBeTruthy()
  })

  it('lastUpdatedAt is a valid ISO date', () => {
    const d = new Date(seedOfficeSnapshot.lastUpdatedAt)
    expect(isNaN(d.getTime())).toBe(false)
  })
})

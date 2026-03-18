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

describe('data - agents', () => {
  it('exports an empty array of agents by default', () => {
    expect(agents).toEqual([])
  })

  it('agent IDs are unique (vacuously true when empty)', () => {
    const ids = agents.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('data - rooms', () => {
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

  it('room agent arrays are empty by default', () => {
    for (const room of rooms) {
      expect(room.agents).toEqual([])
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

describe('data - agentSeats', () => {
  it('is empty by default', () => {
    expect(Object.keys(agentSeats)).toHaveLength(0)
  })
})

describe('data - workdayPolicy', () => {
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

describe('data - seedOfficeSnapshot', () => {
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

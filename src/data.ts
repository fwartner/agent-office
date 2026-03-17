export type PresenceState =
  | 'off_hours'
  | 'available'
  | 'active'
  | 'in_meeting'
  | 'paused'
  | 'blocked'

export interface AgentCard {
  id: string
  name: string
  role: string
  team: string
  roomId: string
  presence: PresenceState
  focus: string
  criticalTask: boolean
  collaborationMode: string
  /** Is this agent an external collaborator (not firm office staff)? */
  external?: boolean
}

export interface Room {
  id: string
  name: string
  team: string
  purpose: string
  agents: string[]
  /** Position zone on the Office Level 4 map (percentage-based) */
  zone: { x: number; y: number; w: number; h: number }
}

export interface WorkdayPolicy {
  timezone: string
  days: string
  hours: string
  pauseRule: string
  sharedPlaceRule: string
}

export interface OfficeSnapshot {
  agents: AgentCard[]
  rooms: Room[]
  agentSeats: Record<string, { xPct: number; yPct: number }>
  workdayPolicy: WorkdayPolicy
  source: 'seed' | 'file' | 'postgres'
  lastUpdatedAt: string
}

export const workdayPolicy: WorkdayPolicy = {
  timezone: 'Europe/Berlin',
  days: 'Monday-Friday',
  hours: '09:00-17:00',
  pauseRule: 'After non-critical tasks, agents should move to paused to save tokens until the next meaningful task arrives.',
  sharedPlaceRule: 'The office is the shared place where all agents work together, coordinate by room, and expose their current state.'
}

export const agents: AgentCard[] = [
  {
    id: 'forge',
    name: 'Forge',
    role: 'Full-stack builder',
    team: 'Build',
    roomId: 'shipyard',
    presence: 'active',
    focus: 'Building the pixel-art virtual office',
    criticalTask: true,
    collaborationMode: 'Shipping implementation in the shared office shell'
  },
  {
    id: 'northstar',
    name: 'Northstar',
    role: 'Technical architecture',
    team: 'Platform',
    roomId: 'systems-bay',
    presence: 'available',
    focus: 'Reviewing seams for future live-state integration',
    criticalTask: false,
    collaborationMode: 'Advises structure used by every room'
  },
  {
    id: 'prism',
    name: 'Prism',
    role: 'Product scope',
    team: 'Product',
    roomId: 'planning-studio',
    presence: 'in_meeting',
    focus: 'Holding Phase 1 scope line around shared-office fundamentals',
    criticalTask: true,
    collaborationMode: 'Aligns priorities across the office'
  },
  {
    id: 'lumen',
    name: 'Lumen',
    role: 'UX and interface structure',
    team: 'Experience',
    roomId: 'planning-studio',
    presence: 'active',
    focus: 'Making presence and navigation readable at a glance',
    criticalTask: true,
    collaborationMode: 'Shapes how the whole office feels to inhabit'
  },
  {
    id: 'quarry',
    name: 'Quarry',
    role: 'Reporting and metrics',
    team: 'Operations',
    roomId: 'signal-room',
    presence: 'available',
    focus: 'Ready to surface metrics and decisions as they happen',
    criticalTask: false,
    collaborationMode: 'Surfaces metrics when they matter'
  },
  {
    id: 'morrow',
    name: 'Morrow',
    role: 'Operational process fit',
    team: 'Operations',
    roomId: 'signal-room',
    presence: 'available',
    focus: 'Available for operational process work and coordination',
    criticalTask: true,
    collaborationMode: 'Keeps the office behavior operationally coherent'
  }
]

export const rooms: Room[] = [
  {
    id: 'planning-studio',
    name: 'Planning Studio',
    team: 'Product + UX',
    purpose: 'Scope, flows, and meeting-driven coordination',
    agents: ['prism', 'lumen'],
    zone: { x: 25, y: 3, w: 50, h: 27 }
  },
  {
    id: 'shipyard',
    name: 'Shipyard',
    team: 'Build',
    purpose: 'Implementation room for active engineering work',
    agents: ['forge'],
    zone: { x: 2, y: 33, w: 58, h: 30 }
  },
  {
    id: 'systems-bay',
    name: 'Systems Bay',
    team: 'Platform',
    purpose: 'Architecture and systems decisions that support the whole office',
    agents: ['northstar'],
    zone: { x: 62, y: 33, w: 36, h: 22 }
  },
  {
    id: 'commons',
    name: 'Commons',
    team: 'Shared Office',
    purpose: 'The shared place where all agents gather, coordinate, and expose presence together',
    agents: [],
    zone: { x: 2, y: 68, w: 58, h: 30 }
  },
  {
    id: 'signal-room',
    name: 'Signal Room',
    team: 'Ops',
    purpose: 'Status, reporting, decisions, and operational visibility',
    agents: ['quarry', 'morrow'],
    zone: { x: 62, y: 60, w: 36, h: 38 }
  }
]

/** Seat positions for agents within their room zones (percentage offsets within the zone) */
export const agentSeats: Record<string, { xPct: number; yPct: number }> = {
  forge: { xPct: 35, yPct: 45 },
  northstar: { xPct: 50, yPct: 50 },
  prism: { xPct: 35, yPct: 50 },
  lumen: { xPct: 65, yPct: 50 },
  quarry: { xPct: 35, yPct: 45 },
  morrow: { xPct: 65, yPct: 55 }
}

export const seedOfficeSnapshot: OfficeSnapshot = {
  agents,
  rooms,
  agentSeats,
  workdayPolicy,
  source: 'seed',
  lastUpdatedAt: new Date().toISOString()
}

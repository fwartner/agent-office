import type { PresenceState } from './data'

/** Per-sprite animation metadata */
export interface SpriteAnimData {
  frameWidth: number
  frameHeight: number
  frameCount: number
}

/** Character definition for an agent */
export interface CharacterSpriteSet {
  id: string
  label: string
  idle: string
  active?: string
  meeting?: string
  paused?: string
  blocked?: string
  portrait?: string
  kind: 'worker' | 'lead' | 'specialist' | 'custom'
  scale: number
  labelOffsetY?: number
}

export interface AgentWorldEntity {
  agentId: string
  characterId: string
  anchor: { xPct: number; yPct: number }
  facing?: 'left' | 'right' | 'up' | 'down'
}

export interface AssignmentRecord {
  id: string
  targetAgentId: string
  taskTitle: string
  taskBrief: string
  priority: 'low' | 'medium' | 'high'
  status: 'queued' | 'routed' | 'active' | 'done' | 'blocked' | 'cancelled'
  routingTarget: 'agent_runtime' | 'work_tracker' | 'both'
  createdAt: string
  source?: string
  result?: string
  resultSavedAt?: string
  resultAction?: 'saved' | 'dismissed' | 'visible'
}

export interface ActivityItem {
  id: string
  kind: 'assignment' | 'presence' | 'decision' | 'system'
  text: string
  agentId?: string
  createdAt: string
}

const BASE = '/assets/characters/free-office-pixel-art'
const CUSTOM = '/assets/custom-characters'
const PIXELLAB = '/assets/characters/pixellab'

/** Animation data keyed by filename (last segment of URL) */
const spriteAnimMap: Record<string, SpriteAnimData> = {
  'Julia-Idle.png': { frameWidth: 32, frameHeight: 32, frameCount: 4 },
  'Julia.png': { frameWidth: 32, frameHeight: 32, frameCount: 4 },
  'Julia_PC.png': { frameWidth: 64, frameHeight: 64, frameCount: 6 },
  'Julia_Drinking_Coffee.png': { frameWidth: 32, frameHeight: 32, frameCount: 3 },
  'boss.png': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'worker1.png': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'worker2.png': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'worker4.png': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'polly.jpg': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'morrow.jpg': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'ledger.jpg': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'halcyon.jpg': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'circuit.jpg': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  'keystone.jpg': { frameWidth: 64, frameHeight: 64, frameCount: 1 },
  // PixelLab-generated sprites (48x48 canvas, single frame)
  'forge-south.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'forge-east.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'forge-north.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'forge-west.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'northstar-south.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'northstar-east.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'northstar-north.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'northstar-west.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'prism-south.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'prism-east.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'prism-north.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'prism-west.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'lumen-south.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'lumen-east.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'lumen-north.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'lumen-west.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'quarry-south.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'quarry-east.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'quarry-north.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'quarry-west.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'morrow-south.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'morrow-east.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'morrow-north.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
  'morrow-west.png': { frameWidth: 48, frameHeight: 48, frameCount: 1 },
}

/** Get animation data for a sprite URL */
export function getSpriteAnimData(spriteUrl: string): SpriteAnimData {
  const filename = spriteUrl.split('/').pop() ?? ''
  return spriteAnimMap[filename] ?? { frameWidth: 32, frameHeight: 32, frameCount: 1 }
}

export const characterSprites: Record<string, CharacterSpriteSet> = {
  polly: {
    id: 'polly',
    label: 'Polly',
    idle: `${CUSTOM}/polly.jpg`,
    portrait: `${CUSTOM}/polly.jpg`,
    kind: 'custom',
    scale: 1.5,
    labelOffsetY: 36
  },
  forge: {
    id: 'forge',
    label: 'Forge',
    idle: `${PIXELLAB}/forge-south.png`,
    active: `${PIXELLAB}/forge-east.png`,
    meeting: `${PIXELLAB}/forge-west.png`,
    paused: `${PIXELLAB}/forge-south.png`,
    blocked: `${PIXELLAB}/forge-north.png`,
    portrait: `${PIXELLAB}/forge-south.png`,
    kind: 'custom',
    scale: 1.8,
    labelOffsetY: 50
  },
  northstar: {
    id: 'northstar',
    label: 'Northstar',
    idle: `${PIXELLAB}/northstar-south.png`,
    active: `${PIXELLAB}/northstar-east.png`,
    meeting: `${PIXELLAB}/northstar-west.png`,
    paused: `${PIXELLAB}/northstar-south.png`,
    blocked: `${PIXELLAB}/northstar-north.png`,
    portrait: `${PIXELLAB}/northstar-south.png`,
    kind: 'custom',
    scale: 1.8,
    labelOffsetY: 50
  },
  morrow: {
    id: 'morrow',
    label: 'Morrow',
    idle: `${PIXELLAB}/morrow-south.png`,
    active: `${PIXELLAB}/morrow-east.png`,
    meeting: `${PIXELLAB}/morrow-west.png`,
    paused: `${PIXELLAB}/morrow-south.png`,
    blocked: `${PIXELLAB}/morrow-north.png`,
    portrait: `${PIXELLAB}/morrow-south.png`,
    kind: 'custom',
    scale: 1.8,
    labelOffsetY: 50
  },
  ledger: {
    id: 'ledger',
    label: 'Ledger',
    idle: `${CUSTOM}/ledger.jpg`,
    portrait: `${CUSTOM}/ledger.jpg`,
    kind: 'custom',
    scale: 1.5,
    labelOffsetY: 36
  },
  halcyon: {
    id: 'halcyon',
    label: 'Halcyon',
    idle: `${CUSTOM}/halcyon.jpg`,
    portrait: `${CUSTOM}/halcyon.jpg`,
    kind: 'custom',
    scale: 1.5,
    labelOffsetY: 36
  },
  circuit: {
    id: 'circuit',
    label: 'Circuit',
    idle: `${CUSTOM}/circuit.jpg`,
    portrait: `${CUSTOM}/circuit.jpg`,
    kind: 'custom',
    scale: 1.5,
    labelOffsetY: 36
  },
  prism: {
    id: 'prism',
    label: 'Prism',
    idle: `${PIXELLAB}/prism-south.png`,
    active: `${PIXELLAB}/prism-east.png`,
    meeting: `${PIXELLAB}/prism-west.png`,
    paused: `${PIXELLAB}/prism-south.png`,
    blocked: `${PIXELLAB}/prism-north.png`,
    portrait: `${PIXELLAB}/prism-south.png`,
    kind: 'custom',
    scale: 1.8,
    labelOffsetY: 50
  },
  keystone: {
    id: 'keystone',
    label: 'Keystone',
    idle: `${CUSTOM}/keystone.jpg`,
    portrait: `${CUSTOM}/keystone.jpg`,
    kind: 'custom',
    scale: 1.5,
    labelOffsetY: 36
  },
  lumen: {
    id: 'lumen',
    label: 'Lumen',
    idle: `${PIXELLAB}/lumen-south.png`,
    active: `${PIXELLAB}/lumen-east.png`,
    meeting: `${PIXELLAB}/lumen-west.png`,
    paused: `${PIXELLAB}/lumen-south.png`,
    blocked: `${PIXELLAB}/lumen-north.png`,
    portrait: `${PIXELLAB}/lumen-south.png`,
    kind: 'custom',
    scale: 1.8,
    labelOffsetY: 50
  },
  quarry: {
    id: 'quarry',
    label: 'Quarry',
    idle: `${PIXELLAB}/quarry-south.png`,
    active: `${PIXELLAB}/quarry-east.png`,
    meeting: `${PIXELLAB}/quarry-west.png`,
    paused: `${PIXELLAB}/quarry-south.png`,
    blocked: `${PIXELLAB}/quarry-north.png`,
    portrait: `${PIXELLAB}/quarry-south.png`,
    kind: 'custom',
    scale: 1.8,
    labelOffsetY: 50
  }
}

/** Get the correct sprite URL for a character based on their presence state */
export function getCharacterSprite(character: CharacterSpriteSet, presence: PresenceState): string {
  switch (presence) {
    case 'active':
      return character.active ?? character.idle
    case 'in_meeting':
      return character.meeting ?? character.active ?? character.idle
    case 'paused':
      return character.paused ?? character.idle
    case 'blocked':
      return character.blocked ?? character.idle
    case 'available':
    case 'off_hours':
    default:
      return character.idle
  }
}

export const worldEntities: Record<string, AgentWorldEntity> = {
  forge: { agentId: 'forge', characterId: 'forge', anchor: { xPct: 35, yPct: 45 }, facing: 'down' },
  northstar: { agentId: 'northstar', characterId: 'northstar', anchor: { xPct: 50, yPct: 50 }, facing: 'down' },
  prism: { agentId: 'prism', characterId: 'prism', anchor: { xPct: 35, yPct: 50 }, facing: 'down' },
  lumen: { agentId: 'lumen', characterId: 'lumen', anchor: { xPct: 65, yPct: 50 }, facing: 'down' },
  quarry: { agentId: 'quarry', characterId: 'quarry', anchor: { xPct: 35, yPct: 45 }, facing: 'down' },
  morrow: { agentId: 'morrow', characterId: 'morrow', anchor: { xPct: 65, yPct: 55 }, facing: 'down' }
}

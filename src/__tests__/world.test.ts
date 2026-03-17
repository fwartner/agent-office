import { describe, it, expect } from 'vitest'
import {
  getSpriteAnimData,
  getCharacterSprite,
  characterSprites,
  worldEntities,
  type CharacterSpriteSet,
  type SpriteAnimData,
} from '../world'
import { agents } from '../data'
import type { PresenceState } from '../data'

describe('getSpriteAnimData', () => {
  it('returns correct data for a known sprite', () => {
    const result = getSpriteAnimData('/assets/characters/free-office-pixel-art/Julia-Idle.png')
    expect(result).toEqual({ frameWidth: 32, frameHeight: 32, frameCount: 4 })
  })

  it('returns correct data for a PixelLab character', () => {
    const result = getSpriteAnimData('/assets/characters/pixellab/forge-south.png')
    expect(result).toEqual({ frameWidth: 48, frameHeight: 48, frameCount: 1 })
  })

  it('returns default for unknown sprites', () => {
    const result = getSpriteAnimData('/some/unknown/sprite.png')
    expect(result).toEqual({ frameWidth: 32, frameHeight: 32, frameCount: 1 })
  })

  it('returns default for empty string', () => {
    const result = getSpriteAnimData('')
    expect(result).toEqual({ frameWidth: 32, frameHeight: 32, frameCount: 1 })
  })
})

describe('getCharacterSprite', () => {
  const testCharacter: CharacterSpriteSet = {
    id: 'test',
    label: 'Test',
    idle: '/idle.png',
    active: '/active.png',
    meeting: '/meeting.png',
    paused: '/paused.png',
    blocked: '/blocked.png',
    kind: 'worker',
    scale: 1,
  }

  it('returns idle for off_hours', () => {
    expect(getCharacterSprite(testCharacter, 'off_hours')).toBe('/idle.png')
  })

  it('returns idle for available', () => {
    expect(getCharacterSprite(testCharacter, 'available')).toBe('/idle.png')
  })

  it('returns active for active', () => {
    expect(getCharacterSprite(testCharacter, 'active')).toBe('/active.png')
  })

  it('returns meeting for in_meeting', () => {
    expect(getCharacterSprite(testCharacter, 'in_meeting')).toBe('/meeting.png')
  })

  it('returns paused for paused', () => {
    expect(getCharacterSprite(testCharacter, 'paused')).toBe('/paused.png')
  })

  it('returns blocked for blocked', () => {
    expect(getCharacterSprite(testCharacter, 'blocked')).toBe('/blocked.png')
  })

  it('falls back to idle when specific sprite is missing', () => {
    const minimal: CharacterSpriteSet = {
      id: 'min',
      label: 'Min',
      idle: '/idle.png',
      kind: 'worker',
      scale: 1,
    }
    expect(getCharacterSprite(minimal, 'active')).toBe('/idle.png')
    expect(getCharacterSprite(minimal, 'paused')).toBe('/idle.png')
    expect(getCharacterSprite(minimal, 'blocked')).toBe('/idle.png')
  })

  it('falls back to active then idle for in_meeting when meeting is missing', () => {
    const noMeeting: CharacterSpriteSet = {
      id: 'nm',
      label: 'NM',
      idle: '/idle.png',
      active: '/active.png',
      kind: 'worker',
      scale: 1,
    }
    expect(getCharacterSprite(noMeeting, 'in_meeting')).toBe('/active.png')
  })
})

describe('characterSprites', () => {
  it('has a sprite set for every seed agent', () => {
    for (const agent of agents) {
      expect(characterSprites[agent.id]).toBeDefined()
    }
  })

  it('every sprite set has required fields', () => {
    for (const [id, sprite] of Object.entries(characterSprites)) {
      expect(sprite.id).toBe(id)
      expect(sprite.label).toBeTruthy()
      expect(sprite.idle).toBeTruthy()
      expect(sprite.scale).toBeGreaterThan(0)
      expect(['worker', 'lead', 'specialist', 'custom']).toContain(sprite.kind)
    }
  })
})

describe('worldEntities', () => {
  it('has an entity for every seed agent', () => {
    for (const agent of agents) {
      expect(worldEntities[agent.id]).toBeDefined()
    }
  })

  it('every entity references its own agent ID', () => {
    for (const [id, entity] of Object.entries(worldEntities)) {
      expect(entity.agentId).toBe(id)
    }
  })

  it('anchor positions are within 0-100 range', () => {
    for (const entity of Object.values(worldEntities)) {
      expect(entity.anchor.xPct).toBeGreaterThanOrEqual(0)
      expect(entity.anchor.xPct).toBeLessThanOrEqual(100)
      expect(entity.anchor.yPct).toBeGreaterThanOrEqual(0)
      expect(entity.anchor.yPct).toBeLessThanOrEqual(100)
    }
  })
})

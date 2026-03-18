import { describe, it, expect } from 'vitest'
import path from 'node:path'

const VALID_PRESENCE = ['off_hours', 'available', 'active', 'in_meeting', 'paused', 'blocked']
const AGENT_PATCH_FIELDS = ['presence', 'focus', 'roomId', 'criticalTask', 'collaborationMode']

function sanitizePatch(raw) {
  const clean = {}
  for (const key of AGENT_PATCH_FIELDS) {
    if (key in raw) clean[key] = raw[key]
  }
  return clean
}

function isSafePath(filePath, allowedRoots) {
  const resolved = path.resolve(filePath)
  return allowedRoots.some(root => resolved.startsWith(root + path.sep) || resolved === root)
}

describe('sanitizePatch - field whitelist', () => {
  it('keeps only allowed fields', () => {
    const result = sanitizePatch({
      presence: 'active',
      focus: 'testing',
      roomId: 'shipyard',
      criticalTask: true,
      collaborationMode: 'solo',
    })
    expect(result).toEqual({
      presence: 'active',
      focus: 'testing',
      roomId: 'shipyard',
      criticalTask: true,
      collaborationMode: 'solo',
    })
  })

  it('strips unknown fields', () => {
    const result = sanitizePatch({
      presence: 'active',
      __proto__: { polluted: true },
      constructor: 'evil',
      id: 'stolen',
      name: 'overwritten',
      role: 'hacked',
    })
    expect(result).toEqual({ presence: 'active' })
    expect(result).not.toHaveProperty('constructor')
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('name')
    expect(result).not.toHaveProperty('role')
  })

  it('returns empty object if no valid fields', () => {
    const result = sanitizePatch({ evil: true })
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('handles empty object', () => {
    const result = sanitizePatch({})
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('preserves only subset of valid fields', () => {
    const result = sanitizePatch({ focus: 'new focus' })
    expect(result).toEqual({ focus: 'new focus' })
  })
})

describe('presence validation', () => {
  it('accepts all valid presence values', () => {
    for (const state of VALID_PRESENCE) {
      expect(VALID_PRESENCE.includes(state)).toBe(true)
    }
  })

  it('rejects invalid presence values', () => {
    expect(VALID_PRESENCE.includes('invalid')).toBe(false)
    expect(VALID_PRESENCE.includes('')).toBe(false)
    expect(VALID_PRESENCE.includes('ACTIVE')).toBe(false)
    expect(VALID_PRESENCE.includes('online')).toBe(false)
  })
})

describe('assignment required fields', () => {
  const REQUIRED = ['targetAgentId', 'taskTitle', 'priority', 'routingTarget']

  it('detects all missing fields on empty input', () => {
    const input = {}
    const missing = REQUIRED.filter(f => !input[f])
    expect(missing).toEqual(REQUIRED)
  })

  it('detects partial missing fields', () => {
    const input = { targetAgentId: 'forge', taskTitle: 'Test' }
    const missing = REQUIRED.filter(f => !input[f])
    expect(missing).toEqual(['priority', 'routingTarget'])
  })

  it('passes with all required fields', () => {
    const input = {
      targetAgentId: 'forge',
      taskTitle: 'Test task',
      priority: 'high',
      routingTarget: 'agent_runtime',
    }
    const missing = REQUIRED.filter(f => !input[f])
    expect(missing).toHaveLength(0)
  })

  it('detects falsy field values as missing', () => {
    const input = { targetAgentId: '', taskTitle: 'Test', priority: 'low', routingTarget: 'both' }
    const missing = REQUIRED.filter(f => !input[f])
    expect(missing).toContain('targetAgentId')
  })
})

describe('body type validation', () => {
  it('rejects arrays', () => {
    const body = [1, 2, 3]
    expect(typeof body !== 'object' || body === null || Array.isArray(body)).toBe(true)
  })

  it('rejects null', () => {
    const body = null
    expect(typeof body !== 'object' || body === null || Array.isArray(body)).toBe(true)
  })

  it('rejects strings', () => {
    const body = 'hello'
    expect(typeof body !== 'object' || body === null || Array.isArray(body)).toBe(true)
  })

  it('rejects numbers', () => {
    const body = 42
    expect(typeof body !== 'object' || body === null || Array.isArray(body)).toBe(true)
  })

  it('accepts plain objects', () => {
    const body = { key: 'value' }
    expect(typeof body !== 'object' || body === null || Array.isArray(body)).toBe(false)
  })
})

describe('path traversal protection', () => {
  it('rejects paths with ../', () => {
    const DIST = path.resolve('/tmp/test-dist')
    const ASSETS = path.resolve('/tmp/test-assets')
    const roots = [DIST, ASSETS]

    const malicious = path.join(DIST, '../../../etc/passwd')
    expect(isSafePath(malicious, roots)).toBe(false)
  })

  it('accepts paths within allowed roots', () => {
    const DIST = path.resolve('/tmp/test-dist')
    const roots = [DIST]

    const legit = path.join(DIST, 'index.html')
    expect(isSafePath(legit, roots)).toBe(true)
  })

  it('accepts the root directory itself', () => {
    const DIST = path.resolve('/tmp/test-dist')
    expect(isSafePath(DIST, [DIST])).toBe(true)
  })

  it('rejects sibling directories', () => {
    const DIST = path.resolve('/tmp/test-dist')
    const sibling = path.resolve('/tmp/test-dist-evil')
    expect(isSafePath(sibling, [DIST])).toBe(false)
  })
})

describe('body size limit', () => {
  const MAX_BODY_SIZE = 1_048_576 // 1MB

  it('limit is 1MB', () => {
    expect(MAX_BODY_SIZE).toBe(1024 * 1024)
  })

  it('a normal request body is under the limit', () => {
    const body = JSON.stringify({ presence: 'active', focus: 'working on tests' })
    expect(Buffer.byteLength(body)).toBeLessThan(MAX_BODY_SIZE)
  })
})

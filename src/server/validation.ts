/**
 * Shared validation constants and helpers.
 * Used by both dev (vite.config.ts) and prod (server.mjs) servers.
 */

export const MAX_BODY_SIZE = 1_048_576 // 1MB
export const MAX_TITLE_LEN = 200
export const MAX_BRIEF_LEN = 2000
export const MAX_FOCUS_LEN = 500
export const MAX_NAME_LEN = 100
export const MAX_ROLE_LEN = 200
export const MAX_SYSTEM_PROMPT_LEN = 5000
export const MAX_MESSAGE_LEN = 2000

export const VALID_PRESENCE = ['off_hours', 'available', 'active', 'in_meeting', 'paused', 'blocked'] as const
export type PresenceState = typeof VALID_PRESENCE[number]

export const AGENT_PATCH_FIELDS = ['presence', 'focus', 'roomId', 'criticalTask', 'collaborationMode', 'xPct', 'yPct', 'systemPrompt', 'runtimeMaxTurns', 'runtimeTimeoutSec', 'runtimeWorkingDir', 'runtimeAllowedTools', 'runtimeMode', 'runtimeProvider', 'runtimeModel'] as const
export const AGENT_ID_RE = /^[a-z0-9-]+$/
export const ASSIGNMENT_STATUSES = ['queued', 'routed', 'active', 'done', 'blocked', 'cancelled'] as const
export const VALID_ROUTING = ['agent_runtime', 'work_tracker', 'both'] as const
export const VALID_PRIORITY = ['low', 'medium', 'high'] as const
export const VALID_DECISION_STATUSES = ['proposed', 'accepted', 'rejected'] as const
export const WEBHOOK_EVENTS = ['agent.presence_changed', 'task.created', 'task.queued', 'task.completed', 'task.failed', 'agent.created', 'agent.deleted', 'decision.created', 'decision.updated', 'message.sent'] as const

export interface AgentPatch {
  presence?: string
  focus?: string
  roomId?: string
  criticalTask?: boolean
  collaborationMode?: string
  xPct?: number
  yPct?: number
  systemPrompt?: string
  runtimeMaxTurns?: number
  runtimeTimeoutSec?: number
  runtimeWorkingDir?: string
  runtimeAllowedTools?: string
  runtimeMode?: string
  runtimeProvider?: string
  runtimeModel?: string
}

export function sanitizePatch(raw: Record<string, unknown>): AgentPatch {
  const clean: AgentPatch = {}
  for (const key of AGENT_PATCH_FIELDS) {
    if (key in raw) {
      if ((key === 'xPct' || key === 'yPct') && typeof raw[key] === 'number') {
        clean[key] = Math.max(0, Math.min(100, raw[key] as number))
      } else if (key === 'systemPrompt' && typeof raw[key] === 'string') {
        clean[key] = (raw[key] as string).slice(0, MAX_SYSTEM_PROMPT_LEN)
      } else {
        ;(clean as Record<string, unknown>)[key] = raw[key]
      }
    }
  }
  return clean
}

export function validateObject(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
}

export function findMissing(obj: Record<string, unknown>, fields: string[]): string[] {
  return fields.filter(f => !obj[f])
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** Strip HTML tags from a string to prevent XSS in stored text. */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

/** Sanitize a string field: strip HTML + enforce max length. */
export function sanitizeString(input: string, maxLen: number): string {
  return stripHtml(input).slice(0, maxLen)
}

/**
 * Simple sliding-window rate limiter (in-memory, per-IP).
 * Returns true if the request should be allowed, false if rate-limited.
 */
export class RateLimiter {
  private windows = new Map<string, number[]>()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  allow(key: string): boolean {
    const now = Date.now()
    const cutoff = now - this.windowMs
    let timestamps = this.windows.get(key) || []
    timestamps = timestamps.filter(t => t > cutoff)
    if (timestamps.length >= this.maxRequests) {
      this.windows.set(key, timestamps)
      return false
    }
    timestamps.push(now)
    this.windows.set(key, timestamps)
    return true
  }

  private cleanup(): void {
    const now = Date.now()
    const cutoff = now - this.windowMs
    for (const [key, timestamps] of this.windows) {
      const filtered = timestamps.filter(t => t > cutoff)
      if (filtered.length === 0) this.windows.delete(key)
      else this.windows.set(key, filtered)
    }
  }
}

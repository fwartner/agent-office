/**
 * Drizzle ORM-backed ApiContext - uses SQLite or Postgres via Drizzle.
 * Replaces the JSON file context when a database is configured.
 */
import fs from 'node:fs'
import path from 'node:path'
import { eq, desc, and, or } from 'drizzle-orm'
import type { ApiContext, SnapshotData } from './api-routes.js'
import type { AgentPatch } from './validation.js'
import {
  MAX_NAME_LEN, MAX_ROLE_LEN, MAX_BRIEF_LEN, MAX_TITLE_LEN,
  MAX_SYSTEM_PROMPT_LEN, MAX_MESSAGE_LEN, VALID_PRESENCE, WEBHOOK_EVENTS,
} from './validation.js'
import type * as SchemaTypes from '../db/schema.js'

type Schema = typeof SchemaTypes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDb = any

/** Settings + workday policy stored in a JSON sidecar file alongside the DB */
interface SettingsFile {
  officeName: string
  theme: { presenceColors: Record<string, string> }
  workdayPolicy: { timezone: string; days: string; hours: string; pauseRule: string; sharedPlaceRule: string }
}

function readSettings(filePath: string): SettingsFile {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return {
      officeName: 'Agent Office',
      theme: { presenceColors: { off_hours: '#8792a8', available: '#95d8ff', active: '#78f7b5', in_meeting: '#c39bff', paused: '#ffd479', blocked: '#ff8b8b' } },
      workdayPolicy: { timezone: 'Europe/Berlin', days: 'Monday-Friday', hours: '09:00-17:00', pauseRule: 'After non-critical tasks, agents should move to paused to save tokens until the next meaningful task arrives.', sharedPlaceRule: 'The office is the shared place where all agents work together, coordinate by room, and expose their current state.' },
    }
  }
}

function writeSettings(filePath: string, settings: SettingsFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2))
}

export function createDrizzleContext(
  db: DrizzleDb,
  schema: Schema,
  resultsDir: string,
  settingsFilePath?: string,
): ApiContext {
  const settingsPath = settingsFilePath || path.join(path.dirname(resultsDir), 'settings.json')

  function now() { return new Date().toISOString() }
  function genId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

  const ctx: ApiContext = {
    resultsDir,

    async getSnapshot(): Promise<SnapshotData> {
      type Agent = typeof schema.officeAgents.$inferSelect
      type Room = typeof schema.officeRooms.$inferSelect
      type Presence = typeof schema.officePresence.$inferSelect
      type WorldEntity = typeof schema.officeWorldEntities.$inferSelect
      type Assignment = typeof schema.officeAssignments.$inferSelect
      type Activity = typeof schema.officeActivityFeed.$inferSelect
      type Decision = typeof schema.officeDecisions.$inferSelect
      type Message = typeof schema.officeMessages.$inferSelect
      type Webhook = typeof schema.officeWebhooks.$inferSelect
      type WebhookLog = typeof schema.officeWebhookLogs.$inferSelect

      const agents: Agent[] = await db.select().from(schema.officeAgents)
      const rooms: Room[] = await db.select().from(schema.officeRooms)
      const presence: Presence[] = await db.select().from(schema.officePresence)
      const worldEntities: WorldEntity[] = await db.select().from(schema.officeWorldEntities)
      const assignments: Assignment[] = await db.select().from(schema.officeAssignments)
      const activityRows: Activity[] = await db.select().from(schema.officeActivityFeed)
      const decisions: Decision[] = await db.select().from(schema.officeDecisions)
      const messages: Message[] = await db.select().from(schema.officeMessages)
      const webhooks: Webhook[] = await db.select().from(schema.officeWebhooks)
      const webhookLogs: WebhookLog[] = await db.select().from(schema.officeWebhookLogs)

      // Build agent cards with presence + world entity data
      const presenceMap = new Map<string, Presence>(presence.map(p => [p.agentId, p]))
      const entityMap = new Map<string, WorldEntity>(worldEntities.map(e => [e.agentId, e]))
      const agentCards = agents.filter(a => a.officeVisible).map(a => {
        const p = presenceMap.get(a.id)
        const e = entityMap.get(a.id)
        return {
          id: a.id, name: a.name, role: a.role, team: a.team,
          roomId: e?.roomId || 'commons',
          presence: p?.presenceState || 'off_hours',
          focus: p?.focus || '',
          criticalTask: p?.criticalTask || false,
          collaborationMode: p?.collaborationMode || '',
          systemPrompt: a.systemPrompt || '',
          runtimeMaxTurns: a.runtimeMaxTurns ?? 3,
          runtimeTimeoutSec: a.runtimeTimeoutSec ?? 300,
          runtimeWorkingDir: a.runtimeWorkingDir || '',
          runtimeAllowedTools: a.runtimeAllowedTools || '',
          runtimeMode: a.runtimeMode || 'full',
          runtimeProvider: a.runtimeProvider || 'claude-code',
          runtimeModel: a.runtimeModel || '',
          external: !a.internalStaff,
        }
      })

      // Build rooms with agent lists
      const roomCards = rooms.map(r => {
        const roomAgents = worldEntities.filter(e => e.roomId === r.id).map(e => e.agentId)
        return {
          id: r.id, name: r.name, team: r.team, purpose: r.purpose,
          agents: roomAgents,
          zone: { x: r.zoneX, y: r.zoneY, w: r.zoneW, h: r.zoneH },
        }
      })

      // Build seats
      const agentSeats: Record<string, { xPct: number; yPct: number }> = {}
      for (const e of worldEntities) {
        agentSeats[e.agentId] = { xPct: e.anchorXPct, yPct: e.anchorYPct }
      }

      // Map webhooks - parse events JSON for SQLite
      const webhookCards = webhooks.map(w => ({
        ...w,
        events: typeof w.events === 'string' ? JSON.parse(w.events as string) : w.events,
      }))

      const settings = readSettings(settingsPath)

      return {
        agents: agentCards,
        rooms: roomCards,
        agentSeats,
        workdayPolicy: settings.workdayPolicy,
        settings: { officeName: settings.officeName, theme: settings.theme },
        activity: activityRows.map(a => ({
          id: a.id, kind: a.kind, text: a.message, agentId: a.agentId, createdAt: a.createdAt,
        })),
        assignments: assignments.map(a => ({
          id: a.id, targetAgentId: a.targetAgentId, taskTitle: a.taskTitle,
          taskBrief: a.taskBrief, priority: a.priority, status: a.status,
          routingTarget: a.routingTarget, source: a.source, result: a.result,
          createdAt: a.createdAt,
        })),
        decisions: decisions.map(d => ({
          id: d.id, title: d.title, detail: d.detail,
          status: d.status, proposedBy: d.proposedBy, createdAt: d.createdAt,
        })),
        messages: messages.map(m => ({
          id: m.id, fromAgentId: m.fromAgentId, toAgentId: m.toAgentId,
          roomId: m.roomId, message: m.message, createdAt: m.createdAt,
        })),
        webhooks: webhookCards,
        webhookLogs: webhookLogs.map(l => ({
          id: l.id, webhookId: l.webhookId, event: l.event,
          statusCode: l.statusCode, deliveredAt: l.deliveredAt,
        })),
        source: 'sqlite',
        lastUpdatedAt: now(),
      }
    },

    async getAgent(id) {
      const rows = await db.select().from(schema.officeAgents).where(eq(schema.officeAgents.id, id))
      return rows[0] ? { ...rows[0] } : null
    },

    async createAgent(input) {
      const id = String(input.id)
      const sysPrompt = input.systemPrompt ? String(input.systemPrompt).slice(0, MAX_SYSTEM_PROMPT_LEN) : ''
      await db.insert(schema.officeAgents).values({
        id, name: String(input.name), role: String(input.role), team: String(input.team),
        systemPrompt: sysPrompt,
        runtimeMaxTurns: typeof input.runtimeMaxTurns === 'number' ? input.runtimeMaxTurns : 3,
        runtimeTimeoutSec: typeof input.runtimeTimeoutSec === 'number' ? input.runtimeTimeoutSec : 300,
        runtimeWorkingDir: input.runtimeWorkingDir ? String(input.runtimeWorkingDir) : null,
        runtimeAllowedTools: input.runtimeAllowedTools ? String(input.runtimeAllowedTools) : null,
        runtimeMode: input.runtimeMode ? String(input.runtimeMode) : 'full',
        runtimeProvider: input.runtimeProvider ? String(input.runtimeProvider) : 'claude-code',
        runtimeModel: input.runtimeModel ? String(input.runtimeModel) : null,
      })
      await db.insert(schema.officePresence).values({
        agentId: id,
        presenceState: String(input.presence || 'available'),
        effectivePresenceState: String(input.presence || 'available'),
        criticalTask: Boolean(input.criticalTask),
        focus: input.focus ? String(input.focus) : null,
        collaborationMode: input.collaborationMode ? String(input.collaborationMode) : null,
      })
      await db.insert(schema.officeWorldEntities).values({
        agentId: id, roomId: String(input.roomId), anchorXPct: 50, anchorYPct: 50,
      })
      await db.insert(schema.officeActivityFeed).values({
        id: genId('act'), kind: 'system', message: `Agent ${input.name} created`, agentId: id,
      })
      return { id }
    },

    async updateAgent(id, input) {
      const existing = await db.select().from(schema.officeAgents).where(eq(schema.officeAgents.id, id))
      if (!existing.length) return false
      const agentUpdates: Record<string, unknown> = { updatedAt: now() }
      if (input.name) agentUpdates.name = String(input.name)
      if (input.role) agentUpdates.role = String(input.role)
      if (input.team) agentUpdates.team = String(input.team)
      if (input.systemPrompt !== undefined) agentUpdates.systemPrompt = String(input.systemPrompt)
      if (typeof input.runtimeMaxTurns === 'number') agentUpdates.runtimeMaxTurns = input.runtimeMaxTurns
      if (typeof input.runtimeTimeoutSec === 'number') agentUpdates.runtimeTimeoutSec = input.runtimeTimeoutSec
      if (input.runtimeWorkingDir !== undefined) agentUpdates.runtimeWorkingDir = input.runtimeWorkingDir || null
      if (input.runtimeAllowedTools !== undefined) agentUpdates.runtimeAllowedTools = input.runtimeAllowedTools || null
      if (input.runtimeMode !== undefined) agentUpdates.runtimeMode = input.runtimeMode
      if (input.runtimeProvider !== undefined) agentUpdates.runtimeProvider = input.runtimeProvider
      if (input.runtimeModel !== undefined) agentUpdates.runtimeModel = input.runtimeModel || null
      await db.update(schema.officeAgents).set(agentUpdates).where(eq(schema.officeAgents.id, id))
      const presUpdates: Record<string, unknown> = { updatedAt: now() }
      if (input.presence) { presUpdates.presenceState = String(input.presence); presUpdates.effectivePresenceState = String(input.presence) }
      if (typeof input.focus === 'string') presUpdates.focus = input.focus
      if (typeof input.criticalTask === 'boolean') presUpdates.criticalTask = input.criticalTask
      if (typeof input.collaborationMode === 'string') presUpdates.collaborationMode = input.collaborationMode
      if (Object.keys(presUpdates).length > 1) {
        await db.update(schema.officePresence).set(presUpdates).where(eq(schema.officePresence.agentId, id))
      }
      if (input.roomId) {
        await db.update(schema.officeWorldEntities).set({ roomId: String(input.roomId), updatedAt: now() }).where(eq(schema.officeWorldEntities.agentId, id))
      }
      return true
    },

    async patchAgent(id, patch) {
      const existing = await db.select().from(schema.officeAgents).where(eq(schema.officeAgents.id, id))
      if (!existing.length) return false
      const agentUpdates: Record<string, unknown> = { updatedAt: now() }
      if (patch.systemPrompt !== undefined) agentUpdates.systemPrompt = patch.systemPrompt
      if (typeof patch.runtimeMaxTurns === 'number') agentUpdates.runtimeMaxTurns = patch.runtimeMaxTurns
      if (typeof patch.runtimeTimeoutSec === 'number') agentUpdates.runtimeTimeoutSec = patch.runtimeTimeoutSec
      if (patch.runtimeWorkingDir !== undefined) agentUpdates.runtimeWorkingDir = patch.runtimeWorkingDir || null
      if (patch.runtimeAllowedTools !== undefined) agentUpdates.runtimeAllowedTools = patch.runtimeAllowedTools || null
      if (patch.runtimeMode !== undefined) agentUpdates.runtimeMode = patch.runtimeMode
      if (patch.runtimeProvider !== undefined) agentUpdates.runtimeProvider = patch.runtimeProvider
      if (patch.runtimeModel !== undefined) agentUpdates.runtimeModel = patch.runtimeModel || null
      if (Object.keys(agentUpdates).length > 1) {
        await db.update(schema.officeAgents).set(agentUpdates).where(eq(schema.officeAgents.id, id))
      }
      const presUpdates: Record<string, unknown> = { updatedAt: now() }
      if (patch.presence) { presUpdates.presenceState = patch.presence; presUpdates.effectivePresenceState = patch.presence }
      if (typeof patch.focus === 'string') presUpdates.focus = patch.focus
      if (typeof patch.criticalTask === 'boolean') presUpdates.criticalTask = patch.criticalTask
      if (typeof patch.collaborationMode === 'string') presUpdates.collaborationMode = patch.collaborationMode
      if (Object.keys(presUpdates).length > 1) {
        await db.update(schema.officePresence).set(presUpdates).where(eq(schema.officePresence.agentId, id))
      }
      const worldUpdates: Record<string, unknown> = { updatedAt: now() }
      if (patch.roomId) worldUpdates.roomId = patch.roomId
      if (typeof patch.xPct === 'number') worldUpdates.anchorXPct = patch.xPct
      if (typeof patch.yPct === 'number') worldUpdates.anchorYPct = patch.yPct
      if (Object.keys(worldUpdates).length > 1) {
        await db.update(schema.officeWorldEntities).set(worldUpdates).where(eq(schema.officeWorldEntities.agentId, id))
      }
      return true
    },

    async deleteAgent(id) {
      const existing = await db.select().from(schema.officeAgents).where(eq(schema.officeAgents.id, id))
      if (!existing.length) return false
      // CASCADE handles presence + world_entities, but assignments need explicit delete
      await db.delete(schema.officeAssignments).where(eq(schema.officeAssignments.targetAgentId, id))
      await db.delete(schema.officeAgents).where(eq(schema.officeAgents.id, id))
      await db.insert(schema.officeActivityFeed).values({ id: genId('act'), kind: 'system', message: `Agent ${id} deleted` })
      return true
    },

    async createAssignment(input) {
      const id = `assignment-${Date.now()}`
      await db.insert(schema.officeAssignments).values({
        id, targetAgentId: String(input.targetAgentId),
        taskTitle: String(input.taskTitle),
        taskBrief: input.taskBrief ? String(input.taskBrief) : '',
        priority: String(input.priority), routingTarget: String(input.routingTarget),
        source: input.source ? String(input.source) : 'office_ui',
      })
      await db.insert(schema.officeActivityFeed).values({
        id: genId('act'), kind: 'assignment',
        message: `Assigned "${input.taskTitle}" to ${input.targetAgentId}`,
        agentId: String(input.targetAgentId),
      })
      return { id, status: 'queued' }
    },

    async updateAssignment(id, status, result) {
      const existing = await db.select().from(schema.officeAssignments).where(eq(schema.officeAssignments.id, id))
      if (!existing.length) return false
      const updates: Record<string, unknown> = { status, updatedAt: now() }
      if (typeof result === 'string') updates.result = result
      if (status === 'done') updates.completedAt = now()
      await db.update(schema.officeAssignments).set(updates).where(eq(schema.officeAssignments.id, id))
      if (status === 'done' && result) {
        await db.insert(schema.officeActivityFeed).values({
          id: genId('act'), kind: 'assignment',
          message: `Task "${existing[0].taskTitle}" completed`, agentId: existing[0].targetAgentId,
        })
      }
      return true
    },

    async getAssignment(id) {
      const rows = await db.select().from(schema.officeAssignments).where(eq(schema.officeAssignments.id, id))
      return rows[0] ? { ...rows[0] } : null
    },

    async listAssignments(filters) {
      let query = db.select().from(schema.officeAssignments)
      const conditions = []
      if (filters.status) conditions.push(eq(schema.officeAssignments.status, filters.status))
      if (filters.agent) conditions.push(eq(schema.officeAssignments.targetAgentId, filters.agent))
      if (conditions.length === 1) query = query.where(conditions[0])
      else if (conditions.length > 1) query = query.where(and(...conditions))
      const rows = await query.orderBy(desc(schema.officeAssignments.createdAt)).limit(filters.limit || 100)
      return rows
    },

    async saveResult(id) {
      await db.update(schema.officeAssignments).set({ updatedAt: now() }).where(eq(schema.officeAssignments.id, id))
      return true
    },

    async appendActivity(entry) {
      await db.insert(schema.officeActivityFeed).values({
        id: genId('act'),
        kind: String(entry.kind || 'system'),
        message: String(entry.text || ''),
        agentId: entry.agentId ? String(entry.agentId) : null,
      })
    },

    async createDecision(input) {
      const decision = {
        id: `decision-${Date.now()}`,
        title: String(input.title).slice(0, MAX_TITLE_LEN),
        detail: String(input.detail).slice(0, MAX_BRIEF_LEN),
        status: 'proposed' as const,
        proposedBy: input.proposedBy ? String(input.proposedBy) : null,
      }
      await db.insert(schema.officeDecisions).values(decision)
      await db.insert(schema.officeActivityFeed).values({
        id: genId('act'), kind: 'decision', message: `Decision proposed: "${decision.title}"`,
      })
      return { ...decision, createdAt: now() }
    },

    async updateDecision(id, input) {
      const existing = await db.select().from(schema.officeDecisions).where(eq(schema.officeDecisions.id, id))
      if (!existing.length) return false
      const updates: Record<string, unknown> = {}
      if (input.status) updates.status = input.status
      if (typeof input.title === 'string') updates.title = String(input.title).slice(0, MAX_TITLE_LEN)
      if (typeof input.detail === 'string') updates.detail = String(input.detail).slice(0, MAX_BRIEF_LEN)
      if (Object.keys(updates).length) {
        await db.update(schema.officeDecisions).set(updates).where(eq(schema.officeDecisions.id, id))
      }
      return true
    },

    async sendMessage(input) {
      const msg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromAgentId: String(input.fromAgentId),
        toAgentId: input.toAgentId ? String(input.toAgentId) : null,
        roomId: input.roomId ? String(input.roomId) : null,
        message: String(input.message).slice(0, MAX_MESSAGE_LEN),
      }
      await db.insert(schema.officeMessages).values(msg)
      return { ...msg, createdAt: now() }
    },

    async listMessages(filters) {
      let query = db.select().from(schema.officeMessages)
      const conditions = []
      if (filters.room) conditions.push(eq(schema.officeMessages.roomId, filters.room))
      if (filters.agent) {
        conditions.push(
          or(eq(schema.officeMessages.fromAgentId, filters.agent), eq(schema.officeMessages.toAgentId, filters.agent))!
        )
      }
      if (conditions.length === 1) query = query.where(conditions[0])
      else if (conditions.length > 1) query = query.where(and(...conditions))
      return await query.orderBy(desc(schema.officeMessages.createdAt)).limit(50)
    },

    async createRoom(input) {
      const zone = input.zone as Record<string, number>
      await db.insert(schema.officeRooms).values({
        id: String(input.id),
        name: String(input.name).slice(0, MAX_NAME_LEN),
        team: String(input.team).slice(0, MAX_ROLE_LEN),
        purpose: String(input.purpose).slice(0, MAX_BRIEF_LEN),
        zoneX: zone.x, zoneY: zone.y, zoneW: zone.w, zoneH: zone.h,
      })
      return { id: String(input.id) }
    },

    async updateRoom(id, input) {
      const existing = await db.select().from(schema.officeRooms).where(eq(schema.officeRooms.id, id))
      if (!existing.length) return false
      const updates: Record<string, unknown> = { updatedAt: now() }
      if (typeof input.name === 'string') updates.name = input.name.slice(0, MAX_NAME_LEN)
      if (typeof input.team === 'string') updates.team = input.team.slice(0, MAX_ROLE_LEN)
      if (typeof input.purpose === 'string') updates.purpose = input.purpose.slice(0, MAX_BRIEF_LEN)
      await db.update(schema.officeRooms).set(updates).where(eq(schema.officeRooms.id, id))
      return true
    },

    async deleteRoom(id) {
      const existing = await db.select().from(schema.officeRooms).where(eq(schema.officeRooms.id, id))
      if (!existing.length) return false
      // Move agents in this room to commons
      await db.update(schema.officeWorldEntities).set({ roomId: 'commons', updatedAt: now() }).where(eq(schema.officeWorldEntities.roomId, id))
      await db.delete(schema.officeRooms).where(eq(schema.officeRooms.id, id))
      return true
    },

    async createWebhook(input) {
      const webhook = {
        id: `webhook-${Date.now()}`,
        url: String(input.url),
        secret: input.secret ? String(input.secret) : '',
        events: JSON.stringify(Array.isArray(input.events) ? (input.events as string[]).filter(e => WEBHOOK_EVENTS.includes(e as typeof WEBHOOK_EVENTS[number])) : []),
        enabled: true,
      }
      await db.insert(schema.officeWebhooks).values(webhook)
      return { ...webhook, events: JSON.parse(webhook.events), createdAt: now() }
    },

    async deleteWebhook(id) {
      await db.delete(schema.officeWebhookLogs).where(eq(schema.officeWebhookLogs.webhookId, id))
      await db.delete(schema.officeWebhooks).where(eq(schema.officeWebhooks.id, id))
      return true
    },

    async logWebhookDelivery(webhookId, event, statusCode) {
      await db.insert(schema.officeWebhookLogs).values({
        id: `whl-${Date.now()}`, webhookId, event, statusCode,
      })
    },

    async getIntegration(name: string) {
      if (!schema.officeIntegrations) return null
      const rows = await db.select().from(schema.officeIntegrations).where(eq(schema.officeIntegrations.name, name))
      if (!rows[0]) return null
      const row = rows[0]
      return {
        name: row.name,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
        enabled: row.enabled,
        updatedAt: row.updatedAt,
      }
    },

    async updateIntegration(name: string, input: Record<string, unknown>) {
      if (!schema.officeIntegrations) return false
      const existing = await db.select().from(schema.officeIntegrations).where(eq(schema.officeIntegrations.name, name))
      const configStr = input.config ? JSON.stringify(input.config) : '{}'
      const enabled = typeof input.enabled === 'boolean' ? input.enabled : false
      if (existing.length) {
        // Merge config if partial
        const existingConfig = typeof existing[0].config === 'string' ? JSON.parse(existing[0].config) : existing[0].config
        const mergedConfig = input.config ? { ...existingConfig, ...(input.config as Record<string, unknown>) } : existingConfig
        await db.update(schema.officeIntegrations).set({
          config: JSON.stringify(mergedConfig),
          enabled,
          updatedAt: now(),
        }).where(eq(schema.officeIntegrations.name, name))
      } else {
        await db.insert(schema.officeIntegrations).values({
          name,
          config: configStr,
          enabled,
          updatedAt: now(),
        })
      }
      return true
    },

    async updateSettings(input) {
      const settings = readSettings(settingsPath)
      if (typeof input.officeName === 'string') settings.officeName = input.officeName.slice(0, MAX_NAME_LEN)
      if (input.theme && typeof input.theme === 'object') {
        const inputTheme = input.theme as Record<string, unknown>
        if (inputTheme.presenceColors && typeof inputTheme.presenceColors === 'object') {
          const inputColors = inputTheme.presenceColors as Record<string, string>
          for (const key of VALID_PRESENCE) {
            if (typeof inputColors[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(inputColors[key])) {
              settings.theme.presenceColors[key] = inputColors[key]
            }
          }
        }
      }
      if (input.workdayPolicy && typeof input.workdayPolicy === 'object') {
        const iwp = input.workdayPolicy as Record<string, string>
        if (typeof iwp.timezone === 'string') settings.workdayPolicy.timezone = iwp.timezone.slice(0, 100)
        if (typeof iwp.days === 'string') settings.workdayPolicy.days = iwp.days.slice(0, 100)
        if (typeof iwp.hours === 'string') settings.workdayPolicy.hours = iwp.hours.slice(0, 100)
        if (typeof iwp.pauseRule === 'string') settings.workdayPolicy.pauseRule = iwp.pauseRule.slice(0, MAX_BRIEF_LEN)
        if (typeof iwp.sharedPlaceRule === 'string') settings.workdayPolicy.sharedPlaceRule = iwp.sharedPlaceRule.slice(0, MAX_BRIEF_LEN)
      }
      writeSettings(settingsPath, settings)
      return { officeName: settings.officeName, theme: settings.theme, workdayPolicy: settings.workdayPolicy }
    },
  }

  return ctx
}

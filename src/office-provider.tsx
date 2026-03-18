import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { agents as seedAgents, rooms as seedRooms, agentSeats as seedSeats, workdayPolicy as seedPolicy, defaultSettings, type AgentCard, type PresenceState, type Room, type WorkdayPolicy, type OfficeSettings, type RoomUpdateInput, type DecisionRecord, type MessageRecord, type WebhookRecord, type WebhookLogRecord } from './data'
import { characterSprites, worldEntities, type ActivityItem, type AssignmentRecord } from './world'
import type { AgentRuntimeStatus } from './office-state'
import { useSSE, type SSEEventType } from './hooks/useSSE'

export interface OfficeAgent extends AgentCard {
  effectivePresence: PresenceState
  characterId: string
  systemPrompt?: string
}

export interface AgentCreateInput {
  id: string; name: string; role: string; team: string; roomId: string
  presence?: PresenceState; focus?: string; criticalTask?: boolean; collaborationMode?: string
  systemPrompt?: string
  runtimeMaxTurns?: number; runtimeTimeoutSec?: number; runtimeWorkingDir?: string
  runtimeAllowedTools?: string; runtimeMode?: string
}

export interface AgentUpdateInput {
  name?: string; role?: string; team?: string; roomId?: string
  presence?: PresenceState; focus?: string; criticalTask?: boolean; collaborationMode?: string
  systemPrompt?: string
  runtimeMaxTurns?: number; runtimeTimeoutSec?: number; runtimeWorkingDir?: string
  runtimeAllowedTools?: string; runtimeMode?: string
}

export interface ToastItem {
  id: string
  message: string
  kind: 'info' | 'success' | 'warning' | 'error'
  createdAt: number
}

export interface AgentBubble {
  text: string
  color: string
  expiresAt: number
}

interface OfficeState {
  agents: OfficeAgent[]
  rooms: Room[]
  agentSeats: Record<string, { xPct: number; yPct: number }>
  workdayPolicy: WorkdayPolicy
  officeSettings: OfficeSettings
  assignments: AssignmentRecord[]
  activity: ActivityItem[]
  agentRuntimeStatuses: AgentRuntimeStatus[]
  decisions: DecisionRecord[]
  messages: MessageRecord[]
  webhooks: WebhookRecord[]
  toasts: ToastItem[]
  agentBubbles: Map<string, AgentBubble>
  selectedAgentId: string | null
  berlinTimeLabel: string
  withinWorkday: boolean
  dataSource: 'seed' | 'live'
  connectionError: string | null
  selectAgent: (agentId: string | null) => void
  assignTask: (input: {
    targetAgentId: string
    taskTitle: string
    taskBrief: string
    priority: 'low' | 'medium' | 'high'
    routingTarget: 'agent_runtime' | 'work_tracker' | 'both'
  }) => void
  completeTask: (assignmentId: string, result: string) => Promise<boolean>
  cancelTask: (agentId: string) => Promise<boolean>
  saveResult: (assignmentId: string) => Promise<boolean>
  dismissResult: (assignmentId: string) => void
  createAgent: (input: AgentCreateInput) => Promise<boolean>
  updateAgent: (id: string, input: AgentUpdateInput) => Promise<boolean>
  deleteAgent: (id: string) => Promise<boolean>
  updateSettings: (patch: Partial<OfficeSettings> & { workdayPolicy?: Partial<WorkdayPolicy> }) => Promise<boolean>
  updateRoom: (id: string, input: RoomUpdateInput) => Promise<boolean>
  createDecision: (input: { title: string; detail: string; proposedBy?: string }) => Promise<boolean>
  updateDecision: (id: string, input: { status?: string; title?: string; detail?: string }) => Promise<boolean>
  sendMessage: (input: { fromAgentId: string; toAgentId?: string; roomId?: string; message: string }) => Promise<boolean>
  createRoom: (input: { id: string; name: string; team: string; purpose: string; zone: { x: number; y: number; w: number; h: number } }) => Promise<boolean>
  deleteRoom: (id: string) => Promise<boolean>
  createWebhook: (input: { url: string; secret?: string; events: string[] }) => Promise<boolean>
  deleteWebhook: (id: string) => Promise<boolean>
  dismissToast: (id: string) => void
  updateAgentPosition: (agentId: string, xPct: number, yPct: number, roomId?: string) => void
}

const OfficeContext = createContext<OfficeState | null>(null)

function getBerlinNow(tz: string) {
  try {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    })
    const parts = f.formatToParts(new Date())
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
    const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
    return { weekday, hour, minute, label: f.format(new Date()) }
  } catch {
    // Invalid timezone fallback
    return { weekday: 'Mon', hour: 0, minute: 0, label: 'Unknown' }
  }
}

function parseDayRange(daysStr: string): string[] {
  const dayMap: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
    friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
    mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
  }
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const parts = daysStr.split('-').map(s => s.trim().toLowerCase())
  if (parts.length === 2) {
    const start = dayMap[parts[0]]
    const end = dayMap[parts[1]]
    if (start && end) {
      const si = allDays.indexOf(start)
      const ei = allDays.indexOf(end)
      if (si >= 0 && ei >= 0) {
        const result: string[] = []
        for (let i = si; i <= ei; i++) result.push(allDays[i])
        return result
      }
    }
  }
  // Try comma-separated
  const result: string[] = []
  for (const p of daysStr.split(',')) {
    const d = dayMap[p.trim().toLowerCase()]
    if (d) result.push(d)
  }
  return result.length > 0 ? result : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
}

function parseHoursRange(hoursStr: string): { start: number; end: number } {
  const match = hoursStr.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
  if (match) {
    return { start: Number(match[1]) * 60 + Number(match[2]), end: Number(match[3]) * 60 + Number(match[4]) }
  }
  return { start: 540, end: 1020 } // 09:00-17:00
}

function isWithinWorkday(tz: string, policyDays?: string, policyHours?: string) {
  const { weekday, hour, minute } = getBerlinNow(tz)
  const days = parseDayRange(policyDays ?? 'Monday-Friday')
  const { start, end } = parseHoursRange(policyHours ?? '09:00-17:00')
  const t = hour * 60 + minute
  return days.includes(weekday) && t >= start && t < end
}

function getEffectivePresence(state: PresenceState, within: boolean): PresenceState {
  if (!within && state !== 'off_hours') return 'off_hours'
  return state
}

const VALID_PRESENCE: Set<string> = new Set(['off_hours', 'available', 'active', 'in_meeting', 'paused', 'blocked'])

function isValidPresence(v: unknown): v is PresenceState {
  return typeof v === 'string' && VALID_PRESENCE.has(v)
}

/** Validate that an API response looks like a valid snapshot */
function validateSnapshot(data: unknown): data is ApiSnapshot {
  if (data == null || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!Array.isArray(d.agents) || !Array.isArray(d.rooms)) return false
  // Spot-check first agent if present
  if (d.agents.length > 0) {
    const first = d.agents[0] as Record<string, unknown>
    if (typeof first.id !== 'string' || typeof first.name !== 'string') return false
    if (!isValidPresence(first.presence)) return false
  }
  // Check rooms
  const firstRoom = d.rooms[0] as Record<string, unknown> | undefined
  if (firstRoom && (typeof firstRoom.id !== 'string' || !firstRoom.zone)) return false
  // Check workdayPolicy
  if (d.workdayPolicy == null || typeof d.workdayPolicy !== 'object') return false
  const wp = d.workdayPolicy as Record<string, unknown>
  if (typeof wp.timezone !== 'string') return false
  return true
}

function buildAgents(source: AgentCard[], within: boolean): OfficeAgent[] {
  return source
    .filter(agent => !agent.external)
    .map(agent => ({
      ...agent,
      effectivePresence: getEffectivePresence(agent.presence, within),
      characterId: worldEntities[agent.id]?.characterId ?? agent.id
    }))
}

const INITIAL_ACTIVITY: ActivityItem[] = [
  { id: 'boot-1', kind: 'system', text: 'Office opened. Waiting for first agent.', createdAt: new Date().toISOString() },
]

interface ApiSnapshot {
  agents: AgentCard[]
  rooms: Room[]
  agentSeats: Record<string, { xPct: number; yPct: number }>
  workdayPolicy: WorkdayPolicy
  settings?: OfficeSettings
  activity?: ActivityItem[]
  assignments?: AssignmentRecord[]
  agentRuntimeStatuses?: AgentRuntimeStatus[]
  decisions?: DecisionRecord[]
  messages?: MessageRecord[]
  webhooks?: WebhookRecord[]
  source: string
  lastUpdatedAt: string
}

function normalizeAssignment(assignment: AssignmentRecord): AssignmentRecord {
  return {
    ...assignment,
    taskBrief: assignment.taskBrief ?? '',
    source: assignment.source ?? 'system',
    result: assignment.result,
    resultSavedAt: assignment.resultSavedAt,
    resultAction: assignment.resultAction,
  }
}

function mergeAssignments(current: AssignmentRecord[], incoming: AssignmentRecord[]): AssignmentRecord[] {
  const currentMap = new Map<string, AssignmentRecord>()
  for (const a of current.map(normalizeAssignment)) currentMap.set(a.id, a)

  const merged = new Map<string, AssignmentRecord>()
  for (const a of current.map(normalizeAssignment)) merged.set(a.id, a)
  for (const a of incoming.map(normalizeAssignment)) {
    const prev = currentMap.get(a.id)
    // Preserve local-only result fields if incoming doesn't have them
    if (prev) {
      merged.set(a.id, {
        ...a,
        result: a.result ?? prev.result,
        resultSavedAt: a.resultSavedAt ?? prev.resultSavedAt,
        resultAction: a.resultAction ?? prev.resultAction,
      })
    } else {
      merged.set(a.id, a)
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

const BASE_POLL_MS = 4000
const MAX_POLL_MS = 30000
const MAX_ASSIGNMENTS       = 25
const MAX_ACTIVITY_ITEMS    = 50

export function OfficeProvider({ children }: { children: ReactNode }) {
  const [rawAgents, setRawAgents] = useState<AgentCard[]>(seedAgents)
  const [currentRooms, setCurrentRooms] = useState<Room[]>(seedRooms)
  const [currentSeats, setCurrentSeats] = useState(seedSeats)
  const [currentPolicy, setCurrentPolicy] = useState<WorkdayPolicy>(seedPolicy)
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings>(defaultSettings)
  const [dataSource, setDataSource] = useState<'seed' | 'live'>('seed')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [berlinTimeLabel, setBerlinTimeLabel] = useState(getBerlinNow(seedPolicy.timezone).label)
  const [withinWorkday, setWithinWorkday] = useState(isWithinWorkday(seedPolicy.timezone, seedPolicy.days, seedPolicy.hours))
  const [agents, setAgents] = useState<OfficeAgent[]>(() => buildAgents(seedAgents, isWithinWorkday(seedPolicy.timezone, seedPolicy.days, seedPolicy.hours)))
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [agentRuntimeStatuses, setAgentRuntimeStatuses] = useState<AgentRuntimeStatus[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>(INITIAL_ACTIVITY)
  const [decisions, setDecisions] = useState<DecisionRecord[]>([])
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [agentBubbles, setAgentBubbles] = useState<Map<string, AgentBubble>>(new Map())
  const rawAgentsRef = useRef<AgentCard[]>(seedAgents)
  const prevSnapshotRef = useRef<{ assignments: AssignmentRecord[]; agents: AgentCard[] }>({ assignments: [], agents: [] })
  const wasLive = useRef(false)
  const consecutiveFailures = useRef(0)
  const [sseConnected, setSseConnected] = useState(false)

  // Toast helpers
  const addToast = useCallback((message: string, kind: ToastItem['kind'] = 'info') => {
    const toast: ToastItem = { id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, message, kind, createdAt: Date.now() }
    setToasts(prev => [...prev, toast].slice(-5))
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Auto-dismiss toasts after 5s
  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setToasts(prev => prev.filter(t => now - t.createdAt < 5000))
    }, 1000)
    return () => clearInterval(timer)
  }, [toasts.length])

  // Keep rawAgentsRef in sync
  useEffect(() => { rawAgentsRef.current = rawAgents }, [rawAgents])

  // Bubble helpers
  const setBubble = useCallback((agentId: string, text: string, color: string, ttlMs = 5000) => {
    setAgentBubbles(prev => {
      const next = new Map(prev)
      next.set(agentId, { text, color, expiresAt: Date.now() + ttlMs })
      return next
    })
  }, [])

  // Cleanup expired bubbles
  useEffect(() => {
    if (agentBubbles.size === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setAgentBubbles(prev => {
        let changed = false
        const next = new Map(prev)
        for (const [id, b] of next) {
          if (now >= b.expiresAt) { next.delete(id); changed = true }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [agentBubbles.size])

  // SSE handler - apply real-time updates from server
  const handleSSE = useCallback((eventType: SSEEventType, data: unknown) => {
    const d = data as Record<string, unknown>
    switch (eventType) {
      case 'settings.changed':
        if (d.settings || d.officeName !== undefined) {
          setOfficeSettings(prev => ({ ...defaultSettings, ...prev, ...(d.settings ? d.settings as unknown as OfficeSettings : d as unknown as OfficeSettings) }))
          const incoming = (d.settings ?? d) as Record<string, unknown>
          if (incoming.workdayPolicy && typeof incoming.workdayPolicy === 'object') {
            setCurrentPolicy(prev => ({ ...prev, ...(incoming.workdayPolicy as Partial<WorkdayPolicy>) }))
          }
        }
        break
      case 'task.created': {
        const agentId = String(d.agentId ?? '')
        const title = String(d.title ?? '')
        if (agentId) setBubble(agentId, `On it! Working on: ${title}`, '#95d8ff', 5000)
        break
      }
      case 'agent.output': {
        const agentId = String(d.agentId ?? '')
        const chunk = String(d.chunk ?? '').slice(0, 80)
        if (agentId && chunk) setBubble(agentId, chunk, '#78f7b5', 6000)
        break
      }
      case 'task.completed': {
        const agentId = String(d.agentId ?? '')
        const result = String(d.result ?? 'Done!').slice(0, 50)
        if (agentId) setBubble(agentId, `Done! ${result}`, '#78f7b5', 5000)
        break
      }
      case 'task.failed': {
        const agentId = String(d.agentId ?? '')
        const error = String(d.error ?? 'Unknown error').slice(0, 50)
        if (agentId) setBubble(agentId, `Blocked: ${error}`, '#ff8b8b', 5000)
        break
      }
      case 'message.sent': {
        const msg: MessageRecord = {
          id: String(d.messageId ?? `msg-sse-${Date.now()}`),
          fromAgentId: String(d.fromAgentId ?? ''),
          toAgentId: d.toAgentId ? String(d.toAgentId) : null,
          roomId: d.roomId ? String(d.roomId) : null,
          message: String(d.message ?? ''),
          createdAt: new Date().toISOString(),
        }
        if (msg.fromAgentId && msg.message) {
          setMessages(prev => {
            // Deduplicate by id
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg].slice(-100)
          })
        }
        break
      }
      case 'agent.presence_changed':
      case 'agent.created':
      case 'agent.deleted':
        break
    }
  }, [setBubble])

  const { connected: sseIsConnected } = useSSE(handleSSE, dataSource === 'live')

  // Track SSE connection state via ref so poll loop can read it without re-mounting
  const sseConnectedRef = useRef(false)
  useEffect(() => {
    sseConnectedRef.current = sseIsConnected
    setSseConnected(sseIsConnected)
  }, [sseIsConnected])

  // Poll for live state from API with exponential backoff
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const res = await fetch('/api/office/snapshot', { signal: controller.signal })
        clearTimeout(timeout)

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }

        const data: unknown = await res.json()
        if (cancelled) return

        if (!validateSnapshot(data)) {
          throw new Error('Invalid snapshot shape from API')
        }

        consecutiveFailures.current = 0
        setConnectionError(null)
        setRawAgents(data.agents)
        setCurrentRooms(data.rooms)
        setCurrentSeats(data.agentSeats)
        setCurrentPolicy(data.workdayPolicy)
        if (data.settings) {
          setOfficeSettings(prev => ({ ...defaultSettings, ...prev, ...data.settings }))
        }
        if (data.activity && data.activity.length > 0) {
          setActivity(data.activity)
        }
        if (data.assignments) {
          setAssignments(current => mergeAssignments(current, data.assignments ?? []))
        }
        if (data.agentRuntimeStatuses) {
          setAgentRuntimeStatuses(data.agentRuntimeStatuses)
        }
        if (data.decisions) {
          setDecisions(data.decisions)
        }
        if (data.messages) {
          setMessages(data.messages)
        }
        if (data.webhooks) {
          setWebhooks(data.webhooks)
        }

        // Notification diffing - detect important changes
        if (wasLive.current && data.assignments) {
          const prevAssignments = prevSnapshotRef.current.assignments
          for (const a of data.assignments) {
            const prev = prevAssignments.find(p => p.id === a.id)
            if (prev && prev.status !== a.status) {
              if (a.status === 'done') {
                addToast(`Task "${a.taskTitle}" completed`, 'success')
                // Auto-save result when task completes
                if (a.result && !prev.result) {
                  fetch(`/api/office/result/${a.id}/save`, { method: 'POST' }).catch(() => {})
                }
              }
              if (a.status === 'blocked') addToast(`Task "${a.taskTitle}" blocked`, 'warning')
              if (a.status === 'cancelled') addToast(`Task "${a.taskTitle}" cancelled`, 'info')
            }
          }
          for (const agent of data.agents) {
            const prev = prevSnapshotRef.current.agents.find(p => p.id === agent.id)
            if (prev && prev.presence !== agent.presence && agent.presence === 'blocked') {
              addToast(`${agent.name} is now blocked`, 'warning')
            }
          }
        }
        prevSnapshotRef.current = { assignments: data.assignments ?? [], agents: data.agents }

        if (!wasLive.current) {
          wasLive.current = true
          setDataSource('live')
        }
      } catch (err) {
        if (cancelled) return
        consecutiveFailures.current++
        // Only show error after being live then losing connection, or after many failures
        if (wasLive.current) {
          setConnectionError('Connection lost - using last known state')
          setDataSource('seed')
          wasLive.current = false
        } else if (consecutiveFailures.current > 3) {
          setConnectionError('Backend unavailable - running on seed data')
        }
      }

      if (!cancelled) {
        // When SSE is connected, use long poll interval (backup only); otherwise use exponential backoff
        const delay = sseConnectedRef.current
          ? MAX_POLL_MS
          : Math.min(BASE_POLL_MS * Math.pow(2, Math.min(consecutiveFailures.current, 3)), MAX_POLL_MS)
        timer = setTimeout(poll, delay)
      }
    }

    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  // Tick clock and rebuild agents on time change or data change
  useEffect(() => {
    const tick = () => {
      const tz = currentPolicy.timezone
      const nextWithin = isWithinWorkday(tz, currentPolicy.days, currentPolicy.hours)
      setBerlinTimeLabel(getBerlinNow(tz).label)
      setWithinWorkday(nextWithin)
      setAgents(buildAgents(rawAgents, nextWithin))
    }
    tick()
    const timer = setInterval(tick, 750)
    return () => clearInterval(timer)
  }, [rawAgents, currentPolicy.timezone, currentPolicy.days, currentPolicy.hours])

  // ── Helpers: push activity + patch agent ──

  function addActivity(entry: { kind: ActivityItem['kind']; text: string; agentId?: string }) {
    const item: ActivityItem = {
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: entry.kind,
      text: entry.text,
      agentId: entry.agentId,
      createdAt: new Date().toISOString(),
    }
    setActivity(current => [item, ...current].slice(0, MAX_ACTIVITY_ITEMS))
    fetch('/api/office/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).catch(err => { if (import.meta.env.DEV) console.warn('[office]', err) })
  }

  function patchAgent(agentId: string, patch: { presence?: PresenceState; focus?: string }) {
    setRawAgents(current =>
      current.map(a => a.id === agentId ? { ...a, ...patch } : a)
    )
    fetch(`/api/office/agent/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(err => { if (import.meta.env.DEV) console.warn('[office]', err) })
  }

  function patchAssignmentOnServer(assignmentId: string, status: string) {
    fetch('/api/office/assignment/' + assignmentId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(err => { if (import.meta.env.DEV) console.warn('[office]', err) })
  }

  const assignTask: OfficeState['assignTask'] = useCallback((input) => {
    // Validate input
    const title = input.taskTitle?.trim()
    if (!title) return
    if (!input.targetAgentId) return

    const now = new Date().toISOString()
    const agent = rawAgents.find(a => a.id === input.targetAgentId)

    // Optimistic local update
    const assignment: AssignmentRecord = {
      id: `assignment-${Date.now()}`,
      targetAgentId: input.targetAgentId,
      taskTitle: title,
      taskBrief: input.taskBrief?.trim() ?? '',
      priority: input.priority,
      status: 'queued',
      routingTarget: input.routingTarget,
      createdAt: now,
      source: 'office_ui'
    }
    setAssignments(current => [assignment, ...current].slice(0, MAX_ASSIGNMENTS))

    addActivity({
      kind: 'assignment',
      text: `Assigned "${title}" to ${agent?.name ?? input.targetAgentId}`,
      agentId: input.targetAgentId,
    })
    setBubble(input.targetAgentId, `On it! Working on: ${title}`, '#95d8ff', 5000)

    // POST to server - log failure to activity feed
    fetch('/api/office/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetAgentId: input.targetAgentId,
        taskTitle: title,
        taskBrief: input.taskBrief?.trim() ?? '',
        priority: input.priority,
        routingTarget: input.routingTarget,
      })
    }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }).catch(() => {
      addActivity({
        kind: 'system',
        text: `Failed to persist assignment "${title}" - saved locally only`,
      })
    })
  }, [rawAgents, setBubble])

  const completeTask: OfficeState['completeTask'] = useCallback(async (assignmentId, result) => {
    // Optimistic update
    setAssignments(current =>
      current.map(a => a.id === assignmentId
        ? { ...a, status: 'done' as const, result, resultAction: 'visible' as const }
        : a)
    )
    const assignment = assignments.find(a => a.id === assignmentId)
    if (assignment) {
      const name = rawAgents.find(ag => ag.id === assignment.targetAgentId)?.name ?? assignment.targetAgentId
      addActivity({ kind: 'assignment', text: `Task "${assignment.taskTitle}" completed with result`, agentId: assignment.targetAgentId })
      patchAgent(assignment.targetAgentId, { presence: 'available', focus: `Completed: ${assignment.taskTitle}` })
    }
    try {
      const res = await fetch(`/api/office/assignment/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done', result }),
      })
      if (!res.ok) {
        addActivity({ kind: 'system', text: 'Failed to persist task completion - saved locally only' })
        return false
      }
      return true
    } catch {
      addActivity({ kind: 'system', text: 'Failed to persist task completion - network error' })
      return false
    }
  }, [assignments, rawAgents])

  const cancelTask: OfficeState['cancelTask'] = useCallback(async (agentId) => {
    try {
      const res = await fetch(`/api/office/agent/${agentId}/cancel`, { method: 'POST' })
      if (!res.ok) {
        addActivity({ kind: 'system', text: `Failed to cancel task for ${agentId}` })
        return false
      }
      // Optimistic: update agent presence and assignment status locally
      setRawAgents(current =>
        current.map(a => a.id === agentId ? { ...a, presence: 'available' as const, focus: 'Task cancelled' } : a)
      )
      setAssignments(current =>
        current.map(a => a.targetAgentId === agentId && a.status === 'active'
          ? { ...a, status: 'cancelled' as const }
          : a)
      )
      const agent = rawAgents.find(a => a.id === agentId)
      addActivity({ kind: 'system', text: `Task cancelled for ${agent?.name ?? agentId}`, agentId })
      setBubble(agentId, 'Task cancelled', '#ff8b8b', 4000)
      return true
    } catch {
      addActivity({ kind: 'system', text: 'Failed to cancel task - network error' })
      return false
    }
  }, [rawAgents, setBubble])

  const saveResult: OfficeState['saveResult'] = useCallback(async (assignmentId) => {
    try {
      const res = await fetch(`/api/office/result/${assignmentId}/save`, { method: 'POST' })
      if (!res.ok) {
        addActivity({ kind: 'system', text: 'Failed to save result locally' })
        return false
      }
      setAssignments(current =>
        current.map(a => a.id === assignmentId
          ? { ...a, resultAction: 'saved' as const, resultSavedAt: new Date().toISOString() }
          : a)
      )
      addActivity({ kind: 'system', text: 'Result saved to local file' })
      return true
    } catch {
      addActivity({ kind: 'system', text: 'Failed to save result - network error' })
      return false
    }
  }, [])

  const dismissResult: OfficeState['dismissResult'] = useCallback((assignmentId) => {
    setAssignments(current =>
      current.map(a => a.id === assignmentId
        ? { ...a, resultAction: 'dismissed' as const }
        : a)
    )
  }, [])

  const createAgent = useCallback(async (input: AgentCreateInput): Promise<boolean> => {
    // Optimistic local update
    const newAgent: AgentCard = {
      id: input.id, name: input.name, role: input.role, team: input.team,
      roomId: input.roomId, presence: input.presence ?? 'available',
      focus: input.focus ?? '', criticalTask: input.criticalTask ?? false,
      collaborationMode: input.collaborationMode ?? ''
    }
    setRawAgents(current => [...current, newAgent])
    setCurrentSeats(current => ({ ...current, [input.id]: { xPct: 50, yPct: 50 } }))
    addActivity({ kind: 'system', text: `Agent ${input.name} created` })
    try {
      const res = await fetch('/api/office/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        // Revert
        setRawAgents(current => current.filter(a => a.id !== input.id))
        setCurrentSeats(current => { const next = { ...current }; delete next[input.id]; return next })
        addActivity({ kind: 'system', text: `Failed to create agent: ${err.error}` })
        return false
      }
      return true
    } catch {
      setRawAgents(current => current.filter(a => a.id !== input.id))
      setCurrentSeats(current => { const next = { ...current }; delete next[input.id]; return next })
      addActivity({ kind: 'system', text: 'Failed to create agent - network error' })
      return false
    }
  }, [])

  const updateAgent = useCallback(async (id: string, input: AgentUpdateInput): Promise<boolean> => {
    // Save old state for revert
    const oldAgent = rawAgents.find(a => a.id === id)
    if (!oldAgent) return false
    // Optimistic update
    setRawAgents(current =>
      current.map(a => a.id === id ? { ...a, ...input } as AgentCard : a)
    )
    addActivity({ kind: 'system', text: `Agent ${oldAgent.name} updated`, agentId: id })
    try {
      const res = await fetch(`/api/office/agent/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!res.ok) {
        setRawAgents(current => current.map(a => a.id === id ? oldAgent : a))
        addActivity({ kind: 'system', text: 'Failed to update agent - server error' })
        return false
      }
      return true
    } catch {
      setRawAgents(current => current.map(a => a.id === id ? oldAgent : a))
      addActivity({ kind: 'system', text: 'Failed to update agent - network error' })
      return false
    }
  }, [rawAgents])

  const deleteAgent = useCallback(async (id: string): Promise<boolean> => {
    const oldAgents = rawAgents
    const oldSeats = currentSeats
    const oldAssignments = assignments
    const agent = rawAgents.find(a => a.id === id)
    // Optimistic removal
    setRawAgents(current => current.filter(a => a.id !== id))
    setCurrentSeats(current => { const next = { ...current }; delete next[id]; return next })
    setAssignments(current => current.filter(a => a.targetAgentId !== id))
    setSelectedAgentId(current => current === id ? null : current)
    addActivity({ kind: 'system', text: `Agent ${agent?.name ?? id} deleted` })
    try {
      const res = await fetch(`/api/office/agent/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setRawAgents(oldAgents)
        setCurrentSeats(oldSeats)
        setAssignments(oldAssignments)
        addActivity({ kind: 'system', text: 'Failed to delete agent - server error' })
        return false
      }
      return true
    } catch {
      setRawAgents(oldAgents)
      setCurrentSeats(oldSeats)
      setAssignments(oldAssignments)
      addActivity({ kind: 'system', text: 'Failed to delete agent - network error' })
      return false
    }
  }, [rawAgents, currentSeats, assignments])

  const updateSettings = useCallback(async (patch: Partial<OfficeSettings> & { workdayPolicy?: Partial<WorkdayPolicy> }): Promise<boolean> => {
    const oldSettings = officeSettings
    const oldPolicy = currentPolicy
    // Optimistic update
    if (patch.officeName !== undefined || patch.theme) {
      setOfficeSettings(prev => ({
        ...prev,
        ...(patch.officeName !== undefined ? { officeName: patch.officeName } : {}),
        ...(patch.theme ? { theme: { ...prev.theme, ...patch.theme } } : {})
      }))
    }
    if (patch.workdayPolicy) {
      setCurrentPolicy(prev => ({ ...prev, ...patch.workdayPolicy }))
    }
    try {
      const res = await fetch('/api/office/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      })
      if (!res.ok) {
        setOfficeSettings(oldSettings)
        setCurrentPolicy(oldPolicy)
        addActivity({ kind: 'system', text: 'Failed to update settings - server error' })
        return false
      }
      addActivity({ kind: 'system', text: 'Office settings updated' })
      return true
    } catch {
      setOfficeSettings(oldSettings)
      setCurrentPolicy(oldPolicy)
      addActivity({ kind: 'system', text: 'Failed to update settings - network error' })
      return false
    }
  }, [officeSettings, currentPolicy])

  const updateRoom = useCallback(async (id: string, input: RoomUpdateInput): Promise<boolean> => {
    const oldRooms = currentRooms
    // Optimistic update
    setCurrentRooms(prev =>
      prev.map(r => r.id === id ? { ...r, ...input } : r)
    )
    try {
      const res = await fetch(`/api/office/room/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!res.ok) {
        setCurrentRooms(oldRooms)
        addActivity({ kind: 'system', text: 'Failed to update room - server error' })
        return false
      }
      addActivity({ kind: 'system', text: `Room updated` })
      return true
    } catch {
      setCurrentRooms(oldRooms)
      addActivity({ kind: 'system', text: 'Failed to update room - network error' })
      return false
    }
  }, [currentRooms])

  // ── Decisions CRUD ──
  const createDecision = useCallback(async (input: { title: string; detail: string; proposedBy?: string }): Promise<boolean> => {
    const optimistic: DecisionRecord = {
      id: `decision-${Date.now()}`, title: input.title, detail: input.detail,
      status: 'proposed', proposedBy: input.proposedBy ?? null, createdAt: new Date().toISOString()
    }
    setDecisions(prev => [optimistic, ...prev])
    addActivity({ kind: 'decision', text: `Decision proposed: "${input.title}"` })
    addToast(`Decision proposed: "${input.title}"`, 'info')
    try {
      const res = await fetch('/api/office/decision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!res.ok) { setDecisions(prev => prev.filter(d => d.id !== optimistic.id)); return false }
      return true
    } catch { setDecisions(prev => prev.filter(d => d.id !== optimistic.id)); return false }
  }, [addToast])

  const updateDecision = useCallback(async (id: string, input: { status?: string; title?: string; detail?: string }): Promise<boolean> => {
    const old = decisions.find(d => d.id === id)
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, ...input } as DecisionRecord : d))
    if (input.status) {
      addActivity({ kind: 'decision', text: `Decision "${old?.title ?? id}" ${input.status}` })
      addToast(`Decision ${input.status}: "${old?.title ?? id}"`, input.status === 'accepted' ? 'success' : 'info')
    }
    try {
      const res = await fetch(`/api/office/decision/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!res.ok) { if (old) setDecisions(prev => prev.map(d => d.id === id ? old : d)); return false }
      return true
    } catch { if (old) setDecisions(prev => prev.map(d => d.id === id ? old : d)); return false }
  }, [decisions, addToast])

  // ── Messages ──
  const sendMessage = useCallback(async (input: { fromAgentId: string; toAgentId?: string; roomId?: string; message: string }): Promise<boolean> => {
    // No optimistic insert - SSE message.sent event adds it instantly
    try {
      const res = await fetch('/api/office/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      return res.ok
    } catch { return false }
  }, [])

  // ── Room CRUD ──
  const createRoom = useCallback(async (input: { id: string; name: string; team: string; purpose: string; zone: { x: number; y: number; w: number; h: number } }): Promise<boolean> => {
    const newRoom: Room = { ...input, agents: [] }
    setCurrentRooms(prev => [...prev, newRoom])
    addActivity({ kind: 'system', text: `Room "${input.name}" created` })
    try {
      const res = await fetch('/api/office/room', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!res.ok) { setCurrentRooms(prev => prev.filter(r => r.id !== input.id)); return false }
      return true
    } catch { setCurrentRooms(prev => prev.filter(r => r.id !== input.id)); return false }
  }, [])

  const deleteRoom = useCallback(async (id: string): Promise<boolean> => {
    const oldRooms = currentRooms
    setCurrentRooms(prev => prev.filter(r => r.id !== id))
    // Move agents in deleted room to commons
    setRawAgents(prev => prev.map(a => a.roomId === id ? { ...a, roomId: 'commons' } : a))
    addActivity({ kind: 'system', text: `Room deleted` })
    try {
      const res = await fetch(`/api/office/room/${id}`, { method: 'DELETE' })
      if (!res.ok) { setCurrentRooms(oldRooms); return false }
      return true
    } catch { setCurrentRooms(oldRooms); return false }
  }, [currentRooms])

  // ── Webhooks ──
  const createWebhook = useCallback(async (input: { url: string; secret?: string; events: string[] }): Promise<boolean> => {
    try {
      const res = await fetch('/api/office/webhook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!res.ok) return false
      const data = await res.json()
      setWebhooks(prev => [...prev, data.webhook])
      return true
    } catch { return false }
  }, [])

  const deleteWebhook = useCallback(async (id: string): Promise<boolean> => {
    const old = webhooks
    setWebhooks(prev => prev.filter(w => w.id !== id))
    try {
      const res = await fetch(`/api/office/webhook/${id}`, { method: 'DELETE' })
      if (!res.ok) { setWebhooks(old); return false }
      return true
    } catch { setWebhooks(old); return false }
  }, [webhooks])

  // ── Drag-and-drop position update ──
  const updateAgentPosition = useCallback((agentId: string, xPct: number, yPct: number, roomId?: string) => {
    setCurrentSeats(prev => ({ ...prev, [agentId]: { xPct, yPct } }))
    if (roomId) {
      setRawAgents(prev => prev.map(a => a.id === agentId ? { ...a, roomId } : a))
    }
    const patch: Record<string, unknown> = { xPct, yPct }
    if (roomId) patch.roomId = roomId
    fetch(`/api/office/agent/${agentId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch(() => {})
  }, [])

  const value = useMemo<OfficeState>(() => ({
    agents,
    rooms: currentRooms,
    agentSeats: currentSeats,
    workdayPolicy: currentPolicy,
    officeSettings,
    assignments,
    activity,
    agentRuntimeStatuses,
    decisions,
    messages,
    webhooks,
    toasts,
    agentBubbles,
    selectedAgentId,
    berlinTimeLabel,
    withinWorkday,
    dataSource,
    connectionError,
    selectAgent: setSelectedAgentId,
    assignTask,
    completeTask,
    cancelTask,
    saveResult,
    dismissResult,
    createAgent,
    updateAgent,
    deleteAgent,
    updateSettings,
    updateRoom,
    createDecision,
    updateDecision,
    sendMessage,
    createRoom,
    deleteRoom,
    createWebhook,
    deleteWebhook,
    dismissToast,
    updateAgentPosition,
  }), [agents, currentRooms, currentSeats, currentPolicy, officeSettings, assignments, activity, agentRuntimeStatuses, decisions, messages, webhooks, toasts, agentBubbles, selectedAgentId, berlinTimeLabel, withinWorkday, dataSource, connectionError, assignTask, completeTask, cancelTask, saveResult, dismissResult, createAgent, updateAgent, deleteAgent, updateSettings, updateRoom, createDecision, updateDecision, sendMessage, createRoom, deleteRoom, createWebhook, deleteWebhook, dismissToast, updateAgentPosition])

  return <OfficeContext.Provider value={value}>{children}</OfficeContext.Provider>
}

export function useOffice() {
  const ctx = useContext(OfficeContext)
  if (!ctx) throw new Error('useOffice must be used within OfficeProvider')
  return ctx
}

export { characterSprites, worldEntities }

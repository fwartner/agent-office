/**
 * SSE (Server-Sent Events) manager for real-time updates.
 */
import { onAll, type OfficeEvent } from './events.js'

interface SSEClient {
  id: string
  write: (data: string) => boolean
  close: () => void
}

const clients: Map<string, SSEClient> = new Map()
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export function addClient(client: SSEClient): void {
  clients.set(client.id, client)
}

export function removeClient(id: string): void {
  clients.delete(id)
}

function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const [id, client] of clients) {
    try {
      if (!client.write(payload)) {
        clients.delete(id)
      }
    } catch {
      clients.delete(id)
    }
  }
}

/** Broadcast an agent stdout output chunk */
export function broadcastAgentOutput(agentId: string, assignmentId: string, chunk: string): void {
  broadcast('agent.output', { agentId, assignmentId, chunk })
}

/** Broadcast a settings change */
export function broadcastSettingsChanged(settings: unknown): void {
  broadcast('settings.changed', settings)
}

/** Initialize SSE: subscribe to event bus and start heartbeat */
export function initSSE(): void {
  // Forward all office events to SSE clients
  onAll((event: OfficeEvent) => {
    broadcast(event.type, event)
  })

  // 15s heartbeat
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = setInterval(() => {
    const ping = `: heartbeat ${Date.now()}\n\n`
    for (const [id, client] of clients) {
      try {
        if (!client.write(ping)) clients.delete(id)
      } catch {
        clients.delete(id)
      }
    }
  }, 15_000)
}

export function shutdownSSE(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  for (const client of clients.values()) {
    try { client.close() } catch { /* ignore */ }
  }
  clients.clear()
}

export function getClientCount(): number {
  return clients.size
}

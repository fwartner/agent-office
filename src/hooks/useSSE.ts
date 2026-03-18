import { useEffect, useRef, useState } from 'react'

export type SSEEventType =
  | 'agent.output'
  | 'agent.created'
  | 'agent.deleted'
  | 'agent.presence_changed'
  | 'task.created'
  | 'task.completed'
  | 'task.failed'
  | 'decision.created'
  | 'decision.updated'
  | 'message.sent'
  | 'settings.changed'

export interface SSEHandler {
  (event: SSEEventType, data: unknown): void
}

export function useSSE(handler: SSEHandler, enabled = true): { connected: boolean } {
  const handlerRef = useRef(handler)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!enabled) return
    if (typeof EventSource === 'undefined') return

    const eventSource = new EventSource('/api/sse')

    eventSource.onopen = () => {
      setConnected(true)
    }

    const eventTypes: SSEEventType[] = [
      'agent.output', 'agent.created', 'agent.deleted', 'agent.presence_changed',
      'task.created', 'task.completed', 'task.failed',
      'decision.created', 'decision.updated', 'message.sent', 'settings.changed',
    ]

    for (const type of eventTypes) {
      eventSource.addEventListener(type, (e: MessageEvent) => {
        try {
          const data: unknown = JSON.parse(e.data)
          handlerRef.current(type, data)
        } catch { /* malformed data */ }
      })
    }

    eventSource.onerror = () => {
      setConnected(false)
    }

    return () => {
      eventSource.close()
      setConnected(false)
    }
  }, [enabled])

  return { connected }
}

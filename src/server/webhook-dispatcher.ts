/**
 * Webhook dispatcher - delivers events to configured webhook URLs.
 * Supports HMAC-SHA256 signatures, retry on failure, and log recording.
 */
import crypto from 'node:crypto'
import { onAll, type OfficeEvent } from './events.js'
import type { ApiContext } from './api-routes.js'

let _ctx: ApiContext | null = null

export function initWebhookDispatcher(ctx: ApiContext): void {
  _ctx = ctx
  onAll(handleEvent)
}

async function handleEvent(event: OfficeEvent): Promise<void> {
  if (!_ctx) return
  try {
    const snapshot = await _ctx.getSnapshot()
    const webhooks = (snapshot.webhooks || []) as Array<{ id: string; url: string; secret: string; events: string[]; enabled: boolean }>
    for (const wh of webhooks) {
      if (!wh.enabled) continue
      if (wh.events.length > 0 && !wh.events.includes(event.type)) continue
      deliverWebhook(wh, event)
    }
  } catch { /* no webhooks configured */ }
}

async function deliverWebhook(
  wh: { id: string; url: string; secret: string; events: string[] },
  event: OfficeEvent,
): Promise<void> {
  const body = JSON.stringify({ event: event.type, payload: event, timestamp: new Date().toISOString() })
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (wh.secret) {
    headers['X-Webhook-Signature'] = crypto.createHmac('sha256', wh.secret).update(body).digest('hex')
  }

  const attempt = async (): Promise<number> => {
    try {
      const res = await fetch(wh.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) })
      return res.status
    } catch {
      return 0
    }
  }

  // Exponential backoff: 4 attempts at 0s, 2s, 8s, 32s
  const delays = [0, 2000, 8000, 32000]
  let statusCode = 0
  for (let i = 0; i < delays.length; i++) {
    if (i > 0) {
      console.log(`[webhook] Retry ${i}/${delays.length - 1} for ${wh.url} (waiting ${delays[i] / 1000}s)`)
      await new Promise(r => setTimeout(r, delays[i]))
    }
    statusCode = await attempt()
    if (statusCode >= 200 && statusCode < 300) break
    if (statusCode >= 400 && statusCode < 500) break // Don't retry client errors
  }

  // Log delivery
  if (_ctx) {
    try {
      await _ctx.logWebhookDelivery(wh.id, event.type, statusCode)
    } catch { /* best effort */ }
  }
}

/**
 * Discord integration - outbound only via Webhook.
 * Same event pattern as Slack but uses Discord's webhook format.
 *
 * Env: DISCORD_WEBHOOK_URL
 */
import { on, type OfficeEvent } from '../events.js'
import type { ApiContext } from '../api-routes.js'

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL
const MAX_RETRIES = 3

async function post(content: string, embeds?: unknown[]): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) return
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, embeds }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok || res.status === 204) return
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return
      // Rate limited - wait and retry
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') || 1) * 1000
        await new Promise(r => setTimeout(r, retryAfter))
        continue
      }
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        console.error(`[discord] webhook delivery failed after ${MAX_RETRIES} attempts:`, err)
      }
    }
    if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
  }
}

function embed(title: string, description: string, color: number): Record<string, unknown> {
  return { title, description, color, timestamp: new Date().toISOString() }
}

export function init(_ctx: ApiContext): void {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('[discord] DISCORD_WEBHOOK_URL not set — integration disabled')
    return
  }
  console.log('[discord] integration enabled')

  on('agent.created', (e) => {
    const ev = e as OfficeEvent & { type: 'agent.created' }
    post('', [embed('Agent Created', `**${ev.name}** (\`${ev.agentId}\`) joined the office.`, 0x78f7b5)])
  })

  on('agent.deleted', (e) => {
    const ev = e as OfficeEvent & { type: 'agent.deleted' }
    post('', [embed('Agent Removed', `\`${ev.agentId}\` was removed.`, 0xff8b8b)])
  })

  on('task.completed', (e) => {
    const ev = e as OfficeEvent & { type: 'task.completed' }
    post('', [embed('Task Completed', `**${ev.title}**\nAgent: \`${ev.agentId}\`\nResult: ${ev.result.slice(0, 500)}`, 0x78f7b5)])
  })

  on('task.failed', (e) => {
    const ev = e as OfficeEvent & { type: 'task.failed' }
    post('', [embed('Task Failed', `**${ev.title}**\nAgent: \`${ev.agentId}\`\nError: ${ev.error.slice(0, 500)}`, 0xff8b8b)])
  })

  on('decision.created', (e) => {
    const ev = e as OfficeEvent & { type: 'decision.created' }
    post('', [embed('New Decision', `**${ev.title}**`, 0xc39bff)])
  })

  on('message.sent', (e) => {
    const ev = e as OfficeEvent & { type: 'message.sent' }
    post('', [embed('Message', `From \`${ev.fromAgentId}\`: ${(ev.message || '').slice(0, 500)}`, 0x95d8ff)])
  })
}

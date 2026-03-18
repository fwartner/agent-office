/**
 * Slack integration - outbound only via Incoming Webhook.
 * Sends Block Kit messages for key office events.
 *
 * Env: SLACK_WEBHOOK_URL
 */
import { on, type OfficeEvent } from '../events.js'
import type { ApiContext } from '../api-routes.js'

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const MAX_RETRIES = 3

async function post(blocks: unknown[], text: string): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, blocks }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) return
      if (res.status >= 400 && res.status < 500) return // Don't retry client errors
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        console.error(`[slack] webhook delivery failed after ${MAX_RETRIES} attempts:`, err)
      }
    }
    if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
  }
}

function headerBlock(text: string): Record<string, unknown> {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } }
}

function sectionBlock(markdown: string): Record<string, unknown> {
  return { type: 'section', text: { type: 'mrkdwn', text: markdown } }
}

export function init(_ctx: ApiContext): void {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[slack] SLACK_WEBHOOK_URL not set — integration disabled')
    return
  }
  console.log('[slack] integration enabled')

  on('agent.created', (e) => {
    const ev = e as OfficeEvent & { type: 'agent.created' }
    post(
      [headerBlock('Agent Created'), sectionBlock(`New agent \`${ev.agentId}\` (*${ev.name}*) joined the office.`)],
      `Agent created: ${ev.name}`,
    )
  })

  on('agent.deleted', (e) => {
    const ev = e as OfficeEvent & { type: 'agent.deleted' }
    post(
      [headerBlock('Agent Removed'), sectionBlock(`Agent \`${ev.agentId}\` was removed from the office.`)],
      `Agent deleted: ${ev.agentId}`,
    )
  })

  on('agent.presence_changed', (e) => {
    const ev = e as OfficeEvent & { type: 'agent.presence_changed' }
    if (ev.to !== 'blocked') return
    post(
      [headerBlock('Agent Blocked'), sectionBlock(`Agent \`${ev.agentId}\` changed from *${ev.from}* to *blocked*.`)],
      `Agent ${ev.agentId} is now blocked`,
    )
  })

  on('task.completed', (e) => {
    const ev = e as OfficeEvent & { type: 'task.completed' }
    post(
      [headerBlock('Task Completed'), sectionBlock(`*${ev.title}*\nAgent: \`${ev.agentId}\`\nResult: ${ev.result.slice(0, 500)}`)],
      `Task completed: ${ev.title}`,
    )
  })

  on('task.failed', (e) => {
    const ev = e as OfficeEvent & { type: 'task.failed' }
    post(
      [headerBlock('Task Failed'), sectionBlock(`*${ev.title}*\nAgent: \`${ev.agentId}\`\nError: ${ev.error.slice(0, 500)}`)],
      `Task failed: ${ev.title}`,
    )
  })

  on('decision.created', (e) => {
    const ev = e as OfficeEvent & { type: 'decision.created' }
    post(
      [headerBlock('New Decision'), sectionBlock(`*${ev.title}*\nID: \`${ev.decisionId}\``)],
      `Decision created: ${ev.title}`,
    )
  })

  on('message.sent', (e) => {
    const ev = e as OfficeEvent & { type: 'message.sent' }
    post(
      [headerBlock('Message'), sectionBlock(`From \`${ev.fromAgentId}\`: ${(ev.message || '').slice(0, 500)}`)],
      `Message from ${ev.fromAgentId}`,
    )
  })
}

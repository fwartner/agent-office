/**
 * Notion integration - sync task results to a Notion database.
 *
 * Env: NOTION_API_KEY, NOTION_DATABASE_ID
 */
import { on, type OfficeEvent } from '../events.js'
import type { ApiContext } from '../api-routes.js'

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID

const NOTION_API = 'https://api.notion.com/v1'

async function notionFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${NOTION_API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      ...(opts.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(15000),
  })
}

async function createPage(event: OfficeEvent & { type: 'task.completed' }): Promise<void> {
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) return
  try {
    await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          Name: { title: [{ text: { content: event.title } }] },
          Agent: { rich_text: [{ text: { content: event.agentId } }] },
          Status: { select: { name: 'Completed' } },
          'Assignment ID': { rich_text: [{ text: { content: event.assignmentId } }] },
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: event.result.slice(0, 2000) } }],
            },
          },
        ],
      }),
    })
    console.log(`[notion] Created page for task "${event.title}"`)
  } catch (err) {
    console.error('[notion] create page failed:', err)
  }
}

async function createFailedPage(event: OfficeEvent & { type: 'task.failed' }): Promise<void> {
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) return
  try {
    await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          Name: { title: [{ text: { content: event.title } }] },
          Agent: { rich_text: [{ text: { content: event.agentId } }] },
          Status: { select: { name: 'Failed' } },
          'Assignment ID': { rich_text: [{ text: { content: event.assignmentId } }] },
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: `Error: ${event.error.slice(0, 2000)}` } }],
            },
          },
        ],
      }),
    })
  } catch (err) {
    console.error('[notion] create failed page failed:', err)
  }
}

export function init(_ctx: ApiContext): void {
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    console.log('[notion] NOTION_API_KEY / NOTION_DATABASE_ID not set — integration disabled')
    return
  }
  console.log('[notion] integration enabled')

  on('task.completed', (e) => createPage(e as OfficeEvent & { type: 'task.completed' }))
  on('task.failed', (e) => createFailedPage(e as OfficeEvent & { type: 'task.failed' }))
}

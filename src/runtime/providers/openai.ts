/**
 * OpenAI runtime provider - uses OpenAI chat completions API via fetch.
 */
import type { RuntimeProvider, RuntimeConfig, Assignment, RuntimeCallbacks } from '../types.js'

const MAX_RESULT_LEN = 2000
const activeTasks = new Map<string, { assignmentId: string; controller: AbortController }>()

export const openaiProvider: RuntimeProvider = {
  name: 'openai',

  dispatch(agentId, agentName, agentRole, systemPrompt, assignment, config, callbacks) {
    if (activeTasks.has(agentId)) return false

    const controller = new AbortController()
    activeTasks.set(agentId, { assignmentId: assignment.id, controller })

    Promise.resolve(callbacks.onStart(assignment.id)).catch(() => {})

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY
    if (!apiKey) {
      activeTasks.delete(agentId)
      Promise.resolve(callbacks.onError(assignment.id, 'No OpenAI API key configured')).catch(() => {})
      return true
    }

    const model = config.model || 'gpt-4o'
    const sysMessage = systemPrompt || `You are ${agentName}, a ${agentRole}.`
    const userMessage = `Task: ${assignment.taskTitle}\n\n${assignment.taskBrief || ''}\n\nProvide your response directly.`

    const timeoutMs = (config.timeoutSec || 300) * 1000

    runCompletion(agentId, assignment, apiKey, model, sysMessage, userMessage, timeoutMs, controller.signal, callbacks)
      .catch(err => {
        activeTasks.delete(agentId)
        Promise.resolve(callbacks.onError(assignment.id, err.message)).catch(() => {})
      })

    return true
  },

  cancel(agentId) {
    const task = activeTasks.get(agentId)
    if (!task) return null
    task.controller.abort()
    activeTasks.delete(agentId)
    return task.assignmentId
  },

  isAvailable() {
    return !!(process.env.OPENAI_API_KEY)
  },
}

async function runCompletion(
  agentId: string,
  assignment: Assignment,
  apiKey: string,
  model: string,
  systemMessage: string,
  userMessage: string,
  timeoutMs: number,
  signal: AbortSignal,
  callbacks: RuntimeCallbacks,
) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
    }),
    signal: timeoutMs ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : signal,
  })

  activeTasks.delete(agentId)

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error')
    throw new Error(`OpenAI API error ${res.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  let result = data.choices?.[0]?.message?.content || ''
  if (result.length > MAX_RESULT_LEN) {
    result = result.slice(0, MAX_RESULT_LEN - 3) + '...'
  }

  console.log(`[openai] Task "${assignment.taskTitle}" completed by ${agentId}`)
  await callbacks.onComplete(assignment.id, result)
}

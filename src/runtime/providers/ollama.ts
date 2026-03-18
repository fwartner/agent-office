/**
 * Ollama runtime provider - uses local Ollama HTTP API.
 */
import type { RuntimeProvider, RuntimeConfig, Assignment, RuntimeCallbacks } from '../types.js'

const MAX_RESULT_LEN = 2000
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const activeTasks = new Map<string, { assignmentId: string; controller: AbortController }>()

export const ollamaProvider: RuntimeProvider = {
  name: 'ollama',

  dispatch(agentId, agentName, agentRole, systemPrompt, assignment, config, callbacks) {
    if (activeTasks.has(agentId)) return false

    const controller = new AbortController()
    activeTasks.set(agentId, { assignmentId: assignment.id, controller })

    Promise.resolve(callbacks.onStart(assignment.id)).catch(() => {})

    const model = config.model || 'llama3.1'
    const sysMessage = systemPrompt || `You are ${agentName}, a ${agentRole}.`
    const userMessage = `Task: ${assignment.taskTitle}\n\n${assignment.taskBrief || ''}\n\nProvide your response directly.`
    const timeoutMs = (config.timeoutSec || 300) * 1000

    runOllamaChat(agentId, assignment, model, sysMessage, userMessage, timeoutMs, controller.signal, callbacks)
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
    return true // Ollama is local, assume available
  },
}

async function runOllamaChat(
  agentId: string,
  assignment: Assignment,
  model: string,
  systemMessage: string,
  userMessage: string,
  timeoutMs: number,
  signal: AbortSignal,
  callbacks: RuntimeCallbacks,
) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      stream: false,
    }),
    signal: timeoutMs ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : signal,
  })

  activeTasks.delete(agentId)

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error')
    throw new Error(`Ollama API error ${res.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await res.json() as { message?: { content?: string } }
  let result = data.message?.content || ''
  if (result.length > MAX_RESULT_LEN) {
    result = result.slice(0, MAX_RESULT_LEN - 3) + '...'
  }

  console.log(`[ollama] Task "${assignment.taskTitle}" completed by ${agentId}`)
  await callbacks.onComplete(assignment.id, result)
}

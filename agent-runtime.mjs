/**
 * Agent Runtime — Process manager for Claude Code agent spawning.
 * Shared by both vite.config.ts (dev) and server.mjs (prod).
 */
import { spawn } from 'node:child_process'

const CLAUDE_CMD = process.env.CLAUDE_CMD || 'claude'
const MAX_RESULT_LEN = 2000
let projectRoot = process.cwd()

/**
 * Set the project root directory (used as default cwd for agent tasks).
 * @param {string} dir
 */
export function setProjectRoot(dir) {
  projectRoot = dir
}

/** @type {Map<string, { agentId: string, name: string, role: string, systemPrompt: string, runtimeConfig: Record<string, unknown>, currentTask: { assignmentId: string, childProcess: import('child_process').ChildProcess } | null }>} */
const registry = new Map()

/** @type {ReturnType<typeof setInterval> | null} */
let queueTimer = null

/**
 * Register an agent in the runtime registry.
 * @param {string} agentId
 * @param {string} name
 * @param {string} role
 * @param {string} [systemPrompt]
 * @param {Record<string, unknown>} [runtimeConfig]
 */
export function registerAgent(agentId, name, role, systemPrompt = '', runtimeConfig = {}) {
  if (registry.has(agentId)) {
    // Update systemPrompt and runtimeConfig if agent already registered
    const existing = registry.get(agentId)
    if (existing) {
      if (systemPrompt) existing.systemPrompt = systemPrompt
      existing.runtimeConfig = runtimeConfig
    }
    return
  }
  registry.set(agentId, { agentId, name, role, systemPrompt, runtimeConfig, currentTask: null })
  console.log(`[agent-runtime] Registered agent: ${agentId} (${name})`)
}

/**
 * Unregister an agent and kill any in-flight subprocess.
 * @param {string} agentId
 */
export function unregisterAgent(agentId) {
  const entry = registry.get(agentId)
  if (!entry) return
  if (entry.currentTask) {
    try {
      entry.currentTask.childProcess.kill('SIGTERM')
    } catch { /* already dead */ }
    console.log(`[agent-runtime] Killed running task for agent: ${agentId}`)
  }
  registry.delete(agentId)
  console.log(`[agent-runtime] Unregistered agent: ${agentId}`)
}

/**
 * Dispatch a task to an agent via `claude -p`.
 * @param {string} agentId
 * @param {{ id: string, taskTitle: string, taskBrief: string }} assignment
 * @param {{ onStart: (id: string) => void|Promise<void>, onComplete: (id: string, result: string) => void|Promise<void>, onError: (id: string, error: string) => void|Promise<void> }} callbacks
 * @returns {boolean} true if dispatch started, false if agent busy/unregistered
 */
export function dispatchTask(agentId, assignment, callbacks) {
  const entry = registry.get(agentId)
  if (!entry) {
    console.warn(`[agent-runtime] Cannot dispatch — agent ${agentId} not registered`)
    return false
  }
  if (entry.currentTask) {
    console.warn(`[agent-runtime] Cannot dispatch — agent ${agentId} is busy with ${entry.currentTask.assignmentId}`)
    return false
  }

  const prompt = entry.systemPrompt
    ? `${entry.systemPrompt}\n\nTask: ${assignment.taskTitle}\n\n${assignment.taskBrief || ''}\n\nProvide your response directly.`
    : `You are ${entry.name}, a ${entry.role}.\n\nTask: ${assignment.taskTitle}\n\n${assignment.taskBrief || ''}\n\nProvide your response directly.`

  const maxTurns = String(entry.runtimeConfig.maxTurns || 3)
  const timeoutMs = (entry.runtimeConfig.timeoutSec || 300) * 1000

  const args = [
    '-p', prompt,
    '--output-format', 'json',
    '--max-turns', maxTurns,
  ]

  // Only add --dangerously-skip-permissions if mode is not 'readonly'
  if (entry.runtimeConfig.mode !== 'readonly') {
    args.push('--dangerously-skip-permissions')
  }

  // Add allowed tools if specified
  if (entry.runtimeConfig.allowedTools) {
    try {
      const tools = typeof entry.runtimeConfig.allowedTools === 'string'
        ? JSON.parse(entry.runtimeConfig.allowedTools)
        : entry.runtimeConfig.allowedTools
      if (Array.isArray(tools) && tools.length > 0) {
        for (const tool of tools) {
          args.push('--allowedTools', String(tool).trim())
        }
      }
    } catch { /* invalid JSON, skip */ }
  }

  console.log(`[agent-runtime] Dispatching task "${assignment.taskTitle}" to ${agentId}`)

  const spawnOpts = {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  }

  // Use custom working directory if specified, fallback to project root
  spawnOpts.cwd = entry.runtimeConfig.workingDir || projectRoot

  const child = spawn(CLAUDE_CMD, args, spawnOpts)

  entry.currentTask = { assignmentId: assignment.id, childProcess: child }

  // Notify start
  Promise.resolve(callbacks.onStart(assignment.id)).catch(err =>
    console.error(`[agent-runtime] onStart callback error:`, err)
  )

  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (chunk) => {
    stdout += chunk
    if (callbacks.onOutput) {
      // Try to extract readable text from JSON chunks for live display
      let displayText = chunk.toString()
      try {
        const parsed = JSON.parse(displayText.trim())
        if (parsed.result) displayText = parsed.result
        else if (parsed.text) displayText = parsed.text
        else if (parsed.content) displayText = parsed.content
      } catch { /* not JSON, use raw */ }
      Promise.resolve(callbacks.onOutput(assignment.id, displayText)).catch(() => {})
    }
  })
  child.stderr.on('data', (chunk) => { stderr += chunk })

  child.on('close', (code) => {
    entry.currentTask = null

    if (code === 0) {
      let resultText = ''
      try {
        // claude --output-format json may output multiple JSON objects (streaming)
        // Try parsing the last complete JSON object, or the whole thing
        const trimmed = stdout.trim()
        let parsed = null
        // Try whole output as single JSON
        try { parsed = JSON.parse(trimmed) } catch {
          // Try last line (streaming mode outputs one JSON per line)
          const lines = trimmed.split('\n').filter(l => l.trim())
          for (let i = lines.length - 1; i >= 0; i--) {
            try { parsed = JSON.parse(lines[i]); break } catch { /* try next */ }
          }
        }
        if (parsed) {
          resultText = parsed.result || parsed.text || parsed.content || ''
          // If result is still an object/array, stringify it
          if (typeof resultText !== 'string') resultText = JSON.stringify(resultText)
        }
        if (!resultText) resultText = trimmed
      } catch {
        resultText = stdout.trim()
      }
      // Truncate to max length
      if (typeof resultText === 'string' && resultText.length > MAX_RESULT_LEN) {
        resultText = resultText.slice(0, MAX_RESULT_LEN - 3) + '...'
      }
      console.log(`[agent-runtime] Task "${assignment.taskTitle}" completed by ${agentId}`)
      Promise.resolve(callbacks.onComplete(assignment.id, String(resultText))).catch(err =>
        console.error(`[agent-runtime] onComplete callback error:`, err)
      )
    } else {
      const errorMsg = stderr.trim() || `Process exited with code ${code}`
      console.error(`[agent-runtime] Task "${assignment.taskTitle}" failed for ${agentId}: ${errorMsg}`)
      Promise.resolve(callbacks.onError(assignment.id, errorMsg.slice(0, 500))).catch(err =>
        console.error(`[agent-runtime] onError callback error:`, err)
      )
    }
  })

  child.on('error', (err) => {
    entry.currentTask = null
    console.error(`[agent-runtime] Spawn error for ${agentId}:`, err.message)
    Promise.resolve(callbacks.onError(assignment.id, err.message)).catch(cbErr =>
      console.error(`[agent-runtime] onError callback error:`, cbErr)
    )
  })

  return true
}

/**
 * Get the runtime status of a single agent.
 * @param {string} agentId
 * @returns {'idle' | 'busy' | 'unregistered'}
 */
export function getAgentStatus(agentId) {
  const entry = registry.get(agentId)
  if (!entry) return 'unregistered'
  return entry.currentTask ? 'busy' : 'idle'
}

/**
 * Get runtime statuses for all registered agents.
 * @returns {Array<{ agentId: string, registered: boolean, busy: boolean, currentAssignmentId: string | null }>}
 */
export function getAllAgentStatuses() {
  const statuses = []
  for (const [agentId, entry] of registry) {
    statuses.push({
      agentId,
      registered: true,
      busy: !!entry.currentTask,
      currentAssignmentId: entry.currentTask?.assignmentId ?? null,
    })
  }
  return statuses
}

/**
 * Start the task queue processor.
 * @param {number} intervalMs
 * @param {() => Array<{ id: string, targetAgentId: string, taskTitle: string, taskBrief: string, routingTarget: string }>} getQueuedTasks
 * @param {(assignment: object) => void} dispatchFn
 */
export function startTaskQueue(intervalMs, getQueuedTasks, dispatchFn) {
  if (queueTimer) clearInterval(queueTimer)
  queueTimer = setInterval(() => {
    try {
      const queued = getQueuedTasks()
      for (const assignment of queued) {
        const status = getAgentStatus(assignment.targetAgentId)
        if (status === 'idle') {
          dispatchFn(assignment)
        }
      }
    } catch (err) {
      console.error('[agent-runtime] Queue processor error:', err)
    }
  }, intervalMs)
  console.log(`[agent-runtime] Task queue processor started (${intervalMs}ms interval)`)
}

/**
 * Cancel a running task for an agent.
 * @param {string} agentId
 * @returns {string | null} The cancelled assignmentId, or null if not busy
 */
export function cancelTask(agentId) {
  const entry = registry.get(agentId)
  if (!entry || !entry.currentTask) return null
  const assignmentId = entry.currentTask.assignmentId
  try {
    entry.currentTask.childProcess.kill('SIGTERM')
  } catch { /* already dead */ }
  entry.currentTask = null
  console.log(`[agent-runtime] Cancelled task ${assignmentId} for agent ${agentId}`)
  return assignmentId
}

/**
 * Kill all running subprocesses and stop the queue.
 */
export function shutdownAll() {
  if (queueTimer) {
    clearInterval(queueTimer)
    queueTimer = null
  }
  for (const [agentId, entry] of registry) {
    if (entry.currentTask) {
      try {
        entry.currentTask.childProcess.kill('SIGTERM')
      } catch { /* already dead */ }
      console.log(`[agent-runtime] Killed task for ${agentId} during shutdown`)
    }
  }
  registry.clear()
  console.log('[agent-runtime] Shutdown complete')
}

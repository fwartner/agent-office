/**
 * Claude Code runtime provider - spawns `claude -p` subprocess.
 * This is the default provider, migrated from agent-runtime.mjs.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import type { RuntimeProvider, RuntimeConfig, Assignment, RuntimeCallbacks } from '../types.js'

const CLAUDE_CMD = process.env.CLAUDE_CMD || 'claude'
const MAX_RESULT_LEN = 2000

const tasks = new Map<string, { assignmentId: string; childProcess: ChildProcess }>()

export const claudeCodeProvider: RuntimeProvider = {
  name: 'claude-code',

  dispatch(agentId, agentName, agentRole, systemPrompt, assignment, config, callbacks) {
    if (tasks.has(agentId)) return false

    const prompt = systemPrompt
      ? `${systemPrompt}\n\nTask: ${assignment.taskTitle}\n\n${assignment.taskBrief || ''}\n\nProvide your response directly.`
      : `You are ${agentName}, a ${agentRole}.\n\nTask: ${assignment.taskTitle}\n\n${assignment.taskBrief || ''}\n\nProvide your response directly.`

    const maxTurns = String(config.maxTurns || 3)
    const timeoutMs = (config.timeoutSec || 300) * 1000

    const args = ['-p', prompt, '--output-format', 'json', '--max-turns', maxTurns]

    if (config.mode !== 'readonly') {
      args.push('--dangerously-skip-permissions')
    }

    if (config.allowedTools) {
      try {
        const tools = typeof config.allowedTools === 'string' ? JSON.parse(config.allowedTools) : config.allowedTools
        if (Array.isArray(tools) && tools.length > 0) {
          for (const tool of tools) args.push('--allowedTools', String(tool).trim())
        }
      } catch { /* invalid JSON, skip */ }
    }

    const child = spawn(CLAUDE_CMD, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      cwd: config.workingDir || process.env.PROJECT_ROOT || process.cwd(),
    })

    tasks.set(agentId, { assignmentId: assignment.id, childProcess: child })

    Promise.resolve(callbacks.onStart(assignment.id)).catch(err =>
      console.error(`[claude-code] onStart error:`, err)
    )

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk
      if (callbacks.onOutput) {
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
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk })

    child.on('close', (code) => {
      tasks.delete(agentId)
      if (code === 0) {
        const resultText = parseClaudeOutput(stdout)
        console.log(`[claude-code] Task "${assignment.taskTitle}" completed by ${agentId}`)
        Promise.resolve(callbacks.onComplete(assignment.id, resultText)).catch(err =>
          console.error(`[claude-code] onComplete error:`, err)
        )
      } else {
        const errorMsg = stderr.trim() || `Process exited with code ${code}`
        console.error(`[claude-code] Task "${assignment.taskTitle}" failed for ${agentId}: ${errorMsg}`)
        Promise.resolve(callbacks.onError(assignment.id, errorMsg.slice(0, 500))).catch(err =>
          console.error(`[claude-code] onError error:`, err)
        )
      }
    })

    child.on('error', (err) => {
      tasks.delete(agentId)
      console.error(`[claude-code] Spawn error for ${agentId}:`, err.message)
      Promise.resolve(callbacks.onError(assignment.id, err.message)).catch(cbErr =>
        console.error(`[claude-code] onError error:`, cbErr)
      )
    })

    return true
  },

  cancel(agentId) {
    const task = tasks.get(agentId)
    if (!task) return null
    try { task.childProcess.kill('SIGTERM') } catch { /* already dead */ }
    tasks.delete(agentId)
    return task.assignmentId
  },

  isAvailable() {
    return true // Claude Code CLI is always assumed available
  },
}

function parseClaudeOutput(stdout: string): string {
  let resultText = ''
  try {
    const trimmed = stdout.trim()
    let parsed = null
    try { parsed = JSON.parse(trimmed) } catch {
      const lines = trimmed.split('\n').filter(l => l.trim())
      for (let i = lines.length - 1; i >= 0; i--) {
        try { parsed = JSON.parse(lines[i]); break } catch { /* try next */ }
      }
    }
    if (parsed) {
      resultText = parsed.result || parsed.text || parsed.content || ''
      if (typeof resultText !== 'string') resultText = JSON.stringify(resultText)
    }
    if (!resultText) resultText = trimmed
  } catch {
    resultText = stdout.trim()
  }
  if (typeof resultText === 'string' && resultText.length > MAX_RESULT_LEN) {
    resultText = resultText.slice(0, MAX_RESULT_LEN - 3) + '...'
  }
  return String(resultText)
}

export function getClaudeCodeTasks() {
  return tasks
}

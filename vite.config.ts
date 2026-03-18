import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { registerAgent, unregisterAgent, dispatchTask, cancelTask, getAllAgentStatuses, startTaskQueue, shutdownAll, setProjectRoot } from './agent-runtime.mjs'

setProjectRoot(process.env.PROJECT_ROOT || __dirname)
const STATE_DIR = process.env.OFFICE_STATE_DIR || path.resolve(__dirname, 'state')
const STATE_FILE = path.join(STATE_DIR, 'office-snapshot.json')
const RESULTS_DIR = process.env.OFFICE_RESULTS_DIR || path.join(STATE_DIR, 'results')
const SETTINGS_PATH = process.env.OFFICE_SETTINGS_PATH || path.join(STATE_DIR, 'settings.json')
const MAX_BODY_SIZE = 1_048_576
const startTime = Date.now()

function readBody(req: IncomingMessage): Promise<{ parsed: unknown; raw: string }> {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0
    const timeout = setTimeout(() => { reject(new Error('Request timeout')); req.destroy() }, 10_000)
    req.on('data', (chunk: Buffer | string) => {
      size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
      if (size > MAX_BODY_SIZE) { reject(new Error('Body too large')); req.destroy(); return }
      body += chunk
    })
    req.on('end', () => {
      clearTimeout(timeout)
      if (!body) { resolve({ parsed: null, raw: '' }); return }
      try { resolve({ parsed: JSON.parse(body), raw: body }) } catch (e) { reject(e) }
    })
    req.on('error', (e) => { clearTimeout(timeout); reject(e) })
  })
}

function officeApiPlugin(): Plugin {
  let apiReady = false
  let routeRequest: Function
  let apiCtx: Record<string, Function>
  let sseAddClient: Function
  let sseRemoveClient: Function
  let sseBroadcastAgentOutput: Function
  let sseBroadcastSettingsChanged: Function
  let sseShutdown: Function

  return {
    name: 'office-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? '/', `http://localhost:4173`)

        if (!url.pathname.startsWith('/api/')) { next(); return }

        // Lazy-init: load compiled shared modules on first API request
        if (!apiReady) {
          try {
            const serverMod = await import('./dist-server/server/index.js')
            routeRequest = serverMod.routeRequest

            // Try Drizzle DB (SQLite), fall back to JSON file
            try {
              const { getConnection } = await import('./dist-server/db/index.js')
              const { runMigrations } = await import('./dist-server/db/migrate.js')
              const { seedDatabase } = await import('./dist-server/db/seed.js')
              const conn = await getConnection()
              await runMigrations(conn)
              await seedDatabase(conn)
              apiCtx = serverMod.createDrizzleContext(conn.db, conn.schema, RESULTS_DIR, SETTINGS_PATH)
              console.log(`[dev] Using ${conn.dialect} database`)
            } catch (dbErr) {
              console.warn(`[dev] Drizzle init failed, using JSON file: ${(dbErr as Error).message}`)
              apiCtx = serverMod.createJsonContext(STATE_FILE, RESULTS_DIR)
            }

            // Wire agent runtime
            apiCtx.registerAgentRuntime = (id: string, name: string, role: string, sp: string, rc?: Record<string, unknown>) => registerAgent(id, name, role, sp, rc)
            apiCtx.unregisterAgentRuntime = (id: string) => unregisterAgent(id)
            apiCtx.getAgentRuntimeStatuses = () => getAllAgentStatuses()
            apiCtx.cancelAgentTask = (agentId: string) => cancelTask(agentId)
            apiCtx.dispatchToRuntime = (agentId: string, assignment: Record<string, unknown>) => {
              dispatchTask(agentId, assignment, createDevStateCallbacks(apiCtx, sseBroadcastAgentOutput))
            }

            serverMod.initWebhookDispatcher(apiCtx)

            // Init integrations
            serverMod.initSlack(apiCtx)
            serverMod.initGitHub(apiCtx)
            serverMod.initLinear(apiCtx)

            // Register inbound webhook handlers
            apiCtx.integrationWebhooks = {
              github: serverMod.githubWebhookHandler(apiCtx),
              linear: serverMod.linearWebhookHandler(apiCtx),
            }

            // Init SSE streaming
            serverMod.initSSE()
            sseAddClient = serverMod.addClient
            sseRemoveClient = serverMod.removeClient
            sseBroadcastAgentOutput = serverMod.broadcastAgentOutput
            sseBroadcastSettingsChanged = serverMod.broadcastSettingsChanged
            sseShutdown = serverMod.shutdownSSE

            // Wire settings change broadcast
            apiCtx.onSettingsChanged = (settings: Record<string, unknown>) => {
              if (sseBroadcastSettingsChanged) sseBroadcastSettingsChanged(settings)
            }

            // Register existing agents
            try {
              const snap = await apiCtx.getSnapshot()
              for (const agent of (snap.agents || [])) {
                registerAgent(String(agent.id), String(agent.name || agent.id), String(agent.role || ''), String(agent.systemPrompt || ''), {
                  maxTurns: agent.runtimeMaxTurns ?? 3,
                  timeoutSec: agent.runtimeTimeoutSec ?? 300,
                  workingDir: agent.runtimeWorkingDir ?? undefined,
                  allowedTools: agent.runtimeAllowedTools ?? undefined,
                  mode: agent.runtimeMode ?? 'full',
                })
              }
            } catch { /* empty state */ }

            // Start task queue
            startTaskQueue(5000, () => {
              try {
                const snap = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
                return (snap.assignments || []).filter((a: Record<string, string>) =>
                  a.status === 'queued' && ['agent_runtime', 'both'].includes(a.routingTarget)
                )
              } catch { return [] }
            }, (assignment: { targetAgentId: string }) => {
              dispatchTask(assignment.targetAgentId, assignment, createDevStateCallbacks(apiCtx))
            })

            // Start bot if configured
            if (process.env.TELEGRAM_BOT_TOKEN) {
              try {
                const botMod = await import('./dist-server/bot/index.js')
                await botMod.startBot(process.env.TELEGRAM_BOT_TOKEN, apiCtx)
              } catch (err) {
                console.warn('[bot] Failed to start:', (err as Error).message)
              }
            }

            apiReady = true
            console.log('[dev] Shared API layer loaded from dist-server/')
          } catch (err) {
            console.error('[dev] Failed to load dist-server/. Run `npm run build:server` first.', (err as Error).message)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Server modules not built. Run: npm run build:server' }))
            return
          }
        }

        // CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          res.end()
          return
        }

        try {
          let parsed = null
          let rawBody = ''
          if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
            const { parsed: p, raw } = await readBody(req)
            parsed = p
            rawBody = raw
          }
          const reqHeaders = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
          const result = await routeRequest(apiCtx, req.method, url.pathname, parsed, url.searchParams, startTime, rawBody, reqHeaders)
          if (result.handled && result.sse) {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*',
            })
            const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            sseAddClient({
              id: clientId,
              write: (data: string) => { try { res.write(data); return true } catch { return false } },
              close: () => { try { res.end() } catch { /* ignore */ } },
            })
            res.on('close', () => sseRemoveClient(clientId))
            return
          }
          if (result.handled && result.response) {
            res.writeHead(result.response.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
            res.end(JSON.stringify(result.response.body))
            return
          }
        } catch (e) {
          console.error(`Error handling ${req.method} ${url.pathname}:`, e)
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid request' }))
          return
        }

        next()
      })

      server.httpServer?.on('close', () => { if (sseShutdown) sseShutdown(); shutdownAll() })
    }
  }
}

function createDevStateCallbacks(ctx: Record<string, Function>, broadcastOutput?: Function) {
  return {
    async onStart(assignmentId: string) {
      try {
        const snap = await ctx.getSnapshot()
        const assignment = (snap.assignments || []).find((a: Record<string, string>) => a.id === assignmentId)
        if (!assignment) return
        await ctx.updateAssignment(assignmentId, 'active')
        await ctx.patchAgent(String(assignment.targetAgentId), { presence: 'active', focus: `Working on: ${assignment.taskTitle}` })
        await ctx.appendActivity({ kind: 'assignment', text: `${assignment.targetAgentId} started "${assignment.taskTitle}"`, agentId: assignment.targetAgentId })
      } catch (e) { console.error('[dev] onStart error:', e) }
    },
    async onComplete(assignmentId: string, result: string) {
      try {
        const snap = await ctx.getSnapshot()
        const assignment = (snap.assignments || []).find((a: Record<string, string>) => a.id === assignmentId)
        if (!assignment) return
        await ctx.updateAssignment(assignmentId, 'done', result)
        await ctx.patchAgent(String(assignment.targetAgentId), { presence: 'available', focus: `Completed: ${assignment.taskTitle}` })
        await ctx.appendActivity({ kind: 'assignment', text: `${assignment.targetAgentId} completed "${assignment.taskTitle}"`, agentId: assignment.targetAgentId })
        // If chat-sourced, post the result as a chat message from the agent
        if (assignment.source === 'chat' && result) {
          try {
            const agentSnap = (snap.agents || []).find((a: Record<string, string>) => a.id === assignment.targetAgentId)
            const roomId = agentSnap?.roomId || 'commons'
            await ctx.sendMessage({ fromAgentId: String(assignment.targetAgentId), roomId: String(roomId), message: result })
          } catch { /* best-effort */ }
        }
      } catch (e) { console.error('[dev] onComplete error:', e) }
    },
    async onError(assignmentId: string, error: string) {
      try {
        const snap = await ctx.getSnapshot()
        const assignment = (snap.assignments || []).find((a: Record<string, string>) => a.id === assignmentId)
        if (!assignment) return
        await ctx.updateAssignment(assignmentId, 'blocked')
        await ctx.patchAgent(String(assignment.targetAgentId), { presence: 'blocked', focus: `Error: ${error.slice(0, 100)}` })
        await ctx.appendActivity({ kind: 'system', text: `Task "${assignment.taskTitle}" failed: ${error.slice(0, 200)}`, agentId: assignment.targetAgentId })
      } catch (e) { console.error('[dev] onError error:', e) }
    },
    async onOutput(assignmentId: string, chunk: string) {
      if (!broadcastOutput) return
      try {
        const snap = await ctx.getSnapshot()
        const assignment = (snap.assignments || []).find((a: Record<string, string>) => a.id === assignmentId)
        if (assignment) {
          broadcastOutput(String(assignment.targetAgentId), assignmentId, chunk)
        }
      } catch { /* ignore */ }
    },
  }
}

export default defineConfig({
  plugins: [react(), officeApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 4173
  }
})

#!/usr/bin/env node
/**
 * Agent Office CLI entry point.
 *
 * Usage:
 *   office              Start server + open browser
 *   office init          Interactive setup
 *   office status        Show running state from PID file
 *   office agents        List agents from DB
 *   office stop          SIGTERM via PID file
 *
 * Flags:
 *   --port <n>           Override port (default 4173, auto-increment if taken)
 *   --no-open            Skip browser open (Docker/CI)
 */
import { parseArgs } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { spawn, execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.resolve(__dirname, '..')

// ── Colours ──────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', magenta: '\x1b[35m', blue: '\x1b[34m',
}

// ── Parse CLI args ───────────────────────────────────
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', short: 'p' },
    'no-open': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
  strict: false,
})

const command = positionals[0] || 'start'

// ── Version ──────────────────────────────────────────
function getVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf-8'))
    return pkg.version || '0.0.0'
  } catch { return '0.0.0' }
}

if (values.version) {
  console.log(`agent-office v${getVersion()}`)
  process.exit(0)
}

// ── Help ─────────────────────────────────────────────
if (values.help) {
  console.log(`
  ${c.cyan}${c.bold}Agent Office${c.reset} v${getVersion()}

  ${c.bold}Usage:${c.reset}
    office                Start server + open browser
    office init           Interactive setup wizard
    office status         Show running state
    office agents         List registered agents
    office stop           Stop running server

  ${c.bold}Options:${c.reset}
    --port <n>            Override port (default: 4173)
    --no-open             Skip browser open
    -h, --help            Show this help
    -v, --version         Show version
  `)
  process.exit(0)
}

// ── Path resolution ──────────────────────────────────
const PROJECT_ROOT = process.cwd()
const STATE_DIR = path.join(PROJECT_ROOT, '.agent-office')
const DB_PATH = path.join(STATE_DIR, 'agent-office.db')
const SETTINGS_PATH = path.join(STATE_DIR, 'settings.json')
const RESULTS_DIR = path.join(STATE_DIR, 'results')
const MEMORY_DIR = path.join(STATE_DIR, 'memory')
const PID_FILE = path.join(STATE_DIR, 'server.pid')
const CONFIG_PATH = path.join(STATE_DIR, 'config.json')

// ── Helpers ──────────────────────────────────────────
function ensureStateDir() {
  for (const dir of [STATE_DIR, RESULTS_DIR, MEMORY_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch { return null }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

function readPid() {
  try {
    const data = JSON.parse(fs.readFileSync(PID_FILE, 'utf-8'))
    return data
  } catch { return null }
}

function writePid(pid, port) {
  fs.writeFileSync(PID_FILE, JSON.stringify({ pid, port, startedAt: new Date().toISOString() }))
}

function removePid() {
  try { fs.unlinkSync(PID_FILE) } catch { /* ok */ }
}

function isProcessRunning(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => { srv.close(() => resolve(true)) })
    srv.listen(port, '0.0.0.0')
  })
}

async function findAvailablePort(startPort) {
  let port = startPort
  for (let i = 0; i < 10; i++) {
    if (await isPortAvailable(port)) return port
    port++
  }
  throw new Error(`No available port found (tried ${startPort}-${port - 1})`)
}

function openBrowser(url) {
  const platform = process.platform
  try {
    if (platform === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' })
    else if (platform === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' })
    else execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
  } catch { /* not critical */ }
}

// ── Commands ─────────────────────────────────────────

async function cmdInit() {
  // Delegate to setup.mjs with project root context
  const setupPath = path.join(PKG_ROOT, 'setup.mjs')
  if (!fs.existsSync(setupPath)) {
    console.error(`${c.red}Error:${c.reset} setup.mjs not found at ${setupPath}`)
    process.exit(1)
  }

  ensureStateDir()

  // Run setup wizard
  const args = ['--force']
  if (process.argv.includes('--yes') || process.argv.includes('-y')) args.push('--yes')
  const child = spawn('node', [setupPath, ...args], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: { ...process.env, PROJECT_ROOT },
  })
  child.on('close', (code) => process.exit(code || 0))
}

async function cmdStatus() {
  const pidData = readPid()
  if (!pidData) {
    console.log(`${c.yellow}No running server found${c.reset} in ${STATE_DIR}`)
    process.exit(1)
  }

  if (!isProcessRunning(pidData.pid)) {
    console.log(`${c.yellow}Server not running${c.reset} (stale PID file: ${pidData.pid})`)
    removePid()
    process.exit(1)
  }

  console.log(`${c.green}Server running${c.reset}`)
  console.log(`  PID:     ${pidData.pid}`)
  console.log(`  Port:    ${pidData.port}`)
  console.log(`  Started: ${pidData.startedAt}`)
  console.log(`  URL:     http://localhost:${pidData.port}`)

  // Try to fetch agent count
  try {
    const res = await fetch(`http://localhost:${pidData.port}/api/health`)
    if (res.ok) {
      const health = await res.json()
      console.log(`  DB:      ${health.database || 'unknown'}`)
      console.log(`  Uptime:  ${health.uptime || 'unknown'}`)
    }
  } catch { /* server may be unreachable */ }
}

async function cmdAgents() {
  const pidData = readPid()
  if (!pidData || !isProcessRunning(pidData.pid)) {
    console.log(`${c.yellow}Server not running.${c.reset} Start it with: ${c.bold}office${c.reset}`)
    process.exit(1)
  }

  try {
    const res = await fetch(`http://localhost:${pidData.port}/api/office/snapshot`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const snap = await res.json()
    const agents = snap.agents || []

    if (agents.length === 0) {
      console.log(`${c.dim}No agents registered.${c.reset}`)
      return
    }

    console.log(`${c.bold}Agents (${agents.length}):${c.reset}`)
    console.log()
    for (const a of agents) {
      const presColor = a.presence === 'active' ? c.green : a.presence === 'available' ? c.cyan : a.presence === 'blocked' ? c.red : c.dim
      console.log(`  ${presColor}●${c.reset} ${c.bold}${a.name}${c.reset} ${c.dim}(${a.id})${c.reset}`)
      console.log(`    Role: ${a.role} | Room: ${a.roomId} | Status: ${presColor}${a.presence}${c.reset}`)
      if (a.focus) console.log(`    Focus: ${c.dim}${a.focus}${c.reset}`)
    }
  } catch (err) {
    console.error(`${c.red}Error:${c.reset} Could not fetch agents: ${err.message}`)
    process.exit(1)
  }
}

async function cmdStop() {
  const pidData = readPid()
  if (!pidData) {
    console.log(`${c.yellow}No running server found${c.reset}`)
    process.exit(0)
  }

  if (!isProcessRunning(pidData.pid)) {
    console.log(`${c.yellow}Server not running${c.reset} (cleaning up stale PID file)`)
    removePid()
    process.exit(0)
  }

  console.log(`Stopping server (PID ${pidData.pid})...`)
  try {
    process.kill(pidData.pid, 'SIGTERM')
    // Wait for process to die
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100))
      if (!isProcessRunning(pidData.pid)) break
    }
    removePid()
    console.log(`${c.green}Server stopped${c.reset}`)
  } catch (err) {
    console.error(`${c.red}Error stopping server:${c.reset} ${err.message}`)
    process.exit(1)
  }
}

async function cmdStart() {
  // Check for stale PID
  const pidData = readPid()
  if (pidData && isProcessRunning(pidData.pid)) {
    console.log(`${c.yellow}Server already running${c.reset} (PID ${pidData.pid}, port ${pidData.port})`)
    console.log(`  URL: http://localhost:${pidData.port}`)
    console.log(`  Use ${c.bold}office stop${c.reset} to stop it first.`)
    process.exit(0)
  }

  // Ensure state dir exists
  ensureStateDir()

  // Auto-run init if no config
  const config = readConfig()
  if (!config) {
    console.log(`${c.dim}First run detected - creating .agent-office/ directory...${c.reset}`)
    writeConfig({
      createdAt: new Date().toISOString(),
      projectName: path.basename(PROJECT_ROOT),
    })
  }

  // Determine port
  const requestedPort = values.port ? parseInt(values.port) : 4173
  const port = await findAvailablePort(requestedPort)
  if (port !== requestedPort) {
    console.log(`${c.yellow}Port ${requestedPort} in use${c.reset}, using ${c.bold}${port}${c.reset}`)
  }

  // Ensure dist-server/ exists (build if needed)
  const distServer = path.join(PKG_ROOT, 'dist-server')
  if (!fs.existsSync(distServer)) {
    console.log(`${c.dim}Building server modules...${c.reset}`)
    try {
      execSync('npm run build:server', { cwd: PKG_ROOT, stdio: 'inherit' })
    } catch {
      console.error(`${c.red}Build failed.${c.reset} Run ${c.bold}npm run build:server${c.reset} manually.`)
      process.exit(1)
    }
  }

  // Ensure dist/ exists (build frontend if needed)
  const distFrontend = path.join(PKG_ROOT, 'dist')
  if (!fs.existsSync(distFrontend)) {
    console.log(`${c.dim}Building frontend...${c.reset}`)
    try {
      execSync('npm run build', { cwd: PKG_ROOT, stdio: 'inherit' })
    } catch {
      console.error(`${c.red}Frontend build failed.${c.reset} Run ${c.bold}npm run build${c.reset} manually.`)
      process.exit(1)
    }
  }

  // Display startup banner
  const version = getVersion()
  console.log()
  console.log(`  ${c.cyan}${c.bold}╔═══════════════════════════════════╗${c.reset}`)
  console.log(`  ${c.cyan}${c.bold}║${c.reset}  ${c.magenta}${c.bold}Agent Office${c.reset} v${version}${' '.repeat(Math.max(0, 18 - version.length))}${c.cyan}${c.bold}║${c.reset}`)
  console.log(`  ${c.cyan}${c.bold}╚═══════════════════════════════════╝${c.reset}`)
  console.log()
  console.log(`  ${c.dim}Project:${c.reset} ${PROJECT_ROOT}`)
  console.log(`  ${c.dim}Data:${c.reset}    ${STATE_DIR}`)

  // Set environment for the server process
  const env = {
    ...process.env,
    PROJECT_ROOT,
    OFFICE_STATE_DIR: STATE_DIR,
    OFFICE_DB_PATH: DB_PATH,
    OFFICE_SETTINGS_PATH: SETTINGS_PATH,
    OFFICE_RESULTS_DIR: RESULTS_DIR,
    PORT: String(port),
  }

  // Load .env from project root if it exists
  const envFile = path.join(PROJECT_ROOT, '.env')
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim()
        if (!env[key]) env[key] = val // Don't override existing env vars
      }
    }
  }

  // Start the production server
  const serverPath = path.join(PKG_ROOT, 'server.mjs')
  const child = spawn('node', [serverPath], {
    cwd: PROJECT_ROOT,
    env,
    stdio: 'inherit',
    detached: false,
  })

  // Write PID file
  writePid(child.pid, port)

  // Wait a moment for server to start
  await new Promise(r => setTimeout(r, 1500))

  // Fetch agent count
  try {
    const res = await fetch(`http://localhost:${port}/api/office/snapshot`)
    if (res.ok) {
      const snap = await res.json()
      const agents = snap.agents || []
      const active = agents.filter(a => a.presence === 'active' || a.presence === 'available').length
      console.log(`  ${c.dim}Agents:${c.reset}  ${agents.length} registered, ${active} active`)
    }
  } catch { /* server may still be starting */ }

  console.log(`  ${c.dim}Server:${c.reset}  ${c.green}http://localhost:${port}${c.reset}`)
  console.log()
  console.log(`  ${c.dim}Press Ctrl+C to stop${c.reset}`)
  console.log()

  // Open browser (unless --no-open)
  if (!values['no-open'] && !process.env.CI && !process.env.DOCKER) {
    openBrowser(`http://localhost:${port}`)
  }

  // Clean up on exit
  child.on('close', (code) => {
    removePid()
    process.exit(code || 0)
  })

  process.on('SIGTERM', () => { child.kill('SIGTERM') })
  process.on('SIGINT', () => { child.kill('SIGTERM') })
}

// ── Dispatch ─────────────────────────────────────────
switch (command) {
  case 'start': await cmdStart(); break
  case 'init': await cmdInit(); break
  case 'status': await cmdStatus(); break
  case 'agents': await cmdAgents(); break
  case 'stop': await cmdStop(); break
  default:
    console.error(`${c.red}Unknown command:${c.reset} ${command}`)
    console.log(`Run ${c.bold}office --help${c.reset} for usage.`)
    process.exit(1)
}

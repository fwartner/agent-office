/**
 * Path resolution for Agent Office.
 * Centralises all derived paths so both CLI and server.mjs use the same logic.
 */
import path from 'node:path'

export interface OfficePaths {
  /** Root project directory (cwd when running `office`) */
  projectRoot: string
  /** .agent-office/ state directory */
  stateDir: string
  /** SQLite database file */
  dbPath: string
  /** Settings JSON sidecar */
  settingsPath: string
  /** Task result files */
  resultsDir: string
  /** Agent memory directory */
  memoryDir: string
  /** Server PID file */
  pidFile: string
  /** Config file */
  configPath: string
}

/**
 * Resolve all derived paths from a project root directory.
 */
export function resolvePaths(projectRoot: string): OfficePaths {
  const stateDir = path.join(projectRoot, '.agent-office')
  return {
    projectRoot,
    stateDir,
    dbPath: path.join(stateDir, 'agent-office.db'),
    settingsPath: path.join(stateDir, 'settings.json'),
    resultsDir: path.join(stateDir, 'results'),
    memoryDir: path.join(stateDir, 'memory'),
    pidFile: path.join(stateDir, 'server.pid'),
    configPath: path.join(stateDir, 'config.json'),
  }
}

/**
 * Resolve paths for legacy mode (backward compat with server.mjs standalone).
 * Uses the old state/ directory layout.
 */
export function resolveLegacyPaths(serverDir: string): OfficePaths {
  const stateDir = path.join(serverDir, 'state')
  return {
    projectRoot: serverDir,
    stateDir,
    dbPath: path.join(stateDir, 'agent-office.db'),
    settingsPath: path.join(stateDir, 'settings.json'),
    resultsDir: path.join(stateDir, 'results'),
    memoryDir: path.join(stateDir, 'memory'),
    pidFile: path.join(stateDir, 'server.pid'),
    configPath: path.join(stateDir, 'config.json'),
  }
}

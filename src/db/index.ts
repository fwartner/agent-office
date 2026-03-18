/**
 * Database connection factory.
 *
 * Reads DATABASE_URL to decide backend:
 *   - starts with "postgres://" or "postgresql://" → Postgres via node-postgres
 *   - absent or file path → SQLite via better-sqlite3 (default)
 *
 * Exports a unified `db` object plus the active schema for query building.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_SQLITE_PATH = path.resolve(__dirname, '../../state/agent-office.db')

export type DbDialect = 'sqlite' | 'postgres'

export interface DbConnection {
  dialect: DbDialect
  /** Drizzle database instance - type varies by dialect */
  db: unknown
  /** The schema tables for the active dialect */
  schema: typeof import('./schema.js')
  /** Close the connection */
  close: () => void
}

let _connection: DbConnection | null = null

/**
 * Get or create the database connection.
 * @param dbPath Optional explicit SQLite path. Overrides DEFAULT_SQLITE_PATH but not DATABASE_URL for Postgres.
 */
export async function getConnection(dbPath?: string): Promise<DbConnection> {
  if (_connection) return _connection

  const databaseUrl = process.env.DATABASE_URL || ''

  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    _connection = await connectPostgres(databaseUrl)
  } else {
    // Use: explicit dbPath > OFFICE_DB_PATH env > DATABASE_URL (non-postgres) > default
    const sqlitePath = dbPath || process.env.OFFICE_DB_PATH || databaseUrl || DEFAULT_SQLITE_PATH
    _connection = await connectSqlite(sqlitePath)
  }

  return _connection
}

async function connectSqlite(dbPath: string): Promise<DbConnection> {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('./schema.js')

  // Ensure directory exists
  const { mkdirSync } = await import('node:fs')
  mkdirSync(path.dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  return {
    dialect: 'sqlite',
    db,
    schema,
    close: () => sqlite.close(),
  }
}

async function connectPostgres(connectionString: string): Promise<DbConnection> {
  const { default: pg } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  // For Postgres we use the PG schema but re-export with same names
  const schema = await import('./schema-pg.js')

  const pool = new pg.Pool({ connectionString })
  const db = drizzle(pool, { schema })

  return {
    dialect: 'postgres',
    db,
    schema: schema as unknown as typeof import('./schema.js'),
    close: () => { pool.end() },
  }
}

export function closeConnection(): void {
  if (_connection) {
    _connection.close()
    _connection = null
  }
}

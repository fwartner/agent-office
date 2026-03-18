/**
 * Drizzle ORM schema - SQLite dialect (default backend).
 */
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const officeAgents = sqliteTable('office_agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  team: text('team').notNull(),
  internalStaff: integer('internal_staff', { mode: 'boolean' }).notNull().default(true),
  officeVisible: integer('office_visible', { mode: 'boolean' }).notNull().default(true),
  characterId: text('character_id'),
  spriteSheet: text('sprite_sheet'),
  systemPrompt: text('system_prompt'),
  runtimeMaxTurns: integer('runtime_max_turns').default(3),
  runtimeTimeoutSec: integer('runtime_timeout_sec').default(300),
  runtimeWorkingDir: text('runtime_working_dir'),
  runtimeAllowedTools: text('runtime_allowed_tools'), // JSON array stored as text
  runtimeMode: text('runtime_mode').default('full'), // 'readonly' | 'full'
  runtimeProvider: text('runtime_provider').default('claude-code'), // 'claude-code' | 'openai' | 'ollama'
  runtimeModel: text('runtime_model'), // model name for non-claude providers
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeRooms = sqliteTable('office_rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  team: text('team').notNull(),
  purpose: text('purpose'),
  zoneX: real('zone_x').notNull(),
  zoneY: real('zone_y').notNull(),
  zoneW: real('zone_w').notNull(),
  zoneH: real('zone_h').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officePresence = sqliteTable('office_presence', {
  agentId: text('agent_id').primaryKey().references(() => officeAgents.id, { onDelete: 'cascade' }),
  presenceState: text('presence_state').notNull().default('available'),
  effectivePresenceState: text('effective_presence_state').notNull().default('available'),
  criticalTask: integer('critical_task', { mode: 'boolean' }).notNull().default(false),
  focus: text('focus'),
  collaborationMode: text('collaboration_mode'),
  officeHoursTimezone: text('office_hours_timezone').notNull().default('Europe/Berlin'),
  officeHoursDays: text('office_hours_days').notNull().default('Monday-Friday'),
  officeHoursWindow: text('office_hours_window').notNull().default('09:00-17:00'),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeWorldEntities = sqliteTable('office_world_entities', {
  agentId: text('agent_id').primaryKey().references(() => officeAgents.id, { onDelete: 'cascade' }),
  roomId: text('room_id').notNull().references(() => officeRooms.id, { onDelete: 'cascade' }),
  anchorXPct: real('anchor_x_pct').notNull(),
  anchorYPct: real('anchor_y_pct').notNull(),
  facing: text('facing'),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeAssignments = sqliteTable('office_assignments', {
  id: text('id').primaryKey(),
  targetAgentId: text('target_agent_id').notNull().references(() => officeAgents.id, { onDelete: 'cascade' }),
  taskTitle: text('task_title').notNull(),
  taskBrief: text('task_brief').notNull(),
  priority: text('priority').notNull().default('medium'),
  status: text('status').notNull().default('queued'),
  routingTarget: text('routing_target').notNull().default('work_tracker'),
  source: text('source').notNull().default('office_ui'),
  result: text('result'),
  completedAt: text('completed_at'),
  durationMs: integer('duration_ms'),
  dependsOn: text('depends_on'), // JSON array of assignment IDs
  externalIssueId: text('external_issue_id'),
  externalIssueUrl: text('external_issue_url'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeActivityFeed = sqliteTable('office_activity_feed', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  agentId: text('agent_id').references(() => officeAgents.id, { onDelete: 'set null' }),
  roomId: text('room_id').references(() => officeRooms.id, { onDelete: 'set null' }),
  message: text('message').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeDecisions = sqliteTable('office_decisions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  detail: text('detail').notNull(),
  status: text('status').notNull().default('proposed'),
  proposedBy: text('proposed_by').references(() => officeAgents.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeMessages = sqliteTable('office_messages', {
  id: text('id').primaryKey(),
  fromAgentId: text('from_agent_id').notNull(),
  toAgentId: text('to_agent_id'),
  roomId: text('room_id').references(() => officeRooms.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeWebhooks = sqliteTable('office_webhooks', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  secret: text('secret').notNull().default(''),
  events: text('events').notNull().default('[]'), // JSON array stored as text
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeWebhookLogs = sqliteTable('office_webhook_logs', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull().references(() => officeWebhooks.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  statusCode: integer('status_code'),
  deliveredAt: text('delivered_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeIntegrations = sqliteTable('office_integrations', {
  name: text('name').primaryKey(),  // 'slack', 'github', 'linear', 'telegram', 'discord', 'notion'
  config: text('config').notNull().default('{}'),  // JSON object stored as text
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const officeAuditLog = sqliteTable('office_audit_log', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  source: text('source').notNull(), // 'api', 'bot', 'runtime', 'integration'
  details: text('details'), // JSON object stored as text
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

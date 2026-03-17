-- Virtual Office central state schema for agent_memory
-- Closure path for DEV-45 / DEV-51

begin;

create table if not exists office_agents (
  id text primary key,
  memory_agent_id text references public.agents(id) on delete set null,
  name text not null,
  role text not null,
  team text not null,
  internal_staff boolean not null default true,
  office_visible boolean not null default true,
  character_id text,
  sprite_sheet text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists office_rooms (
  id text primary key,
  name text not null,
  team text not null,
  purpose text,
  zone_x numeric(5,2) not null,
  zone_y numeric(5,2) not null,
  zone_w numeric(5,2) not null,
  zone_h numeric(5,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists office_presence (
  agent_id text primary key references office_agents(id) on delete cascade,
  presence_state text not null check (presence_state in ('off_hours','available','active','in_meeting','paused','blocked')),
  effective_presence_state text not null check (effective_presence_state in ('off_hours','available','active','in_meeting','paused','blocked')),
  critical_task boolean not null default false,
  focus text,
  collaboration_mode text,
  office_hours_timezone text not null default 'Europe/Berlin',
  office_hours_days text not null default 'Monday-Friday',
  office_hours_window text not null default '09:00-17:00',
  updated_at timestamptz not null default now()
);

create table if not exists office_world_entities (
  agent_id text primary key references office_agents(id) on delete cascade,
  room_id text not null references office_rooms(id) on delete cascade,
  anchor_x_pct numeric(5,2) not null,
  anchor_y_pct numeric(5,2) not null,
  facing text check (facing in ('left','right','up','down')),
  updated_at timestamptz not null default now()
);

create table if not exists office_assignments (
  id text primary key,
  target_agent_id text not null references office_agents(id) on delete cascade,
  task_title text not null,
  task_brief text not null,
  priority text not null check (priority in ('low','medium','high')),
  status text not null check (status in ('queued','routed','active','done','blocked')),
  routing_target text not null check (routing_target in ('agent_runtime','work_tracker','both')),
  source text not null default 'office_ui',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists office_activity_feed (
  id text primary key,
  kind text not null check (kind in ('assignment','presence','decision','system')),
  agent_id text references office_agents(id) on delete set null,
  room_id text references office_rooms(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists office_decisions (
  id text primary key,
  title text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists office_activity_feed_created_at_idx on office_activity_feed (created_at desc);
create index if not exists office_assignments_target_agent_id_idx on office_assignments (target_agent_id, created_at desc);
create index if not exists office_world_entities_room_id_idx on office_world_entities (room_id);

insert into office_rooms (id, name, team, purpose, zone_x, zone_y, zone_w, zone_h)
values
  ('planning-studio', 'Planning Studio', 'Product + UX', 'Scope, flows, and meeting-driven coordination', 25, 3, 50, 27),
  ('shipyard', 'Shipyard', 'Build', 'Implementation room for active engineering work', 2, 33, 58, 30),
  ('systems-bay', 'Systems Bay', 'Platform', 'Architecture and systems decisions that support the whole office', 62, 33, 36, 22),
  ('commons', 'Commons', 'Shared Office', 'Shared coordination space', 2, 68, 58, 30),
  ('signal-room', 'Signal Room', 'Ops', 'Status, reporting, decisions, and operational visibility', 62, 60, 36, 38)
on conflict (id) do nothing;

insert into office_agents (id, name, role, team, internal_staff, office_visible, character_id, sprite_sheet)
values
  ('forge', 'Forge', 'Full-stack builder', 'Build', true, true, 'forge', '/assets/characters/free-office-pixel-art/worker1.png'),
  ('northstar', 'Northstar', 'Technical architecture', 'Platform', true, true, 'northstar', '/assets/characters/free-office-pixel-art/boss.png'),
  ('prism', 'Prism', 'Product scope', 'Product', true, true, 'prism', '/assets/characters/free-office-pixel-art/Julia.png'),
  ('lumen', 'Lumen', 'UX and interface structure', 'Experience', true, true, 'lumen', '/assets/characters/free-office-pixel-art/worker2.png'),
  ('quarry', 'Quarry', 'Reporting and metrics', 'Operations', true, true, 'quarry', '/assets/characters/free-office-pixel-art/worker4.png'),
  ('morrow', 'Morrow', 'Operational process fit', 'Operations', true, true, 'morrow', '/assets/characters/free-office-pixel-art/Julia_PC.png')
on conflict (id) do nothing;

insert into office_presence (agent_id, presence_state, effective_presence_state, critical_task, focus, collaboration_mode)
values
  ('forge', 'active', 'active', true, 'Building the pixel-art virtual office', 'Shipping implementation in the shared office shell'),
  ('northstar', 'available', 'available', false, 'Reviewing seams for future live-state integration', 'Advises structure used by every room'),
  ('prism', 'in_meeting', 'in_meeting', true, 'Holding Phase 1 scope line around shared-office fundamentals', 'Aligns priorities across the office'),
  ('lumen', 'active', 'active', true, 'Making presence and navigation readable at a glance', 'Shapes how the whole office feels to inhabit'),
  ('quarry', 'paused', 'paused', false, 'Waiting after a non-critical reporting pass to save tokens', 'Surfaces metrics when they matter'),
  ('morrow', 'blocked', 'blocked', true, 'Needs live orchestration data to validate process rules end-to-end', 'Keeps the office behavior operationally coherent')
on conflict (agent_id) do nothing;

insert into office_world_entities (agent_id, room_id, anchor_x_pct, anchor_y_pct, facing)
values
  ('forge', 'shipyard', 35, 45, 'down'),
  ('northstar', 'systems-bay', 50, 50, 'down'),
  ('prism', 'planning-studio', 35, 50, 'down'),
  ('lumen', 'planning-studio', 65, 50, 'down'),
  ('quarry', 'signal-room', 35, 45, 'down'),
  ('morrow', 'signal-room', 65, 55, 'down')
on conflict (agent_id) do nothing;

insert into office_decisions (id, title, detail)
values
  ('decision-mvp-scope', 'World-first MVP shell', 'The Virtual Office MVP is a world-first pixel-office shell, not a dashboard.'),
  ('decision-live-state', 'Live office state', 'The office should refresh every few seconds against the central Postgres state backend.')
on conflict (id) do nothing;

commit;

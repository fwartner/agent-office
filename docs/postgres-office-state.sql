-- Postgres groundwork for Forge virtual office live state.
-- Designed to back `/api/office/state` and future realtime subscriptions.

create extension if not exists pgcrypto;

create table if not exists office_rooms (
  id text primary key,
  name text not null,
  team text not null,
  purpose text not null,
  zone_x numeric(5,2) not null,
  zone_y numeric(5,2) not null,
  zone_w numeric(5,2) not null,
  zone_h numeric(5,2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists office_agents (
  id text primary key,
  name text not null,
  role text not null,
  team text not null,
  room_id text not null references office_rooms(id) on update cascade,
  presence text not null check (presence in ('off_hours', 'available', 'active', 'in_meeting', 'paused', 'blocked')),
  focus text not null,
  critical_task boolean not null default false,
  collaboration_mode text not null,
  external boolean not null default false,
  participates_in_office boolean not null default true,
  visible_in_world boolean not null default true,
  sprite_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists office_agent_positions (
  agent_id text primary key references office_agents(id) on delete cascade,
  room_id text not null references office_rooms(id) on delete cascade,
  x_pct numeric(5,2) not null check (x_pct >= 0 and x_pct <= 100),
  y_pct numeric(5,2) not null check (y_pct >= 0 and y_pct <= 100),
  updated_at timestamptz not null default now()
);

create table if not exists office_presence_events (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references office_agents(id) on delete cascade,
  previous_presence text,
  next_presence text not null check (next_presence in ('off_hours', 'available', 'active', 'in_meeting', 'paused', 'blocked')),
  focus text,
  source text not null default 'system',
  observed_at timestamptz not null default now()
);

create or replace view office_state_snapshot as
select
  a.id,
  a.name,
  a.role,
  a.team,
  a.room_id,
  a.presence,
  a.focus,
  a.critical_task,
  a.collaboration_mode,
  a.external,
  a.participates_in_office,
  a.visible_in_world,
  a.sprite_key,
  p.x_pct,
  p.y_pct,
  r.name as room_name,
  r.team as room_team,
  r.purpose as room_purpose,
  r.zone_x,
  r.zone_y,
  r.zone_w,
  r.zone_h,
  greatest(a.updated_at, coalesce(p.updated_at, a.updated_at), r.updated_at) as updated_at
from office_agents a
join office_rooms r on r.id = a.room_id
left join office_agent_positions p on p.agent_id = a.id;

create index if not exists office_agents_room_id_idx on office_agents(room_id);
create index if not exists office_agents_presence_idx on office_agents(presence);
create index if not exists office_presence_events_agent_time_idx on office_presence_events(agent_id, observed_at desc);

-- Realtime-friendly publish step if Supabase/pg logical replication is used later:
-- alter publication supabase_realtime add table office_agents, office_agent_positions, office_rooms, office_presence_events;

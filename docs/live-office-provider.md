# Live office provider seam

This repo now has a minimal provider boundary so the React shell no longer depends directly on hardcoded arrays.

## What changed

- `src/data.ts` still holds the seed snapshot, but now exports a single `OfficeSnapshot` shape.
- `src/office-state.ts` owns data loading through `useOfficeSnapshot()`.
- `src/App.tsx` renders from the provider result instead of importing raw arrays.

## Expected backend contract

Frontend default endpoint: `/api/office/state`

Accepted response shapes:

```json
{
  "snapshot": {
    "agents": [],
    "rooms": [],
    "agentSeats": {},
    "workdayPolicy": {
      "timezone": "Europe/Berlin",
      "days": "Monday-Friday",
      "hours": "09:00-17:00",
      "pauseRule": "...",
      "sharedPlaceRule": "..."
    },
    "source": "postgres",
    "lastUpdatedAt": "2026-03-17T14:00:00.000Z"
  }
}
```

Or the snapshot object directly at the top level.

## Fallback behavior

If `/api/office/state` is unavailable, the UI falls back to the seed snapshot and surfaces the error in the side panel. That means Forge can land backend work incrementally without breaking the current office demo.

## Postgres mapping

Use `docs/postgres-office-state.sql` as the initial schema target.

Recommended API assembly flow:

1. Read `office_rooms`
2. Read `office_agents` filtered by `participates_in_office = true`
3. Join `office_agent_positions`
4. Serialize to `OfficeSnapshot`
5. Mark `source: "postgres"`
6. Set `lastUpdatedAt` from the newest row timestamp in the joined set

## Realtime next step

After the HTTP snapshot works, add one of these without changing `App.tsx` again:

- SSE stream that pushes updated `OfficeSnapshot`
- websocket channel emitting `office_presence_events`
- Supabase realtime subscription and local reducer inside `useOfficeSnapshot()`

The point of this seam is that world rendering can keep evolving while backend/live-state integration happens behind one hook.

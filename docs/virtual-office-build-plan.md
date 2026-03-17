# Virtual Office Build Plan

## Core direction
Build the office as an **external website** connected directly to agents and the wider system, in the spirit of the **Pixel Agents** reference by **pablodelucca**.

This means the product should feel like:
- a living pixel office world
- with visible agent occupants
- with readable activity states
- with tangible orchestration surfaces
- not just a dashboard skinned with pixel art

## Default roster rule
Internal office staff appear by default.

External collaborators or systems may be represented separately, but:
- **Pixel** is external by default
- **Perbra** is external by default
- neither should appear as firm office staff unless explicitly included for a scenario

## Product pillars
1. **World presence** — agents visibly inhabit rooms
2. **Operational legibility** — presence/activity states are instantly readable
3. **Tangible orchestration** — clicking the office should help steer work
4. **Direct assignment** — Flo can assign work to an individual agent from the office UI by free text
5. **Agent creation** — Flo can create new agents from the office UI
6. **Full management** — Flo can manage agents completely from the office UI
7. **Character identity** — every internal office agent has its own visible character in the world
8. **System connection** — website state should come from real agent/system signals over time
9. **Pixel-art authenticity** — final presentation should feel like an office-world, not a generic admin UI

## Character mapping plan
Use the provided character pack as the initial internal-office cast.

Immediate mapping strategy:
- assign a distinct sprite identity to each current internal agent
- use the most distinct available sheets as named defaults
- maintain character assignment as explicit data, not implicit styling

Initial mapping approach:
- `forge` → strong/default builder sprite
- `northstar` → boss/lead-looking sprite if it fits architecture lead posture
- `prism`, `lumen`, `quarry`, `morrow` → distinct worker/Julia variants based on readability and role fit

If the pack has fewer truly distinct bodies than required, use:
- different character sheets where available
- different activity poses/animation sets
- different room placement/context
- minimal tint/accent variation only as a fallback, while keeping recognizability stable

## Admin model
The office must support three administrative layers:
- **world layer**: spatial selection and context
- **inspector layer**: selected-agent actions and quick edits
- **admin layer**: full creation and management surfaces

Minimum data capabilities:
- agent identity and metadata
- team/room assignment
- internal vs external classification
- office participation / visibility
- character identity / sprite assignment
- task assignment and routing
- lifecycle controls

## Creation flow
1. Flo opens **Create agent** from the office HUD/admin entry
2. fills in name, role, team, and basic metadata
3. chooses internal vs external classification
4. decides whether the agent appears in the office world
5. assigns character identity / sprite set
6. assigns initial room/placement if relevant
7. saves into connected provider/system layer
8. new agent appears in admin surfaces and, when appropriate, in the office world

## Management capabilities
Flo must be able to:
- assign tasks by free text
- create agents
- edit agent metadata
- change room/team placement
- control office participation and world visibility
- manage internal vs external classification
- change visible character identity
- update availability/presence-related settings where supported
- enable/disable or otherwise manage lifecycle state
- route assignments into the system/work tracker

## UI placement
- **Office world**: primary navigation and agent selection
- **Agent inspector**: quick actions for selected agent, including assign task, edit basics, and visible character info
- **Admin/creation surfaces**: deeper forms for creating agents and managing all agents comprehensively, including sprite assignment
- **Directory/admin view**: bulk or non-spatial management surface when needed

## Near-term implementation sequence
1. Build shared data-provider layer (`DEV-51`)
2. Introduce office-world scene schema for rooms + agent entities
3. Add explicit character/sprite assignment to the agent world model
4. Replace abstract room cards with asset-backed room scenes
5. Add visible pixel-agent characters into rooms
6. Add selected-agent inspector state and actions
7. Add **Assign task** flow in inspector
8. Add **Create agent** flow and admin panel
9. Connect provider to real agent/runtime/system state and work tracking

## Immediate design constraint
Every new UI decision should be checked against this question:
> Does this make the office feel more like a connected pixel workplace with visible, identifiable agents and operable coordination while still enabling full agent administration?

If not, it should not become the default direction.

# Phase 1 Architecture Notes

## Goal
Establish the interactive virtual office MVP shell as the shared place where all agents work together, with a room-first information architecture, visible presence states, and a rendering layer that can later swap placeholder visuals for final pixel-art assets.

## New hard requirement
The office must now be built in the spirit of the **Pixel Agents** reference by **pablodelucca**:
- visible pixel agents in the world
- clear activity states at the character/world level
- an office-world feel rather than a flat dashboard
- tangible orchestration surfaces that make agent coordination feel operable

At the same time, this must be implemented as an **external website** connected directly to agents and the wider system.

### Staff boundary rule
- **Pixel** and **Perbra** remain **external** by default
- they should not appear as firm office staff unless explicitly included for a scenario or integration surface
- the office defaults to representing the internal working firm, while external collaborators/integrations can be modeled separately

## Core administration requirement
The office must support full agent administration as core product scope. Flo must be able to:
- assign tasks to agents by free text
- create new agents
- manage all agents completely from the office UI

This means the office is not just a world visualization layer. It is also an operational administration surface.

## Character identity requirement
Every internal-firm office agent must have its **own visible character** in the office world.

Character identity is now part of the world model, not an optional visual enhancement. Each agent needs:
- a character/sprite assignment
- visible world presence in the office
- room placement / anchor position
- activity/presence expression through pose, state, or overlay

## Product direction update
The system is now explicitly:
- an **external website**
- a **connected office-world**
- a place where **pixel agents are visible as occupants**
- a place where **state, activity, and orchestration become spatially legible**
- a place where **agent assignment, creation, and management are first-class interactions**

## Current structure
- `src/data.ts`: placeholder domain data for agents, rooms, office workday policy, activity feed, and decisions
- `src/pixelart.ts`: asset manifest and browser-facing integration choices for the provided office tileset
- `src/App.tsx`: shared-office shell composition with effective presence calculation and pixel-art preview surfaces
- `src/styles.css`: placeholder visual system, presence-state styling, responsive layout rules, and pixel-art preview treatment

## Required model layers
- **Domain state**: agents, rooms, presence, workday rules, decisions, activity
- **World state**: room scene, tile layers, agent entities, positions, hotspots
- **Connection state**: live provider data from agents and the wider system
- **Boundary state**: internal staff vs external collaborators/integrations
- **Assignment state**: task routing from office UI into system/work tracking
- **Administration state**: agent creation, configuration, lifecycle, visibility, and role/team metadata
- **Character state**: sprite assignment, animation set, pose/state mapping, and world anchor placement

## Character asset pack
Observed under `assets/characters/free-office-pixel-art`:
- animated/posed **Julia** sheets (`Julia.png`, `Julia-Idle.png`, walking directions, coffee, PC)
- additional character sheets / composites (`worker1.png`, `worker2.png`, `worker4.png`, `boss.png`)
- office furniture/props that can support character scenes (`desk`, `desk-with-pc`, `chair`, `printer`, `coffee-maker`, `partitions`, etc.)

Immediate technical takeaways:
- the pack includes both **character identity sprites** and **support props**
- the Julia assets suggest a reusable animated character format with directional/idle/work variants
- worker/boss sheets provide additional distinct office-character identities
- this is sufficient to start assigning specific visible characters to internal agents immediately, even before a larger bespoke cast exists

## Administration model
Minimum administration surface should support:
- agent identity data (`id`, `name`, `role`, `team`)
- office placement (`room`, world visibility, default position)
- operational state (`presence`, availability policy, paused/off-hours behavior)
- task assignment (`free-text task brief`, priority, routing target)
- lifecycle controls (`create`, `edit`, `enable/disable`, archive/remove where appropriate)
- configuration controls (`participates in office`, internal vs external, default surfaces/actions)
- character controls (`characterId`, sprite set, pose defaults, whether visible in world`)

## UI flow requirement
### Office world
- visible pixel agents occupy rooms
- selecting an agent opens the inspector
- room/world remains the primary navigation surface

### Agent inspector
Primary action surface for a selected agent:
- inspect status
- assign task by free text
- edit core metadata
- manage availability / participation / visibility
- inspect/change character identity
- jump to deeper admin actions

### Admin / creation surfaces
Additional management surfaces layered around the world:
- **Create agent** flow from office HUD/admin entry
- **Agent admin panel** for full editing and lifecycle actions
- **Directory/admin view** for bulk management when world interaction is not the fastest path

## Creation flow
1. Flo opens **Create agent** from office HUD/admin surface
2. enters agent basics (name, role, team)
3. sets office participation and internal/external classification
4. assigns a character identity / sprite set
5. optionally places the agent into a room/world position
6. saves agent into connected system/provider layer
7. new agent becomes available in directory/admin surfaces and, if applicable, appears in the office world

## Management capabilities
Flo must be able to manage agents completely from the office UI, including:
- create agents
- edit metadata
- assign work by free text
- change room/team placement
- control participation in the office world
- manage internal vs external classification
- manage active/paused/off-hours/blocking related configuration where supported
- change visible character identity
- route tasks into the wider system/work tracking

## Planned implementation seams
- Replace static `data.ts` with a live provider backed by vector storage / operational sources
- Add office-world scene schema and visible pixel agents
- Add selected-agent inspector state and admin actions
- Add character assignment into the world/entity model
- Add agent creation surface and administration panel
- Add routing layer for assignments and admin operations into the system/work tracker
- Preserve separation between world rendering and administration logic so UI can evolve without breaking system integrations

## Pixel-art readiness
Presentation must move from generic panels toward a real office-world. Administration surfaces should support the world, not replace it: the office world remains primary, with inspector/admin panels acting as operational overlays.

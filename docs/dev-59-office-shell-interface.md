# DEV-59 — Office Shell Interface and Experience for Virtual Office MVP

## Purpose
Define the interaction shell for the Virtual Office MVP so engineering can build against a clear interface model.

This shell is for a **live pixel-office world**, not a generic dashboard.

## Shell principles
1. **World first** — the office map/world is the primary surface.
2. **Agent persistence** — agents and their state remain legible even while navigating.
3. **Operational clarity** — assignment, inspection, and status must be immediate.
4. **Continuous pulse** — activity and decisions should feel live.
5. **Admin-capable** — the shell must support inspection, assignment, creation, and management.

## Top-level shell model

### 1. Global navigation / office frame
Persistent frame around the office world:
- **Top bar**
  - office title
  - live sync indicator
  - Berlin office-hours status
  - global actions: create agent, admin, filters
- **World viewport**
  - the primary office/map surface
- **Right inspector rail**
  - context-sensitive detail for selected room or agent
- **Optional bottom activity strip / log**
  - live updates, decisions, routing feedback

This structure keeps the world central while preserving administrative operability.

### 2. Primary room/map surface
The main viewport should always be the office world.

Requirements:
- visible rooms / zones
- visible pixel agents inhabiting the office
- click/select interaction on agents and rooms
- room labels should support navigation, not replace the map
- map remains the MVP homepage shell

### 3. Persistent agent/status layer
Agent status should remain perceptible without leaving the world.

Persistent cues:
- visible pixel characters in rooms
- presence indicators on/near characters
- lightweight roster or status summary in the side shell
- selection state that survives shell interaction

Primary agent states:
- active
- paused
- blocked
- in meeting
- available
- off hours

### 4. Activity + decision surfaces
These should not dominate the interface, but must remain accessible and live.

Recommended pattern:
- **activity strip / log** as a persistent secondary surface
- **decision surface** as an inspector section or dedicated tab in the side rail
- updates should reflect assignments, state changes, and relevant office/system events

## UX flow priorities

### Primary everyday flow
1. open office
2. scan world state
3. select agent
4. inspect context
5. assign task / manage agent
6. observe update in activity log and state changes

### Secondary navigation flow
1. select room
2. inspect room/team context
3. identify active or blocked agents
4. jump into agent inspection/administration

### Admin flow
1. create agent from global action
2. configure identity / team / office participation / character
3. place into room/world
4. manage from inspector/admin surfaces thereafter

## MVP shell sections
- **Homepage / office map shell** → main world viewport
- **Agent directory** → roster/admin support surface, not primary homepage replacement
- **Team / room view** → derived from room selection in the world
- **Task / status view** → agent inspector + status layer
- **Update feed** → persistent log surface
- **Decision log** → inspector/admin-adjacent surface

## Engineering-aligned component model
- `OfficeWorldPage`
  - `OfficeTopBar`
  - `OfficeWorldViewport`
    - `RoomLayer`
    - `AgentLayer`
    - `HotspotLayer`
  - `OfficeInspectorRail`
    - `AgentInspector`
    - `RoomInspector`
    - `AssignmentPanel`
    - `AdminPanel`
  - `OfficeActivityLog`

## Explicit anti-patterns
Do **not** default to:
- dashboard card grids as the main experience
- directory-first landing pages
- separate admin pages that bypass the office world entirely
- pixel art as decoration around a standard admin layout

## Delivery outcome for engineering
Engineering should build the MVP shell as:
- a central office-world viewport
- persistent contextual inspection
- direct agent interaction
- live operational feedback
- admin/assignment overlays attached to the world model

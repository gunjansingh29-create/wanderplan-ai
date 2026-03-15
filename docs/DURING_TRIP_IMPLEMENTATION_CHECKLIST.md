# During-Trip Flow Implementation Checklist

This checklist translates the during-trip concept into the current WanderPlan architecture.

It is intentionally based on:
- [src/WanderPlanLLMFlow.jsx](C:/Users/gunja/OneDrive/Coding%20Projects/wanderplan-ai/src/WanderPlanLLMFlow.jsx)
- [agents/orchestrator.py](C:/Users/gunja/OneDrive/Coding%20Projects/wanderplan-ai/agents/orchestrator.py)

It is not based on applying the patch blocks from `files/` directly.

## Scope

First slice only:
- define when a trip becomes `active`
- expose an `Open Live Companion` entry point from `trip_detail`
- add a minimal `companion` screen
- use existing trip/planning data wherever possible
- add tests for the status gate and entry point

Out of scope for this slice:
- `storyboard`
- `security`
- `sos`
- expenses
- adapter registry / new integration layer

## Current Architecture Anchors

Frontend:
- screen navigation via `sc` / `go(...)` in `WanderPlanLLMFlow`
- trip detail screen already exists
- confirmed wizard step already exists

Backend:
- trip lifecycle currently starts in `planning`
- trip and member payloads already support organizer/member state
- planning state is already stored in `trip_planning_states`

## Decision: Active Trip Gate

We need one canonical rule for when a trip is considered "during trip".

Recommended rule:
- set trip `status = "active"` when the trip is fully confirmed and the final itinerary/dates are locked

Checklist:
- [ ] confirm the exact frontend action that represents final trip confirmation
- [ ] update backend trip status when that action completes
- [ ] make sure the resulting trip payload returns `status: "active"`
- [ ] keep `completed` reserved for post-trip state

Notes:
- do not rely on `saved`, `invited`, or `planning` as during-trip states
- do not infer "active" only from frontend step number

## Phase 1: Frontend Entry Point

Goal:
- allow users to enter the during-trip companion from `trip_detail`

Checklist:
- [ ] add a new screen key: `companion`
- [ ] add `Open Live Companion` button in `trip_detail`
- [ ] show the button only when `tr.status === "active"`
- [ ] keep existing `Continue Planning` behavior for `planning` trips
- [ ] decide whether `completed` trips should get a read-only companion entry in a later phase

Implementation notes:
- add this to the existing action area in `trip_detail`
- do not change the dashboard card routing yet
- do not add separate top-nav items for this slice

## Phase 2: Minimal Companion Screen

Goal:
- ship one useful during-trip screen without introducing large new state systems

Screen contents for v1:
- [ ] trip name
- [ ] locked date range
- [ ] destinations
- [ ] crew list
- [ ] today's itinerary or current itinerary summary
- [ ] quick return path back to `trip_detail`

Behavior:
- [ ] read from current trip + planning state first
- [ ] avoid introducing chat, SOS, or live map in v1
- [ ] keep the screen mostly read-only

Suggested sections:
1. Header
2. Today
3. Upcoming
4. Crew
5. Trip snapshot

## Phase 3: Backend Payload Support

Goal:
- support companion rendering with a stable backend payload

Preferred approach:
- first try to reuse `GET /trips/{trip_id}` plus planning state
- if that becomes too fragmented, add a focused companion endpoint

Option A: reuse current endpoints
- [ ] verify `GET /trips/{trip_id}` returns enough trip/member metadata
- [ ] verify planning state contains itinerary and locked dates
- [ ] build companion using those existing calls

Option B: add focused endpoint
- [ ] add `GET /trips/{trip_id}/companion`
- [ ] include:
  - trip id
  - trip name
  - status
  - locked date window
  - destinations
  - members
  - itinerary summary / today items
- [ ] enforce accepted-member access only

Decision rule:
- use Option A if data assembly is simple
- use Option B if frontend starts stitching too many sources together

## Phase 4: Status Transition Wiring

Goal:
- ensure the companion is discoverable at the right time

Checklist:
- [ ] identify the exact frontend approval handler that ends the planning flow
- [ ] ensure it updates trip status in backend
- [ ] refresh trip detail and trip list after the status change
- [ ] confirm `trip_detail` shows the active badge and companion entry after refresh

Regression risks:
- trip remains `planning` even after confirmation
- trip becomes `active` too early
- organizer screen updates but crew screen remains stale

## Tests

Frontend tests:
- [ ] `trip_detail` hides companion button for `planning`
- [ ] `trip_detail` shows companion button for `active`
- [ ] clicking companion button moves `sc` to `companion`
- [ ] companion screen renders trip summary from current trip data

Backend tests:
- [ ] confirmed trip can transition to `active`
- [ ] non-members cannot access companion payload
- [ ] accepted members can access companion payload
- [ ] `planning` trips do not accidentally expose active-only actions

Integration tests:
- [ ] organizer confirms trip
- [ ] trip status becomes `active`
- [ ] organizer opens companion from trip detail
- [ ] crew member sees same trip as active after refresh

## Explicit Non-Goals For This Slice

Do not implement yet:
- [ ] storyboard generation
- [ ] privacy/security export UI
- [ ] SOS/live location
- [ ] expense tracking
- [ ] separate adapter registry framework

Those can be layered after the companion entry point is stable.

## Open Design Decisions

These need an explicit decision before coding deeper slices:

1. What exact user action marks planning as complete?
- itinerary approval only
- final confirm screen
- another organizer lock event

2. When does a trip become `completed`?
- manually by organizer
- after end date passes
- after a post-trip closeout action

3. Should companion be read-only for crew in v1?
- recommended: no, but keep v1 mostly read-only for everyone

## Recommended Build Order

1. Backend status transition to `active`
2. Frontend `trip_detail` companion entry
3. Minimal `companion` screen
4. Companion payload cleanup if existing endpoints are insufficient
5. Tests

## Success Criteria

This slice is done when:
- a fully confirmed trip becomes `active`
- `trip_detail` exposes `Open Live Companion`
- organizer and crew can enter the same companion screen
- the companion screen shows locked trip context using real trip data
- tests cover the new status and entry-point behavior

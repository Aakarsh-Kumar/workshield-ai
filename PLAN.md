# Make Location Intelligence Visible End-to-End

## Summary
The repo already contains much of the planned location engine: GPS ingestion, hazard-zone models/routes, risk multiplier logic, AI multiplier support, and dashboard-side background tracking. The reason the feature is not visibly “implemented” is that most of it is still backend-only or silent:
- worker UI only shows a tiny tracking dot
- quote/policy UI does not surface location risk multiplier or matched zones
- admin UI has no hazard-zone or hazard-event controls
- frontend types/API helpers do not model the new location responses
- repo health issues are currently masking progress (`UU` merge state in tracked files and a malformed `GEMINI_API_KEY` compose entry)

This plan should make the feature visible for both workers and admins, while preserving the existing backend behavior.

## Key Changes
### 1. Stabilize the current branch so the feature can actually be seen
- Resolve and stage the existing Git conflict state in `backend/app.js`, `client/src/app/dashboard/page.tsx`, and `docker-compose.yml`.
- Fix `docker-compose.yml` env interpolation for Gemini so Compose parsing/runtime is not polluted by a literal key in the `${...}` slot.
- Rebuild backend/client after conflict cleanup before validating any location feature behavior.

### 2. Expose location intelligence in worker-facing UI
- Extend the frontend quote response model in `client/src/lib/apiClient.ts` so `/api/policies/quote` returns:
  - `premium`
  - `currency`
  - `locationRiskMultiplier`
  - `hazardZonesDetected`
  - optional explanatory note
- Update `client/src/app/policies/new/page.tsx` to render a visible “Location impact” section after quote fetch:
  - show whether location increased premium or stayed neutral
  - show the multiplier value
  - show detected hazard zones by name/type when present
  - show a neutral fallback message when no recent pings exist
- Update the worker dashboard to replace the tiny implicit tracking dot with an explicit status card or strip:
  - tracking permission state
  - tracking active/inactive
  - sync status/detail
  - simple explanation that location improves zone-based pricing and disaster validation
- Keep tracking optically lightweight, but visible enough that a reviewer can tell the feature exists without opening devtools.

### 3. Add admin-visible controls for hazard zones and hazard events
- Add location admin API helpers in `client/src/lib/apiClient.ts` for:
  - list hazard zones
  - upsert hazard zone
  - validate worker in zone
  - process hazard event
- Extend `client/src/app/team2/ops/page.tsx` with a dedicated “Location intelligence” section:
  - hazard zone list/table
  - create/update hazard zone form
  - hazard event trigger form
  - optional worker-in-zone validator form for manual ops verification
- The admin page should show action results directly in the UI so the proactive payout flow is demonstrably present.

### 4. Close the interface gaps between backend and frontend
- Keep the current backend location APIs as the source of truth; do not invent new endpoints unless a missing UI action truly requires one.
- Normalize the shape the frontend depends on:
  - quote response fields from `policyController.getQuote`
  - hazard zone list/create response shapes from `locationController`
  - hazard event execution result shape from `proactivePayoutService`
- Surface `evaluationMeta.zoneValidation` anywhere claims are already displayed if feasible without major redesign; otherwise keep it for admin/claim detail follow-up, not v1 worker dashboard.
- Preserve the current background GPS ingestion design: no manual worker control panel unless required for permission/debug visibility.

## Test Plan
- Repo health:
  - `git status` shows no unresolved merge state
  - Compose parses and services start cleanly
- Worker flow:
  - login succeeds
  - dashboard visibly shows tracking status/permission state
  - quote screen shows neutral location pricing before pings or when outside zones
  - quote screen shows elevated multiplier and detected zones after seeded in-zone pings
- Admin flow:
  - admin can list/create/update hazard zones
  - admin can submit a hazard event and receive affected-worker / claims-created results
  - optional zone validation tool returns visible `inZone` result for a worker/time window
- Integration checks:
  - backend quote response includes multiplier + detected zones
  - policy creation still succeeds with multiplier threaded through
  - proactive payout continues to reuse existing trigger pipeline
- Regression checks:
  - dashboard, policy purchase, claims, and Team2 ops still load without location data
  - geolocation denied/unavailable path degrades gracefully and does not block normal app use

## Assumptions
- The intended feature from `implementation_plan.md` is the location-based intelligence engine, and the missing requirement is visible product proof, not core backend capability.
- Recommended visible scope is both worker and admin:
  - worker sees pricing/tracking impact
  - admin sees hazard-zone/event tooling
- Existing backend location routes and services are the implementation base; the main missing work is UI integration, response typing, and branch stabilization.
- No schema redesign is needed unless implementation uncovers a real incompatibility; current `LocationPing`, `HazardZone`, and risk multiplier approach are accepted as-is for v1 visibility.

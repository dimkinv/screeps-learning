## Summary

This commit adds the first chapter (Harvesting & Energy Management) of a beginner-friendly Screeps wrapper library
and the minimal project scaffolding required to use it in a TypeScript Screeps project.

- Files added in `src/`:
  - `roles.ts` — `Role` enum (`Harvester`, `Worker`, `Soldier`).
  - `status.ts` — `ActionStatus` enum used as the wrapper's return/status values.
  - `simpleCreep.ts` — `SimpleCreep` class implementing Chapter 1 APIs:
    - `findClosestSource()`
    - `harvest(source)`
    - `full()`, `empty()`, `needsEnergy()`
    - `isNear(target)`, `moveTo(target)` (simple wrappers)
    - `transferEnergyTo(target)`, `withdraw(target)`
    - `deliverEnergyToBase()` (priority: spawn → extensions → towers → containers/storage)
    - role helpers: `getRole()`, `setRole()`, `is(role)`
  - `index.ts` — library re-exports.
  - `loop.ts` — small example `module.exports.loop` demonstrating a harvester using the wrapper.
  - `populationManager.ts` — `PopulationManager` singleton providing spawning & population helpers:
    - `buildCreep(role: Role)` — deterministic body selection and spawn request
    - `canBuildCreep(role: Role)` — whether spawn is free and minimal body can be built
    - `getCreepCount(role: Role)` — count creeps by role
    - `maintainCreepsAtRole(role: Role, targetCount: number)` — ensure target count for a single role
    - `maintainPopulation(targets)` — maintain multiple roles in one call
    - `getQueuedSpawns()` — report currently spawning jobs
    - `forEachCreepOfRole(role, handler)` — convenience iterator calling handler with `SimpleCreep`

- Other:
  - `README.md` — brief usage summary and file list.

Design notes and assumptions for the next agent
- The wrapper targets a single-room, single-spawn teaching scenario (v1) and intentionally keeps APIs
  small and predictable so learners write the decision logic themselves.
- Movement uses `creep.moveTo` with default options; no advanced path tuning (swamps/roads) yet.
- `ActionStatus` maps high-level outcomes (e.g., `MOVING`, `HARVESTING`, `EMPTY`, `NO_TARGET`)
  rather than surfacing Screeps numeric error codes directly.
- `deliverEnergyToBase()` uses simple room-local prioritization and walks the common structure types.

Recommended next steps for the follow-up agent
- Add TypeScript build validation (run `tsc`) and fix any typing issues that appear during compile.
- Implement the remaining documentation task (finish `README.md` with example code for learners).
- Add tests or a small tick simulator harness to validate behavior of `SimpleCreep` methods.
- Consider exposing small configuration (e.g., `deliverEnergyToBase` priorities) and improving
  `moveTo` options for more predictable pathing.

If you want, I can run a TypeScript check and fix any compile errors next, and then wire this into
your build pipeline or a test harness.

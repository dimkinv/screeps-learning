# Screeps Teaching Wrapper Library (Read-Only Overview)

This repository hosts a TypeScript-first wrapper around the Screeps API meant for beginners (single-room, single-spawn focus). The goal is to simplify common tasks like harvesting, delivering energy, logistics, and maintaining creep populations while keeping terminology close to the base game so learners can transition smoothly.

## Repository layout
- `src/simpleCreep.ts` — `SimpleCreep` class with harvesting, movement, safety, logistics (pickup/withdraw/store/fill), and utility helpers built on top of the Screeps creep API.
- `src/populationManager.ts` — `PopulationManager` singleton that chooses deterministic creep bodies per role, tracks spawn queues, and maintains population targets.
- `src/roles.ts` — `Role` enum (`Harvester`, `Worker`, `Soldier`) used to label creep behavior.
- `src/status.ts` — `ActionStatus` enum returned by wrapper methods to indicate high-level outcomes (movement, harvesting, transfers, pickups, etc.).
- `src/loop.ts` — Example `module.exports.loop` showing how to wire the wrapper into a game tick.
- `src/index.ts` / `src/main.ts` — Re-exports to consume the library from a Screeps project entry point.
- `SCREEPS.API.md` and `instructions/SCREEPS.API.md` — Quick references for common Screeps types and APIs while working with the wrapper.

## How to use the wrapper
1. Copy the `src/` files into your Screeps TypeScript project (or import them from this package if published).
2. In your `module.exports.loop`, instantiate `SimpleCreep` for existing creeps and call helpers like `findClosestTarget()` (для поиска источников/контроллера/хранилищ), `harvest()`, `pickupOrWithdrawEnergy()`, `deliverEnergyToBase()`, и утилиты перемещения (`moveTo`, `moveNear`, `stayAwayFrom`). Действия теперь не двигают крипа автоматически — сначала выберите цель и сблизьтесь, затем вызывайте действие.
3. Use logistics helpers to fill spawn/extensions (`fillExtensionsAndSpawn`), stash overflow (`storeEnergyInContainers`), and inspect store state (`getEnergyLevel`, `getEnergyCapacity`). Боевые вызовы разделены на поиск цели (`findClosestHostile`) и отдельные действия (`attackHostile`, `rangedAttackHostile`).
4. Use `PopulationManager` to maintain roles: call `maintainPopulation` with target counts, inspect `getQueuedSpawns()` to track spawn jobs, and iterate role-specific creeps with `forEachCreepOfRole`.
5. Roles are stored on `creep.memory.role`; use `setRole`, `is(Role.Worker)`, `remember`, and `recall` to keep behavior and state consistent. You can also dispatch handlers per role with `runRole` or attach tick callbacks via `onTick`/`runTickHandlers`.

## Design notes
- APIs favor clarity over optimization: movement uses straightforward `moveTo` calls and path visualization; advanced tuning is intentionally out of scope for this chapter.
- The wrapper returns descriptive `ActionStatus` values instead of raw Screeps error codes to make decision logic easier for new players.
- Energy delivery prioritizes the common early-game structures (spawn → extensions → towers → containers/storage) and assumes all interactions happen within one room.

## Next steps for learners
- Extend `SimpleCreep` with building, upgrading, or combat behaviors using the same status pattern.
- Add TypeScript compilation checks (`tsc`) and tests/simulations to validate behavior as you expand the wrapper.
- Experiment with tweaking `PopulationManager` body selection or adding per-room configuration as your base grows.

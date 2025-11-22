# Screeps Teaching Wrapper Library – Requirements

## Purpose

Design a high-level wrapper library around the Screeps API to make it easier for a 12-year-old beginner to program creeps. The wrapper should:

* Expose a small, intuitive set of methods grouped by behavior category.
* Hide low-level Screeps details (paths, multi-room, edge cases) in early versions.
* Keep naming and mental models close to the official Screeps API to ease later transition.
* Target a **single-room, single-spawn** environment for the first iteration.

This document specifies the high-level behaviors and method contracts for the wrapper. Implementation details are left to the coding agent.

## Scope and Constraints

* Scope: One room, one spawn (e.g., `Game.spawns.Spawn1`). Multi-room mechanics are intentionally hidden in v1.
* Target entity: `Creep` wrapper (primary). Support types: `Source`, `StructureSpawn`, `StructureExtension`, `StructureController`, `StructureTower`, `StructureContainer`, `StructureStorage`, `RoomPosition`.
* Tick model: Standard Screeps `module.exports.loop` environment.
* Language target: **TypeScript only**. All library code, public types, and examples must be written in TypeScript. Roles, status codes, and other categorical labels must use TypeScript `enum` (or equivalent literal union types), not free-form strings.

## Core Design Principles

1. **Beginner-friendly surface**: Few parameters, clear names, boolean helpers.
2. **Predictable behavior**: Methods should avoid surprising side effects and return clear result states.
3. **Soft abstraction**: Underlying Screeps concepts (store, room, sources, controller) should remain visible in method descriptions and types.
4. **Progressive disclosure**: Advanced options (paths, range tuning, costs) can be added later via optional parameters.

---

## Categories and Methods Overview

### 1. Harvesting & Energy Management

Wrapper methods that help a creep find, harvest, and deliver energy, while hiding low-level lookup and conditions.

#### `harvest(source)`

* **For**: Creep wrapper.
* **Purpose**: Directly harvest from a specific source.
* **Behavior**:

  * If creep is not adjacent to the source, returns a status such as `"NOT_IN_RANGE"`.
  * If adjacent, attempts to harvest and returns `"HARVESTING"`.
  * If the harvest action fails, return an appropriate error status code.
* **Notes**: This method provides the primitive needed for teaching explicit logic (`isNear`, `moveTo`, `harvest`).

Wrapper methods that help a creep find, harvest, and deliver energy, while hiding low-level lookup and conditions.

#### 1.1 `findClosestSource()`

* **For**: Creep wrapper.
* **Purpose**: Return the nearest accessible energy source in the current room.
* **Behavior**:

  * Uses creep position and room sources to select the closest by range.
  * Ignores sources that are obviously blocked/unreachable if cheaply detectable.
* **Returns**: A `Source` or `null` if none found.
* **Notes**: Multi-room is never considered in v1.

#### 1.2 `full()`

* **For**: Creep wrapper.
* **Purpose**: Check if the creep’s energy store is full.
* **Behavior**: Returns `true` when no more energy can be carried.
* **Returns**: `boolean`.
* **Notes**: Convenience wrapper for `store.getFreeCapacity(RESOURCE_ENERGY) === 0`.

#### 1.3 `empty()`

* **For**: Creep wrapper.
* **Purpose**: Check if the creep has no energy.
* **Behavior**: Returns `true` when creep has zero energy.
* **Returns**: `boolean`.

#### 1.4 `needsEnergy()`

* **For**: Creep wrapper.
* **Purpose**: Simple alias for `!full()` to support more readable code for kids.
* **Behavior**: Same as `!full()`.
* **Returns**: `boolean`.

#### 1.5 *(reserved — intentionally removed)*

This slot is intentionally left unused. High-level combined harvesting behaviors are avoided in v1 to ensure the learner writes the explicit logic:

* Find a source
* Check if the creep is near
* Move if needed
* Harvest when adjacent
* Check if full and react accordingly

The wrapper should only provide the primitives required for this sequence (`findClosestSource`, `isNear`, `moveTo`, `harvest`, `full`). | "MOVING" | "HARVESTING" | "FULL" | "ERROR"`).

#### 1.6 `transferEnergyTo(target)`

* **For**: Creep wrapper.
* **Purpose**: Transfer energy to a target structure (spawn, extension, tower, container, etc.).
* **Behavior**:

  * If not adjacent to `target`, moves toward it and returns `"MOVING"`.
  * If adjacent and creep has energy, calls transfer and returns `"TRANSFERRING"`.
  * If creep has no energy, returns `"EMPTY"`.
* **Returns**: Status code representing result.

#### 1.7 `withdraw(target)`

* **For**: Creep wrapper.
* **Purpose**: Withdraw energy from a container, storage, or similar structure.
* **Behavior**:

  * If creep is not adjacent to the target, returns `"NOT_IN_RANGE"`.
  * If adjacent and the target contains energy, attempts to withdraw and returns `"WITHDRAWING"`.
  * If the withdraw action fails or the target has no energy, returns an appropriate error status.

#### 1.8 `deliverEnergyToBase()`

* **For**: Creep wrapper.
* **Purpose**: High-level behavior to deliver energy to the “best” structure in the base.
* **Behavior**:

  * Chooses a target in priority order (e.g., spawn → extensions → tower → storage/container).
  * Moves and transfers energy using `transferEnergyTo` semantics.
* **Returns**: Status code (e.g., `"NO_TARGET" | "MOVING" | "TRANSFERRING" | "EMPTY"`).

---

### 2. Movement & Positioning

Wrapper methods to simplify all common movement use cases, while hiding pathfinding options and multi-room coordinates.

#### 2.1 `moveTo(target)`

* **For**: Creep wrapper.
* **Purpose**: Move the creep toward a room object or position.
* **Behavior**:

  * Accepts `RoomObject` or `RoomPosition`.
  * Uses reasonable defaults for pathfinding.
  * In v1, no special tuning for swamps or roads.
* **Returns**: Status code (e.g., `"MOVING" | "ALREADY_THERE" | "NO_PATH"`).

#### 2.2 `isNear(target, range = 1)`

* **For**: Creep wrapper.
* **Purpose**: Check if the creep is within a given range of a target.
* **Behavior**:

  * Default range is 1 (adjacent).
  * Uses underlying `inRangeTo` or distance comparison.
* **Returns**: `boolean`.

#### 2.3 `moveNear(target)`

* **For**: Creep wrapper.
* **Purpose**: Move creep toward a target until within range 1.
* **Behavior**:

  * If already `isNear(target)`, returns `"ALREADY_NEAR"` and does nothing.
  * Otherwise, tries to move and returns `"MOVING"` or `"NO_PATH"`.

#### 2.4 `stayAwayFrom(target, distance)`

* **For**: Creep wrapper.
* **Purpose**: Simple “kite” behavior to keep distance from a target (e.g., hostile creep).
* **Behavior**:

  * If current range is less than `distance`, attempts a step away.
  * If range is >= `distance`, does nothing.
* **Returns**: Status code (e.g., `"RETREATING" | "SAFE" | "NO_PATH"`).

#### 2.5 `moveToFlag(name)` (optional in v1)

* **For**: Creep wrapper.
* **Purpose**: Move creep to a named flag within the same room.
* **Behavior**:

  * Locates `Game.flags[name]` in current room.
  * Moves as in `moveTo`.
* **Returns**: Status code.
* **Notes**: Only use if flags are part of the teaching plan.

#### 2.6 `goHome()`

* **For**: Creep wrapper.
* **Purpose**: Move creep to a home position (e.g., spawn or stored `RoomPosition`).
* **Behavior**:

  * Uses a predefined home position (resolved at wrapper creation or passed in).
  * Moves using `moveTo` semantics.
* **Returns**: Status code.

#### 2.7 `isAt(position)`

* **For**: Creep wrapper.
* **Purpose**: Check if creep is standing exactly on a given `RoomPosition`.
* **Behavior**: Compares `x`, `y`, and `roomName`.
* **Returns**: `boolean`.

---

### 3. Upgrading, Building, and Repairing

High-level methods for interacting with the controller and construction/repair tasks.

#### 3.1 `upgradeController()`

* **For**: Creep wrapper.
* **Purpose**: Single-room upgrade behavior toward the room’s controller.
* **Behavior**:

  * If creep has no energy, returns `"EMPTY"`.
  * If not near controller, moves toward it and returns `"MOVING"`.
  * If near, calls `upgradeController` and returns `"UPGRADING"`.
* **Returns**: Status code.

#### 3.2 `buildClosestSite()`

* **For**: Creep wrapper.
* **Purpose**: Find and build the nearest construction site.
* **Behavior**:

  * Finds all construction sites in the room.
  * Picks closest by range.
  * Moves and builds similarly to `harvestFromClosestSource` behavior: `"NO_SITE" | "MOVING" | "BUILDING" | "EMPTY"`.

#### 3.3 `repairClosestDamagedStructure()`

* **For**: Creep wrapper.
* **Purpose**: Repair the nearest damaged structure.
* **Behavior**:

  * Finds structures below a defined health threshold.
  * Picks closest by range.
  * Moves and repairs and returns status codes like `"NO_TARGET" | "MOVING" | "REPAIRING" | "EMPTY"`.

#### 3.4 `hasWork()`

* **For**: Creep wrapper.
* **Purpose**: High-level question: does this creep have some available task (build, repair, upgrade) in the room?
* **Behavior**:

  * Returns `true` if any of: there is a construction site, a damaged structure, or controller below max level.
* **Returns**: `boolean`.

#### 3.5 `doWork()`

* **For**: Creep wrapper.
* **Purpose**: High-level behavior to choose and perform the “best” work task.
* **Behavior** (sample default priority):

  * If there is any construction site: use `buildClosestSite()`.
  * Else if damaged structures exist: use `repairClosestDamagedStructure()`.
  * Else: use `upgradeController()`.
* **Returns**: Status code from the chosen action.
* **Notes**: The agent should keep behavior simple and explainable for a child.

#### 3.6 `buildAt(position)` (optional in v1)

* **For**: Higher-level API or planning; may be beyond first lessons.
* **Purpose**: When the player has created a construction site at a position, this method commands the creep to build that specific site.
* **Behavior**:

  * Locates site at/near position and builds.
* **Returns**: Status code.

#### 3.7 `repair(target)`

* **For**: Creep wrapper.
* **Purpose**: Direct repair of a known structure target.
* **Behavior**: Moves to range and calls repair, similar to `repairClosestDamagedStructure` but with explicit target.
* **Returns**: Status code.

---

### 4. Fighting & Defense

Basic combat helpers, kept simple for teaching. In a first teaching phase, combat can be skipped or made optional; still defined here for the agent.

#### 4.1 `attackClosestHostile()`

* **For**: Creep wrapper (melee creep).
* **Purpose**: Basic auto-targeting melee attack.
* **Behavior**:

  * Finds closest hostile creep in room.
  * If none: returns `"NO_TARGET"`.
  * If not adjacent: moves toward target and returns `"MOVING"`.
  * If adjacent: calls `attack` and returns `"ATTACKING"`.

#### 4.2 `rangedAttackClosestHostile()`

* **For**: Ranged creep wrapper.
* **Purpose**: Simple ranged attack behavior.
* **Behavior**:

  * Finds closest hostile creep.
  * If within range 3: calls `rangedAttack` and returns `"ATTACKING"`.
  * If too far: moves toward and returns `"MOVING"`.

#### 4.3 `kiteHostile()`

* **For**: Ranged creep wrapper.
* **Purpose**: Move away from hostile while trying to keep in ranged attack distance.
* **Behavior**:

  * If hostile is too close (e.g., range ≤ 2), use `stayAwayFrom`.
  * If at safe distance, allow attacks.
* **Returns**: Status code (e.g., `"RETREATING" | "ATTACKING" | "NO_TARGET"`).

#### 4.4 `healSelfIfNeeded()`

* **For**: Creep wrapper with `HEAL` parts.
* **Purpose**: Simple self-heal behavior.
* **Behavior**:

  * If creep is damaged, calls `heal` on itself.
  * Returns `"HEALING"` or `"HEALTHY"`.

#### 4.5 `towerDefendBase(tower)`

* **For**: Helper function (not bound to creep), still part of the teaching library.
* **Purpose**: High-level behavior for a tower to defend the room.
* **Behavior**:

  * If hostiles exist: attack closest hostile.
  * Else if critical damaged structure exists: repair.
  * Else if injured friendly creeps exist: heal.
* **Returns**: Status code (e.g., `"ATTACK" | "REPAIR" | "HEAL" | "IDLE"`).

#### 4.6 `hasHostilesInRoom()`

* **For**: Room-level helper.
* **Purpose**: Simple boolean to check if room is under threat.
* **Behavior**: Returns `true` if any hostile creeps in room.

#### 4.7 `fleeToBase()`

* **For**: Creep wrapper.
* **Purpose**: Panic/retreat behavior when hostiles are nearby.
* **Behavior**:

  * Moves creep toward home base position.
  * Optional: Use `stayAwayFrom` relative to closest hostile.
* **Returns**: Status code.

---

### 5. Resource Logistics and Storage

Helpers to move energy between containers, storage, and structures.

#### 5.1 `findEnergyDropOrContainer()`

* **For**: Creep wrapper.
* **Purpose**: Find the best non-source place to pick up energy (dropped energy, container, storage).
* **Behavior**:

  * Prioritize: dropped energy near base → containers with energy → storage.
  * Returns the chosen target or `null`.

#### 5.2 `pickupOrWithdrawEnergy()`

* **For**: Creep wrapper.
* **Purpose**: High-level method to obtain energy from either dropped resources or structures.
* **Behavior**:

  * Uses `findEnergyDropOrContainer`.
  * If target is dropped energy: moves and picks up.
  * If container/storage: moves and withdraws.
* **Returns**: Status code (e.g., `"NO_TARGET" | "MOVING" | "PICKING_UP" | "WITHDRAWING" | "FULL"`).

#### 5.3 `fillExtensionsAndSpawn()`

* **For**: Creep wrapper.
* **Purpose**: Deliver energy to spawn and extensions in a simple prioritized way.
* **Behavior**:

  * Find spawn/extensions that are not full.
  * Pick closest; move and transfer.
* **Returns**: Status code (e.g., `"NO_TARGET" | "MOVING" | "TRANSFERRING" | "EMPTY"`).

#### 5.4 `storeEnergyInContainers()`

* **For**: Creep wrapper.
* **Purpose**: Deliver energy overflow into containers or storage.
* **Behavior**:

  * Choose closest container/storage with free capacity.
  * Move and transfer.
* **Returns**: Status code.

#### 5.5 `hasRoomForEnergy()`

* **For**: Creep wrapper.
* **Purpose**: Check if creep has any free capacity left for energy.
* **Behavior**: Convenience wrapper for `!full()`.
* **Returns**: `boolean`.

#### 5.6 `getEnergyLevel()`

* **For**: Creep wrapper.
* **Purpose**: Simplified numeric indicator of current energy.
* **Behavior**:

  * Returns an integer representing current energy carried.
* **Returns**: `number`.

#### 5.7 `getEnergyCapacity()`

* **For**: Creep wrapper.
* **Purpose**: Total energy capacity of creep for teaching resource concepts.
* **Behavior**: Returns integer capacity.
* **Returns**: `number`.

---

### 6. Utility, Roles, and State Helpers

Small helpers to organize code, make main loop cleaner, and manage simple role logic in a child-friendly way.

TypeScript-specific requirements for roles:

* There must be a `Role` enum (or string-literal union type) that enumerates all supported creep roles, e.g. `Role.Harvester`, `Role.Worker`, `Role.Soldier`, etc.
* Public APIs must accept and return `Role` values instead of raw strings.

Small helpers to organize code, make main loop cleaner, and manage simple role logic in a child-friendly way.

#### 6.1 `getRole()` / `setRole(role: Role)`

* **For**: Creep wrapper.
* **Purpose**: Access and modify the creep’s simple text role (e.g., `"harvester"`, `"builder"`).
* **Behavior**:

  * Persist role in creep memory (implementation detail left to agent).
  * `getRole()` returns a `Role` value or `null` if unset.

#### 6.2 `is(role: Role)`

* **For**: Creep wrapper.
* **Purpose**: Shorthand for checking creep role.
* **Behavior**: Returns `true` if the creep’s stored `Role` matches the given `role` value.

#### 6.3 `runRole()`

* **For**: Higher-level library function.
* **Purpose**: Dispatch to a role function map (e.g., `"harvester" → harvester behavior`).
* **Behavior**:

  * Implementation uses an internal mapping from role names to behavior functions.
  * Intended as an optional teaching tool, not mandatory.

#### 6.4 `remember(key, value)` / `recall(key)`

* **For**: Creep wrapper.
* **Purpose**: Simple API to store and retrieve creep-specific state in memory.
* **Behavior**:

  * Wraps `creep.memory[key]` reads/writes with type-safe or at least safe-access logic.

#### 6.5 `logStatus(message)`

* **For**: Library-level helper.
* **Purpose**: Simple logging for teaching program introspection.
* **Behavior**:

  * Prefixes log lines with creep name and role.
  * Example output: `"[Harvester1|harvester] going to source"`.

#### 6.6 `onTick(callback)` (optional)

* **For**: Library-level helper.
* **Purpose**: Child-friendly way to attach logic to each game tick.
* **Behavior**:

  * Internally used in `module.exports.loop`.
  * The agent may implement or skip, depending on integration strategy.

#### 6.7 `forEachCreep(handler)`

* **For**: Library-level helper.
* **Purpose**: Simplify iteration over all creeps.
* **Behavior**:

  * Invokes `handler(simpleCreep)` for each creep, where `simpleCreep` is the wrapped creep instance.

---

### 7. Spawning & Population Management

A small set of helpers for creating creeps and maintaining role-based populations. These functions are exposed on a global/base-level manager object (e.g. `Base` or `PopulationManager`), not on individual creeps.

All APIs in this section must be typed in TypeScript and use the `Role` enum for role parameters and return values.

#### 7.1 `buildCreep(role: Role)`

* **For**: Global/base-level manager.
* **Purpose**: Request spawning of a single creep with the given role.
* **Behavior**:

  * Chooses an appropriate body for the role based on available energy and simple fixed rules.
  * Issues a spawn command on the primary spawn if possible.
  * Returns a status code such as `"SPAWNING" | "NOT_ENOUGH_ENERGY" | "SPAWN_BUSY" | "ERROR"`.
* **Notes**: Naming and body selection rules should be simple and deterministic for teaching purposes.

#### 7.2 `canBuildCreep(role: Role)`

* **For**: Global/base-level manager.
* **Purpose**: Check if a creep of the given role can be spawned right now.
* **Behavior**:

  * Returns `true` if spawn is free and there is enough energy to build at least the minimal body for that role.
* **Returns**: `boolean`.

#### 7.3 `getCreepCount(role: Role)`

* **For**: Global/base-level manager.
* **Purpose**: Count how many creeps of a given role currently exist.
* **Behavior**:

  * Iterates over all creeps and counts those whose stored role matches the given `Role`.
* **Returns**: `number`.

#### 7.4 `maintainCreepsAtRole(role: Role, targetCount: number)`

* **For**: Global/base-level manager.
* **Purpose**: Ensure that there are at least `targetCount` creeps of the given role.
* **Behavior**:

  * Uses `getCreepCount(role)` to determine current count.
  * If current count < targetCount and spawning is possible, calls `buildCreep(role)`.
  * Returns a simple status such as `"OK" | "SPAWNING" | "CAPPED" | "BLOCKED"`.

#### 7.5 `maintainPopulation(targets)`

* **For**: Global/base-level manager.
* **Purpose**: Maintain multiple role targets in one call.
* **Behavior**:

  * `targets` is a structure like `{ [role in Role]?: number }` or equivalent.
  * For each entry, behaves similarly to `maintainCreepsAtRole`.
* **Returns**: A summary object or simple status map keyed by `Role`.

#### 7.6 `getQueuedSpawns()`

* **For**: Global/base-level manager.
* **Purpose**: Report what creeps are currently being spawned or queued, for debugging/teaching.
* **Behavior**:

  * Returns an array of simple descriptors (role, name, remaining time, etc.).
* **Returns**: Typed array of spawn job descriptions.

#### 7.7 `forEachCreepOfRole(role: Role, handler)`

* **For**: Library-level helper.
* **Purpose**: Convenience iteration helper that only visits creeps of a given role.
* **Behavior**:

  * Iterates over all creeps, filters by `Role`, and calls `handler(simpleCreep)` for each match.

---

## Example High-level Usage (Illustrative Only)

This example is for the agent to understand the intended style of usage. Exact names may differ, but the pattern should remain similar.

```ts
// Imaginary API usage example with Role enum
forEachCreep(creep => {
  if (creep.is(Role.Harvester)) {
    if (creep.needsEnergy()) {
      const source = creep.findClosestSource();
      if (!source) return;

      if (!creep.isNear(source)) {
        creep.moveTo(source);
        return;
      }

      creep.harvest(source);
      return;
    }

    creep.deliverEnergyToBase();
    return;
  }

  if (creep.is(Role.Worker)) {
    if (creep.empty()) {
      creep.pickupOrWithdrawEnergy();
      return;
    }

    creep.doWork();
  }
});

// Imaginary spawning management example
maintainCreepsAtRole(Role.Harvester, 3);
maintainCreepsAtRole(Role.Worker, 2);
```

The coding agent should implement the described methods and behaviors so that:

* The main game loop code remains short and readable.
* The child primarily writes decision logic (if/else, early returns, choosing behaviors).
* Underlying Screeps API calls and details are encapsulated but still discoverable later for learning.

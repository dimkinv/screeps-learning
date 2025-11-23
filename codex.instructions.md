---
applyTo: '**'
---
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


# Coding Requirements
1. When writing functions, always use typescript syntax in strict mode. 
2. annotate public functions with jsdoc explaning its purpose, parameters, and return type.

# Screeps Teaching Wrapper — Chapter 1

This workspace contains a minimal TypeScript wrapper for Screeps designed for teaching. Files are located in `src/`.

- `src/roles.ts` — `Role` enum
- `src/status.ts` — `ActionStatus` enum used by wrapper methods
- `src/simpleCreep.ts` — `SimpleCreep` wrapper implementing Chapter 1 APIs (harvest, findClosestSource, transfer, withdraw, deliverEnergyToBase, etc.)
- `src/index.ts` — library exports
- `src/loop.ts` — example `module.exports.loop` using the wrapper

Usage: copy the `src` folder files into your Screeps TypeScript project or compile as usual. The example loop is intentionally simple to show the primitives.

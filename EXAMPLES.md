# Library usage examples

The current APIs already cover the requested behaviors—no new helpers are required.

## Harvest and return to spawn
```ts
import { ActionStatus, SimpleCreep } from "./src";

export function runHarvester(creep: SimpleCreep): void {
  if (creep.needsEnergy()) {
    const source = creep.findClosestTarget("source") as Source | null;
    if (!source) return;

    if (!creep.isNear(source, 1)) {
      creep.moveNear(source);
      return;
    }

    creep.harvest(source);
    return;
  }

  const movingHome = creep.goHome();
  if (movingHome === ActionStatus.MOVING) return;

  creep.storeEnergyToBase();
}
```

## Harvest and upgrade controller
```ts
import { SimpleCreep } from "./src";

export function runUpgrader(creep: SimpleCreep): void {
  if (creep.needsEnergy()) {
    const source = creep.findClosestTarget("source") as Source | null;
    if (!source) return;

    if (!creep.isNear(source, 1)) {
      creep.moveNear(source);
      return;
    }

    creep.harvest(source);
    return;
  }

  const controller = creep.findClosestTarget("controller") as StructureController | null;
  if (!controller) return;

  if (!creep.isNear(controller, 3)) {
    creep.moveNear(controller);
    return;
  }

  creep.upgradeController();
}
```

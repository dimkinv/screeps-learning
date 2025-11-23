import { Role } from "./roles";
import { SimpleCreepBase } from "./simpleCreepBase";
import { HarvestingMixin } from "./mixins/harvestingMixins";
import { WorkMixin } from "./workMixins";
import { CombatMixin } from "./mixins/combatMixins";
import { LogisticsMixin } from "./mixins/logisticsMixins";
import { RoleAndMemoryMixin } from "./simpleCreepRoles";
export { towerDefendBase, hasHostilesInRoom } from "./simpleCreepUtilities";

const SimpleCreepComposed = CombatMixin(
  WorkMixin(LogisticsMixin(HarvestingMixin(RoleAndMemoryMixin(SimpleCreepBase)))),
);

export class SimpleCreep extends SimpleCreepComposed {}

const tickHandlers: Array<() => void> = [];

/**
 * Register a callback to run every game tick.
 * @param callback Function executed once per tick when `runTickHandlers` is invoked.
 */
export function onTick(callback: () => void): void {
  tickHandlers.push(callback);
}

/**
 * Execute all registered tick callbacks. Call this inside `module.exports.loop`.
 */
export function runTickHandlers(): void {
  tickHandlers.forEach(cb => cb());
}

/**
 * Iterate over every creep and invoke a handler with a wrapped `SimpleCreep`.
 * @param handler Function called for each creep.
 */
export function forEachCreep(handler: (creep: SimpleCreep) => void): void {
  for (const n in Game.creeps) {
    const creep = Game.creeps[n];
    if (!creep) continue;
    handler(new SimpleCreep(creep));
  }
}

/**
 * Dispatch creeps to role-specific handlers using the stored `Role` value.
 * @param handlers Map from `Role` to handler functions.
 */
export function runRole(handlers: Partial<Record<Role, (creep: SimpleCreep) => void>>): void {
  forEachCreep(sc => {
    const role = sc.getRole();
    if (role === null) return;
    const handler = handlers[role];
    if (handler) handler(sc);
  });
}

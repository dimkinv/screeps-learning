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
 * Регистрирует колбэк, выполняемый каждый игровой тик.
 * @param callback Функция, вызываемая при выполнении `runTickHandlers`.
 */
export function onTick(callback: () => void): void {
  tickHandlers.push(callback);
}

/**
 * Выполняет все зарегистрированные колбэки тиков. Вызывайте внутри `module.exports.loop`.
 */
export function runTickHandlers(): void {
  tickHandlers.forEach(cb => cb());
}

/**
 * Итерируется по всем крипам и вызывает обработчик с обёрткой `SimpleCreep`.
 * @param handler Функция, вызываемая для каждого крипа.
 */
export function forEachCreep(handler: (creep: SimpleCreep) => void): void {
  for (const n in Game.creeps) {
    const creep = Game.creeps[n];
    if (!creep) continue;
    handler(new SimpleCreep(creep));
  }
}

/**
 * Рассылает крипов в обработчики по ролям на основе сохранённого `Role`.
 * @param handlers Отображение `Role` → функция-обработчик.
 */
export function runRole(handlers: Partial<Record<Role, (creep: SimpleCreep) => void>>): void {
  forEachCreep(sc => {
    const role = sc.getRole();
    if (role === null) return;
    const handler = handlers[role];
    if (handler) handler(sc);
  });
}

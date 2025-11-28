import { ActionStatus } from "./status";

/**
 * Простая логика башни: атаковать врагов, иначе чинить критично повреждённые постройки, иначе лечить союзников.
 * @param tower Башня, которой управляем.
 * @returns Статус действия, описывающий выбранный шаг.
 */
export function towerDefendBase(tower: StructureTower): ActionStatus {
  const energy =
    (tower.store && (tower.store.getUsedCapacity ? tower.store.getUsedCapacity(RESOURCE_ENERGY) : undefined)) ??
    (tower.energy ?? 0);
  if (energy <= 0) return ActionStatus.EMPTY;

  const room = tower.room;

  // Attack closest hostile
  const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
  if (hostiles.length > 0) {
    const target = tower.pos.findClosestByRange(hostiles) as Creep | null;
    if (target) {
      const res = tower.attack(target);
      if (res === OK) return ActionStatus.ATTACK;
      return ActionStatus.ERROR;
    }
  }

  // Repair critically damaged structures
  const critical = room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax * 0.5 }) as Structure[];
  if (critical.length > 0) {
    const target = tower.pos.findClosestByRange(critical) as Structure | null;
    if (target) {
      const res = tower.repair(target);
      if (res === OK) return ActionStatus.REPAIR;
      return ActionStatus.ERROR;
    }
  }

  // Heal injured friendly creeps
  const injured = room.find(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax }) as Creep[];
  if (injured.length > 0) {
    const target = tower.pos.findClosestByRange(injured) as Creep | null;
    if (target) {
      const res = tower.heal(target);
      if (res === OK) return ActionStatus.HEAL;
      return ActionStatus.ERROR;
    }
  }

  return ActionStatus.IDLE;
}

/**
 * Проверяет, есть ли в комнате вражеские крипы.
 * @param room Комната для проверки.
 * @returns `true`, если обнаружены враги.
 */
export function hasHostilesInRoom(room: Room): boolean {
  return room.find(FIND_HOSTILE_CREEPS).length > 0;
}

import { ActionStatus } from "../status";
import { SimpleCreepBase, SimpleCreepConstructor } from "../simpleCreepBase";
import { HarvestingCapabilities } from "./harvestingMixins";

export function CombatMixin<
  TBase extends SimpleCreepConstructor<SimpleCreepBase & HarvestingCapabilities>,
>(Base: TBase) {
  return class Chapter4Combat extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Находит ближайшего враждебного крипа в комнате.
     * @returns Ближайший вражеский крип или `null`, если целей нет.
     */
    findClosestHostile(): Creep | null {
      const room = this.creep.room;
      if (!room) return null;
      const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
      if (!hostiles || hostiles.length === 0) return null;
      return (this.creep.pos.findClosestByRange(hostiles) as Creep | null) ?? null;
    }

    /**
     * Выполняет ближнюю атаку по указанной цели без автоматического движения.
     * @param target Вражеский крип.
     * @returns `ATTACKING` при успешном ударе, `NOT_IN_RANGE`, если далеко, либо `NO_TARGET`, если цели нет.
     */
    attackHostile(target: Creep | null): ActionStatus {
      if (!target) return ActionStatus.NO_TARGET;
      if (!this.isNear(target, 1)) return ActionStatus.NOT_IN_RANGE;

      const res = this.creep.attack(target);
      if (res === OK) return ActionStatus.ATTACKING;
      return ActionStatus.ERROR;
    }

    /**
     * Производит дальнюю атаку по цели без изменения позиции.
     * @param target Вражеский крип.
     * @returns `ATTACKING` при успехе, `NOT_IN_RANGE`, если дальше трёх клеток, либо `NO_TARGET`, если цели нет.
     */
    rangedAttackHostile(target: Creep | null): ActionStatus {
      if (!target) return ActionStatus.NO_TARGET;
      const range = this.creep.pos.getRangeTo(target);
      if (range > 3) return ActionStatus.NOT_IN_RANGE;

      const res = this.creep.rangedAttack(target);
      if (res === OK) return ActionStatus.ATTACKING;
      return ActionStatus.ERROR;
    }

    /**
     * Держит безопасную дистанцию от ближайшего врага, атакуя его, если позволяет дальность.
     * @returns `RETREATING`, `ATTACKING` или `NO_TARGET` при отсутствии врагов.
     */
    kiteHostile(): ActionStatus {
      const target = this.findClosestHostile();
      if (!target) return ActionStatus.NO_TARGET;

      const range = this.creep.pos.getRangeTo(target);
      if (range < 3) return this.stayAwayFrom(target, 3);
      if (range <= 3) return this.rangedAttackHostile(target);
      return ActionStatus.NOT_IN_RANGE;
    }

    /**
     * Лечит себя при наличии урона.
     * @returns `HEALING`, если лечение выполнено, или `HEALTHY`, если урона нет.
     */
    healSelfIfNeeded(): ActionStatus {
      if (this.creep.hits >= this.creep.hitsMax) return ActionStatus.HEALTHY;
      const res = (this.creep.heal as any)(this.creep);
      if (res === OK) return ActionStatus.HEALING;
      return ActionStatus.ERROR;
    }

    /**
     * Проверяет, есть ли в комнате враждебные крипы.
     * @returns `true`, если враги обнаружены.
     */
    hasHostilesInRoom(): boolean {
      const room = this.creep.room;
      if (!room) return false;
      return room.find(FIND_HOSTILE_CREEPS).length > 0;
    }

    /**
     * Отступает к базе/спауну при появлении врагов.
     * @returns Статус движения или `NO_TARGET`, если отсутствуют данные о комнате или спауне.
     */
    fleeToBase(): ActionStatus {
      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;
      const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
      if (hostiles && hostiles.length > 0) {
        const target = this.creep.pos.findClosestByRange(hostiles) as Creep | null;
        if (target) {
          const range = this.creep.pos.getRangeTo(target);
          if (range < 4) {
            const fleeStatus = this.stayAwayFrom(target, 4);
            if (fleeStatus !== ActionStatus.NO_PATH && fleeStatus !== ActionStatus.ERROR) return fleeStatus;
          }
        }
      }
      return this.goHome();
    }
  };
}

export type Chapter4Combat = InstanceType<ReturnType<typeof CombatMixin>>;

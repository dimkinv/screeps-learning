import { ActionStatus } from "./status";
import { SimpleCreepBase, SimpleCreepConstructor } from "./simpleCreepBase";

export function Chapter4CombatMixin<TBase extends SimpleCreepConstructor<SimpleCreepBase>>(Base: TBase) {
  return class Chapter4Combat extends Base {
    /**
     * Melee attack the closest hostile creep in the room.
     * @returns `ATTACKING` when attacking, `MOVING` while approaching, or `NO_TARGET` if none found.
     */
    attackClosestHostile(): ActionStatus {
      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;
      const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
      if (!hostiles || hostiles.length === 0) return ActionStatus.NO_TARGET;
      const target = this.creep.pos.findClosestByRange(hostiles) as Creep | null;
      if (!target) return ActionStatus.NO_TARGET;

      if (!this.isNear(target, 1)) {
        const moveStatus = this.moveTo(target);
        if (moveStatus === ActionStatus.NO_PATH || moveStatus === ActionStatus.ERROR) return moveStatus;
        return ActionStatus.MOVING;
      }

      const res = this.creep.attack(target);
      if (res === OK) return ActionStatus.ATTACKING;
      return ActionStatus.ERROR;
    }

    /**
     * Ranged attack the closest hostile creep.
     * @returns `ATTACKING` when firing, `MOVING` while closing distance, or `NO_TARGET` if none found.
     */
    rangedAttackClosestHostile(): ActionStatus {
      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;
      const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
      if (!hostiles || hostiles.length === 0) return ActionStatus.NO_TARGET;
      const target = this.creep.pos.findClosestByRange(hostiles) as Creep | null;
      if (!target) return ActionStatus.NO_TARGET;

      const range = this.creep.pos.getRangeTo(target);
      if (range > 3) {
        const moveStatus = this.moveTo(target);
        if (moveStatus === ActionStatus.NO_PATH || moveStatus === ActionStatus.ERROR) return moveStatus;
        return ActionStatus.MOVING;
      }

      const res = this.creep.rangedAttack(target);
      if (res === OK) return ActionStatus.ATTACKING;
      return ActionStatus.ERROR;
    }

    /**
     * Keep safe distance from hostiles while attempting ranged attack.
     * @returns `RETREATING`, `ATTACKING`, `MOVING`, or `NO_TARGET`.
     */
    kiteHostile(): ActionStatus {
      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;
      const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
      if (!hostiles || hostiles.length === 0) return ActionStatus.NO_TARGET;
      const target = this.creep.pos.findClosestByRange(hostiles) as Creep | null;
      if (!target) return ActionStatus.NO_TARGET;

      const range = this.creep.pos.getRangeTo(target);
      if (range < 3) return this.stayAwayFrom(target, 3);
      if (range <= 3) {
        const res = this.creep.rangedAttack(target);
        if (res === OK) return ActionStatus.ATTACKING;
        return ActionStatus.ERROR;
      }
      return this.moveTo(target);
    }

    /**
     * Heal the creep if damaged.
     * @returns `HEALING` when healed, `HEALTHY` if no damage.
     */
    healSelfIfNeeded(): ActionStatus {
      if (this.creep.hits >= this.creep.hitsMax) return ActionStatus.HEALTHY;
      const res = (this.creep.heal as any)(this.creep);
      if (res === OK) return ActionStatus.HEALING;
      return ActionStatus.ERROR;
    }

    /**
     * Check if the room contains any hostile creeps.
     * @returns `true` when hostiles are present.
     */
    hasHostilesInRoom(): boolean {
      const room = this.creep.room;
      if (!room) return false;
      return room.find(FIND_HOSTILE_CREEPS).length > 0;
    }

    /**
     * Move back toward base/spawn when hostiles are nearby.
     * @returns Movement status or `NO_TARGET` if room/spawn is missing.
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

export type Chapter4Combat = InstanceType<ReturnType<typeof Chapter4CombatMixin>>;

import { ActionStatus } from "./status";
import { SimpleCreepBase, SimpleCreepConstructor } from "./simpleCreepBase";
import { HarvestingCapabilities } from "./harvestingMixins";

export function WorkMixin<
  TBase extends SimpleCreepConstructor<SimpleCreepBase & HarvestingCapabilities>,
>(Base: TBase) {
  return class Chapter3Work extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Upgrade the current room controller.
     * @returns `UPGRADING` when upgrading, `MOVING` while approaching, `EMPTY` if no energy, or `NO_TARGET` if no controller.
     */
    upgradeController(): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      const controller = this.creep.room?.controller;
      if (!controller) return ActionStatus.NO_TARGET;
      if (!this.isNear(controller, 3)) return this.moveTo(controller);

      const res = this.creep.upgradeController(controller);
      if (res === OK) return ActionStatus.UPGRADING;
      return ActionStatus.ERROR;
    }

    /**
     * Find and build the closest construction site in the room.
     * @returns `BUILDING` on success, `MOVING` while approaching, `EMPTY` if no energy, or `NO_SITE`/`NO_TARGET` if none found.
     */
    buildClosestSite(): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;

      const sites = room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];
      if (!sites || sites.length === 0) return ActionStatus.NO_SITE;

      const site = this.creep.pos.findClosestByRange(sites) as ConstructionSite | null;
      if (!site) return ActionStatus.NO_SITE;

      if (!this.isNear(site, 3)) return this.moveTo(site);

      const res = this.creep.build(site);
      if (res === OK) return ActionStatus.BUILDING;
      return ActionStatus.ERROR;
    }

    /**
     * Build a construction site at or near a specific position.
     * @param position Desired build position.
     * @returns Status from build attempt, or `NO_SITE`/`NO_TARGET` if no site exists there.
     */
    buildAt(position: RoomPosition): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      if (position.roomName !== this.creep.room?.name) return ActionStatus.NO_TARGET;

      const sites = position.lookFor(LOOK_CONSTRUCTION_SITES) as ConstructionSite[];
      const site = sites[0];
      if (!site) return ActionStatus.NO_SITE;

      if (!this.isNear(site, 3)) return this.moveTo(site);

      const res = this.creep.build(site);
      if (res === OK) return ActionStatus.BUILDING;
      return ActionStatus.ERROR;
    }

    /**
     * Repair the nearest damaged structure (hits below max).
     * @returns `REPAIRING` when repairing, `MOVING` while approaching, `EMPTY` if no energy, or `NO_TARGET` if nothing to fix.
     */
    repairClosestDamagedStructure(): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;

      const damaged = room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax }) as Structure[];
      if (!damaged || damaged.length === 0) return ActionStatus.NO_TARGET;

      const target = this.creep.pos.findClosestByRange(damaged) as Structure | null;
      if (!target) return ActionStatus.NO_TARGET;

      if (!this.isNear(target, 3)) return this.moveTo(target);

      const res = this.creep.repair(target);
      if (res === OK) return ActionStatus.REPAIRING;
      return ActionStatus.ERROR;
    }

    /**
     * Repair a specific structure target.
     * @param target Structure to repair.
     * @returns Repair status or `EMPTY` if no energy.
     */
    repair(target: Structure): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      if (!this.isNear(target, 3)) return this.moveTo(target);

      const res = this.creep.repair(target);
      if (res === OK) return ActionStatus.REPAIRING;
      return ActionStatus.ERROR;
    }

    /**
     * Whether any work is available (construction, repair, or controller upgrades).
     * @returns `true` if something needs building, repairing, or upgrading.
     */
    hasWork(): boolean {
      const room = this.creep.room;
      if (!room) return false;

      const hasSite = room.find(FIND_CONSTRUCTION_SITES).length > 0;
      if (hasSite) return true;

      const damaged = room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax });
      if (damaged.length > 0) return true;

      const controller = room.controller;
      if (controller && controller.level < 8) return true;

      return false;
    }

    /**
     * Do "best" available work: build sites first, then repair, otherwise upgrade controller.
     * @returns Status from the chosen action, or `NO_TARGET` if nothing to do.
     */
    doWork(): ActionStatus {
      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;

      const sites = room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];
      if (sites.length > 0) return this.buildClosestSite();

      const damaged = room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax }) as Structure[];
      if (damaged.length > 0) return this.repairClosestDamagedStructure();

      return this.upgradeController();
    }
  };
}

export type Chapter3Work = InstanceType<ReturnType<typeof WorkMixin>>;

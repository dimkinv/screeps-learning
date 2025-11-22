import { ActionStatus } from "./status";
import { SimpleCreepBase, SimpleCreepConstructor } from "./simpleCreepBase";
import { Chapter1HarvestingCapabilities } from "./simpleCreepChapter1";

export function Chapter5LogisticsMixin<
  TBase extends SimpleCreepConstructor<SimpleCreepBase & Chapter1HarvestingCapabilities>,
>(Base: TBase) {
  return class Chapter5Logistics extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Find the best nearby non-source energy target (dropped energy, then containers, then storage).
     * @returns Dropped resource, container, storage, or `null` when nothing is available.
     */
    findEnergyDropOrContainer(): Resource | StructureContainer | StructureStorage | null {
      const room = this.creep.room;
      if (!room) return null;

      const spawn = room.find(FIND_MY_SPAWNS)[0];

      const dropped = room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY,
      }) as Resource[];
      if (dropped.length > 0) {
        const target = spawn ? spawn.pos.findClosestByRange(dropped) : this.creep.pos.findClosestByRange(dropped);
        if (target) return target;
      }

      const containers = room.find(FIND_STRUCTURES, {
        filter: s =>
          s.structureType === STRUCTURE_CONTAINER &&
          (s.store?.getUsedCapacity(RESOURCE_ENERGY) ?? 0) > 0,
      }) as StructureContainer[];
      if (containers.length > 0) {
        const target = this.creep.pos.findClosestByRange(containers) as StructureContainer | null;
        if (target) return target;
      }

      const storages = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_STORAGE && (s.store?.getUsedCapacity(RESOURCE_ENERGY) ?? 0) > 0,
      }) as StructureStorage[];
      if (storages.length > 0) {
        const target = this.creep.pos.findClosestByRange(storages) as StructureStorage | null;
        if (target) return target;
      }

      return null;
    }

    /**
     * High-level helper to pick up dropped energy or withdraw from a container/storage.
     * @returns Status reflecting action progress, or `FULL`/`NO_TARGET` when blocked.
     */
    pickupOrWithdrawEnergy(): ActionStatus {
      if (this.full()) return ActionStatus.FULL;

      const target = this.findEnergyDropOrContainer();
      if (!target) return ActionStatus.NO_TARGET;

      if ((target as Resource).resourceType === RESOURCE_ENERGY) {
        const resTarget = target as Resource;
        if (!this.isNear(resTarget, 1)) return this.moveTo(resTarget);
        const res = this.creep.pickup(resTarget);
        if (res === OK) return ActionStatus.PICKING_UP;
        return ActionStatus.ERROR;
      }

      if (!this.isNear(target, 1)) {
        const moveStatus = this.moveTo(target);
        if (moveStatus === ActionStatus.NO_PATH || moveStatus === ActionStatus.ERROR) return moveStatus;
        return ActionStatus.MOVING;
      }

      const withdrawResult = this.withdraw(target as any);
      if (withdrawResult === ActionStatus.WITHDRAWING) return ActionStatus.WITHDRAWING;
      return withdrawResult;
    }

    /**
     * Deliver energy to spawn and extensions, preferring whichever is closer.
     * @returns Transfer status, `EMPTY` when out of energy, or `NO_TARGET` when no fill targets exist.
     */
    fillExtensionsAndSpawn(): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;

      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;

      const structures = room.find(FIND_MY_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
          (s.store?.getFreeCapacity(RESOURCE_ENERGY) ?? 0) > 0,
      }) as (StructureSpawn | StructureExtension)[];

      if (structures.length === 0) return ActionStatus.NO_TARGET;

      const target = this.creep.pos.findClosestByRange(structures) as StructureSpawn | StructureExtension | null;
      if (!target) return ActionStatus.NO_TARGET;

      return this.transferEnergyTo(target);
    }

    /**
     * Store excess energy into containers or storage structures.
     * @returns Transfer status, `EMPTY` when no carried energy, or `NO_TARGET` when no container space exists.
     */
    storeEnergyInContainers(): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;

      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;

      const targets = room.find(FIND_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
          (s.store?.getFreeCapacity(RESOURCE_ENERGY) ?? 0) > 0,
      }) as (StructureContainer | StructureStorage)[];

      if (targets.length === 0) return ActionStatus.NO_TARGET;

      const target = this.creep.pos.findClosestByRange(targets) as StructureContainer | StructureStorage | null;
      if (!target) return ActionStatus.NO_TARGET;

      return this.transferEnergyTo(target);
    }

    /**
     * Whether the creep can still carry more energy.
     * @returns `true` when free capacity remains.
     */
    hasRoomForEnergy(): boolean {
      return !this.full();
    }

    /**
     * Current carried energy amount.
     * @returns Energy stored on this creep.
     */
    getEnergyLevel(): number {
      return this.creep.store?.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
    }

    /**
     * Maximum energy capacity of this creep.
     * @returns Total capacity for energy in the creep's store.
     */
    getEnergyCapacity(): number {
      const cap = this.creep.store?.getCapacity(RESOURCE_ENERGY);
      return typeof cap === "number" ? cap : 0;
    }

    /**
     * Deposit carried energy into base structures (spawn + extensions + towers + containers/storage).
     * @returns Status reflecting the attempted transfer, or `NO_TARGET` if nothing needs energy.
     */
    deliverEnergyToBase(): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;

      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;

      const spawns = room.find(FIND_MY_SPAWNS);
      if (spawns && spawns.length > 0) {
        const spawn = spawns[0];
        if (!spawn) return ActionStatus.NO_TARGET;

        if (this.needsEnergyFill(spawn)) return this.transferEnergyTo(spawn);
      }

      const extensions = room.find(FIND_STRUCTURES, {
        filter: s =>
          s.structureType === STRUCTURE_EXTENSION &&
          (s.store.getFreeCapacity ? s.store.getFreeCapacity(RESOURCE_ENERGY) : (s.energyCapacity - (s.energy ?? 0))) > 0,
      }) as StructureExtension[];
      if (extensions && extensions.length > 0) {
        const target = this.creep.pos.findClosestByRange(extensions) as StructureExtension;
        if (target) return this.transferEnergyTo(target);
      }

      const towers = room.find(FIND_STRUCTURES, {
        filter: s =>
          s.structureType === STRUCTURE_TOWER &&
          (s.store.getFreeCapacity ? s.store.getFreeCapacity(RESOURCE_ENERGY) : (s.energyCapacity - (s.energy ?? 0))) > 0,
      }) as StructureTower[];
      if (towers && towers.length > 0) {
        const target = this.creep.pos.findClosestByRange(towers) as StructureTower;
        if (target) return this.transferEnergyTo(target);
      }

      const containers = room.find(FIND_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
          (s.store.getFreeCapacity ? s.store.getFreeCapacity(RESOURCE_ENERGY) : 0) > 0,
      }) as Structure[];
      if (containers && containers.length > 0) {
        const target = this.creep.pos.findClosestByRange(containers) as Structure;
        if (target) return this.transferEnergyTo(target);
      }

      return ActionStatus.NO_TARGET;
    }

    private needsEnergyFill(s: any): boolean {
      if (!s) return false;
      const free =
        (s.store && s.store.getFreeCapacity ? s.store.getFreeCapacity(RESOURCE_ENERGY) : s.energyCapacity - (s.energy ?? 0)) ??
        0;
      return free > 0;
    }
  };
}

export type Chapter5Logistics = InstanceType<ReturnType<typeof Chapter5LogisticsMixin>>;

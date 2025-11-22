import { ActionStatus } from "./status";
import { SimpleCreepBase, SimpleCreepConstructor } from "./simpleCreepBase";

export interface Chapter1HarvestingCapabilities {
  full(): boolean;
  empty(): boolean;
  needsEnergy(): boolean;
  isNear(target: RoomPosition | { pos: RoomPosition } | RoomObject, range?: number): boolean;
  moveTo(target: RoomPosition | { pos: RoomPosition } | RoomObject): ActionStatus;
  moveNear(target: RoomPosition | { pos: RoomPosition } | RoomObject): ActionStatus;
  stayAwayFrom(target: RoomPosition | { pos: RoomPosition } | RoomObject, distance: number): ActionStatus;
  goHome(): ActionStatus;
  storeEnergyToBase(): ActionStatus;
  harvest(source: Source): ActionStatus;
  transferEnergyTo(target: Structure | RoomObject): ActionStatus;
  withdraw(target: Structure | any): ActionStatus;
}

export function Chapter1HarvestingMixin<TBase extends SimpleCreepConstructor<SimpleCreepBase>>(Base: TBase) {
  return class Chapter1Harvesting extends Base implements Chapter1HarvestingCapabilities {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Find the nearest energy source within the current room.
     * @returns Closest `Source` or `null` if none exist.
     */
    findClosestSource(): Source | null {
      if (!this.creep.room) return null;
      const sources = this.creep.room.find(FIND_SOURCES) as Source[];
      if (!sources || sources.length === 0) return null;
      const closest = this.creep.pos.findClosestByRange(sources) as Source | null;
      return closest || null;
    }

    /** @returns Whether the creep has no free energy capacity. */
    full(): boolean {
      return (this.creep.store.getFreeCapacity(RESOURCE_ENERGY) ?? 0) === 0;
    }

    /** @returns Whether the creep carries zero energy. */
    empty(): boolean {
      return (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) === 0;
    }

    /** @returns Whether the creep can accept more energy. */
    needsEnergy(): boolean {
      return !this.full();
    }

    /**
     * Check whether the creep is within a given range of the target.
     * @param target A room position or object with a position.
     * @param range Maximum range to count as "near" (default 1).
     */
    isNear(target: RoomPosition | { pos: RoomPosition } | RoomObject, range = 1): boolean {
      const pos = (target as any).pos ?? target;
      return this.creep.pos.inRangeTo(pos, range);
    }

    /**
     * Move toward a target position/object.
     * @returns `ALREADY_THERE` if standing on the target, `NO_PATH` if move failed, `ERROR` for other issues, otherwise `MOVING`.
     */
    moveTo(target: RoomPosition | { pos: RoomPosition } | RoomObject): ActionStatus {
      if (this.isNear(target, 0)) return ActionStatus.ALREADY_THERE;
      const moveResult = this.creep.moveTo(target as any, { visualizePathStyle: { stroke: "#ffffff" } }) as number;
      if (moveResult === ERR_NO_PATH) return ActionStatus.NO_PATH;
      if (moveResult !== OK && moveResult !== ERR_TIRED) return ActionStatus.ERROR;
      return ActionStatus.MOVING;
    }

    /**
     * Move toward a target until within range 1.
     * @param target Position or object to approach.
     * @returns `ALREADY_NEAR` if already close, `NO_PATH` if movement fails, otherwise `MOVING`.
     */
    moveNear(target: RoomPosition | { pos: RoomPosition } | RoomObject): ActionStatus {
      if (this.isNear(target, 1)) return ActionStatus.ALREADY_NEAR;
      const result = this.moveTo(target);
      if (result === ActionStatus.NO_PATH) return ActionStatus.NO_PATH;
      if (result === ActionStatus.ERROR) return ActionStatus.ERROR;
      return ActionStatus.MOVING;
    }

    /**
     * Keep at least `distance` tiles away from a target; steps away if too close.
     * @param target Target position or object to avoid.
     * @param distance Minimum range to maintain.
     * @returns `SAFE` when already outside the distance, `RETREATING` while moving away, or `NO_PATH`/`ERROR` on failure.
     */
    stayAwayFrom(target: RoomPosition | { pos: RoomPosition } | RoomObject, distance: number): ActionStatus {
      const pos = (target as any).pos ?? target;
      const range = this.creep.pos.getRangeTo(pos);
      if (range >= distance) return ActionStatus.SAFE;

      const fleeSearch = PathFinder.search(this.creep.pos, [{ pos, range: distance }], {
        flee: true,
        maxRooms: 1,
      });
      const next = fleeSearch.path[0];
      if (!next) return ActionStatus.NO_PATH;

      const dir = this.creep.pos.getDirectionTo(next);
      const moveResult = this.creep.move(dir);
      if (moveResult !== OK && moveResult !== ERR_TIRED) return ActionStatus.ERROR;
      return ActionStatus.RETREATING;
    }

    /**
     * Move to a named flag in the same room.
     * @param flagName Name of the flag to move toward.
     * @returns Movement status or `NO_TARGET` if the flag is missing or not in the same room.
     */
    moveToFlag(flagName: string): ActionStatus {
      const flag = Game.flags[flagName];
      if (!flag || flag.pos.roomName !== this.creep.room?.name) return ActionStatus.NO_TARGET;
      return this.moveTo(flag.pos);
    }

    /**
     * Check if the creep is exactly at a given position.
     * @param position Target position to compare against.
     * @returns `true` when the creep is standing on that position.
     */
    isAt(position: RoomPosition): boolean {
      return (
        this.creep.pos.x === position.x &&
        this.creep.pos.y === position.y &&
        this.creep.pos.roomName === position.roomName
      );
    }

    /**
     * Move the creep toward the room's nearest spawn (preferring `homeSpawnName` if set)
     * and stop once within range 1.
     * @returns `MOVING` while moving, or `ALREADY_THERE` when within range 1.
     */
    goHome(): ActionStatus {
      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;

      let spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
      if (this.homeSpawnName) {
        const preferred = Game.spawns[this.homeSpawnName];
        if (preferred && preferred.room === room) spawns = [preferred];
      }

      if (!spawns || spawns.length === 0) return ActionStatus.NO_TARGET;
      const spawn = this.creep.pos.findClosestByRange(spawns) as StructureSpawn | null;
      if (!spawn) return ActionStatus.NO_TARGET;

      if (this.isNear(spawn, 1)) return ActionStatus.ALREADY_THERE;
      this.creep.moveTo(spawn as any);
      return ActionStatus.MOVING;
    }

    /**
     * If there's a spawn within range 1, transfer all carried energy to it.
     * Returns `TRANSFERRING` if a transfer was performed, `EMPTY` if creep has no energy,
     * or `NO_TARGET` if no nearby spawn was found. Returns `ERROR` for unexpected results.
     */
    storeEnergyToBase(): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;

      const room = this.creep.room;
      if (!room) return ActionStatus.NO_TARGET;

      const spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
      if (!spawns || spawns.length === 0) return ActionStatus.NO_TARGET;

      const spawn = this.creep.pos.findClosestByRange(spawns) as StructureSpawn | null;
      if (!spawn) return ActionStatus.NO_TARGET;

      // Only act if spawn is adjacent ("near")
      if (!this.isNear(spawn, 1)) return ActionStatus.NO_TARGET;

      const res = (this.creep.transfer as any)(spawn as any, RESOURCE_ENERGY);
      if (res === OK) return ActionStatus.TRANSFERRING;
      return ActionStatus.ERROR;
    }

    /**
     * Harvest from a source directly adjacent to the creep.
     * @returns `HARVESTING` on success, `NOT_IN_RANGE` if not adjacent, otherwise `ERROR`.
     */
    harvest(source: Source): ActionStatus {
      if (!this.isNear(source, 1)) return ActionStatus.NOT_IN_RANGE;
      const res = this.creep.harvest(source);
      if (res === OK) return ActionStatus.HARVESTING;
      return ActionStatus.ERROR;
    }

    /**
     * Deliver energy to a structure or room object, moving into range if needed.
     * @returns `TRANSFERRING` when energy was given, `MOVING` while approaching, `EMPTY` if no energy.
     */
    transferEnergyTo(target: Structure | RoomObject): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      if (!this.isNear(target, 1)) {
        this.creep.moveTo(target as any);
        return ActionStatus.MOVING;
      }
      const res = (this.creep.transfer as any)(target as any, RESOURCE_ENERGY);
      if (res === OK) return ActionStatus.TRANSFERRING;
      return ActionStatus.ERROR;
    }

    /**
     * Withdraw energy from a structure/container directly adjacent to the creep.
     * @returns `WITHDRAWING` on success, `NOT_IN_RANGE` if too far, `ERROR` if no energy available.
     */
    withdraw(target: Structure | any): ActionStatus {
      if (!this.isNear(target, 1)) return ActionStatus.NOT_IN_RANGE;
      const available =
        (target.store && (target.store.getUsedCapacity ? target.store.getUsedCapacity(RESOURCE_ENERGY) : undefined)) ??
        (target.energy ?? 0);
      if (!available || available <= 0) return ActionStatus.ERROR;
      const res = (this.creep.withdraw as any)(target as any, RESOURCE_ENERGY);
      if (res === OK) return ActionStatus.WITHDRAWING;
      return ActionStatus.ERROR;
    }
  };
}

export type Chapter1Harvesting = InstanceType<ReturnType<typeof Chapter1HarvestingMixin>>;

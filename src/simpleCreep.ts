import { Role } from "./roles";
import { ActionStatus } from "./status";

type CreepWithTypedMemory<R extends Role> = Creep & { memory: CreepMemory & { role: R } };

export class SimpleCreep {
  public creep: CreepWithTypedMemory<Role>;
  public homeSpawnName: string | undefined;

  constructor(creep: Creep, homeSpawnName?: string) {
    this.creep = creep as CreepWithTypedMemory<Role>;
    this.homeSpawnName = homeSpawnName;
  }

  // Role helpers
  /**
   * Read the creep's stored `role` from memory.
   * @returns Role value if set, otherwise `null`.
   */
  getRole(): Role | null {
    const r = this.creep.memory.role as Role | undefined;
    return r ?? null;
  }

  /**
   * Check whether the creep matches a given role.
   * @param role Target role to compare.
   */
  is(role: Role): boolean {
    return this.getRole() === role;
  }

  /**
   * Persist a new role on the creep's memory.
   * @param role Role to assign.
   */
  setRole(role: Role): void {
    this.creep.memory.role = role;
  }

  // Chapter 1: Harvesting & Energy Management

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
    const moveResult = this.creep.moveTo(target as any, { visualizePathStyle: { stroke: "#ffffff" } });
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
    if (moveResult === ERR_NO_PATH) return ActionStatus.NO_PATH;
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
      // Move toward target but return MOVING to let caller know
      this.creep.moveTo(target as any);
      return ActionStatus.MOVING;
    }
    // Attempt transfer
    // Some structures use `.store`, older API had `.energy`.
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
    const available = (target.store && (target.store.getUsedCapacity ? target.store.getUsedCapacity(RESOURCE_ENERGY) : undefined)) ?? (target.energy ?? 0);
    if (!available || available <= 0) return ActionStatus.ERROR;
    const res = (this.creep.withdraw as any)(target as any, RESOURCE_ENERGY);
    if (res === OK) return ActionStatus.WITHDRAWING;
    return ActionStatus.ERROR;
  }

  // Chapter 3: Upgrading, Building, and Repairing

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

  // Chapter 4: Fighting & Defense

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

  /**
   * Deposit carried energy into base structures (spawn + extensions + towers + containers/storage).
   * @returns Status reflecting the attempted transfer, or `NO_TARGET` if nothing needs energy.
   */
  deliverEnergyToBase(): ActionStatus {
    if (this.empty()) return ActionStatus.EMPTY;

    // Priority: spawn -> extensions -> towers -> containers/storage
    const room = this.creep.room;
    if (!room) return ActionStatus.NO_TARGET;
    
    // Spawn
    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns && spawns.length > 0) {
      const spawn = spawns[0];
      if(!spawn) return ActionStatus.NO_TARGET;

      if (this._needsEnergyFill(spawn)) return this.transferEnergyTo(spawn);
    }

    // Extensions
    const extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION && (s.store.getFreeCapacity ? s.store.getFreeCapacity(RESOURCE_ENERGY) : (s.energyCapacity - (s.energy ?? 0)) ) > 0 }) as StructureExtension[];
    if (extensions && extensions.length > 0) {
      const target = this.creep.pos.findClosestByRange(extensions) as StructureExtension;
      if (target) return this.transferEnergyTo(target);
    }

    // Towers
    const towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER && (s.store.getFreeCapacity ? s.store.getFreeCapacity(RESOURCE_ENERGY) : (s.energyCapacity - (s.energy ?? 0)) ) > 0 }) as StructureTower[];
    if (towers && towers.length > 0) {
      const target = this.creep.pos.findClosestByRange(towers) as StructureTower;
      if (target) return this.transferEnergyTo(target);
    }

    // Containers / Storage
    const containers = room.find(FIND_STRUCTURES, { filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && (s.store.getFreeCapacity ? s.store.getFreeCapacity(RESOURCE_ENERGY) : 0) > 0 }) as Structure[];
    if (containers && containers.length > 0) {
      const target = this.creep.pos.findClosestByRange(containers) as Structure;
      if (target) return this.transferEnergyTo(target);
    }

    return ActionStatus.NO_TARGET;
  }

  // Helper: check if a spawn/structure needs energy
  private _needsEnergyFill(s: any): boolean {
    if (!s) return false;
    const free = (s.store && s.store.getFreeCapacity ? s.store.getFreeCapacity(RESOURCE_ENERGY) : (s.energyCapacity && (s.energyCapacity - (s.energy ?? 0)))) ?? 0;
    return free > 0;
  }
}

/**
 * Simple tower AI: attack hostiles, otherwise repair critical structures, otherwise heal injured creeps.
 * @param tower Tower to command.
 * @returns Action status reflecting the chosen action.
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
 * Check if a room currently has hostile creeps.
 * @param room Room to inspect.
 * @returns `true` if any hostiles are present.
 */
export function hasHostilesInRoom(room: Room): boolean {
  return room.find(FIND_HOSTILE_CREEPS).length > 0;
}

import assert = require('node:assert');

const globalAny = globalThis as any;

type StoreOptions = { used?: number; capacity?: number };

type CreepOverrides = Partial<Creep> & {
  pos?: RoomPosition;
  room?: Room | null;
  store?: Store<ResourceConstant, false>;
};

type SpawnOverrides = Partial<StructureSpawn>;
type RoomOverrides = Partial<Room>;
type TowerOverrides = Partial<StructureTower> & { room?: Room };

export function setupScreepsGlobals(): void {
  Object.assign(globalAny, {
    OK: 0,
    ERR_NOT_ENOUGH_ENERGY: -6,
    ERR_BUSY: -4,
    ERR_NAME_EXISTS: -3,
    ERR_NO_PATH: -7,
    ERR_NOT_FOUND: -5,
    ERR_TIRED: -11,
    WORK: 'work',
    CARRY: 'carry',
    MOVE: 'move',
    ATTACK: 'attack',
    TOUGH: 'tough',
    RANGED_ATTACK: 'ranged_attack',
    HEAL: 'heal',
    RESOURCE_ENERGY: 'energy',
    TOP: 1,
    FIND_SOURCES: 1,
    FIND_MY_SPAWNS: 2,
    FIND_CONSTRUCTION_SITES: 3,
    FIND_STRUCTURES: 4,
    FIND_HOSTILE_CREEPS: 5,
    FIND_MY_CREEPS: 6,
    FIND_DROPPED_RESOURCES: 7,
    LOOK_CONSTRUCTION_SITES: 'constructionSites',
  });

  globalAny.BODYPART_COST = {
    [globalAny.WORK]: 100,
    [globalAny.CARRY]: 50,
    [globalAny.MOVE]: 50,
    [globalAny.ATTACK]: 80,
    [globalAny.TOUGH]: 10,
  } satisfies Partial<Record<BodyPartConstant, number>>;

  globalAny.Game = { creeps: {}, spawns: {}, flags: {}, time: 0 } as Game;
  globalAny.Memory = {} as Memory;
  globalAny.PathFinder = {
    search: () => ({ path: [createPosition(1, 1, 'W0N0')] }),
  } as unknown as PathFinder;
}

export function createPosition(x = 0, y = 0, roomName = 'W0N0'): RoomPosition {
  const pos = {
    x,
    y,
    roomName,
    inRangeTo(target: RoomPosition | { pos: RoomPosition }, range = 1) {
      const targetPos = 'pos' in target ? target.pos : target;
      const distance = Math.max(Math.abs(this.x - targetPos.x), Math.abs(this.y - targetPos.y));
      return distance <= range;
    },
    getRangeTo(target: RoomPosition | { pos: RoomPosition }) {
      const targetPos = 'pos' in target ? target.pos : target;
      return Math.max(Math.abs(this.x - targetPos.x), Math.abs(this.y - targetPos.y));
    },
    findClosestByRange(targets: RoomPosition[]) {
      return targets[0] ?? null;
    },
    getDirectionTo(): DirectionConstant {
      return TOP;
    },
    lookFor() {
      return [];
    },
  } as const;

  return pos as unknown as RoomPosition;
}

export function createStore<T extends ResourceConstant = ResourceConstant>({ used = 0, capacity = 100 }: StoreOptions = {}): Store<T, false> {
  const store = {
    getFreeCapacity: () => capacity - used,
    getUsedCapacity: () => used,
    [globalAny.RESOURCE_ENERGY]: used,
  } as unknown as Store<T, false>;
  return store;
}

export function createCreep(overrides: CreepOverrides = {}): Creep {
  const pos = overrides.pos ?? createPosition();
  const store = overrides.store ?? createStore({ used: 0, capacity: 100 });
  const creep: Partial<Creep> = {
    pos,
    store,
    room: (overrides.room ?? createRoom()) as Room,
    memory: overrides.memory ?? {},
    hits: overrides.hits ?? 100,
    hitsMax: overrides.hitsMax ?? 100,
    moveTo: overrides.moveTo ?? (() => globalAny.OK),
    move: overrides.move ?? (() => globalAny.OK),
    harvest: overrides.harvest ?? (() => globalAny.OK),
    transfer: overrides.transfer ?? (() => globalAny.OK),
    withdraw: overrides.withdraw ?? (() => globalAny.OK),
    upgradeController: overrides.upgradeController ?? (() => globalAny.OK),
    build: overrides.build ?? (() => globalAny.OK),
    repair: overrides.repair ?? (() => globalAny.OK),
    attack: overrides.attack ?? (() => globalAny.OK),
    rangedAttack: overrides.rangedAttack ?? (() => globalAny.OK),
    heal: overrides.heal ?? (() => globalAny.OK),
    ...overrides,
  };

  return creep as Creep;
}

export function createSpawn(overrides: SpawnOverrides = {}): StructureSpawn {
  const { store, controller, ...rest } = overrides as SpawnOverrides & { controller?: never };
  const spawn: Partial<StructureSpawn> = {
    room: (overrides.room ?? createRoom()) as Room,
    spawning: overrides.spawning ?? null,
    spawnCreep: overrides.spawnCreep ?? (() => globalAny.OK),
    ...rest,
  };
  if (store !== undefined) {
    spawn.store = store;
  }

  return spawn as StructureSpawn;
}

export function createRoom(overrides: RoomOverrides = {}): Room {
  const { controller, ...rest } = overrides;
  const room: Partial<Room> = {
    name: overrides.name ?? 'W0N0',
    find: overrides.find ?? ((_type: FindConstant) => []),
    ...rest,
  };
  if (controller !== undefined) {
    room.controller = controller;
  }

  return room as Room;
}

export function createTower(overrides: TowerOverrides = {}): StructureTower {
  const room = (overrides.room ?? createRoom()) as Room;
  const tower: Partial<StructureTower> = {
    room,
    pos: overrides.pos ?? createPosition(),
    store:
      (overrides.store as Store<RESOURCE_ENERGY, false> | undefined) ??
      (createStore<RESOURCE_ENERGY>({ used: 0, capacity: 300 }) as Store<RESOURCE_ENERGY, false>),
    energy: overrides.energy ?? 0,
    attack: overrides.attack ?? (() => globalAny.OK),
    repair: overrides.repair ?? (() => globalAny.OK),
    heal: overrides.heal ?? (() => globalAny.OK),
    ...overrides,
  };
  assert.ok(tower.room, 'Tower requires a room');
  return tower as StructureTower;
}

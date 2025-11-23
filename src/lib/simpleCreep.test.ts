import { beforeEach, describe, test } from 'node:test';
import assert = require('node:assert');
import { ActionStatus } from './status';
import { Role } from './roles';
import { SimpleCreep, forEachCreep, onTick, runRole, runTickHandlers } from './simpleCreep';
import {
  createCreep,
  createPosition,
  createRoom,
  createStore,
  setupScreepsGlobals,
} from './__tests__/screeps-mock';

describe('SimpleCreep utilities', () => {
  beforeEach(() => {
    setupScreepsGlobals();
  });

  test('onTick and runTickHandlers execute callbacks', () => {
    let count = 0;
    onTick(() => count++);
    onTick(() => count++);
    runTickHandlers();
    assert.strictEqual(count, 2);
  });

  test('forEachCreep wraps creeps in SimpleCreep', () => {
    const room = createRoom();
    const creepA = createCreep({ room, memory: { role: Role.Harvester }, pos: createPosition(1, 1) });
    Game.creeps = { a: creepA };
    let seen = 0;
    forEachCreep(sc => {
      assert.ok(sc instanceof SimpleCreep);
      seen += 1;
    });
    assert.strictEqual(seen, 1);
  });

  test('runRole dispatches by creep role', () => {
    const room = createRoom();
    const creepA = createCreep({ room, memory: { role: Role.Worker }, pos: createPosition(1, 1) });
    Game.creeps = { a: creepA };
    let workerCalled = 0;
    runRole({
      [Role.Worker]: () => workerCalled++,
      [Role.Harvester]: () => {
        throw new Error('wrong role');
      },
    });
    assert.strictEqual(workerCalled, 1);
  });
});

describe('SimpleCreep Chapter1 harvesting', () => {
  beforeEach(() => {
    setupScreepsGlobals();
  });

  test('full/empty/needsEnergy reflect store state', () => {
    const creep = createCreep({ store: createStore({ used: 100, capacity: 100 }) });
    const sc = new SimpleCreep(creep);
    assert.strictEqual(sc.full(), true);
    assert.strictEqual(sc.empty(), false);
    assert.strictEqual(sc.needsEnergy(), false);
  });

  test('moveTo returns already there when on target', () => {
    const pos = createPosition(0, 0);
    const creep = createCreep({ pos });
    const sc = new SimpleCreep(creep);
    assert.strictEqual(sc.moveTo(pos), ActionStatus.ALREADY_THERE);
  });

  test('moveNear moves when not adjacent', () => {
    const creep = createCreep({ pos: createPosition(0, 0) });
    const target = createPosition(5, 5);
    const sc = new SimpleCreep(creep);
    const status = sc.moveNear(target);
    assert.strictEqual(status, ActionStatus.MOVING);
  });

  test('stayAwayFrom retreats when too close', () => {
    let moved = false;
    const creep = createCreep({
      pos: createPosition(0, 0),
      move: () => {
        moved = true;
        return OK;
      },
    });
    const sc = new SimpleCreep(creep);
    const status = sc.stayAwayFrom(createPosition(0, 0), 3);
    assert.strictEqual(status, ActionStatus.RETREATING);
    assert.ok(moved);
  });

  test('harvest returns NOT_IN_RANGE when far and HARVESTING when near', () => {
    const source = { pos: createPosition(1, 1) } as Source;
    const creep = createCreep({ pos: createPosition(5, 5) });
    const sc = new SimpleCreep(creep);
    assert.strictEqual(sc.harvest(source), ActionStatus.NOT_IN_RANGE);

    const nearCreep = createCreep({ pos: createPosition(1, 1) });
    const near = new SimpleCreep(nearCreep);
    assert.strictEqual(near.harvest(source), ActionStatus.HARVESTING);
  });

  test('transferEnergyTo moves into range then transfers', () => {
    const target = { pos: createPosition(2, 2) } as AnyCreep;
    const movingCreep = createCreep({ pos: createPosition(0, 0), store: createStore({ used: 50, capacity: 100 }) });
    const scMoving = new SimpleCreep(movingCreep);
    assert.strictEqual(scMoving.transferEnergyTo(target), ActionStatus.MOVING);

    const transferCreep = createCreep({
      pos: createPosition(0, 0),
      store: createStore({ used: 50, capacity: 100 }),
      transfer: () => OK,
    });
    const scTransfer = new SimpleCreep(transferCreep);
    assert.strictEqual(scTransfer.transferEnergyTo({ pos: createPosition(0, 0) } as AnyStoreStructure), ActionStatus.TRANSFERRING);
  });

  test('withdraw requires adjacency and available energy', () => {
    const target = { pos: createPosition(2, 2), store: createStore({ used: 100, capacity: 200 }) } as AnyStoreStructure;
    const scFar = new SimpleCreep(createCreep({ pos: createPosition(0, 0) }));
    assert.strictEqual(scFar.withdraw(target), ActionStatus.NOT_IN_RANGE);

    const emptyTarget = { pos: createPosition(0, 0), store: createStore({ used: 0, capacity: 200 }) } as AnyStoreStructure;
    const scEmpty = new SimpleCreep(createCreep({ pos: createPosition(0, 0) }));
    assert.strictEqual(scEmpty.withdraw(emptyTarget), ActionStatus.ERROR);

    const scNear = new SimpleCreep(createCreep({ pos: createPosition(0, 0) }));
    assert.strictEqual(
      scNear.withdraw({ pos: createPosition(0, 0), store: createStore({ used: 50, capacity: 200 }) } as AnyStoreStructure),
      ActionStatus.WITHDRAWING,
    );
  });
});

describe('Chapter3 work routines', () => {
  beforeEach(() => setupScreepsGlobals());

  test('upgradeController moves when out of range and upgrades when close', () => {
    const controller = { pos: createPosition(4, 4) } as StructureController;
    const room = createRoom({ controller });
    const mover = new SimpleCreep(createCreep({ room, pos: createPosition(0, 0), store: createStore({ used: 50, capacity: 100 }) }));
    assert.strictEqual(mover.upgradeController(), ActionStatus.MOVING);

    const upgrader = new SimpleCreep(createCreep({ room, pos: createPosition(4, 4), store: createStore({ used: 50, capacity: 100 }) }));
    assert.strictEqual(upgrader.upgradeController(), ActionStatus.UPGRADING);
  });

  test('hasWork detects construction, repair, or controller needs', () => {
    const roomWithSites = createRoom({
      find: (type: FindConstant) => (type === FIND_CONSTRUCTION_SITES ? [{} as ConstructionSite] : []),
    });
    const scSite = new SimpleCreep(createCreep({ room: roomWithSites }));
    assert.ok(scSite.hasWork());

    const roomWithDamage = createRoom({
      find: (type: FindConstant) => (type === FIND_STRUCTURES ? [{ hits: 0, hitsMax: 10 } as Structure] : []),
    });
    const scDamage = new SimpleCreep(createCreep({ room: roomWithDamage }));
    assert.ok(scDamage.hasWork());

    const controller = { level: 7 } as StructureController;
    const roomController = createRoom({ controller, find: () => [] });
    const scController = new SimpleCreep(createCreep({ room: roomController }));
    assert.ok(scController.hasWork());
  });
});

describe('Chapter4 combat routines', () => {
  beforeEach(() => setupScreepsGlobals());

  test('attackClosestHostile moves toward target then attacks when adjacent', () => {
    const hostile = createCreep({ pos: createPosition(5, 5) });
    const room = createRoom({ find: (type: FindConstant) => (type === FIND_HOSTILE_CREEPS ? [hostile] : []) });
    const sc = new SimpleCreep(createCreep({ room, pos: createPosition(0, 0) }));
    assert.strictEqual(sc.attackClosestHostile(), ActionStatus.MOVING);

    const adjacent = new SimpleCreep(createCreep({ room, pos: createPosition(5, 5) }));
    assert.strictEqual(adjacent.attackClosestHostile(), ActionStatus.ATTACKING);
  });

  test('healSelfIfNeeded heals when damaged and reports healthy otherwise', () => {
    const wounded = new SimpleCreep(createCreep({ hits: 50, hitsMax: 100 }));
    assert.strictEqual(wounded.healSelfIfNeeded(), ActionStatus.HEALING);

    const healthy = new SimpleCreep(createCreep({ hits: 100, hitsMax: 100 }));
    assert.strictEqual(healthy.healSelfIfNeeded(), ActionStatus.HEALTHY);
  });
});

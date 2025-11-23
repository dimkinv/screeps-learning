import { beforeEach, describe, test } from 'node:test';
import assert = require('node:assert');
import { ActionStatus } from './status';
import { hasHostilesInRoom, towerDefendBase } from './simpleCreepUtilities';
import { createCreep, createPosition, createRoom, createStore, createTower, setupScreepsGlobals } from './__tests__/screeps-mock';

describe('simpleCreepUtilities', () => {
  beforeEach(() => setupScreepsGlobals());

  test('towerDefendBase prioritizes hostiles then repairs then heals', () => {
    const hostile = createCreep({ pos: createPosition(1, 1) });
    const damaged = { pos: createPosition(2, 2), hits: 10, hitsMax: 100 } as Structure;
    const injured = createCreep({ pos: createPosition(3, 3), hits: 50, hitsMax: 100 });
    const room = createRoom({
      find: (type: FindConstant) => {
        if (type === FIND_HOSTILE_CREEPS) return [hostile];
        if (type === FIND_STRUCTURES) return [damaged];
        if (type === FIND_MY_CREEPS) return [injured];
        return [];
      },
    });
    const tower = createTower({ room, store: createStore<RESOURCE_ENERGY>({ used: 200, capacity: 300 }) });
    assert.strictEqual(towerDefendBase(tower), ActionStatus.ATTACK);

    room.find = (type: FindConstant) => {
      if (type === FIND_HOSTILE_CREEPS) return [];
      if (type === FIND_STRUCTURES) return [damaged];
      if (type === FIND_MY_CREEPS) return [injured];
      return [];
    };
    assert.strictEqual(towerDefendBase(tower), ActionStatus.REPAIR);

    room.find = (type: FindConstant) => {
      if (type === FIND_HOSTILE_CREEPS) return [];
      if (type === FIND_STRUCTURES) return [];
      if (type === FIND_MY_CREEPS) return [injured];
      return [];
    };
    assert.strictEqual(towerDefendBase(tower), ActionStatus.HEAL);
  });

  test('hasHostilesInRoom detects hostiles', () => {
    const room = createRoom({ find: (type: FindConstant) => (type === FIND_HOSTILE_CREEPS ? [createCreep()] : []) });
    assert.ok(hasHostilesInRoom(room));
  });
});

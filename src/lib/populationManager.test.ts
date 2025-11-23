import { beforeEach, describe, test } from 'node:test';
import assert = require('node:assert');
import { Role } from './roles';
import { PopulationManager } from './populationManager';
import { createCreep, createRoom, createSpawn, setupScreepsGlobals } from './__tests__/screeps-mock';

describe('PopulationManager', () => {
  beforeEach(() => setupScreepsGlobals());

  test('canBuildCreep respects spawn availability and energy', () => {
    const room = createRoom({ energyAvailable: 300 });
    const spawn = createSpawn({ room });
    Game.spawns = { home: spawn };
    assert.ok(PopulationManager.canBuildCreep(Role.Harvester));

    (spawn as StructureSpawn).spawning = { name: 'busy' } as Spawning;
    assert.strictEqual(PopulationManager.canBuildCreep(Role.Harvester), false);
  });

  test('buildCreep returns appropriate status and increments Memory counter', () => {
    const room = createRoom({ energyAvailable: 300 });
    let spawnedName = '';
    const spawn = createSpawn({
      room,
      spawnCreep: (_body, name) => {
        spawnedName = name;
        return OK;
      },
    });
    Game.spawns = { home: spawn };
    const status = PopulationManager.buildCreep(Role.Worker);
    assert.strictEqual(status, 'SPAWNING');
    assert.ok(spawnedName.includes(Role.Worker));
    assert.ok((Memory as any).__pmCounter > 0);
  });

  test('getCreepCount counts creeps by role', () => {
    const room = createRoom();
    Game.creeps = {
      a: createCreep({ room, memory: { role: Role.Harvester } }),
      b: createCreep({ room, memory: { role: Role.Worker } }),
      c: createCreep({ room, memory: { role: Role.Harvester } }),
    };
    assert.strictEqual(PopulationManager.getCreepCount(Role.Harvester), 2);
  });

  test('maintainPopulation reports statuses for roles', () => {
    const room = createRoom({ energyAvailable: 300 });
    Game.spawns = { s: createSpawn({ room }) };
    Game.creeps = {};
    const summary = PopulationManager.maintainPopulation({ [Role.Harvester]: 1, [Role.Worker]: 0 });
    assert.strictEqual(summary[Role.Harvester], 'SPAWNING');
    assert.strictEqual(summary[Role.Worker], 'CAPPED');
  });

  test('getQueuedSpawns lists active spawns with inferred role', () => {
    const room = createRoom({ energyAvailable: 300 });
    Game.spawns = {
      s: createSpawn({ room, spawning: { name: 'harvester-1-123', remainingTime: 3 } as Spawning }),
    };
    const jobs = PopulationManager.getQueuedSpawns();
    assert.strictEqual(jobs.length, 1);
    const job = jobs[0];
    assert.ok(job);
    assert.strictEqual(job.role, Role.Harvester);
  });

  test('forEachCreepOfRole wraps creeps by role', () => {
    const room = createRoom();
    Game.creeps = {
      a: createCreep({ room, memory: { role: Role.Soldier } }),
      b: createCreep({ room, memory: { role: Role.Harvester } }),
    };
    let seen = 0;
    PopulationManager.forEachCreepOfRole(Role.Harvester, () => seen++);
    assert.strictEqual(seen, 1);
  });
});

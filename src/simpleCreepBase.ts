import { Role } from "./roles";

export type CreepWithTypedMemory<R extends Role> = Creep & { memory: CreepMemory & { role: R } };

export type SimpleCreepArgs = [creep: Creep, homeSpawnName?: string];

export class SimpleCreepBase {
  public creep: CreepWithTypedMemory<Role>;
  public homeSpawnName: string | undefined;

  constructor(creep: Creep, homeSpawnName?: string) {
    this.creep = creep as CreepWithTypedMemory<Role>;
    this.homeSpawnName = homeSpawnName;
  }
}

export type SimpleCreepConstructor<T = SimpleCreepBase> = new (...args: any[]) => T;

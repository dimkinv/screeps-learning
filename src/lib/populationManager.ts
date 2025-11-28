import { Role } from "./roles";
import { SimpleCreep } from './simpleCreep';

type SpawnBuildResult = "SPAWNING" | "NOT_ENOUGH_ENERGY" | "SPAWN_BUSY" | "ERROR";
type MaintainStatus = "OK" | "SPAWNING" | "CAPPED" | "BLOCKED";

export interface SpawnJob {
  role: Role;
  name: string;
  remainingTime?: number;
  spawnName?: string;
}

class PopulationManagerClass {
  // Deterministic body selection per role based on available energy.
  private chooseBody(role: Role, availableEnergy: number): BodyPartConstant[] {
    const body: BodyPartConstant[] = [];

    const pushParts = (...parts: BodyPartConstant[]) => parts.forEach(p => body.push(p));

    const costOf = (parts: BodyPartConstant[]) => parts.reduce((s, p) => s + (BODYPART_COST[p] || 0), 0);

    // Minimal bodies
    if (role === Role.Harvester) {
      const base = [WORK, CARRY, MOVE];
      if (costOf(base) > availableEnergy) return [];
      pushParts(...base);
      // Add pairs of WORK+MOVE while we have capacity (simple scaling)
      while (body.length + 2 <= 50 && costOf([WORK, MOVE]) + costOf(body) <= availableEnergy) {
        pushParts(WORK, MOVE);
      }
      // Add extra CARRY if energy allows
      while (body.length + 1 <= 50 && costOf([CARRY]) + costOf(body) <= availableEnergy) pushParts(CARRY);
      return body;
    }

    if (role === Role.Worker) {
      const base = [WORK, CARRY, MOVE];
      if (costOf(base) > availableEnergy) return [];
      pushParts(...base);
      // Try to balance WORK and CARRY
      while (body.length + 3 <= 50 && costOf([WORK, CARRY, MOVE]) + costOf(body) <= availableEnergy) {
        pushParts(WORK, CARRY, MOVE);
      }
      return body;
    }

    // Soldier
    if (role === Role.Soldier) {
      const base = [TOUGH, ATTACK, MOVE];
      if (costOf(base) > availableEnergy) return [];
      pushParts(...base);
      // Add ATTACK+MOVE pairs
      while (body.length + 2 <= 50 && costOf([ATTACK, MOVE]) + costOf(body) <= availableEnergy) {
        pushParts(ATTACK, MOVE);
      }
      return body;
    }

    return [];
  }

  private getPrimarySpawn(): StructureSpawn | undefined {
    const names = Object.keys(Game.spawns || {});
    if (names.length === 0) return undefined;
    return Game.spawns[names[0] as string];
  }

  /**
   * Проверяет, можно ли сейчас создать крипа указанной роли на основном спауне.
   * @returns `true`, если спаун свободен и энергии хватает на минимальное тело.
   */
  canBuildCreep(role: Role): boolean {
    const spawn = this.getPrimarySpawn();
    if (!spawn) return false;
    if (spawn.spawning) return false;
    const room = spawn.room;
    if (!room) return false;
    const available = room.energyAvailable ?? 0;
    const body = this.chooseBody(role, available);
    return body.length > 0;
  }

  /**
   * Пытается начать создание крипа указанной роли.
   * @returns Результат, отражающий старт, блокировку или ошибку спауна.
   */
  buildCreep(role: Role): SpawnBuildResult {
    const spawn = this.getPrimarySpawn();
    if (!spawn) return "ERROR";
    if (spawn.spawning) return "SPAWN_BUSY";
    const room = spawn.room;
    if (!room) return "ERROR";
    const available = room.energyAvailable ?? 0;
    const body = this.chooseBody(role, available);
    if (body.length === 0) return "NOT_ENOUGH_ENERGY";

    // Ensure a stable unique counter in Memory
    if (!(Memory as any).__pmCounter) (Memory as any).__pmCounter = 0;
    (Memory as any).__pmCounter = ((Memory as any).__pmCounter as number) + 1;
    const name = `${role}-${(Memory as any).__pmCounter}-${Game.time}`;

    const res = spawn.spawnCreep(body, name, { memory: { role } as any });
    if (res === OK) return "SPAWNING";
    if (res === ERR_NOT_ENOUGH_ENERGY) return "NOT_ENOUGH_ENERGY";
    if (res === ERR_BUSY || res === ERR_NAME_EXISTS) return "SPAWN_BUSY";
    return "ERROR";
  }

  /**
   * Подсчитывает активных крипов с указанной ролью.
   * @returns Количество крипов с заданной ролью.
   */
  getCreepCount(role: Role): number {
    let count = 0;
    for (const n in Game.creeps) {
      const c = Game.creeps[n];
      if (!c) continue;
      const memRole = (c.memory && (c.memory as any).role) as Role | undefined;
      if (memRole === role) count += 1;
    }
    return count;
  }

  /**
   * Обеспечивает минимальное количество крипов роли, создавая новых при нехватке.
   * @returns Статус: достигнут лимит, идёт спаун или создание заблокировано.
   */
  maintainCreepsAtRole(role: Role, targetCount: number): MaintainStatus {
    const current = this.getCreepCount(role);
    if (current >= targetCount) return "CAPPED";
    if (!this.canBuildCreep(role)) return "BLOCKED";
    const res = this.buildCreep(role);
    if (res === "SPAWNING") return "SPAWNING";
    if (res === "NOT_ENOUGH_ENERGY") return "BLOCKED";
    return res === "SPAWN_BUSY" ? "BLOCKED" : "OK";
  }

  /**
   * Поддерживает численность нескольких ролей за один проход.
   * @param targets Отображение роль → требуемое количество.
   * @returns Отображение роль → статус поддержки.
   */
  maintainPopulation(targets: Partial<Record<Role, number>>): Partial<Record<Role, MaintainStatus>> {
    const summary: Partial<Record<Role, MaintainStatus>> = {};
    for (const rKey of Object.keys(targets)) {
      const role = rKey as Role;
      const target = (targets as any)[role] as number | undefined;
      if (typeof target !== "number") continue;
      summary[role] = this.maintainCreepsAtRole(role, target);
    }
    return summary;
  }

  /**
   * Сообщает о текущих заданиях спауна и оставшемся времени.
   * @returns Список заданий спауна с ролью, именем и оставшимся временем.
   */
  getQueuedSpawns(): SpawnJob[] {
    const jobs: SpawnJob[] = [];
    for (const sName in Game.spawns) {
      const sp = Game.spawns[sName];
      if (!sp) continue;
      if (sp.spawning) {
        const memEntry = (Memory as any)[sp.spawning.name];
        const inferredRole = (memEntry && (memEntry.role as Role)) || (sp.spawning.name.split("-")[0] as Role);
        jobs.push({ role: inferredRole, name: sp.spawning.name, remainingTime: (sp.spawning as any).remainingTime, spawnName: sName });
      }
    }
    return jobs;
  }

  /**
   * Проходит по всем крипам заданной роли, вызывая обработчик с `SimpleCreep`.
   * @param role Роль для фильтрации.
   * @param handler Колбэк, выполняемый для каждого крипа.
   */
  forEachCreepOfRole(role: Role, handler: (sc: SimpleCreep) => void) {
    for (const n in Game.creeps) {
      const c = Game.creeps[n];
      if (!c) continue;
      const memRole = (c.memory && (c.memory as any).role) as Role | undefined;
      if (memRole === role) handler(new SimpleCreep(c));
    }
  }
}

export const PopulationManager = new PopulationManagerClass();

export default PopulationManager;

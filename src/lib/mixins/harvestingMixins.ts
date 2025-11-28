import { ActionStatus } from "../status";
import { SimpleCreepBase, SimpleCreepConstructor } from "../simpleCreepBase";

export type ClosestTargetType =
  | "source"
  | "controller"
  | "storage"
  | "container"
  | "spawn"
  | "extension"
  | "tower"
  | "droppedEnergy";

export interface HarvestingCapabilities {
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
  findClosestTarget(type: ClosestTargetType): RoomObject | Structure | null;
}

export function HarvestingMixin<TBase extends SimpleCreepConstructor<SimpleCreepBase>>(Base: TBase) {
  return class Chapter1Harvesting extends Base implements HarvestingCapabilities {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Найти ближайший объект указанного типа в текущей комнате.
     * @param type Тип цели: источник, контроллер, хранилище, контейнер, спаун, расширение, башня или сброшенная энергия.
     * @returns Ближайшая подходящая цель или `null`, если ничего не найдено.
     */
    findClosestTarget(type: ClosestTargetType): RoomObject | Structure | null {
      const room = this.creep.room;
      if (!room) return null;

      switch (type) {
        case "source": {
          const sources = room.find(FIND_SOURCES) as Source[];
          return (this.creep.pos.findClosestByRange(sources) as Source | null) ?? null;
        }
        case "controller":
          return room.controller ?? null;
        case "storage":
          return room.storage ?? null;
        case "container": {
          const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER,
          }) as StructureContainer[];
          return (this.creep.pos.findClosestByRange(containers) as StructureContainer | null) ?? null;
        }
        case "spawn": {
          const spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
          return (this.creep.pos.findClosestByRange(spawns) as StructureSpawn | null) ?? null;
        }
        case "extension": {
          const extensions = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION,
          }) as StructureExtension[];
          return (this.creep.pos.findClosestByRange(extensions) as StructureExtension | null) ?? null;
        }
        case "tower": {
          const towers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER,
          }) as StructureTower[];
          return (this.creep.pos.findClosestByRange(towers) as StructureTower | null) ?? null;
        }
        case "droppedEnergy": {
          const drops = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY,
          }) as Resource[];
          return (this.creep.pos.findClosestByRange(drops) as Resource | null) ?? null;
        }
        default:
          return null;
      }
    }

    /** @returns Указывает, что у крипа нет свободного места для энергии. */
    full(): boolean {
      return (this.creep.store.getFreeCapacity(RESOURCE_ENERGY) ?? 0) === 0;
    }

    /** @returns Указывает, что крип не несёт энергию. */
    empty(): boolean {
      return (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) === 0;
    }

    /** @returns Указывает, что крип может принять ещё энергию. */
    needsEnergy(): boolean {
      return !this.full();
    }

    /**
     * Проверяет, находится ли крип в заданной дистанции от цели.
     * @param target Комнатная позиция или объект с позицией.
     * @param range Максимальная дистанция для проверки (по умолчанию 1).
     */
    isNear(target: RoomPosition | { pos: RoomPosition } | RoomObject, range = 1): boolean {
      const pos = (target as any).pos ?? target;
      return this.creep.pos.inRangeTo(pos, range);
    }

    /**
     * Перемещает крипа к целевой позиции или объекту.
     * @returns `ALREADY_THERE`, если крип уже на цели, `NO_PATH` при ошибке пути, `ERROR` для прочих ошибок, иначе `MOVING`.
     */
    moveTo(target: RoomPosition | { pos: RoomPosition } | RoomObject): ActionStatus {
      if (this.isNear(target, 0)) return ActionStatus.ALREADY_THERE;
      const moveResult = this.creep.moveTo(target as any, { visualizePathStyle: { stroke: "#ffffff" } }) as number;
      if (moveResult === ERR_NO_PATH) return ActionStatus.NO_PATH;
      if (moveResult !== OK && moveResult !== ERR_TIRED) return ActionStatus.ERROR;
      return ActionStatus.MOVING;
    }

    /**
     * Сближает крипа с целью до дистанции 1.
     * @param target Позиция или объект, к которому нужно подойти.
     * @returns `ALREADY_NEAR`, если крип уже рядом, `NO_PATH` при ошибке пути, иначе `MOVING`.
     */
    moveNear(target: RoomPosition | { pos: RoomPosition } | RoomObject): ActionStatus {
      if (this.isNear(target, 1)) return ActionStatus.ALREADY_NEAR;
      const result = this.moveTo(target);
      if (result === ActionStatus.NO_PATH) return ActionStatus.NO_PATH;
      if (result === ActionStatus.ERROR) return ActionStatus.ERROR;
      return ActionStatus.MOVING;
    }

    /**
     * Держит дистанцию не ближе указанного значения, отступая при необходимости.
     * @param target Цель, от которой нужно держаться подальше.
     * @param distance Минимальная дистанция до цели.
     * @returns `SAFE`, если дистанция безопасна, `RETREATING` во время отступления, либо `NO_PATH`/`ERROR` при ошибках.
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
     * Перемещает крипа к флагу в той же комнате.
     * @param flagName Имя целевого флага.
     * @returns Статус движения или `NO_TARGET`, если флаг недоступен.
     */
    moveToFlag(flagName: string): ActionStatus {
      const flag = Game.flags[flagName];
      if (!flag || flag.pos.roomName !== this.creep.room?.name) return ActionStatus.NO_TARGET;
      return this.moveTo(flag.pos);
    }

    /**
     * Проверяет совпадение позиции крипа с указанными координатами.
     * @param position Целевая позиция для сравнения.
     * @returns `true`, если крип стоит на этой клетке.
     */
    isAt(position: RoomPosition): boolean {
      return (
        this.creep.pos.x === position.x &&
        this.creep.pos.y === position.y &&
        this.creep.pos.roomName === position.roomName
      );
    }

    /**
     * Двигает крипа к ближайшему спауну в комнате (приоритет `homeSpawnName`, если задан)
     * и останавливается на дистанции 1.
     * @returns `MOVING` во время движения или `ALREADY_THERE`, если крип уже рядом.
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
     * Передаёт всю энергию ближайшему спауну, если он находится на соседней клетке.
     * Возвращает `TRANSFERRING` при успешной передаче, `EMPTY`, если нет энергии,
     * либо `NO_TARGET`, если рядом нет подходящего спауна. `ERROR` сигнализирует о непредвиденной ошибке.
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

      const carrying = (this.creep.store && this.creep.store.getUsedCapacity)
        ? (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
        : 0;

      const spawnFree = (spawn.store && (spawn.store.getFreeCapacity))
        ? (spawn.store.getFreeCapacity(RESOURCE_ENERGY) ?? 0)
        : ((spawn.store.getCapacity(RESOURCE_ENERGY) ?? 0) - (spawn.store[RESOURCE_ENERGY] ?? 0));

      // If the spawn doesn't have enough free room for ALL the creep's energy, report TARGET_FULL
      if (spawnFree < carrying) return ActionStatus.TARGET_FULL;

      const res = (this.creep.transfer as any)(spawn as any, RESOURCE_ENERGY);
      if (res === OK) return ActionStatus.TRANSFERRING;
      return ActionStatus.ERROR;
    }

    /**
     * Добывает энергию из источника, стоя рядом с ним.
     * @returns `HARVESTING` при успехе, `NOT_IN_RANGE`, если далеко, иначе `ERROR`.
     */
    harvest(source: Source): ActionStatus {
      if (!this.isNear(source, 1)) return ActionStatus.NOT_IN_RANGE;
      const res = this.creep.harvest(source);
      if (res === OK) return ActionStatus.HARVESTING;
      return ActionStatus.ERROR;
    }

    /**
     * Передаёт энергию указанной цели, ожидая, что крип уже в радиусе 1.
     * @returns `TRANSFERRING` при успешной передаче, `NOT_IN_RANGE`, если далеко, `EMPTY`, если нет энергии.
     */
    transferEnergyTo(target: Structure | RoomObject): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      if (!this.isNear(target, 1)) return ActionStatus.NOT_IN_RANGE;
      const res = (this.creep.transfer as any)(target as any, RESOURCE_ENERGY);
      if (res === OK) return ActionStatus.TRANSFERRING;
      return ActionStatus.ERROR;
    }

    /**
     * Извлекает энергию из соседней структуры или контейнера.
     * @returns `WITHDRAWING` при успехе, `NOT_IN_RANGE`, если далеко, `ERROR`, если энергия недоступна.
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

export type Chapter1Harvesting = InstanceType<ReturnType<typeof HarvestingMixin>>;

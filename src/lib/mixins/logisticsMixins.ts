import { ActionStatus } from "../status";
import { SimpleCreepBase, SimpleCreepConstructor } from "../simpleCreepBase";
import { HarvestingCapabilities } from "./harvestingMixins";

export function LogisticsMixin<
  TBase extends SimpleCreepConstructor<SimpleCreepBase & HarvestingCapabilities>,
>(Base: TBase) {
  return class Chapter5Logistics extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Ищет лучший источник энергии, отличный от добычи (сначала дроп, затем контейнеры, затем хранилище).
     * @returns Сброшенный ресурс, контейнер, хранилище или `null`, если целей нет.
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
     * Подбирает сброшенную энергию или извлекает её из контейнера/хранилища без перемещения.
     * @returns Статус действия или `FULL`/`NO_TARGET`, если нет места или целей.
     */
    pickupOrWithdrawEnergy(): ActionStatus {
      if (this.full()) return ActionStatus.FULL;

      const target = this.findEnergyDropOrContainer();
      if (!target) return ActionStatus.NO_TARGET;

      if ((target as Resource).resourceType === RESOURCE_ENERGY) {
        const resTarget = target as Resource;
        if (!this.isNear(resTarget, 1)) return ActionStatus.NOT_IN_RANGE;
        const res = this.creep.pickup(resTarget);
        if (res === OK) return ActionStatus.PICKING_UP;
        return ActionStatus.ERROR;
      }

      if (!this.isNear(target, 1)) return ActionStatus.NOT_IN_RANGE;

      const withdrawResult = this.withdraw(target as any);
      if (withdrawResult === ActionStatus.WITHDRAWING) return ActionStatus.WITHDRAWING;
      return withdrawResult;
    }

    /**
     * Находит ближайший спаун или расширение, которому требуется энергия, и передаёт её без перемещения.
     * @returns Статус передачи, `EMPTY`, если нет энергии, или `NO_TARGET`, если цели отсутствуют.
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
     * Ставит энергию в контейнеры или хранилища без автоматического движения.
     * @returns Статус передачи, `EMPTY`, если нет энергии, или `NO_TARGET`, если нет свободных структур.
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
     * Проверяет, может ли крип взять ещё энергию.
     * @returns `true`, если есть свободная ёмкость.
     */
    hasRoomForEnergy(): boolean {
      return !this.full();
    }

    /**
     * Возвращает количество энергии у крипа.
     * @returns Текущий запас энергии.
     */
    getEnergyLevel(): number {
      return this.creep.store?.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
    }

    /**
     * Максимальная вместимость энергии у крипа.
     * @returns Общее доступное место под энергию.
     */
    getEnergyCapacity(): number {
      const cap = this.creep.store?.getCapacity(RESOURCE_ENERGY);
      return typeof cap === "number" ? cap : 0;
    }

    /**
     * Размещает энергию в базовых структурах (спауны, расширения, башни, контейнеры/хранилище) без передвижения.
     * @returns Статус передачи или `NO_TARGET`, если всем хватает энергии.
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

export type Chapter5Logistics = InstanceType<ReturnType<typeof LogisticsMixin>>;

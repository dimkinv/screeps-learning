import { ActionStatus } from "./status";
import { SimpleCreepBase, SimpleCreepConstructor } from "./simpleCreepBase";
import { HarvestingCapabilities } from "./mixins/harvestingMixins";

export function WorkMixin<
  TBase extends SimpleCreepConstructor<SimpleCreepBase & HarvestingCapabilities>,
>(Base: TBase) {
  return class Chapter3Work extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Пытается улучшить контроллер комнаты без автоматического передвижения.
     * @returns `UPGRADING` при успешном апгрейде, `NOT_IN_RANGE`, если далеко, `EMPTY` без энергии или `NO_TARGET`, если нет контроллера.
     */
    upgradeController(): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      const controller = this.creep.room?.controller;
      if (!controller) return ActionStatus.NO_TARGET;
      if (!this.isNear(controller, 3)) return ActionStatus.NOT_IN_RANGE;

      const res = this.creep.upgradeController(controller);
      if (res === OK) return ActionStatus.UPGRADING;
      return ActionStatus.ERROR;
    }

    /**
     * Возвращает ближайшую стройплощадку в комнате.
     * @returns Ближайший `ConstructionSite` или `null`, если площадки отсутствуют.
     */
    findClosestConstructionSite(): ConstructionSite | null {
      const room = this.creep.room;
      if (!room) return null;
      const sites = room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];
      if (!sites || sites.length === 0) return null;
      return (this.creep.pos.findClosestByRange(sites) as ConstructionSite | null) ?? null;
    }

    /**
     * Строит указанную стройплощадку, ожидая, что крип сам управляет перемещением.
     * @param site Целевая стройплощадка.
     * @returns `BUILDING` при успехе, `NOT_IN_RANGE`, если далеко, `EMPTY`, если нет энергии, либо `NO_TARGET`, если площадка отсутствует.
     */
    buildSite(site: ConstructionSite | null): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      if (!site) return ActionStatus.NO_TARGET;
      if (!this.isNear(site, 3)) return ActionStatus.NOT_IN_RANGE;

      const res = this.creep.build(site);
      if (res === OK) return ActionStatus.BUILDING;
      return ActionStatus.ERROR;
    }

    /**
     * Пытается построить площадку, найденную в конкретной позиции.
     * @param position Позиция, где ожидается стройплощадка.
     * @returns Результат строительства или `NO_SITE`/`NO_TARGET`, если площадки нет.
     */
    buildAt(position: RoomPosition): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      if (position.roomName !== this.creep.room?.name) return ActionStatus.NO_TARGET;

      const sites = position.lookFor(LOOK_CONSTRUCTION_SITES) as ConstructionSite[];
      const site = sites[0];
      if (!site) return ActionStatus.NO_SITE;

      if (!this.isNear(site, 3)) return ActionStatus.NOT_IN_RANGE;

      const res = this.creep.build(site);
      if (res === OK) return ActionStatus.BUILDING;
      return ActionStatus.ERROR;
    }

    /**
     * Ищет ближайшую повреждённую структуру (hits ниже максимума).
     * @returns Структура для ремонта или `null`, если всё исправно.
     */
    findClosestDamagedStructure(): Structure | null {
      const room = this.creep.room;
      if (!room) return null;

      const damaged = room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax }) as Structure[];
      if (!damaged || damaged.length === 0) return null;

      return (this.creep.pos.findClosestByRange(damaged) as Structure | null) ?? null;
    }

    /**
     * Ремонтирует указанную структуру без автоматического передвижения.
     * @param target Структура для ремонта.
     * @returns `REPAIRING` при успехе, `NOT_IN_RANGE`, если далеко, `EMPTY`, если нет энергии, либо `NO_TARGET`, если цель отсутствует.
     */
    repair(target: Structure | null): ActionStatus {
      if (this.empty()) return ActionStatus.EMPTY;
      if (!target) return ActionStatus.NO_TARGET;
      if (!this.isNear(target, 3)) return ActionStatus.NOT_IN_RANGE;

      const res = this.creep.repair(target);
      if (res === OK) return ActionStatus.REPAIRING;
      return ActionStatus.ERROR;
    }

    /**
     * Проверяет наличие работы (стройплощадки, ремонт или апгрейд контроллера).
     * @returns `true`, если есть, что строить, чинить или улучшать.
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
     * Выбирает доступную задачу: строить, чинить или апгрейдить, не двигая крипа автоматически.
     * @returns Статус выбранного действия или `NO_TARGET`, если работы нет.
     */
    doWork(): ActionStatus {
      const site = this.findClosestConstructionSite();
      if (site) return this.buildSite(site);

      const damaged = this.findClosestDamagedStructure();
      if (damaged) return this.repair(damaged);

      return this.upgradeController();
    }
  };
}

export type Chapter3Work = InstanceType<ReturnType<typeof WorkMixin>>;

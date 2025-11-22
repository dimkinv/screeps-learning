import PopulationManager from "./populationManager";
import { Role } from "./roles";
import { ActionStatus } from "./status";

PopulationManager.maintainCreepsAtRole(Role.Harvester, 4);

PopulationManager.forEachCreepOfRole(Role.Harvester, c => {
  if (c.full()) {
    const goHomeStatus = c.goHome();
    if (goHomeStatus === ActionStatus.ALREADY_THERE) {
      console.log(c.storeEnergyToBase());
    }
  } else {
    const source = c.findClosestSource();
    if (source) {
      if (!c.isNear(source, 1)) {
        c.moveTo(source);
      } else {
        c.harvest(source);
      }
    }
  }
});

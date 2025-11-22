import PopulationManager from "./populationManager";
import { Role } from "./roles";
import { ActionStatus } from "./status";

PopulationManager.maintainCreepsAtRole(Role.Harvester,4);

PopulationManager.forEachCreepOfRole(Role.Harvester, c => {
    if(c.full()){
        let k = c.goHome()
        if(k === ActionStatus.ALREADY_THERE){
            console.log(c.storeEnergyToBase())
        }
        // console.log(k);
    } else {
        let a = c.findClosestSource();
        if(a){
            if ( !c.isNear(a,1) ){
                c.moveTo(a);
            } else{
                c.harvest(a)
            }   
        }
    }

    
       
})
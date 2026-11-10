import {getVehicleDefinition} from '../render/vehicle-catalog.mjs?v=d34c237e4bf2bab0';
export function initialVehicle(storage=globalThis.__asfaltoV7Storage){let id;try{id=storage?.getItem('asfalto:nacional:v6:selected-vehicle');}catch{}return getVehicleDefinition(id)?.selectable?id:'chevrolet_1969';}

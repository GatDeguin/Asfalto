/** HUD readings from the same simulation snapshot as authored instruments.
 * Oil reports maintenance condition, never an invented pressure measurement.
 */
export function vehicleHudTelemetry(snapshot, oilCondition){
 const finite=value=>Number.isFinite(value)?value:null;
 const rpm=finite(snapshot?.engine?.rpm),temperatureC=finite(snapshot?.engine?.temperatureC);
 const selected=snapshot?.gearbox?.gear;
 const gear=selected===-1?'R':selected===0?'N':Number.isInteger(selected)&&selected>0?String(selected):'—';
 const oil=finite(oilCondition);
 return {gear,rpm:rpm===null?null:Math.max(0,Math.round(rpm)),temperatureC:temperatureC===null?null:Math.round(temperatureC),
  temperatureStatus:temperatureC===null?'unavailable':temperatureC>=110?'critical':temperatureC>=100?'warning':'normal',
  oilStatus:oil===null?'unavailable':oil<35?'critical':oil<62?'warning':'normal',oilSource:oil===null?'unavailable':'maintenance-condition',source:snapshot?'simulation':'unavailable'};
}

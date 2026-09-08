const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
/** Render state only: never writes roadWetness, grip, snow or physics environment. */
export function createWeatherDynamics(){
  const state={wetness:0,snowCover:0,compactedSnow:0,meltWater:0};let initialized=false;
  return{state,
    update({dt=0,environment={},wetness=0,rain=0,snow=0}={}){
      dt=clamp(dt,0,.05);if(!dt)return state;
      if(!initialized){state.wetness=clamp(wetness);state.snowCover=clamp(snow);initialized=true;}
      const temperature=Number(environment.temperatureC??12),targetSnow=temperature<=2?clamp(snow):0;
      const heavySnow=(environment.weatherId||environment.weather||environment.precipitation)==='heavy-snow';
      const accumulationSeconds=heavySnow?18:38,compactionSeconds=heavySnow?14:19;
      const melt=temperature>0?Math.min(state.snowCover,dt*(.0006+temperature*.00022)):0;
      state.snowCover=clamp(state.snowCover+(targetSnow-state.snowCover)*(1-Math.exp(-dt/accumulationSeconds))-melt);
      state.compactedSnow+=(state.snowCover*(heavySnow?.32:.24)-state.compactedSnow)*(1-Math.exp(-dt/compactionSeconds));
      state.meltWater=clamp(state.meltWater+melt*3-dt*.0015);
      const targetWet=clamp(Math.max(wetness,state.meltWater)),tau=targetWet>state.wetness?(rain>0?12:26):90;
      state.wetness+=(targetWet-state.wetness)*(1-Math.exp(-dt/tau));return state;
    },
    reset(){initialized=false;state.wetness=state.snowCover=state.compactedSnow=state.meltWater=0;},
  };
}
/** An actual wheel snapshot is mandatory for physically located emissions. */
export function wheelWeatherEmission(wheel={},speedMps=0,wetness=0){
  const speed=Math.abs(Number(speedMps)||0),load=clamp(wheel.normalLoadN/3500,0,1.5),wet=clamp(wetness);
  const enabled=wheel.contact===true&&load>0&&Array.isArray(wheel.point)&&wheel.point.length>=3;
  const surface=wheel.surface||'asphalt',soil=['gravel','dirt','grass','shoulder','sand'].includes(surface);
  const water=clamp(Math.max(Number(wheel.waterDepthM)||0,wet*.004)/.012);
  const slip=Math.max(Math.abs(Number(wheel.slipRatio)||0),Math.abs(Math.tan(Number(wheel.slipAngleRad)||0)));
  const dustLife=surface==='dirt'||surface==='sand'?2.8:surface==='gravel'?1.15:.75;
  return{spray:enabled?clamp((speed-2)/30)*Math.sqrt(load)*water:0,
    dust:enabled&&soil?clamp((speed-3)/24)*load*clamp(1-wet*2.5):0,
    smoke:enabled&&!soil&&wet<.25?clamp((speed-4)/15)*clamp((slip-.28)*1.8,0,.8)*load:0,
    dustLife:dustLife*(1-wet*.7),surface,load,water};
}
export function metalContactEmission(contact){
  if(!contact||!['metal','steel','guardrail','vehicle-metal'].includes(contact.material)||!contact.point||!contact.relativeVelocity)return 0;
  const v=contact.relativeVelocity,speed=Math.hypot(v.x??v[0]??0,v.y??v[1]??0,v.z??v[2]??0);
  if(speed<2.5||Number(contact.impulseNs??0)<25)return 0;
  return clamp((speed-2.5)/22)*clamp(contact.impulseNs/250,.15,1);
}

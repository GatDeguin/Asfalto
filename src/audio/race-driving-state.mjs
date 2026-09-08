const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,finite(v)));
export function drivingAudioState({snapshot={},controls={},speedMps,wetness=0}={}) {
  const velocity=snapshot.chassis?.linearVelocity||[0,0,0];
  const speed=Math.abs(finite(speedMps,Math.hypot(...velocity.map(v=>finite(v)))));
  const acceleration=snapshot.chassis?.acceleration||[0,0,0],q=snapshot.chassis?.rotation||[0,0,0,1];
  const forward=[1-2*(q[1]*q[1]+q[2]*q[2]),2*(q[0]*q[1]+q[3]*q[2]),2*(q[0]*q[2]-q[3]*q[1])];
  const throttle=clamp(finite(controls.throttle,snapshot.engine?.load));
  const rpm=clamp(snapshot.engine?.rpm,0,9000),torque=snapshot.engine?.torqueNm;
  const load=Number.isFinite(torque)?clamp(torque/360,-1,1):throttle;
  return {speedMps:speed,engine:{rpm,speedMps:speed,effectiveThrottle:throttle,engineLoad:load,
    clutch:clamp(finite(snapshot.clutch?.engagement,1)),longitudinalAccel:finite(acceleration.reduce((sum,v,i)=>sum+finite(v)*forward[i],0)),limiterCut:rpm>5400?.2:1},
    wheels:(snapshot.wheels||[]).map((w,index)=>{
      const contact=w.contact===true&&finite(w.normalLoadN)>100,weight=contact?clamp(w.normalLoadN/3700,0,1.5):0;
      const surface=String(w.surface||'asphalt'),hard=/asphalt|curb|concrete|pavement/.test(surface),gravel=/gravel|shoulder|dirt|earth/.test(surface);
      const slipSpeed=Math.hypot(Math.abs(finite(w.slipRatio))*speed,Math.tan(clamp(w.slipAngleRad,-.7,.7))*speed);
      const spinSpeed=Math.max(0,Math.abs(finite(w.angularSpeedRadps))*.315-speed);
      const slip=clamp((Math.max(slipSpeed,spinSpeed)-.65)/7)*weight;
      const wet=clamp(Math.max(clamp(wetness),finite(w.waterDepthM)*450));
      const moving=clamp(speed/28),rolling=Math.pow(moving,.85)*weight;
      return {id:w.id||String(index),pan:/left/i.test(w.id||'')?-.7:.7,surface,
        rolling:rolling*(hard?1:gravel?.5:.26),skid:hard?slip*(1-wet*.7):0,
        loose:gravel?rolling*.85+slip*.4:(!hard?rolling*.2:0),wet:hard?rolling*wet:0,
        braking:clamp(controls.brake)*clamp(speed/8)*weight*(1-clamp(Math.abs(finite(w.slipRatio)))*.75),
        bump:weight*clamp((Math.abs(finite(w.compressionVelocityMps))-.6)/2),
        temperatureC:clamp(w.temperatureC,0,250),wheelHz:clamp(Math.abs(finite(w.angularSpeedRadps))/(2*Math.PI),0,80)};
    })};
}

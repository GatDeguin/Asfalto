const smooth=(value)=>{
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
};

function startEngineCue(settings){
  if(settings?.soundEnabled===false||!globalThis.AudioContext)return ()=>{};
  let audio;
  try{
    audio=new AudioContext();
    const now=audio.currentTime,master=audio.createGain(),engine=audio.createOscillator();
    const volume=.11*Math.max(0,Math.min(1,settings?.masterVolume??1));
    master.gain.setValueAtTime(.0001,now);
    master.gain.linearRampToValueAtTime(volume*.42,now+.12);
    master.gain.linearRampToValueAtTime(volume,now+.43);
    master.gain.linearRampToValueAtTime(volume*.64,now+.82);
    master.gain.linearRampToValueAtTime(.0001,now+2.8);
    engine.type='triangle';
    engine.frequency.setValueAtTime(23,now);
    engine.frequency.linearRampToValueAtTime(54,now+.42);
    engine.frequency.linearRampToValueAtTime(36,now+.90);
    engine.frequency.linearRampToValueAtTime(71,now+2.6);
    engine.connect(master).connect(audio.destination);engine.start(now);engine.stop(now+2.85);
    void audio.resume().catch(()=>{});
    return ()=>{if(audio.state!=='closed')void audio.close().catch(()=>{});};
  }catch{
    if(audio&&audio.state!=='closed')void audio.close().catch(()=>{});
    return ()=>{};
  }
}

export function playWorkshopDeparture(workshop,{signal,settings,onPhase=()=>{}}={}){
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  if(signal?.aborted||!workshop?.loaded||!workshop.renderView?.isActive()||!workshop.presentation?.setDepartureGate||
    document.hidden||workshop.deviceProfile?.phone||document.body.classList.contains('v6-reduce-motion')||
    document.body.classList.contains('an-v7-reduce-motion')||motion.matches)return null;
  const {car,camera,renderer,scene,vehiclePresentation,presentation,advancedGraphics}=workshop;
  const position=car.position.clone(),rotation=car.quaternion.clone();
  const cameraPosition=camera.position.clone(),cameraRotation=camera.quaternion.clone(),fov=camera.fov,aspect=camera.aspect;
  const priorView=camera.view&&{...camera.view};
  const roomLights=[workshop.hemi,workshop.key,workshop.fill,workshop.warm].filter(Boolean).map(light=>[light,light.intensity]);
  const gate=presentation.getDepartureGate();
  const lightMode=vehiclePresentation?.getLightingDiagnostics?.().mode||'off';
  const stopAudio=startEngineCue(settings);
  let raf=0,lastFrame=null,elapsed=0,phase='',finished=false,lastGate=gate,previousDistance=0;
  const wheels=['frontLeft','frontRight','rearLeft','rearRight'].map(id=>({id,rotationRad:0}));
  car.rotation.set(0,Math.PI/2-(vehiclePresentation?.root?.rotation.y||0),0);
  camera.position.set(4.5,2.2,-4.7);
  camera.clearViewOffset();
  camera.fov=56;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  vehiclePresentation?.setLightMode('low');
  return new Promise(resolve=>{
    function finish(){
      if(finished)return;
      finished=true;cancelAnimationFrame(raf);signal?.removeEventListener('abort',finish);
      document.removeEventListener('visibilitychange',onVisibility);
      motion.removeEventListener('change',onMotion);
      stopAudio();
      car.position.copy(position);car.quaternion.copy(rotation);
      camera.position.copy(cameraPosition);camera.quaternion.copy(cameraRotation);
      if(priorView?.enabled)camera.setViewOffset(priorView.fullWidth,priorView.fullHeight,priorView.offsetX,priorView.offsetY,priorView.width,priorView.height);
      camera.fov=fov;camera.aspect=aspect;camera.updateProjectionMatrix();
      for(const [light,intensity] of roomLights)light.intensity=intensity;
      presentation.setDepartureGate(gate);
      vehiclePresentation?.setLightMode(lightMode);
      resolve();
    }
    function onVisibility(){if(document.hidden)finish();}
    function onMotion(){if(motion.matches)finish();}
    function frame(now){
      if(finished||signal?.aborted||!workshop.renderView?.isActive()){finish();return;}
      // Route preparation can briefly occupy the main thread. Keep the phases
      // observable when a frame is late, and use the same prepared pass as the menu.
      const dt=lastFrame===null?0:Math.min(.14,Math.max(0,(now-lastFrame)/1000));
      elapsed+=dt;lastFrame=now;
      const next=elapsed<.44?'Arrancando el motor…':elapsed<.74?'Apagando las luces del taller…':elapsed<1.55?'Levantando la cortina…':'Saliendo del taller…';
      if(next!==phase){phase=next;onPhase(next);}
      const dark=smooth((elapsed-.44)/.32);
      for(const [light,intensity] of roomLights)light.intensity=intensity*(1-dark*(light===workshop.hemi ? .94 : 1));
      const opening=smooth((elapsed-.74)/.81);
      const nextGate=gate+(1-gate)*opening;
      if(lastGate!==nextGate){lastGate=nextGate;presentation.setDepartureGate(nextGate);}
      const travel=smooth((elapsed-1.46)/1.43);
      const distance=(9-position.z)*travel;
      car.position.x=position.x*(1-travel);car.position.z=position.z+distance;
      for(const wheel of wheels)wheel.rotationRad=-distance/.34;
      vehiclePresentation?.update({dt:Math.min(dt,.05),camera,viewportHeight:renderer.domElement.height,rpm:825+900*travel,
        speedMps:(distance-previousDistance)/Math.max(.001,dt),snapshot:{wheels}});
      previousDistance=distance;
      camera.lookAt(0,1.25,2.2+travel*3.3);
      try{workshop.renderView.frame(()=>advancedGraphics?advancedGraphics.render():renderer.render(scene,camera));}
      catch(error){console.warn('No se pudo dibujar la salida del taller',error);finish();return;}
      if(elapsed>=2.89)finish();else raf=requestAnimationFrame(frame);
    }
    signal?.addEventListener('abort',finish,{once:true});
    document.addEventListener('visibilitychange',onVisibility);
    motion.addEventListener('change',onMotion);
    raf=requestAnimationFrame(frame);
  });
}

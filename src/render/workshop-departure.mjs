import {createWorkshopDepartureAudio} from '../audio/workshop-departure-audio.mjs?v=3a496d07b10b1b49';

const LIGHTS=1.24, GATE=2.17, GATE_OPEN=3.91, ROLL=3.80, EXIT=3.98;
const THRESHOLD_Z=6.50, END_Z=9.45, ROLL_END=6.44, FADE=6.42, END=6.70;
const phases=[
  [0,'ignition','Arrancando el motor…'],
  [LIGHTS,'lights','Apagando las luces del taller…'],
  [GATE,'gate','Levantando la cortina…'],
  [EXIT,'exit','Saliendo del taller…'],
];
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=value=>Math.max(0,Math.min(1,value));
function smooth(value){
  const t=clamp(value);
  return t*t*(3-2*t);
}

function frameCamera(camera,car,elapsed,travel,shot){
  if(shot===0){
    // A low front quarter shows the grille and the filaments coming up.
    const push=smooth(elapsed/LIGHTS);
    camera.position.set(car.x+lerp(3.27,2.88,push),lerp(1.09,.89,push),car.z+lerp(3.94,3.76,push));
    camera.lookAt(car.x-.16,.96,car.z+1.06);
    camera.fov=lerp(43,41,push);
  }else if(shot===1){
    // The fluorescent tubes go out over the rear quarter. The tail lights stay lit.
    const drift=smooth((elapsed-LIGHTS)/(GATE-LIGHTS));
    camera.position.set(lerp(2.82,2.54,drift),lerp(1.04,.88,drift),lerp(-3.98,-3.70,drift));
    camera.lookAt(car.x+.10,.92,car.z-.95);
    camera.fov=lerp(42,41,drift);
  }else if(shot===2){
    // Pull out to show the full opening and the light reaching the floor.
    const reveal=smooth((elapsed-GATE)/(EXIT-GATE));
    camera.position.set(lerp(4.10,3.64,reveal),lerp(1.39,1.58,reveal),lerp(-4.10,-3.73,reveal));
    camera.lookAt(.09,1.56,lerp(2.60,3.47,reveal));
    camera.fov=54;
  }else{
    // Stay in the garage as the whole car clears the threshold.
    camera.position.set(lerp(2.80,1.83,travel),lerp(1.14,1.59,travel),-4.34+5.94*travel);
    camera.lookAt(car.x*.35,lerp(1.03,1.33,travel),car.z+.62);
    camera.fov=lerp(48,46,travel);
  }
  camera.updateProjectionMatrix();
}

export function playWorkshopDeparture(workshop,{signal,settings,onPhase=()=>{},onFade=()=>{}}={}){
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const reduced=()=>motion.matches||document.body.classList.contains('v6-reduce-motion')||
    document.body.classList.contains('an-v7-reduce-motion');
  if(signal?.aborted||!workshop?.loaded||!workshop.homeFrameReady||!workshop.renderView?.isActive()||!workshop.presentation?.setDepartureGate||
    document.hidden||workshop.deviceProfile?.phone||reduced())return null;

  const {car,camera,renderer,scene,vehiclePresentation,presentation,advancedGraphics,hemi,key,fill,warm}=workshop;
  const position=car.position.clone(),rotation=car.quaternion.clone(),yaw=car.rotation.y;
  const cameraPosition=camera.position.clone(),cameraRotation=camera.quaternion.clone(),fov=camera.fov,aspect=camera.aspect;
  const view=camera.view,priorView=view&&{...view};
  const roomLights=new Map([hemi,key,fill,warm].filter(Boolean).map(light=>[light,light.intensity]));
  const practicalLights=[],fluorescents=new Map();
  scene?.getObjectByName('Workshop_Detail_Pass_1973')?.traverse(object=>{
    if(object.isPointLight)practicalLights.push([object,object.intensity]);
  });
  workshop.workshopRoot?.traverse(object=>{
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(material?.name==='MAT_Fluorescent_Emission')fluorescents.set(material,material.emissiveIntensity);
    }
  });
  const fillPosition=fill?.position?.clone(),fillColor=fill?.color?.clone(),outsideColor=fillColor?.clone().set('#a5c9ff');
  const gate=presentation.getDepartureGate();
  const exterior=scene?.getObjectByName('E31_DepartureExterior'),exteriorVisible=exterior?.visible;
  const contact=scene?.getObjectByName('Workshop_Vehicle_Contact');
  const contactPosition=contact?.position.clone(),contactRotation=contact?.quaternion.clone();
  const vehicleCue=vehiclePresentation?.beginDepartureCue?.();
  const sound=createWorkshopDepartureAudio(settings);
  let raf=0,lastFrame=null,elapsed=0,phaseIndex=-1,finished=false,lastGate=gate,lastDistance=0,ending=false;
  const departureYaw=Math.PI/2-(vehiclePresentation?.root?.rotation.y||0);
  car.rotation.set(0,departureYaw,0);
  if(exterior)exterior.visible=true;
  contact?.rotateZ(yaw-departureYaw);
  camera.clearViewOffset();
  const canvas=renderer.domElement;
  camera.aspect=canvas.width>0&&canvas.height>0?canvas.width/canvas.height:aspect;

  return new Promise(resolve=>{
    function finish(){
      if(finished)return;
      finished=true;cancelAnimationFrame(raf);signal?.removeEventListener('abort',finish);
      document.removeEventListener('visibilitychange',onVisibility);
      motion.removeEventListener('change',onMotion);
      sound.dispose();
      if(exterior)exterior.visible=exteriorVisible;
      car.position.copy(position);car.quaternion.copy(rotation);
      if(contact){contact.position.copy(contactPosition);contact.quaternion.copy(contactRotation);}
      camera.position.copy(cameraPosition);camera.quaternion.copy(cameraRotation);
      if(view)Object.assign(view,priorView);
      camera.view=view;camera.fov=fov;camera.aspect=aspect;camera.updateProjectionMatrix();
      for(const [light,intensity] of roomLights)light.intensity=intensity;
      for(const [light,intensity] of practicalLights)light.intensity=intensity;
      for(const [material,intensity] of fluorescents)material.emissiveIntensity=intensity;
      if(fillPosition)fill.position.copy(fillPosition);
      if(fillColor)fill.color.copy(fillColor);
      if(lastGate!==gate)presentation.setDepartureGate(gate);
      vehicleCue?.restore();
      resolve();
    }
    function onVisibility(){if(document.hidden)finish();}
    function onMotion(){if(reduced())finish();}
    function frame(now){
      if(finished||signal?.aborted||document.hidden||reduced()||!workshop.renderView?.isActive()){finish();return;}
      try{
        // Keep every beat legible if route preparation occupies the main thread.
        const dt=lastFrame===null?0:Math.min(.14,Math.max(0,(now-lastFrame)/1000));
        elapsed+=dt;lastFrame=now;
        if(elapsed>=(phases[phaseIndex+1]?.[0]??Infinity)){
          const [,id,label]=phases[++phaseIndex];onPhase(label,id);
          if(finished)return;
          if(id!=='gate'||gate<1)sound.phase(id);
        }
        const dark=smooth((elapsed-LIGHTS)/.33);
        const opening=smooth((elapsed-GATE)/(GATE_OPEN-GATE)),nextGate=lerp(gate,1,opening);
        const spill=smooth((nextGate-.04)/.72);
        if(key)key.intensity=roomLights.get(key)*(1-dark);
        if(hemi)hemi.intensity=roomLights.get(hemi)*(1-.80*dark)+.12*spill;
        if(warm)warm.intensity=roomLights.get(warm)*(1-.93*dark);
        for(const [i,[light,intensity]] of practicalLights.entries())light.intensity=intensity*(1-smooth((elapsed-LIGHTS-i*.06)/.18));
        let tube=0;
        for(const [material,intensity] of fluorescents)material.emissiveIntensity=intensity*(1-smooth((elapsed-LIGHTS-(tube++%3)*.06)/.18));
        if(fill){
          fill.intensity=roomLights.get(fill)*(1-dark)+2.78*spill;
          if(fillPosition)fill.position.set(lerp(fillPosition.x,1.05,dark),lerp(fillPosition.y,4.55,dark),lerp(fillPosition.z,9.0,dark));
          if(fillColor)fill.color.copy(fillColor).lerp(outsideColor,dark);
        }
        const gateDelta=nextGate-lastGate;lastGate=nextGate;
        if(gateDelta)presentation.setDepartureGate(nextGate);
        if(gateDelta>0&&nextGate===1)sound.phase('gate-stop');
        const rollout=clamp((elapsed-ROLL)/(ROLL_END-ROLL));
        const travel=rollout*rollout*(1.85-.85*rollout),distance=Math.max(0,END_Z-position.z)*travel;
        car.position.x=position.x*(1-travel);car.position.z=position.z+distance;
        if(position.z+lastDistance<THRESHOLD_Z&&car.position.z>=THRESHOLD_Z)sound.phase('threshold');
        if(contact)contact.position.set(contactPosition.x+car.position.x-position.x,contactPosition.y,contactPosition.z+distance);
        vehicleCue?.setFrame({wheelRotationRad:-distance/.34,headlamps:smooth((elapsed-.51)/.29),brake:1-smooth((elapsed-ROLL)/.26)});
        frameCamera(camera,car.position,elapsed,travel,phaseIndex);
        const fade=smooth((elapsed-FADE)/(END-FADE));
        if(elapsed>=FADE&&!ending){ending=true;onFade();}
        if(finished)return;
        const clutch=smooth((elapsed-ROLL+.34)/.34)*(1-smooth((elapsed-ROLL)/.39));
        const throttle=clutch*.47+smooth(rollout*2)*.46;
        sound.update({elapsed,gate:nextGate,speed:(distance-lastDistance)/Math.max(.001,dt),gateSpeed:gateDelta/Math.max(.001,dt),throttle,fade});
        lastDistance=distance;
        workshop.renderView.frame(()=>advancedGraphics?advancedGraphics.render():renderer.render(scene,camera));
      }catch(error){
        console.warn('No se pudo dibujar la salida del taller',error);finish();return;
      }
      if(elapsed>=END)finish();else raf=requestAnimationFrame(frame);
    }
    signal?.addEventListener('abort',finish,{once:true});
    document.addEventListener('visibilitychange',onVisibility);
    motion.addEventListener('change',onMotion);
    raf=requestAnimationFrame(frame);
  });
}

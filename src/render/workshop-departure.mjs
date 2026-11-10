import {createWorkshopDepartureAudio} from '../audio/workshop-departure-audio.mjs?v=8e4cd990b9bafec7';

const CUT=.65, GATE=.76, ROLL=1.48, EXIT=1.54, FADE=2.69, END=2.89;
const phases=[
  [0,'ignition','Arrancando el motor…'],
  [.46,'lights','Apagando las luces del taller…'],
  [GATE,'gate','Levantando la cortina…'],
  [EXIT,'exit','Saliendo del taller…'],
];
const lerp=(a,b,t)=>a+(b-a)*t;
function smooth(value){
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}

function frameCamera(camera,car,elapsed,travel){
  if(elapsed<CUT){
    // A low front quarter shows the grille and the filaments coming up.
    const push=smooth(elapsed/CUT);
    camera.position.set(car.x+lerp(3.27,2.88,push),lerp(1.09,.89,push),car.z+lerp(3.94,3.76,push));
    camera.lookAt(car.x-.16,.96,car.z+1.06);
    camera.fov=lerp(43,41,push);
  }else{
    // Cut on the switch, then move toward the threshold as the car leaves.
    const reveal=smooth((elapsed-CUT)/.94),follow=smooth(travel);
    camera.position.set(lerp(4.25,2.82,follow)-.24*reveal,1.19+.22*reveal+.21*follow,-4.48+.59*reveal+4.67*follow);
    camera.lookAt(car.x*.35,1.27+.19*reveal,lerp(2.18,car.z+.59,smooth(travel*1.6)));
    camera.fov=45+5*follow;
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
  const contact=scene?.getObjectByName('Workshop_Vehicle_Contact');
  const contactPosition=contact?.position.clone(),contactRotation=contact?.quaternion.clone();
  const vehicleCue=vehiclePresentation?.beginDepartureCue?.();
  const sound=createWorkshopDepartureAudio(settings);
  let raf=0,lastFrame=null,elapsed=0,phaseIndex=-1,finished=false,lastGate=gate,lastDistance=0,ending=false;
  const departureYaw=Math.PI/2-(vehiclePresentation?.root?.rotation.y||0);
  car.rotation.set(0,departureYaw,0);
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
          sound.phase(id);
        }
        const dark=smooth((elapsed-.46)/.21);
        const opening=smooth((elapsed-GATE)/.82),nextGate=lerp(gate,1,opening);
        const spill=smooth((nextGate-.04)/.72);
        if(key)key.intensity=roomLights.get(key)*(1-dark);
        if(hemi)hemi.intensity=roomLights.get(hemi)*(1-.76*dark)+.085*spill;
        if(warm)warm.intensity=roomLights.get(warm)*(1-.93*dark);
        for(const [light,intensity] of practicalLights)light.intensity=intensity*(1-dark);
        for(const [material,intensity] of fluorescents)material.emissiveIntensity=intensity*(1-dark);
        if(fill){
          fill.intensity=roomLights.get(fill)*(1-dark)+2.46*spill;
          if(fillPosition)fill.position.set(lerp(fillPosition.x,1.05,dark),lerp(fillPosition.y,4.55,dark),lerp(fillPosition.z,9.0,dark));
          if(fillColor)fill.color.copy(fillColor).lerp(outsideColor,dark);
        }
        const gateDelta=nextGate-lastGate;lastGate=nextGate;
        if(gateDelta)presentation.setDepartureGate(nextGate);
        const travel=smooth((elapsed-ROLL)/(END-ROLL)),distance=Math.max(0,9.25-position.z)*travel;
        car.position.x=position.x*(1-travel);car.position.z=position.z+distance;
        if(contact)contact.position.set(contactPosition.x+car.position.x-position.x,contactPosition.y,contactPosition.z+distance);
        vehicleCue?.setFrame({wheelRotationRad:-distance/.34,headlamps:smooth((elapsed-.21)/.25),brake:1-smooth((elapsed-ROLL)/.21)});
        frameCamera(camera,car.position,elapsed,travel);
        const fade=smooth((elapsed-FADE)/(END-FADE));
        if(elapsed>=FADE&&!ending){ending=true;onFade();}
        if(finished)return;
        sound.update({elapsed,gate:nextGate,speed:(distance-lastDistance)/Math.max(.001,dt),gateSpeed:gateDelta/Math.max(.001,dt),fade});
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

import {createWorkshopDepartureAudio} from '../audio/workshop-departure-audio.mjs?v=55fb7202cdfb2f7b';
import {prepareDepartureDoor} from './workshop-departure-door.mjs?v=47519597b1833cf9';
import {getVehicleDefinition} from './vehicle-catalog.mjs?v=d34c237e4bf2bab0';

const DOOR_LATCH=.72, DOOR_SETTLED=.92, IGNITION=1.02, HEADLAMPS=2.08, LIGHTS=2.94;
const GATE=3.78, GATE_OPEN=5.54, ROLL=5.65, EXIT=5.68, NIGHT=9.44;
const THRESHOLD_Z=6.50, TURN_Z=9.55, TURN_RADIUS=4.80, STREET_RUN=26;
const TURN_LENGTH=TURN_RADIUS*Math.PI/2;
const ROLL_END=12.48, FADE=11.40, BLACK=12.64, END=12.84;
const phases=[
  [0,'door','Cerrando la puerta…'],
  [IGNITION,'ignition','Arrancando el motor…'],
  [HEADLAMPS,'headlamps','Encendiendo los faros…'],
  [LIGHTS,'lights','Apagando las luces del taller…'],
  [GATE,'gate','Levantando la cortina…'],
  [EXIT,'exit','Saliendo del taller…'],
  [NIGHT,'night','En la calle…'],
];
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=value=>Math.max(0,Math.min(1,value));
function smooth(value){
  const t=clamp(value);
  return t*t*(3-2*t);
}

function frameCamera(camera,car,elapsed,straightProgress,streetProgress,shot){
  if(shot==='door'){
    const push=smooth(elapsed/IGNITION);
    camera.position.set(car.x+lerp(3.10,2.94,push),1.13,car.z-1.67);
    camera.lookAt(car.x+.79,.99,car.z+.05);
    camera.fov=34;
  }else if(shot==='ignition'){
    const push=smooth((elapsed-IGNITION)/(HEADLAMPS-IGNITION));
    camera.position.set(car.x-lerp(3.21,2.94,push),lerp(.85,.77,push),car.z+3.55);
    camera.lookAt(car.x,.89,car.z+.76);
    camera.fov=42;
  }else if(shot==='headlamps'){
    const push=smooth((elapsed-HEADLAMPS)/(LIGHTS-HEADLAMPS));
    camera.position.set(car.x+lerp(.78,.57,push),lerp(.70,.63,push),car.z+lerp(4.19,3.91,push));
    camera.lookAt(car.x,.80,car.z+1.52);
    camera.fov=40;
  }else if(shot==='lights'){
    // The fluorescent tubes go out over the rear quarter. The tail lights stay lit.
    const drift=smooth((elapsed-LIGHTS)/(GATE-LIGHTS));
    camera.position.set(lerp(2.82,2.54,drift),lerp(1.04,.88,drift),lerp(-3.98,-3.70,drift));
    camera.lookAt(car.x+.10,.92,car.z-.95);
    camera.fov=lerp(42,41,drift);
  }else if(shot==='gate'){
    // Pull out to show the full opening and the light reaching the floor.
    const reveal=smooth((elapsed-GATE)/(EXIT-GATE));
    camera.position.set(lerp(4.10,3.64,reveal),lerp(1.39,1.58,reveal),lerp(-4.10,-3.73,reveal));
    camera.lookAt(.09,1.56,lerp(2.60,3.47,reveal));
    camera.fov=54;
  }else if(shot==='night'){
    // Let the car shrink into the unlit stretch with the stars held in frame.
    const drift=smooth((elapsed-NIGHT)/(END-NIGHT));
    camera.position.set(lerp(3.35,2.65,drift),lerp(2.35,2.57,drift),17.1);
    camera.lookAt(-23,4.36,14.42);
    camera.fov=43;
  }else if(streetProgress===0){
    camera.position.set(lerp(2.80,1.83,straightProgress),lerp(1.14,1.59,straightProgress),-4.34+5.94*straightProgress);
    camera.lookAt(car.x*.35,lerp(1.03,1.33,straightProgress),car.z+.62);
    camera.fov=lerp(48,46,straightProgress);
  }else{
    // The outside cut follows the right turn from the near sidewalk.
    camera.position.set(lerp(3.85,2.92,streetProgress),lerp(1.62,1.96,streetProgress),lerp(8.48,10.3,streetProgress));
    camera.lookAt(car.x-.35*streetProgress,1.30,car.z+.55*(1-streetProgress));
    camera.fov=lerp(51,48,streetProgress);
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
  const exitFill=presentation.getDepartureFillPosition?.()??{x:1.05,y:4.55,z:9};
  const gate=presentation.getDepartureGate();
  const exterior=scene?.getObjectByName('E31_DepartureExterior'),exteriorVisible=exterior?.visible;
  const beam=scene?.getObjectByName('E31_DepartureBeam');
  const beamState=beam&&{visible:beam.visible,position:beam.position.clone(),yaw:beam.rotation.y,scale:beam.scale.clone(),opacity:beam.material.opacity};
  const [lampX,lampY,lampSide]=getVehicleDefinition(workshop.vehicleId)?.lampAnchor??[-.9452,.006,.267];
  const lampCenter=beam&&new workshop.T.Vector3(), lampOuter=beam&&new workshop.T.Vector3();
  const contact=scene?.getObjectByName('Workshop_Vehicle_Contact');
  const contactPosition=contact?.position.clone(),contactRotation=contact?.quaternion.clone();
  const vehicleCue=vehiclePresentation?.beginDepartureCue?.();
  let door=prepareDepartureDoor(workshop.T,vehiclePresentation?.root,workshop.vehicleId);
  door?.setOpen(1);
  const reflections=new Map();
  vehiclePresentation?.root?.traverse(object=>{
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(Number.isFinite(material?.envMapIntensity))reflections.set(material,material.envMapIntensity);
    }
  });
  const sound=createWorkshopDepartureAudio(settings);
  let raf=0,lastFrame=null,elapsed=0,phaseIndex=-1,finished=false,lastGate=gate,lastDistance=0,lastTurn=0,latch=false;
  const departureYaw=Math.PI/2-(vehiclePresentation?.root?.rotation.y||0);
  const straightDistance=Math.max(0,TURN_Z-position.z);
  const streetDistance=TURN_LENGTH+STREET_RUN;
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
      if(beam){beam.visible=beamState.visible;beam.position.copy(beamState.position);beam.rotation.y=beamState.yaw;
        beam.scale.copy(beamState.scale);beam.material.opacity=beamState.opacity;}
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
      door?.restore();
      for(const [material,intensity] of reflections)material.envMapIntensity=intensity;
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
          if(id!=='door'&&(id!=='gate'||gate<1))sound.phase(id);
        }
        door?.setOpen(clamp(presentation.getDepartureDoorOpen?.(elapsed)??(1-smooth((elapsed-.13)/(DOOR_LATCH-.13)))));
        if(!latch&&elapsed>=DOOR_LATCH){latch=true;sound.phase('door');}
        if(door&&elapsed>=DOOR_SETTLED){door.restore();door=null;}
        const dark=smooth((elapsed-LIGHTS)/.33);
        const opening=smooth((elapsed-GATE)/(GATE_OPEN-GATE)),nextGate=lerp(gate,1,opening);
        const spill=smooth((nextGate-.04)/.72);
        const rollout=clamp((elapsed-ROLL)/(ROLL_END-ROLL));
        const distance=(straightDistance+streetDistance)*rollout*rollout*(1.85-.85*rollout);
        const straightProgress=straightDistance>0?clamp(distance/straightDistance):1;
        const streetTravel=Math.max(0,distance-straightDistance);
        const night=smooth((streetTravel-TURN_LENGTH-1.1)/18);
        for(const [material,intensity] of reflections)material.envMapIntensity=intensity*(1-.89*night);
        if(key)key.intensity=roomLights.get(key)*(1-dark);
        if(hemi)hemi.intensity=(roomLights.get(hemi)*(1-.80*dark)+.12*spill)*(1-.89*night);
        if(warm)warm.intensity=roomLights.get(warm)*(1-.93*dark);
        for(const [i,[light,intensity]] of practicalLights.entries())light.intensity=intensity*(1-smooth((elapsed-LIGHTS-i*.06)/.18));
        let tube=0;
        for(const [material,intensity] of fluorescents)material.emissiveIntensity=intensity*(1-smooth((elapsed-LIGHTS-(tube++%3)*.06)/.18));
        if(fill){
          fill.intensity=(roomLights.get(fill)*(1-dark)+2.78*spill)*(1-.93*night);
          if(fillPosition)fill.position.set(lerp(fillPosition.x,exitFill.x,dark),lerp(fillPosition.y,exitFill.y,dark),lerp(fillPosition.z,exitFill.z,dark));
          if(fillColor)fill.color.copy(fillColor).lerp(outsideColor,dark);
        }
        const gateDelta=nextGate-lastGate;lastGate=nextGate;
        if(gateDelta)presentation.setDepartureGate(nextGate);
        if(gateDelta>0&&nextGate===1)sound.phase('gate-stop');
        const turn=Math.min(Math.PI/2,streetTravel/TURN_RADIUS);
        // The car leaves along +Z, so its right is world -X.
        car.position.x=position.x*(1-straightProgress)-TURN_RADIUS*(1-Math.cos(turn))-Math.max(0,streetTravel-TURN_LENGTH);
        car.position.z=position.z+Math.min(distance,straightDistance)+TURN_RADIUS*Math.sin(turn);
        car.rotation.y=departureYaw-turn;
        const cranking=elapsed-IGNITION;
        car.rotation.z=cranking>0&&cranking<.66?Math.sin(cranking*51)*.006*smooth(cranking/.12)*(1-smooth(cranking/.66)):0;
        if(position.z+lastDistance<THRESHOLD_Z&&car.position.z>=THRESHOLD_Z)sound.phase('threshold');
        if(contact){
          contact.position.set(contactPosition.x+car.position.x-position.x,contactPosition.y,contactPosition.z+car.position.z-position.z);
          contact.rotateZ(turn-lastTurn);
        }
        lastTurn=turn;
        const steer=.46*smooth((distance-straightDistance+.55)/1.1)*(1-smooth((streetTravel-TURN_LENGTH+.55)/1.1));
        const headlamps=smooth((elapsed-HEADLAMPS)/.33);
        vehicleCue?.setFrame({wheelRotationRad:-distance/.34,steeringRad:steer,headlamps,brake:1-smooth((elapsed-ROLL)/.26)});
        if(beam&&vehiclePresentation?.root){
          const root=vehiclePresentation.root;
          root.updateWorldMatrix(true,false);
          lampCenter.set(lampX,lampY,0).applyMatrix4(root.matrixWorld);
          lampOuter.set(lampX,lampY,lampSide).applyMatrix4(root.matrixWorld);
          beam.position.set(lampCenter.x,beamState.position.y,lampCenter.z);
          beam.rotation.y=-turn;
          beam.scale.x=lampCenter.distanceTo(lampOuter)/.72;
          beam.scale.z=nextGate<.13?clamp((THRESHOLD_Z-lampCenter.z)/8.4):1;
          beam.material.opacity=headlamps*(.43+.48*dark)*(1-.48*night);
          beam.visible=beam.material.opacity>.005;
        }
        frameCamera(camera,car.position,elapsed,straightProgress,clamp(streetTravel/TURN_LENGTH),phases[phaseIndex][1]);
        const fade=smooth((elapsed-FADE)/(BLACK-FADE));
        if(fade>0)onFade(fade);
        if(finished)return;
        const clutch=smooth((elapsed-ROLL+.34)/.34)*(1-smooth((elapsed-ROLL)/.39));
        const throttle=clutch*.47+smooth(rollout*2)*.46;
        sound.update({cranking,gate:nextGate,speed:(distance-lastDistance)/Math.max(.001,dt),gateSpeed:gateDelta/Math.max(.001,dt),throttle,distanceFade:night,fade});
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

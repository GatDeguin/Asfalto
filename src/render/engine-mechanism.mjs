import {pistonHeight,rodAngle,valveTrain,PULLEY_RADII,mod} from './engine-chevy-math.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
/** Original Motor_Chevy_250 kinematics, decoupled from its standalone renderer and DOM. */
export function createEngineMechanism(T,model){
 const groups=[],meshes=[],base=new Map(),axis=new T.Vector3(0,0,1),offset=new T.Vector3(),rotation=new T.Quaternion();let angle=0,shaftAngle=0,explosion=0,playing=false,active=false,speed=12;
 model.traverse(o=>{if(o.userData.partId){const d=o.userData;base.set(o,{position:d.closedPosition?new T.Vector3(...d.closedPosition):o.position.clone(),quaternion:d.closedQuaternion?new T.Quaternion(...d.closedQuaternion):o.quaternion.clone(),scale:d.closedScale?new T.Vector3(...d.closedScale):o.scale.clone()});groups.push(o);}if(o.isMesh)meshes.push(o);});
 function apply(){const theta=angle*Math.PI/180,shaftTheta=shaftAngle*Math.PI/180,trains=new Map();const train=(c,type)=>{const key=c+type;if(!trains.has(key))trains.set(key,active?valveTrain(angle,c,type):{lift:0,lifter:0,rocker:0,pushrodAngle:0});return trains.get(key);};
 for(const g of groups){const b=base.get(g),d=g.userData,phase=Number(d.phase)||0,c=Number(d.cylinder)||1;g.position.copy(b.position);g.quaternion.copy(b.quaternion);g.scale.copy(b.scale);g.position.add(offset.fromArray(d.explode||[0,0,0]).multiplyScalar(explosion));
 if(d.motion==='piston'||d.motion==='rod'){g.position.y+=pistonHeight(theta+phase)-pistonHeight(phase);if(d.motion==='rod')g.quaternion.premultiply(rotation.setFromAxisAngle(axis,rodAngle(theta+phase)-rodAngle(phase)));}
 else if(d.motion==='crank')g.quaternion.premultiply(rotation.setFromAxisAngle(axis,-theta));
 else if(d.motion==='cam')g.quaternion.premultiply(rotation.setFromAxisAngle(axis,theta/2));
 else if(d.motion==='water'||d.motion==='alternator')g.quaternion.premultiply(rotation.setFromAxisAngle(axis,-shaftTheta*PULLEY_RADII.crank/PULLEY_RADII[d.motion]));
 else if(d.motion==='valve_intake'||d.motion==='valve_exhaust')g.position.add(offset.set(0,-train(c,d.motion).lift,0).applyQuaternion(b.quaternion));
 else if(d.motion==='spring'){const lift=train(c,d.valveType).lift;g.traverse(n=>{if(n.morphTargetInfluences?.length)n.morphTargetInfluences[0]=lift/.008;});}
 else if(d.motion==='lifter'||d.motion==='pushrod'){const t=train(c,d.valveType);g.position.y+=t.lifter;if(d.motion==='pushrod')g.quaternion.premultiply(rotation.setFromAxisAngle(axis,t.pushrodAngle));}
 else if(d.motion==='rocker')g.quaternion.premultiply(rotation.setFromAxisAngle(axis,train(c,d.valveType).rocker));
 else if(d.motion==='belt'){const u=shaftTheta*PULLEY_RADII.crank/(d.beltTexturePitch||.03);g.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])for(const k of ['map','normalMap','roughnessMap','metalnessMap'])if(m[k])m[k].offset.x=mod(u,1);});}
 }model.updateMatrixWorld(true);}
 const api={model,groups,meshes,setAngle(value){active=true;shaftAngle=Number(value)||0;angle=mod(shaftAngle,720);apply();},setExplosion(value){explosion=clamp(value,0,1);apply();},setSpeed(value){speed=clamp(value,2,30);},setPlaying(value){playing=!!value;if(playing){active=true;apply();}},update(dt){if(playing){shaftAngle+=Math.max(0,Number(dt)||0)*speed*6;angle=mod(shaftAngle,720);apply();}},reset(){playing=false;active=false;angle=0;shaftAngle=0;explosion=0;apply();},snapshot:()=>groups.map(g=>({id:g.userData.partId,position:g.position.toArray(),quaternion:g.quaternion.toArray(),scale:g.scale.toArray()})),morphs:()=>{const a=[];model.traverse(m=>{if(m.morphTargetInfluences)a.push(...m.morphTargetInfluences);});return a;},diagnostics:()=>({parts:groups.length,angle,shaftAngle,explosion,playing,didacticActive:active,speedRpm:speed})};api.reset();return api;
}

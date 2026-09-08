/** One bounded light; thunder delay follows distance / sound speed in simulation time. */
export function createWeatherLightning(THREE,parent,onThunder=()=>{}){
  const light=new THREE.DirectionalLight('#d8e8ff',0);light.name='AN_StormFlash';light.castShadow=false;light.position.set(-80,160,-100);parent.add(light);
  let elapsed=0,next=11,flashAge=99,queue=[],events=0,thunders=0,disposed=false;
  return{
    update({dt=0,storm=false,position}){if(disposed||!(dt>0))return;elapsed+=Math.min(.05,dt);flashAge+=dt;
      if(storm&&elapsed>=next){const distanceM=900+(events*719%1700),delaySeconds=distanceM/343,intensity=.34+(events%3)*.08;events++;flashAge=0;next=elapsed+24+(events*7%15);queue.push({at:elapsed+delaySeconds,distanceM,delaySeconds,intensity});if(position){light.position.copy(position);light.position.x-=80;light.position.y+=160;light.position.z-=100;light.target.position.copy(position);light.target.updateMatrixWorld();}}
      if(!storm)next=Math.max(next,elapsed+8);
      light.intensity=storm&&flashAge<.2?Math.min(.6,Math.exp(-flashAge*23)*.55+(flashAge>.065&&flashAge<.1?.18:0)):0;
      // Keep the light slot stable: toggling visible would recompile every lit material.
      light.visible=true;
      while(queue.length&&queue[0].at<=elapsed){const event=queue.shift();onThunder({distanceM:event.distanceM,delaySeconds:event.delaySeconds,intensity:event.intensity});thunders++;}
    },
    reset(){queue=[];light.intensity=0;light.visible=true;flashAge=99;elapsed=0;next=11;},
    diagnostics:()=>({flashes:events,thunders,pendingThunder:queue.length,lightIntensity:light.intensity,elapsed}),
    dispose(){if(disposed)return;disposed=true;queue=[];light.removeFromParent();},
  };
}

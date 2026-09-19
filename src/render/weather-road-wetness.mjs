import {isHighGraphicsQuality} from './graphics-quality-policy.mjs';
/** Projected real canopies and recent physical wheel paths modulate the wet road film. */
export function createRoadWetnessField(T){
  const resolution=128,extent=192,data=new Uint8Array(resolution*resolution),texture=new T.DataTexture(data,resolution,resolution,T.RedFormat,T.UnsignedByteType);
  texture.name='AN_LocalRainCanopy';texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
  const bounds=new T.Vector4(0,0,extent,extent),paths=Array.from({length:24},()=>new T.Vector4()),segments=Array.from({length:24},()=>new T.Vector4()),strengths=new Float32Array(24),births=new Float64Array(24),levels=new Float32Array(24),previous=new Map();
  const point=new T.Vector3(),scale=new T.Vector3(),matrix=new T.Matrix4(),instance=new T.Matrix4();
  let canopies=[],centerX=Infinity,centerZ=Infinity,time=0,count=0,cursor=0,updates=0,coverageCells=0,disposed=false,latestVehicle=null,currentWetness=0;
  const uniforms={uAnCanopyField:{value:texture},uAnCanopyBounds:{value:bounds},uAnCanopyEnabled:{value:0},uAnWheelPaths:{value:segments},uAnWheelPathStrengths:{value:strengths},uAnWheelPathCount:{value:0}};
  function bind(root){latestVehicle=null;currentWetness=0;canopies=[];centerX=centerZ=Infinity;previous.clear();count=cursor=0;strengths.fill(0);levels.fill(0);uniforms.uAnWheelPathCount.value=0;uniforms.uAnCanopyEnabled.value=0;data.fill(0);texture.needsUpdate=true;if(!root)return;
    root.updateWorldMatrix(true,true);const seen=new Set();
    root.traverse(mesh=>{if(!mesh.isMesh)return;const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(!list.some(m=>m?.userData.asfaltoRainCanopy))return;
      mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,local=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),n=mesh.isInstancedMesh?(mesh.userData.asfaltoIguazuInstances?.maximum??mesh.count):1;
      for(let i=0;i<n;i++){matrix.copy(mesh.matrixWorld);if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}point.copy(local).applyMatrix4(matrix);scale.setFromMatrixScale(matrix);const radius=Math.max(.8,Math.min(12,Math.max(size.x*scale.x,size.z*scale.z)*.5)),key=[Math.round(point.x*2),Math.round(point.z*2),Math.round(radius)].join(',');if(seen.has(key))continue;seen.add(key);canopies.push({x:point.x,z:point.z,y:point.y,radius});}
    });
  }
  function rebuild(position){const x=Math.floor(position.x/48)*48,z=Math.floor(position.z/48)*48;if(x===centerX&&z===centerZ)return;centerX=x;centerZ=z;bounds.set(x-extent*.5,z-extent*.5,extent,extent);data.fill(0);coverageCells=0;
    for(const c of canopies){const r=c.radius,px=(c.x-bounds.x)/extent*resolution,pz=(c.z-bounds.y)/extent*resolution,radius=r/extent*resolution;if(px+radius<0||pz+radius<0||px-radius>=resolution||pz-radius>=resolution||c.y<position.y-2)continue;
      const minX=Math.max(0,Math.floor(px-radius)),maxX=Math.min(resolution-1,Math.ceil(px+radius)),minZ=Math.max(0,Math.floor(pz-radius)),maxZ=Math.min(resolution-1,Math.ceil(pz+radius));
      for(let iz=minZ;iz<=maxZ;iz++)for(let ix=minX;ix<=maxX;ix++){const d=Math.hypot(ix+.5-px,iz+.5-pz)/radius;if(d>=1)continue;const value=Math.round((1-d*d)*.86*255),i=iz*resolution+ix;data[i]=Math.max(data[i],value);}
    }for(const value of data)if(value)coverageCells++;texture.needsUpdate=true;uniforms.uAnCanopyEnabled.value=canopies.length?1:0;updates++;
  }
  function vehiclePaths(vehicle,id,wetness){const wheels=vehicle?.wheelContacts;if(!Array.isArray(wheels))return;for(let i=Math.max(0,wheels.length-2);i<wheels.length;i++){const w=wheels[i],key=id+':'+(w.id??i),p=w.point;if(!w.contact||!p||Number(w.normalLoadN??1000)<50||wetness<.08){previous.delete(key);continue;}let last=previous.get(key);if(!last){previous.set(key,{x:p[0],z:p[2]});continue;}const distance=Math.hypot(p[0]-last.x,p[2]-last.z);if(distance>25){last.x=p[0];last.z=p[2];continue;}if(distance<2.4)continue;
      paths[cursor].set(last.x,last.z,p[0],p[2]);births[cursor]=time;levels[cursor]=Math.min(.8,wetness*.8);strengths[cursor]=levels[cursor];cursor=(cursor+1)%24;count=Math.min(24,count+1);last.x=p[0];last.z=p[2];
    }}
  function canopyAt(p){const x=Math.floor((p.x-bounds.x)/extent*resolution),z=Math.floor((p.z-bounds.y)/extent*resolution);return x<0||z<0||x>=resolution||z>=resolution?0:data[z*resolution+x]/255;}
  function filmAt(p){let cleared=0;for(let i=0;i<uniforms.uAnWheelPathCount.value;i++){const s=segments[i],dx=s.z-s.x,dz=s.w-s.y,t=Math.max(0,Math.min(1,((p.x-s.x)*dx+(p.z-s.y)*dz)/Math.max(.001,dx*dx+dz*dz))),d=Math.hypot(p.x-s.x-dx*t,p.z-s.y-dz*t),a=Math.max(0,Math.min(1,(d-.11)/.12));cleared=Math.max(cleared,(1-a*a*(3-2*a))*strengths[i]);}const shelter=canopyAt(p),openFilm=currentWetness,canopyFilm=openFilm*(1-shelter*.35);return {position:[p.x,p.y??0,p.z],shelter,openFilm,canopyFilm,clearedFraction:cleared*.65,film:canopyFilm*(1-cleared*.65)};}
  return {uniforms,bind,update({dt=0,vehicle,rivals=[],wetness=0,qualityTier='balanced'}={}){if(disposed)return;latestVehicle=vehicle;currentWetness=wetness;if(vehicle?.position)rebuild(vehicle.position);if(dt>0){time+=Math.min(.05,dt);vehiclePaths(vehicle,'player',wetness);for(const rival of rivals)vehiclePaths(rival,rival.id||'rival',wetness);}for(let i=0;i<24;i++){const index=(cursor-1-i+48)%24;segments[i].copy(paths[index]);strengths[i]=i<count?levels[index]*Math.exp(-(time-births[index])/45):0;}uniforms.uAnWheelPathCount.value=Math.min(count,qualityTier==='low'?8:isHighGraphicsQuality(qualityTier)?24:16);},
    resetContacts(){previous.clear();},
    sampleCanopy:canopyAt,sampleFilm:filmAt,
    diagnostics:()=>({canopies:canopies.length,coverageCells,textureResolution:resolution,extentM:extent,textureUpdates:updates,wheelSegments:count,renderedSegments:uniforms.uAnWheelPathCount.value,time,playerFilm:latestVehicle?.position?filmAt(latestVehicle.position):null,latestPathFilm:count?filmAt({x:(segments[0].x+segments[0].z)*.5,z:(segments[0].y+segments[0].w)*.5}):null,source:'world-canopy-projection-and-physical-wheel-paths'}),
    dispose(){if(disposed)return;disposed=true;texture.dispose();canopies=[];previous.clear();},
  };
}

/**
 * Measured against cabinaGz normalized to COCKPIT_LAYOUT.cabin.targetWidth=2.20.
 * Frame fit: z=.335262279*y-.353797844 (16 pillar samples, RMS .00260).
 * Every position and wipe radius uses the same cabin-local glass plane.
 */
export const WINDSHIELD_FIT=Object.freeze({widthM:1.54,topWidthM:1.62,heightM:.292,baseY:.157,baseZ:-.301161666,rakeRad:Math.atan(.335262279),glassOffsetM:.001,bladeOffsetM:-.0025,pivotBelowM:.023,angleMin:.20,angleMax:2.76});
export function windshieldLayout(options={}){
 const p={...WINDSHIELD_FIT,...options},cos=Math.cos(p.rakeRad),sin=Math.sin(p.rakeRad),surfaceHeight=p.heightM/cos;
 const pivots=[[-p.widthM*.23,-p.pivotBelowM/cos],[p.widthM*.21,-p.pivotBelowM/cos]];
 return {...p,cos,sin,surfaceHeight,pivots,innerRadius:surfaceHeight*.36,outerRadius:surfaceHeight*.96,
  point(x,y,normalOffset=0){return [x,p.baseY+y*cos-normalOffset*sin,p.baseZ+y*sin+normalOffset*cos];}};
}
export function windshieldBladeEndpoints(layout,index,phase){
 const angle=layout.angleMin+Math.max(0,Math.min(1,phase))*(layout.angleMax-layout.angleMin),pivot=layout.pivots[index];
 return [layout.innerRadius,layout.outerRadius].map(r=>layout.point(pivot[0]+Math.cos(angle)*r,pivot[1]+Math.sin(angle)*r,layout.bladeOffsetM));
}
export function createWeatherWindshield(THREE,{cabinMount,camera,...options}={}){
 if(!cabinMount?.add)throw new TypeError('cabinMount is required');
 const fit=windshieldLayout(options),root=new THREE.Group();root.name='AN_WindshieldWeather';cabinMount.add(root);
 const geometry=new THREE.PlaneGeometry(fit.widthM,fit.heightM,1,1),position=geometry.attributes.position,surface=new Float32Array(position.count*2);
 for(let i=0;i<position.count;i++){
  const top=position.getY(i)>0,x=position.getX(i)*(top?fit.topWidthM/fit.widthM:1),y=top?fit.surfaceHeight:0;
  position.setXYZ(i,...fit.point(x,y,fit.glassOffsetM));surface.set([x,y],i*2);
 }
 geometry.setAttribute('windshieldSurface',new THREE.BufferAttribute(surface,2));geometry.computeVertexNormals();
 const uniforms={uTime:{value:0},uRain:{value:0},uSpeed:{value:0},uPhase:{value:0},uFilm:{value:0},uSweep:{value:0},uCycles:{value:0},uRate:{value:0},
  uHeight:{value:fit.surfaceHeight},uAngles:{value:new THREE.Vector2(fit.angleMin,fit.angleMax)},
  uWipers:{value:fit.pivots.map(([x,y])=>new THREE.Vector4(x,y,fit.innerRadius,fit.outerRadius))}};
 const material=new THREE.ShaderMaterial({name:'AN_WindshieldDropsFilm',uniforms,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,vertexShader:"#include <common>\n#include <logdepthbuf_pars_vertex>\nattribute vec2 windshieldSurface;\nvarying vec2 vUv,vSurface;\nvoid main(){vUv=uv;vSurface=windshieldSurface;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;\n#include <logdepthbuf_vertex>\n}",fragmentShader:"#include <logdepthbuf_pars_fragment>\nuniform float uTime,uRain,uSpeed,uPhase,uFilm,uSweep,uCycles,uRate,uHeight;\nuniform vec2 uAngles;uniform vec4 uWipers[2];varying vec2 vUv,vSurface;\nfloat hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat drops(vec2 uv,float scale){vec2 cell=floor(uv*scale),f=fract(uv*scale);float id=hash(cell);float travel=uTime*(.012+id*.03+uSpeed*.0006);f.y=fract(f.y+travel);vec2 p=f-vec2(.18+id*.6,.3);float size=.055+id*.095;float ellipse=length(p*vec2(1.,.7+id*.4));float rim=1.-smoothstep(.012,.035,abs(ellipse-size));return rim*smoothstep(.1,.42,uRain-id*.35);}\nfloat wiped(vec2 surface,vec4 wiper){\n vec2 p=surface-wiper.xy;float r=length(p),angle=atan(p.y,p.x),arc=clamp((angle-uAngles.x)/(uAngles.y-uAngles.x),0.,1.);\n float outward=acos(1.-2.*arc)/6.283185,inward=1.-outward;\n float age=min(mod(fract(uCycles)-outward+1.,1.),mod(fract(uCycles)-inward+1.,1.))/max(.05,uRate);\n float passed=uCycles>=outward?1.:0.;\n return step(wiper.z,r)*step(r,wiper.w)*passed*step(uAngles.x,angle)*step(angle,uAngles.y)*exp(-age*.95)*step(.01,uRate);\n}\nvoid main(){\n float cleaned=max(wiped(vSurface,uWipers[0]),wiped(vSurface,uWipers[1]));\n float edge=smoothstep(0.,.015,vUv.x)*smoothstep(0.,.015,1.-vUv.x)*smoothstep(0.,.02,vUv.y)*smoothstep(0.,.02,1.-vUv.y);\n vec2 metric=vSurface/uHeight;float drop=drops(metric,18.)+drops(metric+vec2(.017,.3),31.)*.45;\n float alpha=(drop*.31*(1.-cleaned*.91)+uFilm*.026*(1.-cleaned*.55))*edge;\n vec3 color=mix(vec3(.19,.25,.28),vec3(.77,.86,.9),drop*.8);if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);\n #include <logdepthbuf_fragment>\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}"});
 const pane=new THREE.Mesh(geometry,material);pane.name='AN_DropsOnCabinGlass';pane.renderOrder=3;root.add(pane);
 const wiperMaterial=new THREE.MeshStandardMaterial({name:'WindshieldWiperRubber',color:'#17201f',roughness:.68,metalness:.18}),wipers=[],blades=[];
 const bladeCenter=(fit.innerRadius+fit.outerRadius)*.5,bladeLength=fit.outerRadius-fit.innerRadius;
 for(let i=0;i<fit.pivots.length;i++){
  const [x,y]=fit.pivots[i],pivot=new THREE.Group();pivot.name='AN_WiperPivot_'+i;pivot.position.fromArray(fit.point(x,y));pivot.rotation.x=fit.rakeRad;
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.006,bladeCenter,.006),wiperMaterial);arm.name='AN_WiperArm_'+i;arm.position.set(0,bladeCenter*.5,-.009);pivot.add(arm);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.007,bladeLength,.004),wiperMaterial);blade.name='AN_WiperBlade_'+i;blade.position.set(0,bladeCenter,fit.bladeOffsetM);pivot.add(blade);
  root.add(pivot);wipers.push(pivot);blades.push(blade);
 }
 root.visible=false;pane.visible=false;let time=0,film=0,cycle=0,disposed=false;
 function setPhase(phase){for(const pivot of wipers)pivot.rotation.z=fit.angleMin+phase*(fit.angleMax-fit.angleMin)-Math.PI/2;}
 setPhase(0);
 const measuredPoint=new THREE.Vector3();
 function measure(){
  root.updateWorldMatrix(true,true);camera?.updateWorldMatrix(true,false);const points=[],ndc=[];
  for(let i=0;i<position.count;i++){measuredPoint.fromBufferAttribute(position,i).applyMatrix4(pane.matrixWorld);points.push(measuredPoint.toArray());if(camera)ndc.push(measuredPoint.project(camera).toArray());}
  return {widthM:fit.widthM,topWidthM:fit.topWidthM,heightM:fit.heightM,baseY:fit.baseY,baseZ:fit.baseZ,rakeDeg:fit.rakeRad*180/Math.PI,
   cornersWorld:points,cornersNdc:ndc,cabinPosition:cabinMount.position.toArray(),cabinScale:cabinMount.scale.toArray(),
   wipers:wipers.map((pivot,i)=>({pivotLocal:pivot.position.toArray(),pivotWorld:pivot.getWorldPosition(new THREE.Vector3()).toArray(),
    bladeEndsLocal:windshieldBladeEndpoints(fit,i,uniforms.uPhase.value),
    bladeEndsWorld:[-bladeLength*.5,bladeLength*.5].map(y=>new THREE.Vector3(0,y,0).applyMatrix4(blades[i].matrixWorld).toArray()),
    wipeSurface:uniforms.uWipers.value[i].toArray(),bladeNormalOffsetM:fit.bladeOffsetM})),fitSource:'measured-cabinaGz-opening',wipeCoordinates:'shared-metric-glass-plane'};
 }
 return{
  update({dt=0,rain=0,speedMps=0,active=true,cameraMode='cockpit',paused=false,wiperMode='auto'}={}){
   if(disposed)return;root.visible=active&&cameraMode==='cockpit';pane.visible=rain>.005||film>.005;if(paused||!active)return;
   dt=Math.max(0,Math.min(.05,dt));time+=dt;film+=(rain-film)*(1-Math.exp(-dt/(rain>film?4:18)));
   const rate=wiperMode==='off'?0:wiperMode==='fast'?1.2:wiperMode==='slow'?.62:rain>.8?1.1:rain>.02?.66:0;
   if(rate>0)cycle+=dt*rate;else if(cycle%1>.01)cycle=Math.min(Math.ceil(cycle),cycle+dt*.8);
   const phase=(1-Math.cos(cycle*Math.PI*2))*.5;
   uniforms.uTime.value=time;uniforms.uRain.value=Math.max(rain,film*.35);uniforms.uSpeed.value=Math.abs(speedMps);uniforms.uPhase.value=phase;uniforms.uSweep.value=cycle%1>.5?1:0;uniforms.uFilm.value=film;uniforms.uCycles.value=cycle;uniforms.uRate.value=rate;setPhase(phase);
  },
  diagnostics:()=>({visible:root.visible,dropsVisible:pane.visible,time,film,phase:uniforms.uPhase.value,cabinAnchored:root.parent===cabinMount,drawBatches:5,measurements:measure()}),
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.traverse(object=>object.geometry?.dispose());material.dispose();wiperMaterial.dispose();}
 };
}

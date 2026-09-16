/**
 * Measured against cabinaGz normalized to COCKPIT_LAYOUT.cabin.targetWidth=2.20.
 * Frame fit: z=.335262279*y-.353797844 (16 pillar samples, RMS .00260).
 * Every position and wipe radius uses the same cabin-local glass plane.
 */
export const WINDSHIELD_FIT=Object.freeze({widthM:1.54,topWidthM:1.62,heightM:.292,baseY:.157,baseZ:-.301161666,rakeRad:Math.atan(.335262279),glassOffsetM:.001,bladeOffsetM:-.0025,pivotBelowM:.023,angleMin:.20,angleMax:2.76});
export function windshieldLayout(options={}){
 const p={...WINDSHIELD_FIT,...options},cos=Math.cos(p.rakeRad),sin=Math.sin(p.rakeRad),surfaceHeight=p.heightM/cos;
 const pivots=[[-p.widthM*.23,-p.pivotBelowM/cos],[p.widthM*.21,-p.pivotBelowM/cos]];
 const widthAt=fraction=>(1+fraction*(p.topWidthM/p.widthM-1))*(1-(p.edgeNarrow||0)*Math.pow(Math.abs(2*fraction-1),12));
 return {...p,cos,sin,surfaceHeight,pivots,widthAt,innerRadius:surfaceHeight*.36,outerRadius:surfaceHeight*.96,
  point(x,y,normalOffset=0,out=[]){const fraction=y/surfaceHeight,q=Math.min(1,Math.abs(x)/(p.widthM*.5*widthAt(fraction))),edge=Math.pow(q,p.curveYExponent||12);out[0]=x;out[1]=p.baseY+y*cos-normalOffset*sin+edge*((p.curveBottomYM||0)*(1-fraction)+(p.curveTopYM||0)*fraction);out[2]=p.baseZ+y*sin+normalOffset*cos+(p.curveDepthM||0)*Math.pow(q,p.curveExponent||6);return out;}};
}
export function windshieldBladeEndpoints(layout,index,phase){
 const angle=layout.angleMin+Math.max(0,Math.min(1,phase))*(layout.angleMax-layout.angleMin),pivot=layout.pivots[index];
 return [layout.innerRadius,layout.outerRadius].map(r=>layout.point(pivot[0]+Math.cos(angle)*r,pivot[1]+Math.sin(angle)*r,layout.bladeOffsetM));
}
export function createWeatherWindshield(THREE,{cabinMount,camera,...options}={}){
 if(!cabinMount?.add)throw new TypeError('cabinMount is required');
 const fit=windshieldLayout(options),root=new THREE.Group();root.name='AN_WindshieldWeather';cabinMount.add(root);
 const geometry=new THREE.PlaneGeometry(fit.widthM,fit.heightM,fit.curveDepthM?24:1,fit.curveDepthM?6:1),position=geometry.attributes.position,surface=new Float32Array(position.count*2);
 for(let i=0;i<position.count;i++){
  const fraction=(position.getY(i)+fit.heightM*.5)/fit.heightM,x=position.getX(i)*fit.widthAt(fraction),y=fraction*fit.surfaceHeight;
  position.setXYZ(i,...fit.point(x,y,fit.glassOffsetM));surface.set([x,y],i*2);
 }
 geometry.setAttribute('windshieldSurface',new THREE.BufferAttribute(surface,2));geometry.computeVertexNormals();
 // One 128-byte angular history serves both synchronized blades. It persists
 // across speed changes and parking; no texture/array is allocated per frame.
 const wipeSamples=128,wipeStrength=new Float32Array(wipeSamples),wipeBytes=new Uint8Array(wipeSamples),outwardPass=new Float32Array(wipeSamples);
 for(let i=0;i<wipeSamples;i++)outwardPass[i]=Math.acos(1-2*(i+.5)/wipeSamples)/(Math.PI*2);
 const wipeMemory=new THREE.DataTexture(wipeBytes,wipeSamples,1,THREE.RedFormat,THREE.UnsignedByteType);
 wipeMemory.minFilter=THREE.LinearFilter;wipeMemory.magFilter=THREE.LinearFilter;wipeMemory.generateMipmaps=false;wipeMemory.needsUpdate=true;
 const uniforms={uWipeMemory:{value:wipeMemory},uTime:{value:0},uRain:{value:0},uSpeed:{value:0},uPhase:{value:0},uFilm:{value:0},uSweep:{value:0},uCycles:{value:0},uRate:{value:0},
  uHeight:{value:fit.surfaceHeight},uAngles:{value:new THREE.Vector2(fit.angleMin,fit.angleMax)},
  uWipers:{value:fit.pivots.map(([x,y])=>new THREE.Vector4(x,y,fit.innerRadius,fit.outerRadius))}};
 const material=new THREE.ShaderMaterial({name:'AN_WindshieldDropsFilm',uniforms,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,vertexShader:"#include <common>\n#include <logdepthbuf_pars_vertex>\nattribute vec2 windshieldSurface;\nvarying vec2 vUv,vSurface;\nvoid main(){vUv=uv;vSurface=windshieldSurface;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;\n#include <logdepthbuf_vertex>\n}",fragmentShader:"#include <logdepthbuf_pars_fragment>\nuniform float uTime,uRain,uSpeed,uPhase,uFilm,uSweep,uCycles,uRate,uHeight;\nuniform sampler2D uWipeMemory;\nuniform vec2 uAngles;uniform vec4 uWipers[2];varying vec2 vUv,vSurface;\nfloat hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n// Metric coordinates retain round beads on the very wide, shallow cabin glass.\n// RGB stores lens coverage, a narrow lit crescent and its opposing dark rim.\nvec3 beads(vec2 metric,float scale,float runoff,float seed){\n vec2 grid=metric*scale+vec2(seed,seed*.73),cell=floor(grid),f=fract(grid);float id=hash(cell),jitter=hash(cell+19.7);\n f.y=fract(f.y+uTime*runoff*(.07+id*.16+uSpeed*.0018));\n vec2 p=f-vec2(.23+jitter*.52,.3+id*.27);p.x+=sin(uTime*.7+id*37.)*.012*runoff;\n float radius=mix(.085,.205,id*id);vec2 q=p/vec2(radius,radius*(1.+runoff*(.8+uSpeed*.016)));\n float d=length(q),aa=max(.025,fwidth(d)),body=1.-smoothstep(1.-aa,1.+aa,d);\n float rim=1.-smoothstep(.09,.09+aa,abs(d-.84));\n float lit=pow(max(0.,dot(normalize(q+vec2(.001)),normalize(vec2(-.55,.84)))),5.)*rim;\n float shade=pow(max(0.,dot(normalize(q+vec2(.001)),normalize(vec2(.4,-.8)))),3.)*rim;\n float deposit=smoothstep(.025,.2,uRain-id*.72);\n return vec3(body*(.04+rim*.24),lit,shade)*deposit;\n}\nvec3 rivulets(vec2 metric){\n vec2 cell=floor(vec2(metric.x*5.,metric.y*2.));float id=hash(cell+31.1);\n float flow=uTime*(.07+id*.045+uSpeed*.001),y=fract(metric.y*2.+flow);\n float center=.2+id*.58+sin(metric.y*15.+id*43.+uTime*.23)*.035;\n float x=fract(metric.x*5.)-center,width=.012+id*.013;\n float aa=max(.002,fwidth(x)),line=1.-smoothstep(width,width+aa,abs(x));\n float tail=smoothstep(.12,.28,y)*(1.-smoothstep(.72,.9,y));\n float deposit=smoothstep(.23,.8,uFilm)*step(.71,id),edge=1.-smoothstep(aa,aa*2.5,abs(abs(x)-width*.7));\n return vec3(line*tail*.1,edge*tail*.36,line*tail*.07)*deposit;\n}\nfloat wiped(vec2 surface,vec4 wiper){\n vec2 p=surface-wiper.xy;float radius=length(p),angle=atan(p.y,p.x),arc=(angle-uAngles.x)/(uAngles.y-uAngles.x);\n float feather=.003;\n float annulus=smoothstep(wiper.z-feather,wiper.z+feather,radius)*(1.-smoothstep(wiper.w-feather,wiper.w+feather,radius));\n float history=texture2D(uWipeMemory,vec2(clamp(arc,0.,1.),.5)).r;\n return history*annulus*step(0.,arc)*step(arc,1.);\n}\nvoid main(){\n float cleaned=max(wiped(vSurface,uWipers[0]),wiped(vSurface,uWipers[1]));\n float edge=smoothstep(0.,.015,vUv.x)*smoothstep(0.,.015,1.-vUv.x)*smoothstep(0.,.02,vUv.y)*smoothstep(0.,.02,1.-vUv.y);\n vec2 metric=vSurface/uHeight;\n vec3 optics=beads(metric,54.,0.,.3)*.36+beads(metric,26.,.32,7.8)+beads(metric,11.,1.,19.2)*1.1+rivulets(metric);\n float residue=1.-cleaned*.96;\n float edgeWater=uFilm*(1.-smoothstep(.015,.11,vUv.y))*.025;\n float alpha=min(.46,optics.x*residue+optics.y*.17*residue+uFilm*.004*(1.-cleaned*.8)+edgeWater)*edge;\n vec3 color=mix(vec3(.13,.19,.22),vec3(.83,.91,.96),clamp(.3+optics.y*1.1-optics.z*.8,0.,1.));\n if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);\n #include <logdepthbuf_fragment>\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}"});
 const pane=new THREE.Mesh(geometry,material);pane.name='AN_DropsOnCabinGlass';pane.renderOrder=3;root.add(pane);
 const curvedParts=[],curvedPoint=[0,0,0];
 const wiperMaterial=new THREE.MeshStandardMaterial({name:'WindshieldWiperRubber',color:'#17201f',roughness:.68,metalness:.18}),wipers=[],blades=[];
 const bladeCenter=(fit.innerRadius+fit.outerRadius)*.5,bladeLength=fit.outerRadius-fit.innerRadius;
 for(let i=0;i<fit.pivots.length;i++){
  const [x,y]=fit.pivots[i],pivot=new THREE.Group();pivot.name='AN_WiperPivot_'+i;pivot.position.fromArray(fit.point(x,y));pivot.rotation.x=fit.rakeRad;
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.006,bladeCenter,.006),wiperMaterial);arm.name='AN_WiperArm_'+i;arm.position.set(0,bladeCenter*.5,-.009);pivot.add(arm);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.007,bladeLength,.004),wiperMaterial);blade.name='AN_WiperBlade_'+i;blade.position.set(0,bladeCenter,fit.bladeOffsetM);pivot.add(blade);
  root.add(pivot);wipers.push(pivot);blades.push(blade);
  if(fit.curveDepthM){
   for(const [part,near,far] of [[arm,0,bladeCenter],[blade,fit.innerRadius,fit.outerRadius]]){
    part.geometry.dispose();part.geometry=new THREE.BoxGeometry(part===arm?.006:.007,1,.004,1,12,1);part.position.set(0,0,0);part.rotation.set(0,0,0);root.add(part);
    curvedParts.push({part,index:i,near,far,original:part.geometry.attributes.position.array.slice()});
   }
  }
 }
 root.visible=false;pane.visible=false;let time=0,film=0,cycle=0,disposed=false;
 function setPhase(phase){
  const angle=fit.angleMin+phase*(fit.angleMax-fit.angleMin);
  for(const pivot of wipers)pivot.rotation.z=angle-Math.PI/2;
  for(const {part,index,near,far,original} of curvedParts){
   const position=part.geometry.attributes.position,[px,py]=fit.pivots[index];
   for(let i=0;i<position.count;i++){const radius=near+(original[i*3+1]+.5)*(far-near),side=original[i*3];position.setXYZ(i,...fit.point(px+Math.cos(angle)*radius-Math.sin(angle)*side,py+Math.sin(angle)*radius+Math.cos(angle)*side,fit.bladeOffsetM+original[i*3+2],curvedPoint));}
   position.needsUpdate=true;part.geometry.computeVertexNormals();part.geometry.computeBoundingSphere();part.geometry.computeBoundingBox();
  }
 }
 setPhase(0);
 const measuredPoint=new THREE.Vector3();
 function measuredBladeEnds(index){
  const blade=blades[index],part=curvedParts.find(p=>p.part===blade);
  if(!part)return [-bladeLength*.5,bladeLength*.5].map(y=>new THREE.Vector3(0,y,0).applyMatrix4(blade.matrixWorld).toArray());
  return [-.5,.5].map(end=>{const center=new THREE.Vector3(),sample=new THREE.Vector3(),p=blade.geometry.attributes.position;let count=0;for(let i=0;i<p.count;i++)if(Math.abs(part.original[i*3+1]-end)<1e-6){center.add(sample.fromBufferAttribute(p,i));count++;}return center.multiplyScalar(1/count).applyMatrix4(blade.matrixWorld).toArray();});
 }
 function measure(){
  root.updateWorldMatrix(true,true);camera?.updateWorldMatrix(true,false);const points=[],ndc=[];
  for(let i=0;i<position.count;i++){measuredPoint.fromBufferAttribute(position,i).applyMatrix4(pane.matrixWorld);points.push(measuredPoint.toArray());if(camera)ndc.push(measuredPoint.project(camera).toArray());}
  return {widthM:fit.widthM,topWidthM:fit.topWidthM,heightM:fit.heightM,baseY:fit.baseY,baseZ:fit.baseZ,rakeDeg:fit.rakeRad*180/Math.PI,
   cornersWorld:points,cornersNdc:ndc,cabinPosition:cabinMount.position.toArray(),cabinScale:cabinMount.scale.toArray(),
   wipers:wipers.map((pivot,i)=>({pivotLocal:pivot.position.toArray(),pivotWorld:pivot.getWorldPosition(new THREE.Vector3()).toArray(),
    bladeEndsLocal:windshieldBladeEndpoints(fit,i,uniforms.uPhase.value),
    bladeEndsWorld:measuredBladeEnds(i),
    wipeSurface:uniforms.uWipers.value[i].toArray(),bladeNormalOffsetM:fit.bladeOffsetM})),fitSource:'measured-cabinaGz-opening',wipeCoordinates:'shared-metric-glass-plane'};
 }
 return{
  update({dt=0,rain=0,speedMps=0,active=true,cameraMode='cockpit',paused=false,wiperMode='auto'}={}){
   if(disposed)return;root.visible=active&&cameraMode==='cockpit';if(paused||!active)return;
   dt=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;rain=Number.isFinite(rain)?Math.max(0,Math.min(1,rain)):0;speedMps=Number.isFinite(speedMps)?Math.abs(speedMps):0;
   time+=dt;film+=(rain-film)*(1-Math.exp(-dt/(rain>film?3.2:12)));
   const rate=wiperMode==='off'?0:wiperMode==='fast'?1.2:wiperMode==='slow'?.62:rain>.8?1.1:rain>.02?.66:0,previousCycle=cycle;
   if(rate>0)cycle+=dt*rate;else if(cycle%1>1e-7)cycle=Math.min(Math.ceil(cycle),cycle+dt*.8);
   const movingRate=dt>0?(cycle-previousCycle)/dt:0,refill=rain*1.9+.025,decay=Math.exp(-dt*refill);
   if(dt>0){for(let i=0;i<wipeSamples;i++){
    const outward=outwardPass[i],inward=1-outward,lastOut=Math.floor(cycle-outward)+outward,lastIn=Math.floor(cycle-inward)+inward,lastPass=Math.max(lastOut,lastIn);
    wipeStrength[i]=movingRate>0&&lastPass>previousCycle&&lastPass<=cycle?Math.exp(-(cycle-lastPass)/movingRate*refill):wipeStrength[i]*decay;
    wipeBytes[i]=Math.round(wipeStrength[i]*255);
   }wipeMemory.needsUpdate=true;}
   const phase=(1-Math.cos(cycle*Math.PI*2))*.5;
   uniforms.uTime.value=time;uniforms.uRain.value=Math.max(rain,film*.42);uniforms.uSpeed.value=speedMps;uniforms.uPhase.value=phase;uniforms.uSweep.value=cycle%1>.5?1:0;uniforms.uFilm.value=film;uniforms.uCycles.value=cycle;uniforms.uRate.value=movingRate;setPhase(phase);
   pane.visible=rain>.005||film>.005;
  },
  diagnostics:()=>({visible:root.visible,dropsVisible:pane.visible,time,film,phase:uniforms.uPhase.value,cabinAnchored:root.parent===cabinMount,drawBatches:5,wipeMemorySamples:wipeSamples,optics:'hierarchical-beads-rivulets-persistent-wipe',measurements:measure()}),
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.traverse(object=>object.geometry?.dispose());material.dispose();wiperMaterial.dispose();wipeMemory.dispose();}
 };
}

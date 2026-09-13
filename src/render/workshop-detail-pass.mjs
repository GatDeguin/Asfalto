import { tintWorkshopInstances } from './workshop-vertex-colors.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// All dimensions below are metres in the authored room after its import transform.
// The three work areas retain the room's original furniture and circulation space.
export function createWorkshopDetailPass(T, workshop, {floorY=.188, makeLabel=labelTexture}={}) {
  const {scene,workshopRoot}=workshop, owned=new Set(), changed=[], group=new T.Group();
  group.name='Workshop_Detail_Pass_1973';scene.add(group);
  let night=false,disposed=false,time=0, hood=0;
  const materials={}, buckets=new Map(), lights=[], emitters=[], windows=[], lod=[];
  const material=(key,color,roughness=.7,metalness=0)=>materials[key]||(materials[key]=new T.MeshStandardMaterial({name:'Workshop_'+key,color,roughness,metalness}));
  const steel=material('BrushedSteel','#7c8178',.4,.78), dark=material('DarkRubber','#191e1b',.9), cream=material('AgedEnamel','#afa68f',.72,.1), rust=material('ContactWear','#6c4530',.87,.28), cloth=material('FoldedCloth','#647369',.99), oil=material('AmberOil','#73551f',.19);
  const boxGeo=new T.BoxGeometry(1,1,1), cylinderGeo=new T.CylinderGeometry(1,1,1,20), cylinderLow=new T.CylinderGeometry(1,1,1,8), sphereGeo=new T.SphereGeometry(1,12,8);
  for(const g of [boxGeo,cylinderGeo,cylinderLow,sphereGeo])owned.add(g);
  const matrix=new T.Matrix4(), q=new T.Quaternion(), pos=new T.Vector3(), scale=new T.Vector3();
  function instance(geometry,mat,position,size,rotation=[0,0,0]) {
    const key=geometry.uuid+mat.uuid;
    if(!buckets.has(key))buckets.set(key,{geometry,mat,matrices:[]});
    q.setFromEuler(new T.Euler(...rotation));matrix.compose(pos.fromArray(position),q,scale.fromArray(size));
    buckets.get(key).matrices.push(matrix.clone());
  }
  const box=(p,s,m=steel,r)=>instance(boxGeo,m,p,s,r);
  const cylinder=(p,r,h,m=steel,rotation)=>instance(cylinderGeo,m,p,[r,h,r],rotation);
  function tube(points,radius,mat=dark) {
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const geometry=new T.TubeGeometry(curve,Math.max(12,points.length*6),radius,6,false);owned.add(geometry);
    const mesh=new T.Mesh(geometry,mat);mesh.castShadow=true;group.add(mesh);return mesh;
  }
  function label(text,p,size,color='#c3b99e') {
    const tex=makeLabel(T,text,color);if(tex)owned.add(tex);
    const mat=new T.MeshStandardMaterial({color:tex?'#ffffff':color,map:tex,roughness:.86,metalness:.08});owned.add(mat);
    const g=new T.PlaneGeometry(...size);owned.add(g);const m=new T.Mesh(g,mat);m.position.fromArray(p);group.add(m);return m;
  }

  // Skirting and ceiling returns. The E31 architecture owns the service frame.
  box([0,floorY+.085,-5.81],[17.35,.17,.08],dark);
  box([-8.65,floorY+.085,.04],[.08,.17,11.68],dark);for(const[a,b]of[[-5.80,3.160],[4.495,5.88]])box([8.65,floorY+.085,(a+b)/2],[.08,.17,b-a],dark);
  for(const x of [-8.61,8.61])box([x,4.64,.04],[.13,.11,11.68],cream);
  box([0,4.64,-5.76],[17.22,.11,.13],cream);

  // Repaired contact edges and feet, not randomly scattered wear.
  for(const x of [-3.95,-2.75,-1.55,-.35,6.75,7.95]) {
    box([x,floorY+.023,-5.25],[.13,.045,.13],dark);
    box([x,1.086,-4.97],[.21,.008,.018],rust);
  }
  // Practical shelf lips and supports. Heavy drums remain on the floor.
  for(const y of [.725,1.226,1.725,2.223]) {
    box([-3.12,y-.019,-5.35],[1.48,.038,.44],steel);
    for(const x of [-3.75,-2.51])box([x,y-.11,-5.58],[.05,.23,.055],dark);
  }
  for(const x of [-1.96,-1.52,-1.08,-.64])box([x,1.099,-5.18],[.002,.005,.43],dark);
  for(const x of [-2.12,-.42])for(const z of [-5.37,-5.02])cylinder([x,1.103,z],.009,.004,steel);

  // Tool board and every mounted tool share the workbench footprint, clear of the rest-corner records.
  box([-6.69,1.95,-5.765],[2.1,1.25,.06],material('Pegboard','#575d48',.96));
  for(let row=0;row<6;row++)for(let col=0;col<10;col++)cylinder([-7.58+col*.20,1.44+row*.19,-5.724],.012,.006,dark,[Math.PI/2,0,0]);
  for(let i=0;i<7;i++) {
    const x=-7.40+i*.24,y=2.39-(i%2)*.22,z=-5.66;
    tube([[x,y+.035,z-.05],[x,y,z+.045],[x,y-.045,z+.045]],.012,steel);
    box([x,y-.17,z],[.035,.30+(i%3)*.02,.017],steel,[0,0,(i%2?1:-1)*.06]);
    const head=new T.TorusGeometry(.046,.009,6,14);owned.add(head);
    const mesh=new T.Mesh(head,steel);mesh.position.set(x,y-.025,z);group.add(mesh);
  }
  label('BANCO / HERRAMIENTAS',[-6.70,2.71,-5.70],[2.02,.20]);
  label('REPUESTOS / LUBRICANTES',[-2.76,2.63,-5.73],[2.33,.24]);
  label('CHEVROLET 250\nSERVICIO Y PUESTA A PUNTO',[3.66,2.35,-5.73],[2.28,.79]);

  // A specific repair on the cabinet: gasket, cleaned fasteners and used rag.
  const trayMat=material('ServiceTray','#77817b',.32,.8);
  box([6.82,1.627,-5.12],[.57,.026,.38],trayMat);
  for(const x of [6.535,7.105])box([x,1.655,-5.12],[.016,.065,.40],trayMat);
  for(const z of [-5.31,-4.93])box([6.82,1.655,z],[.59,.065,.016],trayMat);
  for(let i=0;i<14;i++) {
    const x=6.65+(i%5)*.073,z=-5.24+Math.floor(i/5)*.068;
    cylinder([x,1.654,z],.014,.021,steel);box([x,1.644,z+.02],[.012,.011,.065],steel,[0,.3+i*.23,0]);
  }
  tube([[6.77,1.674,-5.17],[6.85,1.674,-5.20],[6.93,1.674,-5.14],[6.86,1.674,-5.06],[6.77,1.674,-5.17]],.009,dark);
  const ragGeo=new T.PlaneGeometry(.31,.35,12,12),a=ragGeo.attributes.position;
  for(let i=0;i<a.count;i++)a.setZ(i,Math.sin(a.getX(i)*42)*.013+Math.sin(a.getY(i)*36+a.getX(i)*11)*.006);
  ragGeo.computeVertexNormals();owned.add(ragGeo);const rag=new T.Mesh(ragGeo,cloth);rag.rotation.x=-Math.PI/2;rag.position.set(6.42,1.64,-5.17);rag.castShadow=true;group.add(rag);
  // Cable hangs from socket; air hose rests on concrete, with connector.
  tube([[6.6,1.15,-5.69],[6.56,.65,-5.59],[6.37,.51,-5.58],[6.21,.73,-5.58],[6.37,.95,-5.58],[6.54,.74,-5.58],[6.36,.53,-5.58],[6.18,.73,-5.58],[6.30,1.0,-5.59]],.012,dark);box([6.36,1.02,-5.70],[.13,.05,.24],steel);
  box([6.6,1.19,-5.73],[.075,.12,.042],cream);
  cylinder([6.30,1.04,-5.59],.022,.11,steel,[Math.PI/2,0,.8]);
  // Sample jars have a wall, neck, rim, cap and a visible meniscus.
  const glass=new T.MeshPhysicalMaterial({color:'#c6d2bc',roughness:.13,metalness:0,transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide});owned.add(glass);
  for(let i=0;i<3;i++) {
    const x=-8.10,y=.835,z=3.49-i*.21,h=.19+i*.028,r=.064;
    const g=new T.CylinderGeometry(r,r,h,24,1,true);owned.add(g);const jar=new T.Mesh(g,glass);jar.position.set(x,y+h/2,z);jar.renderOrder=4;group.add(jar);
    cylinder([x,y+h*(.24+i*.09),z],r-.006,h*(.48+i*.18),oil);
    cylinder([x,y+h+.012,z],r+.004,.024,steel);
    const rim=new T.TorusGeometry(r,.004,6,24);owned.add(rim);const lip=new T.Mesh(rim,glass);lip.rotation.x=Math.PI/2;lip.position.set(x,y+.006,z);group.add(lip);
  }

  // Lamp assemblies derive their mounts from the actual luminous GLB panels.
  workshopRoot.updateWorldMatrix(true,true);
  const signs=[];
  workshopRoot.traverse(object=>{
    if(!object.isMesh)return;
    const mats=Array.isArray(object.material)?object.material:[object.material];
    if(mats.some(m=>/Sign|Poster|Cinzano|Shell|Label/i.test(m?.name||'')))signs.push(object);
    if(mats.some(m=>m?.name==='MAT_Glass_Dirty')&&!Array.isArray(object.material)){const mat=object.material.clone();owned.add(mat);changed.push([object,object.material]);object.material=mat;mat.emissive?.set('#d8d5c4');windows.push(mat);}
    if(!mats.some(m=>m?.name==='MAT_Fluorescent_Emission'))return;
    const b=new T.Box3().setFromObject(object),p=b.getCenter(new T.Vector3()),s=b.getSize(new T.Vector3());
    const xLong=s.x>s.z,long=xLong?s.x:s.z;
    box([p.x,p.y+.035,p.z],[Math.max(.12,s.x+.06),.07,Math.max(.12,s.z+.06)],steel);
    for(const side of [-1,1]) {
      const x=p.x+(xLong?side*long*.49:0),z=p.z+(!xLong?side*long*.49:0);
      box([x,p.y-.012,z],[xLong?.045:.16,.075,xLong?.16:.045],cream);
      cylinder([x,(p.y+4.72)*.5,z],.008,Math.max(.03,4.72-p.y),steel);
    }
    const mat=object.material.clone();owned.add(mat);changed.push([object,object.material]);object.material=mat;emitters.push(mat);
    if(lights.length<3){const l=new T.PointLight('#f4e5c7',12,9,2);l.position.copy(p).add(new T.Vector3(0,-.09,0));group.add(l);lights.push(l);}
  });
  signs.forEach((object,i)=>{
    const original=object.material;if(Array.isArray(original))return;
    const mat=original.clone();mat.color.multiplyScalar(.69+(i%4)*.055);mat.roughness=.88;mat.metalness=.05;changed.push([object,original]);owned.add(mat);object.material=mat;
    applyPatina(mat,'sign',i*.79);
  });
  // Same lamp geometry and sources in day/night; only their power changes.
  if(!lights.length)for(const x of [-3.2,3.2]){const l=new T.PointLight('#f4e5c7',12,10,2);l.position.set(x,4.25,-1.4);group.add(l);lights.push(l);}

  // A wall fan has its own motor; blade movement has a clear physical cause.
  const fan=new T.Group();fan.name='Motor_driven_workshop_fan';fan.position.set(6.47,2.81,-5.58);group.add(fan);
  const fanRing=new T.TorusGeometry(.31,.019,8,40);owned.add(fanRing);fan.add(new T.Mesh(fanRing,steel));
  const rotor=new T.Group();fan.add(rotor);
  for(let i=0;i<3;i++){const blade=new T.Mesh(boxGeo,steel);blade.scale.set(.095,.24,.024);blade.position.set(Math.sin(i*Math.PI*2/3)*.125,Math.cos(i*Math.PI*2/3)*.125,.012);blade.rotation.z=-i*Math.PI*2/3-.2;rotor.add(blade);}
  for(let i=0;i<8;i++){const bar=new T.Mesh(boxGeo,dark);bar.scale.set(.6,.009,.009);bar.rotation.z=i*Math.PI/8;bar.position.z=.038;fan.add(bar);}
  box([6.47,2.49,-5.67],[.11,.16,.16],steel);

  // Batch rigid accessories. Fine cylinders swap tessellation, preserving silhouette.
  for(const {geometry,mat,matrices} of buckets.values()){
    const mesh=new T.InstancedMesh(geometry,mat,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
    mesh.updateWorldMatrix(true,false);
    tintWorkshopInstances(T,mesh,/Cloth|Pegboard/.test(mat.name)?'wood':'steel');
    owned.add(mesh);
    if(geometry===cylinderGeo)lod.push(mesh);
  }
  const dustGeo=new T.BufferGeometry(),count=96,points=new Float32Array(count*3),seeds=new Float32Array(count);
  for(let i=0;i<count;i++){points[i*3]=-7.9+(i%17)*.40;points[i*3+1]=.9+(i%13)*.21;points[i*3+2]=-1.3+Math.sin(i*9.2)*1.4;seeds[i]=(i*.618033)%1;}
  dustGeo.setAttribute('position',new T.BufferAttribute(points,3));dustGeo.setAttribute('seed',new T.BufferAttribute(seeds,1));owned.add(dustGeo);
  const dustMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},power:{value:1}},vertexShader:`attribute float seed;uniform float time;varying float a;void main(){vec3 p=position;p.y+=sin(time*.18+seed*31.)*.10;p.z+=sin(time*.11+seed*21.)*.09;float beam=1.-smoothstep(.0,.8,abs(p.y-(3.3-(p.x+8.)*.35)));a=beam*(.08+seed*.09);vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(10./max(1.,-v.z),1.,2.5);}`,fragmentShader:`uniform float power;varying float a;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.9,.81,.63,a*(1.-smoothstep(.12,.5,d))*power);}`});owned.add(dustMat);
  const dust=new T.Points(dustGeo,dustMat);dust.name='Dust_in_window_beam_only';group.add(dust);
  for(const m of Object.values(materials))owned.add(m);
  const api={
    group,
    setNight(value){night=!!value;for(const l of lights)l.intensity=140;for(const m of emitters){m.emissiveIntensity=3.2;}for(const m of windows)m.emissiveIntensity=night?.015:.42;dustMat.uniforms.power.value=night?.05:1;return night;},
    update(dt,{reducedMotion=false}={}) {if(disposed)return;dt=clamp(Number(dt)||0,0,.05);if(!reducedMotion)time+=dt;rotor.rotation.z=time*7;dustMat.uniforms.time.value=time;dust.visible=!reducedMotion;const distance=workshop.camera.position.distanceTo(fan.position);for(const m of lod)m.geometry=distance>9?cylinderLow:cylinderGeo;},
    diagnostics:()=>({zones:3,night,coloredInstances:[...buckets.values()].reduce((n,b)=>n+b.matrices.length,0),instancedBatches:buckets.size,instances:[...buckets.values()].reduce((n,b)=>n+b.matrices.length,0),practicalLights:lights.length,dustCount:count,disposed}),
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const [o,m]of changed)o.material=m;for(const item of owned)item.dispose?.();owned.clear();},
  };
  api.setNight(false);return api;
}

function labelTexture(T,text,color) {
  if(!globalThis.document?.createElement)return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#202e26';c.fillRect(0,0,1024,256);c.strokeStyle='#9a9c7855';c.lineWidth=12;c.strokeRect(9,9,1006,238);
  c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font='bold 56px Arial Narrow, sans-serif';const rows=text.split('\n');rows.forEach((row,i)=>c.fillText(row,512,128+(i-(rows.length-1)/2)*66,940));
  // Faded edges and scratches stay outside the central lettering area.
  for(let i=0;i<160;i++){const x=(i*193)%1024,y=i%2?(i*37)%25:231+(i*7)%25;c.fillStyle=i%3?'#b7b29333':'#0b120c66';c.fillRect(x,y,2+i%21,1+i%3);}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}

export function applyPatina(material,kind,seed=0) {
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous?.(shader);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorkshopSurface;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorkshopSurface=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vWorkshopSurface;
float wsHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float wsNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(wsHash(i),wsHash(i+vec3(1,0,0)),f.x),mix(wsHash(i+vec3(0,1,0)),wsHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(wsHash(i+vec3(0,0,1)),wsHash(i+vec3(1,0,1)),f.x),mix(wsHash(i+vec3(0,1,1)),wsHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`);
    let code='vec3 wp=vWorkshopSurface;float mottled=wsNoise(wp*1.3)+wsNoise(wp*5.)*.2;';
    if(kind==='wall')code+='float foot=exp(-max(0.,wp.y-.18)*2.8);float corner=exp(-abs(abs(wp.x)-8.66)*5.)+exp(-abs(wp.z+5.83)*6.);diffuseColor.rgb*=.81+mottled*.22;diffuseColor.rgb*=1.-min(.24,foot*.16+corner*.06);';
    if(kind==='floor')code+='vec2 engine=(wp.xz-vec2(-1.2,.2))*vec2(1.25,1.8);vec2 benchUse=(wp.xz-vec2(-1.5,-4.7))*vec2(.8,2.2);vec2 tinUse=(wp.xz-vec2(2.75,-2.65))*vec2(2.,2.);float deposit=max(exp(-dot(engine,engine)),max(exp(-dot(benchUse,benchUse))*.65,exp(-dot(tinUse,tinUse))*.45));float wiped=smoothstep(.35,.65,wsNoise(vec3(wp.x*4.,wp.z*1.5,0.)));float stain=deposit*smoothstep(.22,.80,mottled)*(.48+.52*wiped);float edge=exp(-abs(abs(wp.x)-8.65)*3.)+exp(-abs(wp.z+5.8)*3.);float turn=-.38*sin(clamp((5.4-wp.z)/5.4,0.,1.)*1.3);float track=(1.-smoothstep(.060,.15,abs(abs(wp.x-turn)-.76)))*smoothstep(-2.4,-1.8,wp.z)*(1.-smoothstep(5.1,5.7,wp.z));float tread=.78+.22*wsNoise(vec3(wp.x*19.,0.,wp.z*31.));diffuseColor.rgb*=mix(1.,.45,stain)*(.96-min(.16,edge*.11)-track*.18*tread);';
    if(kind==='metal')code+='float wear=smoothstep(.75,.88,wsNoise(wp*27.));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.14,.095),wear*.2);';
    if(kind==='sign')code+=`diffuseColor.rgb*=.75+.20*wsNoise(wp*3.6+${seed.toFixed(3)});`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+code);
    if(kind==='floor')shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(clamp(.78+.20*roughnessFactor,.78,.97),.70,stain*.55);');
  };
  material.customProgramCacheKey=()=>`workshop-patina-4-dry-concrete-${kind}-${seed}`;material.needsUpdate=true;
}

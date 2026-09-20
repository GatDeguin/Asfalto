// Seats in the donor's authored instrument recesses, in presentation source space.
// Dimensions: 01-build.py, r2/refine-interiors.py, r2/refine-r12-r10.py.
// Existing switchgear, radio, upholstery and bezels remain donor-owned.
const SCALE=.4, SHIFT=-.296283007;
const layouts={
 belair_1957:[
  {channel:'speedKph',label:'km/h',center:[-.216,.926,.49],radius:.086,max:180,step:30},
  {channel:'fuel',label:'FUEL',center:[-.216,.926,.31],radius:.032,max:1,step:.5},
  {channel:'temperatureC',label:'°C',center:[-.216,.926,.665],radius:.032,min:40,max:120,step:40},
 ],
 pickup_3100:[
  {channel:'speedKph',label:'km/h',center:[-.299,1.18,.48],radius:.063,max:140,step:20},
  {channel:'rpm',label:'RPM ×1000',center:[-.299,1.18,.28],radius:.063,max:6000,step:1000},
 ],
};
const clamp=v=>Math.min(1,Math.max(0,v));
const angle=ratio=>(225-270*ratio)*Math.PI/180;
function faceTexture(T,spec){
 const canvas=globalThis.document?.createElement?.('canvas');if(!canvas)return null;
 canvas.width=canvas.height=512;const c=canvas.getContext('2d');if(!c)return null;
 const cx=256,cy=256,polar=(r,a)=>[cx+r*Math.cos(a),cy-r*Math.sin(a)];
 c.fillStyle='#101a19';c.fillRect(0,0,512,512);
 const grad=c.createRadialGradient(210,170,20,256,256,250);grad.addColorStop(0,'#24332e');grad.addColorStop(1,'#0c1212');c.fillStyle=grad;c.fillRect(0,0,512,512);
 c.strokeStyle='#829184';c.lineWidth=2;c.beginPath();c.arc(cx,cy,238,0,Math.PI*2);c.stroke();
 const min=spec.min||0,major=Math.round((spec.max-min)/spec.step),divisions=major*5;
 for(let i=0;i<=divisions;i++){
  const a=angle(i/divisions),p=polar(i%5===0?199:212,a),q=polar(228,a);
  c.strokeStyle='#ece5c7';c.lineWidth=i%5===0?4:2;c.beginPath();c.moveTo(...p);c.lineTo(...q);c.stroke();
 }
 c.fillStyle='#f5ebcb';c.textAlign='center';c.textBaseline='middle';c.font=`${spec.channel==='fuel'?35:30}px Georgia, serif`;
 for(let i=0;i<=major;i++){
  const value=min+i*spec.step,p=polar(171,angle(i/major));
  const label=spec.channel==='fuel'?['E','½','F'][i]:String(spec.channel==='rpm'?value/1000:value);
  c.fillText(label,...p);
 }
 c.font='22px Georgia, serif';c.fillStyle='#c7c6ad';c.fillText(spec.label,256,337);
 if(spec.radius>.05){c.font='15px sans-serif';c.fillStyle='#969f8c';c.fillText('CHEVROLET',256,375);}
 const texture=new T.CanvasTexture(canvas);if(T.SRGBColorSpace)texture.colorSpace=T.SRGBColorSpace;else if(T.sRGBEncoding)texture.encoding=T.sRGBEncoding;
 texture.anisotropy=4;return texture;
}
function installInteriorMicrorelief(T,root){
 const clones=new Map(),assignments=[];let texture=null;
 function usableUV(geometry){
  const uv=geometry?.attributes?.uv;if(!uv||uv.itemSize<2||uv.count<3)return false;
  let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
  for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);if(!Number.isFinite(u)||!Number.isFinite(v))return false;minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v);}
  return maxU-minU>1e-6&&maxV-minV>1e-6;
 }
 function microNormal(){
  if(texture)return texture;
  const size=32,data=new Uint8Array(size*size*4);
  // Low-amplitude periodic grain; no color noise, no displacement and no large features.
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=(y*size+x)*4,a=2*Math.PI*x/size,b=2*Math.PI*y/size;
   data[i]=128+Math.round(12*Math.sin(7*a+2*Math.sin(3*b)));
   data[i+1]=128+Math.round(12*Math.cos(9*b+2*Math.sin(5*a)));data[i+2]=255;data[i+3]=255;
  }
  texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.name='HeritageInteriorFineGrain';
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(24,24);
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
 }
 root.traverse(o=>{
  if(!o.isMesh||!usableUV(o.geometry))return;
  const original=o.material,slots=Array.isArray(original)?original:[original];let changed=false;
  const next=slots.map(m=>{
   if(!m?.isMeshStandardMaterial||m.normalMap||m.bumpMap||m.displacementMap||!/Upholstery|Headliner|Carpet|Interior[_ ]?(?:Vinyl|Rubber)/i.test(m.name||''))return m;
   let clone=clones.get(m);if(!clone){clone=m.clone();clone.normalMap=microNormal();clone.normalScale.set(.065,.065);clone.needsUpdate=true;clones.set(m,clone);}changed=true;return clone;
  });
  if(changed){o.material=Array.isArray(original)?next:next[0];assignments.push({object:o,original,installed:o.material});}
 });
 return {getNormalTexture:microNormal,diagnostics:()=>({materials:clones.size,meshes:assignments.length,textureSize:texture?32:0}),dispose(){
  for(const {object,original,installed}of assignments){
   if(object.material===installed)object.material=original;
   else if(Array.isArray(object.material))object.material=object.material.map(m=>{for(const [source,clone]of clones)if(m===clone)return source;return m;});
  }
  for(const clone of clones.values())clone.dispose();texture?.dispose();
 }};
}

function addFasciaDetail(T,{root,group,vehicle,mesh,material,chrome,interiorMicrorelief}){
 const pickup=vehicle==='pickup_3100';
 // Exact glovebox bounds after r12 relocation: pickup Z [-.66,-.12],
 // Y [1.10,1.21], X -.339; Bel Air Z [-.70,-.23], Y [.85,.95], X -.254.
 const x=pickup?-.336:-.251,yTop=pickup?1.21:.95,yBottom=pickup?1.10:.85;
 const centerZ=pickup?-.39:-.465;
 const dark=material(T.MeshStandardMaterial,{color:0x222726,roughness:.88,metalness:.05});
 const rubber=material(T.MeshStandardMaterial,{color:0x42443d,roughness:.96,metalness:0});
 const set=(m,position)=>{m.position.set(position[0]*SCALE,position[1]*SCALE+SHIFT,position[2]*SCALE);return m;};
 const box=(name,position,size,mat)=>set(mesh(new T.BoxGeometry(...size.map(v=>v*SCALE)),mat,group,name),position);
 // Shallow lock escutcheon and inset slot; existing trim is not duplicated.
 box('GloveboxLatch',[x+.003,yTop-.027,centerZ],[.007,.019,.050],chrome);
 box('GloveboxKeySlot',[x+.007,yTop-.027,centerZ],[.001,.009,.0018],dark);
 for(const dz of [-.15,.15]){
  const hinge=mesh(new T.CylinderGeometry(.0035*SCALE,.0035*SCALE,.055*SCALE,12),chrome,group,'GloveboxLowerHinge');
  hinge.rotation.x=Math.PI/2;set(hinge,[x+.001,yBottom+.002,centerZ+dz]);
 }
 for(const dz of [-.222,.222]){
  const screw=mesh(new T.CircleGeometry(.0036*SCALE,12),chrome,group,'GloveboxTrimFastener');screw.rotation.y=Math.PI/2;
  set(screw,[x+.001,yTop-.010,centerZ+dz]);
  box('GloveboxFastenerSlot',[x+.0015,yTop-.010,centerZ+dz],[.0006,.001,.0045],dark);
 }
 // Upper dashboard flats are defined by the donor rounded boxes. Short grooves
 // are kept inside their flat crown, clear of windshield geometry and instruments.
 const top=pickup?1.275:1.014,dashX=pickup?-.47:-.432;let defrosterSlots=0;
 for(const side of [-1,1])for(let i=0;i<5;i++){
  box('DashDefrosterSlot',[dashX+(i-2)*.006,top+.0005,side*.39],[.0025,.0012,.225],dark);defrosterSlots++;
 }
 // Firewall ribs must lie on actual interior donor metal, never on an inferred
 // floating panel. All five samples need a valid near-vertical firewall hit.
 let firewallRibs=0,firewallPad=false,firewallFasteners=0,firewallPads=0;
 const candidates=[];
 // Refresh ancestors before children: installation may precede the first render
 // under a scaled/rotated vehicle root. Otherwise ray directions and donor meshes disagree.
 let hierarchyRoot=root;while(hierarchyRoot.parent)hierarchyRoot=hierarchyRoot.parent;hierarchyRoot.updateMatrixWorld(true);
 root.traverse(o=>{if(!o.isMesh)return;for(let owner=o;owner&&owner!==root;owner=owner.parent){if(/static.*Underbody/i.test(owner.name)){candidates.push(o);break;}}});
 if(pickup&&candidates.length&&T.Raycaster&&T.CatmullRomCurve3){
  const ray=new T.Raycaster(),direction=new T.Vector3(-1,0,0).transformDirection(root.matrixWorld);
  // Driver bank ends before the authored steering column Z=.47 and remains
  // above pedal height. Its surface must sit behind X=-.45, versus column -.42.
  const banks=[{driver:false,z:[-.58,-.50,-.42,-.34,-.26]},{driver:true,z:[.18,.24,.30,.36,.42]}];
  for(const bank of banks){
   const ribColumns=[];
   for(const z of bank.z){
    const points=[];
    for(let i=0;i<5;i++){
     const y=.67+i*.065,origin=root.localToWorld(new T.Vector3(.04*SCALE,y*SCALE+SHIFT,z*SCALE));
     ray.set(origin,direction);const hits=ray.intersectObjects(candidates,false);
     const hit=hits.find(h=>{const p=root.worldToLocal(h.point.clone());return p.x>-.75*SCALE&&p.x<(bank.driver?-.452:-.36)*SCALE;});
     if(!hit)break;const p=root.worldToLocal(hit.point.clone());p.x+=.00045;points.push(p);
    }
    if(points.length!==5)break;
    const xs=points.map(p=>p.x);if(Math.max(...xs)-Math.min(...xs)>.025*SCALE)break;
    ribColumns.push(points);
   }
   if(ribColumns.length!==5)continue;
   for(const points of ribColumns){mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),8,.0035*SCALE,8,false),rubber,group,'FirewallPadRib');firewallRibs++;}
   const vertices=[],indices=[],uv=[];
   for(let c=0;c<5;c++)for(let r=0;r<5;r++){
    const p=ribColumns[c][r];vertices.push(p.x-.00025,p.y,p.z);uv.push(c/4,r/4);
   }
   for(let c=0;c<4;c++)for(let r=0;r<4;r++){const a=c*5+r,b=a+5;indices.push(a,b,a+1,b,b+1,a+1);}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
   const backing=material(T.MeshStandardMaterial,{color:0x555b5a,roughness:.97,metalness:0,side:T.DoubleSide,normalMap:interiorMicrorelief.getNormalTexture()});backing.normalScale.set(.08,.08);
   mesh(geometry,backing,group,bank.driver?'DriverFirewallInsulationPad':'FirewallInsulationPad');firewallPad=true;firewallPads++;
   const border=[...ribColumns[0],...ribColumns.slice(1).map(c=>c[4]),...ribColumns[4].slice(0,4).reverse(),...ribColumns.slice(0,4).reverse().map(c=>c[0])];
   mesh(new T.TubeGeometry(new T.CatmullRomCurve3(border,true),32,.0016*SCALE,6,true),rubber,group,'FirewallPadBoundEdge');
   for(const column of [ribColumns[0],ribColumns[4]])for(const index of [0,4]){
    const washer=mesh(new T.RingGeometry(.0015*SCALE,.005*SCALE,16),chrome,group,'FirewallPadRetainingWasher');
    washer.rotation.y=Math.PI/2;washer.position.copy(column[index]);washer.position.x+=.0006;firewallFasteners++;
   }
  }
 }
 return {gloveboxLatch:true,hinges:2,defrosterSlots,firewallRibs,firewallPad,firewallFasteners,firewallPads};
}

export function installHeritageInteriorDetail(T,{root,vehicle}={}){
 const specs=layouts[vehicle];if(!specs||!root?.add)throw new TypeError('Heritage instruments require a supported vehicle and presentation root');
 const interiorMicrorelief=installInteriorMicrorelief(T,root);
 const group=new T.Group();group.name=`${vehicle}_FunctionalInstrumentDetail`;
 const geometries=new Set(),materials=new Set(),textures=new Set(),replaced=[],gauges=[];
 const material=(Ctor,props)=>{const m=new Ctor(props);materials.add(m);return m;};
 const mesh=(geometry,mat,parent,name)=>{geometries.add(geometry);const m=new T.Mesh(geometry,mat);m.name=name;m.castShadow=false;parent.add(m);return m;};
 root.traverse(o=>{if(o.userData?.instrumentType){replaced.push([o,o.visible]);o.visible=false;}});
 const chrome=material(T.MeshStandardMaterial,{color:0xb4b9ad,metalness:.92,roughness:.24});
 const seatingRubber=material(T.MeshStandardMaterial,{color:0x101714,roughness:.94,metalness:0});
 const needleMaterial=material(T.MeshBasicMaterial,{color:0xe95537});
 const glassMaterial=material(T.MeshStandardMaterial,{color:0xd0e4db,metalness:0,roughness:.12,transparent:true,opacity:.045,depthWrite:false});
 for(const spec of specs){
  const dial=new T.Group();dial.name=`${vehicle}_${spec.channel}_Dial`;
  dial.position.set(spec.center[0]*SCALE,spec.center[1]*SCALE+SHIFT,spec.center[2]*SCALE);
  dial.rotation.y=Math.PI/2;group.add(dial);const radius=spec.radius*SCALE;
  const texture=faceTexture(T,spec);if(texture)textures.add(texture);
  const face=material(T.MeshBasicMaterial,{color:texture?0xffffff:0x18231e,map:texture});
  mesh(new T.CircleGeometry(radius,64),face,dial,'RecessedPrintedFace');
  // Narrow real rubber joint behind the chrome lip, not a painted AO halo.
  mesh(new T.RingGeometry(radius*.99,radius*1.07,64),seatingRubber,dial,'InstrumentSeatingGasket').position.z=-.00012;
  mesh(new T.TorusGeometry(radius*1.015,radius*.018,6,64),chrome,dial,'FineBezelLip').position.z=.00025;
  const pivot=new T.Group();pivot.name=`Live_${spec.channel}`;pivot.position.z=.00065;dial.add(pivot);
  const shape=new T.Shape();shape.moveTo(-radius*.16,-radius*.025);shape.lineTo(radius*.77,0);shape.lineTo(-radius*.16,radius*.025);shape.closePath();
  mesh(new T.ShapeGeometry(shape),needleMaterial,pivot,'TelemetryNeedle');
  mesh(new T.CircleGeometry(radius*.065,24),chrome,dial,'NeedleHub').position.z=.00085;
  const glass=mesh(new T.CircleGeometry(radius*.985,64),glassMaterial,dial,'InstrumentGlass');glass.position.z=.0011;glass.renderOrder=2;
  const initial=spec.channel==='temperatureC'?40:0;
  gauges.push({spec,pivot,face,position:dial.position.toArray(),value:initial,ratio:0});pivot.rotation.z=angle(0);
 }
 const fasciaDetail=addFasciaDetail(T,{root,group,vehicle,mesh,material,chrome,interiorMicrorelief});
 root.add(group);let disposed=false,lights=false;
 return {
  update(sample={}){
   if(disposed)return false;
   lights=typeof sample.lights==='boolean'?sample.lights:lights;
   for(const gauge of gauges){const v=sample[gauge.spec.channel];if(Number.isFinite(v))gauge.value=v;
    const min=gauge.spec.min||0;gauge.ratio=clamp((gauge.value-min)/(gauge.spec.max-min));gauge.pivot.rotation.z=angle(gauge.ratio);
    // Printed faces remain readable in daylight; nighttime backlight is warm.
    gauge.face.color.setHex(lights?0xffdf9c:0xffffff);
   }return true;
  },
  diagnostics:()=>({vehicle,disposed,lights,source:'authored donor recesses; r12 control relocation',gauges:gauges.map(g=>({channel:g.spec.channel,value:g.value,ratio:g.ratio,angle:g.pivot.rotation.z,position:[...g.position]})),replacedNeedles:replaced.length,textureCount:textures.size,interiorMicrorelief:interiorMicrorelief.diagnostics(),fasciaDetail}),
  getInteractionTargets:()=>[],
  dispose(){if(disposed)return;disposed=true;interiorMicrorelief.dispose();root.remove(group);for(const [o,visible]of replaced)o.visible=visible;for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of textures)x.dispose();},
 };
}







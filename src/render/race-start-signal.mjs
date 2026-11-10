export function startSignalState(state={}){const status=state.status;if(status==='PAUSED')return null;if(status==='COUNTDOWN')return{red:Math.max(1,Math.min(5,Math.floor((3-Math.max(0,state.countdown||0))/3*5)+1)),green:false};return{red:0,green:status==='RUNNING'&&(state.totalTime||0)<3};}

function routePose(T, root, route) {
 const {left, normal, tangent}=route.frame;
 const basis=new T.Matrix4().makeBasis(new T.Vector3().fromArray(left),new T.Vector3().fromArray(normal),new T.Vector3().fromArray(tangent).negate());
 root.quaternion.setFromRotationMatrix(basis);
 root.position.fromArray(route.position);
 root.updateMatrixWorld(true);
}

function makeLabel(T, text, accent) {
 if(typeof document==='undefined')return new T.MeshBasicMaterial({color:0x161a19});
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const context=canvas.getContext('2d');
 context.fillStyle='#171a19';context.fillRect(0,0,512,128);
 context.fillStyle=accent;context.fillRect(0,0,10,128);context.fillRect(502,0,10,128);
 context.font='900 78px system-ui, sans-serif';context.textAlign='center';context.textBaseline='middle';
 context.fillStyle='#f9f4e8';context.fillText(text,256,64,445);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 return new T.MeshBasicMaterial({map,toneMapped:false});
}

export function createRaceStartSignal(T,{scene}){
 const root=new T.Group();root.name='V7_DiegeticStartingSignal';root.userData.visualOnly=true;root.visible=false;scene.add(root);const geometries=new Set(),materials=new Set(),lights=[];let chart=0,last={red:0,green:false};
 const steel=new T.MeshStandardMaterial({color:0x333e41,roughness:.46,metalness:.74}),black=new T.MeshStandardMaterial({color:0x101617,roughness:.78}),concrete=new T.MeshStandardMaterial({color:0x85847a,roughness:.96}),label=makeLabel(T,'LARGADA','#edb55d');materials.add(steel);materials.add(black);materials.add(concrete);materials.add(label);
 function mesh(name,g,m,x,y,z){geometries.add(g);materials.add(m);const item=new T.Mesh(g,m);item.name=name;item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;root.add(item);return item;}
 let built=false;function build(width){root.clear();for(const lens of lights){lens.material.dispose();materials.delete(lens.material);}lights.length=0;for(const g of geometries)g.dispose();geometries.clear();const half=width/2+.46,height=4.65;
  for(const side of [-1,1]){mesh('ConcreteFooting',new T.BoxGeometry(.64,.18,.68),concrete,side*half,.09,0);mesh('AnchoredBasePlate',new T.BoxGeometry(.39,.028,.4),steel,side*half,.194,0);mesh('SteelPost',new T.CylinderGeometry(.1,.1,height-.2,12),steel,side*half,(height+.2)/2,0);for(const a of [-1,1])for(const b of [-1,1])mesh('AnchorBolt',new T.CylinderGeometry(.017,.017,.047,6),steel,side*half+a*.14,.231,b*.145);}
  const driverSide=-Math.min(1.72,width*.23);
  mesh('SteelCrossBeam',new T.BoxGeometry(half*2+.2,.26,.21),steel,0,height,0);
  mesh('SignalHousing',new T.BoxGeometry(2.62,.72,.28),black,driverSide,height-.16,.18);
  mesh('StartLabel',new T.PlaneGeometry(1.98,.39),label,driverSide,height+.38,.32).castShadow=false;
  for(let i=0;i<5;i++){const x=driverSide+(i-2)*.49;mesh('LensRecess',new T.CylinderGeometry(.224,.224,.06,24),black,x,height-.16,.35).rotation.x=Math.PI/2;const material=new T.MeshBasicMaterial({color:0x291511,toneMapped:false});const lens=mesh('StartLens_'+(i+1),new T.SphereGeometry(.199,24,12,0,Math.PI*2,0,Math.PI/2),material,x,height-.16,.39);lens.rotation.x=Math.PI/2;lights.push(lens);mesh('LightVisor',new T.BoxGeometry(.43,.05,.37),black,x,height+.095,.48);}
  built=true;
 }
 function set(route){if(!route?.frame||!Array.isArray(route.position))throw Error('Physical route frame required for start signal');const width=Math.max(3,Math.min(20,route.widthM));build(width);routePose(T,root,route);chart=route.referenceChart||0;last={red:0,green:false};root.visible=true;return diagnostics();}
 function update(state){if(!built)return;root.visible=!['IDLE','FINISHED'].includes(state.status);const value=startSignalState(state);if(!value||value.green===last.green&&value.red===last.red)return;last=value;for(let i=0;i<5;i++){const lit=last.green||i<last.red,colour=last.green?0x30f585:0xff392d;lights[i].material.color.setHex(lit?colour:0x291511);}}
 function rebase(event){if(!built)return;root.updateMatrix();root.applyMatrix4(new T.Matrix4().fromArray(event.matrix));root.updateMatrixWorld(true);chart=event.referenceChart;}
 function diagnostics(){return{built,referenceChart:chart,visible:root.visible,lights:{...last},position:root.position.toArray(),clearanceM:4.13,visualOnly:true,colliders:0};}
 return{set,update,rebase,diagnostics,clear(){built=false;root.visible=false;},dispose(){root.removeFromParent();for(const g of geometries)g.dispose();label.map?.dispose();for(const m of materials)m.dispose();root.clear();}};
}

export function createRaceFinishMarker(T,{scene}) {
 const root=new T.Group();root.name='RaceFinishMarker';root.visible=false;root.userData.visualOnly=true;scene.add(root);
 const panel=makeLabel(T,'META','#edb55d');
 const steel=new T.MeshStandardMaterial({color:0x373c3d,metalness:.4,roughness:.58});
 const geometry=new T.BoxGeometry(1,1,1), flat=new T.PlaneGeometry(1,1);
 const pixels=new Uint8Array(20*2*4);
 for(let i=0;i<40;i++){const light=(i%20+Math.floor(i/20))%2===0,value=light?240:29;pixels.set([value,value,value,255],i*4);}
 const map=new T.DataTexture(pixels,20,2);map.colorSpace=T.SRGBColorSpace;map.needsUpdate=true;
 const lineMaterial=new T.MeshBasicMaterial({map,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const line=new T.Mesh(flat,lineMaterial);line.rotation.x=-Math.PI/2;line.position.y=.024;
 const sign=new T.Mesh(flat,panel);sign.scale.set(3.7,.92,1);sign.position.set(0,4.68,.14);
 const crossbar=new T.Mesh(geometry,steel);crossbar.position.y=4.62;
 const posts=[-1,1].map(side=>{const post=new T.Mesh(geometry,steel);post.scale.set(.16,4.65,.18);post.position.set(side,2.325,0);return post;});
 root.add(line,sign,crossbar,...posts);
 let configured=false, chart=0;
 return {
  set(route) {
   routePose(T,root,route);configured=true;chart=route.referenceChart||0;
   const width=Math.max(3,Math.min(20,route.widthM));
   line.scale.set(width,.76,1);crossbar.scale.set(width+1,.17,.16);
   sign.position.x=-Math.min(1.72,width*.23);
   posts[0].position.x=-width/2-.43;posts[1].position.x=width/2+.43;
  },
  update(distance,status) {
   root.visible=configured&&distance<=245&&distance>=-22&&['RUNNING','PAUSED','FINISHED'].includes(status);
  },
  rebase({matrix,referenceChart}) {
   if(!configured)return;
   root.updateMatrix();root.applyMatrix4(new T.Matrix4().fromArray(matrix));root.updateMatrixWorld(true);chart=referenceChart;
  },
  clear() {configured=false;root.visible=false;},
  isConfigured(referenceChart) {return configured&&(referenceChart===undefined||referenceChart===chart);},
  diagnostics() {return {configured,visible:root.visible,referenceChart:chart,position:root.position.toArray()};},
  dispose() {root.removeFromParent();root.clear();geometry.dispose();flat.dispose();panel.map?.dispose();panel.dispose();steel.dispose();lineMaterial.dispose();map.dispose();},
 };
}

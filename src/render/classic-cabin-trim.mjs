// Cabin coordinates come from the shipped meshes. The ray checks keep each
// fitting on its donor surface and skip trim on simplified or missing donors.
function fitting(T, frame, targets, origin, facing, right, width, height) {
  if (!targets.length) return null;
  frame.updateWorldMatrix(true, true);
  const up = new T.Vector3().crossVectors(facing, right);
  const direction = facing.clone().transformDirection(frame.matrixWorld).negate();
  const ray = new T.Raycaster(), depths = [];
  for (const [x,y] of [[0,0],[-.45,-.40],[-.45,.40],[.45,-.40],[.45,.40]]) {
    const sample = origin.clone().addScaledVector(right,x*width).addScaledVector(up,y*height);
    const start = frame.localToWorld(sample.clone().addScaledVector(facing,.04));
    ray.set(start,direction);
    const hit = ray.intersectObjects(targets,false)[0];
    if (!hit) return null;
    const depth = frame.worldToLocal(hit.point).sub(sample).dot(facing);
    if (Math.abs(depth) > .024) return null;
    depths.push(depth);
  }
  const depth = Math.max(...depths);
  if (depth-Math.min(...depths) > .007) return null;
  const mount = new T.Group();
  mount.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,facing));
  mount.position.copy(origin).addScaledVector(facing,depth+.0005);
  frame.add(mount);
  return mount;
}

function meshesBelow(node) {
  const meshes = [];
  node?.traverse(child => { if (child.isMesh) meshes.push(child); });
  return meshes;
}

function plaqueTexture(T, belAir) {
  const canvas = globalThis.document?.createElement?.('canvas');
  if (!canvas) return null;
  canvas.width = 512; canvas.height = 96;
  const c = canvas.getContext('2d');
  if (!c) return null;
  const satin = c.createLinearGradient(0,0,0,96);
  const tones = belAir ? ['#746a52','#d7c9a8','#aba393','#edddba','#766b56']
    : ['#566065','#bdc0bc','#22272a','#393b3b','#9ea29f'];
  for (const [i,tone] of tones.entries()) satin.addColorStop(i/4,tone);
  c.fillStyle=satin; c.fillRect(0,0,512,96);
  c.strokeStyle = belAir ? 'rgba(78,65,49,.21)' : 'rgba(225,220,202,.16)';
  c.lineWidth=1;
  for (let y=8;y<91;y+=4) {
    c.beginPath(); c.moveTo(4,y); c.lineTo(508,y); c.stroke();
  }
  c.strokeStyle = belAir ? '#f2dfaf' : '#c5c6b9';
  c.lineWidth=2; c.strokeRect(5,7,502,82);
  c.textAlign='center'; c.textBaseline='middle';
  if (belAir) {
    c.font='italic bold 67px Georgia, serif';
    c.fillStyle='#575144'; c.fillText('Bel Air',257,55);
    c.fillStyle='#1d4949'; c.fillText('Bel Air',256,52);
    c.strokeStyle='#52655d';
    for (const x of [44,350]) { c.beginPath(); c.moveTo(x,53); c.lineTo(x+113,53); c.stroke(); }
  } else {
    c.fillStyle='#101415'; c.fillRect(14,25,484,50);
    c.font='bold 39px Arial, sans-serif';
    c.fillStyle='#e7ddbe'; c.fillText('C H E V R O L E T   4 0 0',256,52);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace=T.SRGBColorSpace;
  map.anisotropy=4;
  return map;
}

function plaqueGeometry(T,width,height) {
  const x=width/2,y=height/2,r=height*.24,shape=new T.Shape();
  shape.moveTo(-x+r,-y); shape.lineTo(x-r,-y);
  shape.quadraticCurveTo(x,-y,x,-y+r); shape.lineTo(x,y-r);
  shape.quadraticCurveTo(x,y,x-r,y); shape.lineTo(-x+r,y);
  shape.quadraticCurveTo(-x,y,-x,y-r); shape.lineTo(-x,-y+r);
  shape.quadraticCurveTo(-x,-y,-x+r,-y);
  const geo=new T.ExtrudeGeometry(shape,{depth:.0012,bevelEnabled:false,curveSegments:4});
  const p=geo.attributes.position,uv=geo.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/width+.5,p.getY(i)/height+.5);
  return geo;
}

export function installClassicCabinTrim(T,model,vehicle) {
  const roots=[],resources=new Set();
  const vec=(x,y,z)=>new T.Vector3(x,y,z);
  const part=(parent,name,geometry,material)=>{
    resources.add(geometry); resources.add(material);
    const mesh=new T.Mesh(geometry,material);
    mesh.name=name; parent.add(mesh);
    return mesh;
  };
  if (vehicle==='chevy_400_1957'||vehicle==='belair_1957') {
    const belAir=vehicle==='belair_1957';
    const frame=belAir?model:model.getObjectByName('SS250_DashboardAssembly');
    const fascia=belAir?model.getObjectByName('belair_1957_static_BA57_Upholstery_Ivory')
      :frame?.getObjectByName('SS250_GloveboxDoor');
    const width=belAir?.098:.205,height=belAir?.020:.029;
    const mount=fitting(T,frame,meshesBelow(fascia),
      belAir?vec(-.104,.056,-.139):vec(.5165,.030,.024),
      belAir?vec(1,0,0):vec(0,1,0),belAir?vec(0,0,-1):vec(1,0,0),width,height);
    if(mount) {
      roots.push(mount);
      const map=plaqueTexture(T,belAir);
      if(map)resources.add(map);
      const material=new T.MeshStandardMaterial({map,color:map?0xffffff:0xaaa396,roughness:.43,metalness:.28,
        emissive:map?0x463d2d:0x000000,emissiveMap:map,emissiveIntensity:.20});
      part(mount,belAir?'BelAirGloveboxInsert':'Chevrolet400GloveboxPlate',plaqueGeometry(T,width,height),material);
    }
  } else if(vehicle==='pickup_3100') {
    const mounts=[];
    for (const [side,sign] of [['left',-1],['right',1]]) {
      const door=model.children.find(child=>child.userData.doorSide===side);
      if(!door)continue;
      const targets=meshesBelow(door),normal=vec(0,0,-sign),right=vec(-sign,0,0);
      const pull=fitting(T,model,targets,vec(.033,.165,sign*.312),normal,right,.104,.025);
      const crank=fitting(T,model,targets,vec(-.052,.152,sign*.313),normal,right,.035,.025);
      if(pull||crank)mounts.push({door,pull,crank});
    }
    if(mounts.length) {
      const nickel=new T.MeshStandardMaterial({color:0xaca9a0,roughness:.38,metalness:.68});
      const grip=new T.MeshStandardMaterial({color:0x34423e,roughness:.78});
      resources.add(nickel); resources.add(grip);
      const tube=(points,r)=>new T.TubeGeometry(new T.CatmullRomCurve3(points),12,r,7);
      for(const {door,pull,crank} of mounts) {
        if(pull) {
          roots.push(pull);
          part(pull,'DoorPullSeat',plaqueGeometry(T,.110,.026),nickel).position.z=-.001;
          part(pull,'DoorPullGrip',tube([vec(-.044,0,-.001),vec(-.034,0,.012),vec(0,0,.014),vec(.034,0,.012),vec(.044,0,-.001)],.005),grip);
          door.attach(pull);
        }
        if(crank) {
          roots.push(crank);
          part(crank,'WindowCrankEscutcheon',new T.CylinderGeometry(.009,.011,.004,20),nickel).rotation.x=Math.PI/2;
          part(crank,'WindowCrankLever',tube([vec(0,0,.001),vec(0,0,.008),vec(.021,-.016,.009)],.0026),nickel);
          const knob=part(crank,'WindowCrankKnob',new T.SphereGeometry(.0048,12,8),grip);
          knob.position.set(.021,-.016,.012);
          door.attach(crank);
        }
      }
    }
  }
  return {
    fittings:roots.length,
    dispose(){
      for(const mount of roots)mount.removeFromParent();
      for(const resource of resources)resource.dispose();
      roots.length=0;resources.clear();
    }
  };
}

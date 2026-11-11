import {installDelco986443Face} from './delco-986443-face.mjs?v=4d8e4fb7be97f44a';
import {installDelco987575Face} from './delco-987575-face.mjs?v=981f69ebb500ae2d';
import {installSS250RadioFace} from './ss250-radio-face.mjs?v=fcb4ae19d389cad0';

// Coordinates are measured in the shipped dash meshes. The 400 uses the R53
// dashboard frame (+Y faces the driver); the other two use their vehicle LOD0.
// Layout references: Automundo 185, GM Truck Specifications 1953 sheet 117,
// and Chevrolet Engineering Features 1957, instrument-panel section.
const dashboards = {
  chevy_400_1957: {
    lights: {point:[-.628,.022,.079], width:.039},
    ignition: {point:[-.132,.022,.083], width:.040},
    radio: {point:[.190,.057,-.039], width:.235, plate:[.252,.073], inset:.009},
  },
  pickup_3100: {
    lights: {point:[-.146,.186,.257], width:.017},
    ignition: {point:[-.149,.150,.064], width:.017},
    radio: {point:[-.146,.195,-.013], width:.089, plate:[.104,.032], inset:.003},
  },
  belair_1957: {
    lights: {point:[-.104,.050,.267], width:.017},
    ignition: {point:[-.104,.050,.124], width:.017},
    radio: {point:[-.104,.070,.016], width:.105, plate:[.122,.035], inset:.012},
  },
};

const anchors = {
  ignition:['ignition-lock-root','ignition-rotor'],
  lights:['Flared_Trapezoid_Knob','Retaining_Nut'],
  radio:['FACEPLATE','DISPLAY_SURFACE'],
};

function boundsIn(T,object,space){
  const box=new T.Box3(),transform=new T.Matrix4(),inverse=space.matrixWorld.clone().invert();
  object?.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.geometry.computeBoundingBox();
    transform.multiplyMatrices(inverse,mesh.matrixWorld);
    box.union(mesh.geometry.boundingBox.clone().applyMatrix4(transform));
  });
  return box;
}

function dashGeometry(frame,id){
  const targets=[];
  const family=id==='pickup_3100'?/static_C3100_(?:Paint_Turquoise|Chrome|ReferenceIvoryEnamel)/
    :/static_BA57_(?:Paint_Turquoise|Chrome|Upholstery_Ivory)/;
  frame.traverse(node=>{
    if(!node.isMesh)return;
    if(id==='chevy_400_1957'||family.test(node.name)||family.test(node.parent?.name))targets.push(node);
  });
  return targets;
}

function seatOnDash(T,frame,targets,point,normal){
  const ray=new T.Raycaster();
  const start=frame.localToWorld(point.clone().addScaledVector(normal,.035));
  ray.set(start,normal.clone().transformDirection(frame.matrixWorld).negate());
  for(const hit of ray.intersectObjects(targets,false)){
    const local=frame.worldToLocal(hit.point);
    if(Math.abs(local.clone().sub(point).dot(normal))<=.016)return local;
  }
  return null;
}

// Move the real controls and their input targets as one object. Keep the
// legacy layout available when the same controls are used in the other Chevy.
export function createAuthoredControlMounts(T,parts){
  let active=null,radioFace=null,placements=[];
  let placementFrame=null;
  const inverseRoot=new T.Matrix4();
  const owned=new Set(),hidden=[];
  const saved=Object.entries(parts).filter(([,node])=>node).map(([id,node])=>({
    id,node,parent:node.parent,position:node.position.clone(),quaternion:node.quaternion.clone(),
    scale:node.scale.clone(),visible:node.visible,
  }));
  function restore(){
    radioFace?.dispose();radioFace=null;
    for(const s of saved){
      s.parent.add(s.node);
      s.node.position.copy(s.position);s.node.quaternion.copy(s.quaternion);s.node.scale.copy(s.scale);
      if(s.id==='illumination')s.node.visible=s.visible;
    }
    for(const [node,visible] of hidden)node.visible=visible;
    hidden.length=0;
    active?.removeFromParent();active=null;placements=[];placementFrame=null;
    for(const resource of owned)resource.dispose();
    owned.clear();
  }

  function refreshPlacement(){
    if(!placementFrame)return;
    const {root,frame,dashboard}=placementFrame;
    frame.updateWorldMatrix(true,false);
    inverseRoot.copy(root.matrixWorld).invert();
    dashboard.matrix.multiplyMatrices(inverseRoot,frame.matrixWorld);
    dashboard.matrixWorldNeedsUpdate=true;
  }
  const box=(parent,name,size,position,material)=>{
    const geometry=new T.BoxGeometry(...size),mesh=new T.Mesh(geometry,material);
    owned.add(geometry);owned.add(material);
    mesh.name=name;mesh.position.fromArray(position);parent.add(mesh);
  };

  function addRadioMount(host,spec,id){
    const [width,height]=spec.plate;
    const steel=new T.MeshStandardMaterial({color:id==='pickup_3100'?0x828981:0xb4b6ad,metalness:.68,roughness:.37});
    const insert=new T.MeshStandardMaterial({color:0x1a2021,roughness:.83});
    const lip=id==='chevy_400_1957'?.005:.0021,depth=spec.inset+.001;
    box(host,'Radio mounting plate',[width,height,depth],[0,0,-depth*.5+.001],steel);
    box(host,'Radio inset',[width-lip*2,height-lip*2,.0009],[0,0,.0012],insert);
    if(id==='pickup_3100'){
      const support=new T.MeshStandardMaterial({color:0x272e2d,roughness:.86});
      box(host,'Radio speaker recess',[.120,.017,.003],[0,-.031,-.0015],support);
      for(let i=0;i<4;i++)box(host,'Speaker grille slat',[.116,.0011,.0016],[0,-.037+i*.004,.0005],steel);
    }
  }

  return {
    restore,refreshPlacement,
    attach(root,id){
      restore();
      const specs=dashboards[id];
      if(!specs)return;
      active=new T.Group();active.name='FunctionalCockpitEquipment';root.add(active);
      const model=root.getObjectByName(id+'_Exterior_LOD0')||root;
      const is400=id==='chevy_400_1957';
      const frame=is400?model.getObjectByName('SS250_DashboardAssembly')||model:model;
      root.updateWorldMatrix(true,true);
      const dashboard=new T.Group();dashboard.name='Dashboard mounting frame';
      dashboard.matrixAutoUpdate=false;active.add(dashboard);
      placementFrame={root,frame,dashboard};refreshPlacement();
      const right=is400?new T.Vector3(1,0,0):new T.Vector3(0,0,-1);
      const normal=is400?new T.Vector3(0,1,0):new T.Vector3(1,0,0);
      const up=new T.Vector3().crossVectors(normal,right);
      const rotation=new T.Matrix4().makeBasis(right,up,normal),targets=dashGeometry(frame,id);
      for(const s of saved){
        // Authored gauges have their own illumination. The donor lamp is for the legacy cluster.
        if(s.id==='illumination'){s.node.visible=false;continue;}
        const spec=specs[s.id];
        if(!spec&&s.id!=='shifter')continue;
        const host=new T.Group();host.name='Authored_'+s.id;
        if(spec){
          const nominal=new T.Vector3(...spec.point);
          const support=seatOnDash(T,frame,targets,nominal,normal);
          host.position.copy(support||nominal).addScaledVector(normal,spec.inset??.002);
          host.quaternion.setFromRotationMatrix(rotation);dashboard.add(host);
          placements.push({id:s.id,supported:!!support,point:host.position.toArray()});
        }else{
          host.position.set(.085,-.112,.025);host.rotation.y=Math.PI/2;active.add(host);
        }
        host.add(s.node);
        s.node.position.set(0,0,0);s.node.scale.setScalar(1);s.node.quaternion.copy(s.quaternion);
        host.updateWorldMatrix(true,true);
        const names=anchors[s.id];
        const size=boundsIn(T,names?s.node.getObjectByName(names[0])||s.node:s.node,host);
        if(size.isEmpty())continue;
        const datum=names?boundsIn(T,s.node.getObjectByName(names[1]),host):size;
        const reference=datum.isEmpty()?size:datum;
        const center=(s.id==='radio'?size:reference).getCenter(new T.Vector3());
        const factor=(spec?.width??.072)/Math.max(size.max.x-size.min.x,.0001);
        s.node.scale.setScalar(factor);
        s.node.position.copy(center).multiplyScalar(-factor);
        if(spec)s.node.position.z=(s.id==='radio'?.004:.002)-reference.max.z*factor;
        if(s.id==='radio'){
          if(is400)radioFace=installSS250RadioFace(T,s.node);
          if(id==='pickup_3100')radioFace=installDelco986443Face(T,s.node);
          if(id==='belair_1957')radioFace=installDelco987575Face(T,s.node);
          if(id==='pickup_3100'||!radioFace)addRadioMount(host,spec,id);
          if(id==='belair_1957'&&radioFace)frame.traverse(node=>{
            if(!node.name.startsWith('belair_1957_radioDonor_'))return;
            hidden.push([node,node.visible]);node.visible=false;
          });
          if(is400){
            const donor=frame.getObjectByName('SS250_RadioControlGrip');
            if(donor){hidden.push([donor,donor.visible]);donor.visible=false;}
          }
        }
      }
    },
    diagnostics:()=>({authored:!!active,controls:saved.map(s=>s.id),placements:placements.map(p=>({...p,point:[...p.point]}))}),
    dispose:restore,
  };
}

// Reuse the real interactive radio, ignition, light switch and shifter in the authored cabin.
// The transaction restores shared-cockpit transforms before disposing an old vehicle.
export function createAuthoredControlMounts(T,parts){
 let active=null;const owned=[];const saved=Object.entries(parts).filter(([,n])=>n).map(([id,node])=>({id,node,parent:node.parent,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}));
 function restore(){for(const s of saved){s.parent.add(s.node);s.node.position.copy(s.position);s.node.quaternion.copy(s.quaternion);s.node.scale.copy(s.scale);}active?.removeFromParent();active=null;for(const resource of owned)resource.dispose();owned.length=0;}
 return {restore,attach(root,id){restore();if(!['belair_1957','pickup_3100','chevy_400_1957'].includes(id))return;
  active=new T.Group();active.name='FunctionalCockpitEquipment';root.add(active);
  const pickup=id==='pickup_3100',ss400=id==='chevy_400_1957',dashX=pickup?-.112:ss400?-.146:-.080,dashY=pickup?.128:ss400?.091:.058;
  const specs={illumination:{p:[dashX+.10,dashY+.035,.10],width:1},radio:{p:[pickup?-.122:ss400?dashX:-.088,pickup?.172:ss400?dashY:.072,-.045],width:pickup?.090:ss400?.110:.100},ignition:{p:[dashX+.01,dashY-.018,.125],width:.025},lights:{p:[dashX,dashY,.265],width:.026},shifter:{p:[.085,-.112,.025],width:.072}};
  for(const s of saved){const spec=specs[s.id];if(!spec)continue;const host=new T.Group();host.name='Authored_'+s.id;active.add(host);host.position.fromArray(spec.p);host.rotation.y=Math.PI/2;host.add(s.node);s.node.position.set(0,0,0);s.node.scale.setScalar(1);s.node.quaternion.copy(s.quaternion);s.node.updateMatrixWorld(true);
   // Measure in the mount's parent space, independent of the car's world placement.
   const box=new T.Box3(),v=new T.Vector3(),inverse=host.matrixWorld.clone().invert();s.node.traverse(n=>{if(n.isMesh){n.geometry.computeBoundingBox();const b=n.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,n.matrixWorld));box.union(b);}});if(box.isEmpty())continue;const size=box.getSize(v),factor=spec.width/Math.max(size.x,.0001),center=box.getCenter(new T.Vector3());s.node.scale.setScalar(factor);s.node.position.copy(center).multiplyScalar(-factor);if(s.id==='radio'){
    s.node.position.z-=size.z*factor*.5;
    // Thin rubber seating gasket, behind the face and outside its bounds.
    const w=size.x*factor,h=size.y*factor,t=.0012,mat=new T.MeshStandardMaterial({color:0x101516,roughness:.92,metalness:0});owned.push(mat);
    for(const [x,y,width,height]of [[0,h/2+t/2,w+2*t,t],[0,-h/2-t/2,w+2*t,t],[-w/2-t/2,0,t,h],[w/2+t/2,0,t,h]]){
     const geo=new T.BoxGeometry(width,height,.0015),edge=new T.Mesh(geo,mat);owned.push(geo);edge.name='Radio_Recess_SeatingGasket';edge.position.set(x,y,-.001);host.add(edge);
    }
   }
  }
 },diagnostics:()=>({authored:!!active,controls:saved.map(s=>s.id)}),dispose:restore};
}

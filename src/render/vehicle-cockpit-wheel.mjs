/** Vehicle-specific wheel, prepared transactionally with the exterior selection.
 * The editable mount and animated steering pivot remain the input/animation contract.
 */
const SS250_URL=new URL('../../assets/cockpit/v7/400-ss250-wheel.glb?v=400-review-r144-20260917',import.meta.url).href;
const releasedRoots=new WeakSet();
function release(root){
 if(!root||releasedRoots.has(root))return;releasedRoots.add(root);root.removeFromParent();const geometries=new Set(),materials=new Set();
 root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
}
export function createVehicleCockpitWheel(T,{pivot,sharedWheel,targetWidth,loadGlb,tune=()=>{}}){
 let active=null,disposed=false,vehicle='chevy';const pending=new Set(),initialVisible=sharedWheel.visible;
 return {
  async prepare(id,{signal}={}){
   if(disposed)throw new Error('Cockpit wheel disposed');signal?.throwIfAborted();let root=null,done=false;
   if(id==='chevy_400_1957'){
    root=await loadGlb(SS250_URL,'Volante SS250',signal);
    if(disposed||signal?.aborted){release(root);signal?.throwIfAborted();throw new Error('Cockpit wheel disposed');}
    try{
     // Blender XY/front+Z -> glTF XZ/front+Y -> cockpit XY/front+Z.
     root.rotation.x=Math.PI/2;root.updateMatrixWorld(true);
     const width=new T.Box3().setFromObject(root).getSize(new T.Vector3()).x;
     if(!Number.isFinite(width)||width<=0||pivot.scale.x<=0)throw new Error('Invalid SS250 wheel bounds');
     root.scale.setScalar(targetWidth/(width*pivot.scale.x));root.name='Chevrolet400_SS250_SteeringWheel';tune(root);
    }catch(error){release(root);throw error;}
    pending.add(root);
   }
   return {
    commit(){if(done||disposed)return;if(signal?.aborted){done=true;pending.delete(root);release(root);signal.throwIfAborted();}done=true;pending.delete(root);release(active);active=root;vehicle=id;sharedWheel.visible=root?false:initialVisible;if(root)pivot.add(root);},
    dispose(){if(done)return;done=true;pending.delete(root);release(root);},
   };
  },
  getInteractionRoot(){return active||sharedWheel;},
  diagnostics(){return {vehicle,specificWheel:!!active,sharedVisible:sharedWheel.visible,pending:pending.size,disposed};},
  dispose(){if(disposed)return;disposed=true;release(active);active=null;for(const root of pending)release(root);pending.clear();sharedWheel.visible=initialVisible;},
 };
}



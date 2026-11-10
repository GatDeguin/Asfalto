export const RADIO_PRESETS=['PREVIOUS','REWIND','PLAY_PAUSE','FORWARD','NEXT'];
const CONTROL_NAMES=[...RADIO_PRESETS,'POWER_VOLUME','TUNING_SEEK'];

export function roundedRadioPanel(T,width,height,radius,depth){
 const x=width/2,y=height/2,r=radius,shape=new T.Shape();
 shape.moveTo(-x+r,-y);
 shape.lineTo(x-r,-y);shape.quadraticCurveTo(x,-y,x,-y+r);
 shape.lineTo(x,y-r);shape.quadraticCurveTo(x,y,x-r,y);
 shape.lineTo(-x+r,y);shape.quadraticCurveTo(-x,y,-x,y-r);
 shape.lineTo(-x,-y+r);shape.quadraticCurveTo(-x,-y,-x+r,-y);
 return new T.ExtrudeGeometry(shape,{depth,bevelSize:.001,bevelThickness:.001,bevelSegments:2,curveSegments:5});
}

export function playlistNeedlePosition(state,halfSpan,restX){
 const count=state.tracks?.length??0;
 if(count<2)return restX;
 const index=Math.min(count-1,Math.max(0,state.currentIndex));
 return halfSpan*(2*index/(count-1)-1);
}

// The radio controller owns the live control nodes and the playback state.
// A fitted face owns its geometry and can be removed before another vehicle mounts.
export function installClassicRadioFace(T,mount,build){
 const controls=new Map(CONTROL_NAMES.map(name=>[name,mount.getObjectByName('CTRL_'+name)]));
 const model=controls.get('PREVIOUS')?.parent;
 if(!model||[...controls.values()].some(control=>control?.parent!==model))return null;
 const originalMeshes=[];
 model.traverse(node=>{if(node.isMesh)originalMeshes.push([node,node.visible]);});
 const originalControls=[...controls.values()].map(control=>({
  control,position:control.position.clone(),base:control.userData.radioBasePosition?.clone(),
 }));
 const resources=new Set(),parts=[];
 const previousUpdate=mount.userData.updateRadioFace;
 let sync,disposed=false;

 function positionControl(name,position){
  const control=controls.get(name);
  control.position.fromArray(position);
  control.userData.radioBasePosition?.copy(control.position);
  return control;
 }
 function part(parent,name,geometry,material,position){
  const node=new T.Mesh(geometry,material);
  node.name=name;node.position.fromArray(position);parent.add(node);
  resources.add(geometry);parts.push(node);
  return node;
 }
 function material(properties){
  const result=new T.MeshStandardMaterial(properties);resources.add(result);return result;
 }
 function texture(width,height,draw){
  const canvas=globalThis.document?.createElement?.('canvas');
  if(!canvas)return null;
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');
  if(!context)return null;
  draw(context);
  const result=new T.CanvasTexture(canvas);
  result.colorSpace=T.SRGBColorSpace;resources.add(result);return result;
 }
 function dispose(){
  if(disposed)return;
  disposed=true;
  if(sync&&mount.userData.updateRadioFace===sync)mount.userData.updateRadioFace=previousUpdate;
  for(const {control,position,base} of originalControls){
   control.position.copy(position);
   if(base)control.userData.radioBasePosition.copy(base);
  }
  for(const [node,visible] of originalMeshes)node.visible=visible;
  for(const node of parts)node.removeFromParent();
  for(const resource of resources)resource.dispose();
 }
 try{
  sync=build({model,positionControl,part,material,texture});
  for(const [node] of originalMeshes)node.visible=false;
  mount.userData.updateRadioFace=sync;
  sync({powered:mount.userData.radioPowered});
  return {dispose};
 }catch(error){dispose();throw error;}
}

// Distances and natural landmarks are located on the authored route, never on the return connector.
import {instanceDetailTiles} from './roadside-details.mjs?v=3cb650a4f1db8714';
import {addRouteDirection} from './route-direction.mjs?v=e9e6dcf49d8bbd2e';
import {addRoadSigns,roadSignYaw} from './road-signs.mjs?v=6d823d9e48d15630';

export function addKilometreMarkers(T,root,{query,lengthM,heightAt,detailRange=null}){
  const markers=[];
  for(let km=1;km*1000<lengthM-100;km++){
    const sM=km*1000;
    if(detailRange&&(sM<detailRange.startM||sM>=detailRange.endM))continue;
    const q=query.sample(sM),side=km%2===1?1:-1;
    // The authored frame.left vector points to the driver's right.
    for(const margin of [1.55,2.1,2.8,3.5]){
      const position=q.position.map((value,i)=>value+q.frame.left[i]*side*(q.widthM/2+margin));
      const ground=heightAt(position[0],position[2]);
      if(!Number.isFinite(ground)||Math.abs(ground-q.position[1])>1.8)continue;
      position[1]=ground;
      const near=query.project?.(position);
      if(near&&(near.distanceXZ<near.widthM/2+1.2||Math.abs(near.sM-sM)>24))continue;
      markers.push({kind:'kilometre',sM,km,side,position,yaw:roadSignYaw(q.frame.tangent,-side)});
      break;
    }
  }
  addRoadSigns(T,root,markers,{name:'ASFALTO_KILOMETRE_MARKERS'});
  return markers.length;
}

export function addRegionalWayfinding(T,root,{id,query,lengthM,heightAt,signHeightAt=heightAt,templates,textures,detailRange=null,existingCues=[]}){
  const group=new T.Group();group.name='ASFALTO_REGIONAL_WAYFINDING';root.updateMatrixWorld(true);group.matrix.copy(root.matrixWorld).invert();group.matrixAutoUpdate=false;
  const kilometreMarkers=addKilometreMarkers(T,root,{query,lengthM,heightAt:signHeightAt,detailRange});
  const landmarks=[];
  if(id==='cuesta_lipan'&&templates?.size){
    const specs=[{s:2860,side:1,key:'ochre-bluff',scales:[[8,11,7],[5,7,5],[4,5,5]]},{s:6700,side:1,key:'split-ridge',scales:[[7,17,6],[6,14,8],[4,8,7],[5,5,6]]},{s:11800,side:-1,key:'slanted-outcrop',scales:[[16,9,8],[9,6,8],[5,4,6]]},{s:16200,side:1,key:'terraced-knoll',scales:[[13,7,11],[9,10,8],[6,13,5],[5,5,4]]}];
    for(const spec of specs){if(detailRange&&(spec.s<detailRange.startM||spec.s>=detailRange.endM))continue;const q=query.sample(spec.s);let center,cy;for(const side of [spec.side,-spec.side])for(const distance of [85,65,110,145,190]){if(center)continue;const candidate=q.position.map((v,i)=>v+q.frame.left[i]*side*(q.widthM/2+distance)),y=heightAt(candidate[0],candidate[2]);const nearest=Number.isFinite(y)?query.project?.([candidate[0],y,candidate[2]]):null;if(Number.isFinite(y)&&Math.abs(y-q.position[1])<160&&(!nearest||nearest.distanceXZ>nearest.widthM/2+55)){center=candidate;cy=y;}}if(!center)continue;
      const instances=[];for(let i=0;i<spec.scales.length;i++){const a=i*2.399,x=center[0]+Math.cos(a)*i*6,z=center[2]+Math.sin(a)*i*6,y=heightAt(x,z);if(!Number.isFinite(y))continue;const check=query.project?.([x,y,z]);if(check&&check.distanceXZ<check.widthM/2+35)continue;instances.push({position:[x,y-spec.scales[i][1]*.25,z],scale:spec.scales[i],rotation:Math.atan2(q.frame.left[0],q.frame.left[2])+.2*i,pitch:spec.key==='slanted-outcrop'?.22:0});}
      if(!instances.length)continue;const maps=textures.rock_face,material=new T.MeshStandardMaterial({name:'ASFALTO_LIPAN_LANDMARK',map:maps?.diff,normalMap:maps?.normal,roughnessMap:maps?.rough,color:spec.key==='split-ridge'?'#b3896b':spec.key==='terraced-knoll'?'#a68c6b':'#b79676',roughness:1,normalScale:new T.Vector2(.55,.55)});
      instanceDetailTiles(T,group,templates.get('rock-'+(specs.indexOf(spec)%4)),material,instances,{name:spec.key,distanceM:1600});landmarks.push({key:spec.key,sM:spec.s,position:[center[0],cy,center[2]],components:instances.length});
    }
  }
  root.add(group);root.userData.asfaltoRegionalLandmarks=landmarks;
  const direction=addRouteDirection(T,root,{id,leg:'outbound',query,lengthM,heightAt:signHeightAt,detailRange,existingCues});
  return{kilometreMarkers,regionalLandmarks:landmarks,routeDirectionCues:direction.cues.length};
}

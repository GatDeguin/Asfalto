// Distances and natural landmarks are located on the authored route, never on the return connector.
import {instanceDetailTiles} from './roadside-details.mjs?v=full-r1-20260916';
const random=n=>{const x=Math.sin(n*19.31+7.17)*45371.63;return x-Math.floor(x);};
export function addRegionalWayfinding(T,root,{id,query,lengthM,heightAt,templates,textures,detailRange=null}){
  const group=new T.Group();group.name='ASFALTO_REGIONAL_WAYFINDING';root.updateMatrixWorld(true);group.matrix.copy(root.matrixWorld).invert();group.matrixAutoUpdate=false;
  const points=[],posts=[];
  for(let s=1000;s<lengthM-100;s+=1000){if(detailRange&&(s<detailRange.startM||s>=detailRange.endM))continue;const q=query.sample(s),lateral=q.widthM/2+1.65,p=q.position.map((v,i)=>v+q.frame.left[i]*lateral);let y=heightAt(p[0],p[2]);if(!Number.isFinite(y)||Math.abs(y-p[1])>3.2)y=p[1]-.08;
    const check=query.project?.(p);if(check&&(check.distanceXZ<check.widthM/2+1.2||Math.abs(check.sM-s)>30))continue;
    points.push({q,p,km:Math.round(s/1000)});const top=p[1]+1.15;posts.push({position:[p[0],(top+y)/2-.04,p[2]],scale:[.08,Math.max(.4,top-y+.12),.08],rotation:0});
  }
  if(points.length){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d');
    for(let n=0;n<32;n++){const x=(n%8)*128,y=Math.floor(n/8)*128;c.fillStyle='#d1ceba';c.fillRect(x,y,128,128);c.fillStyle='#284139';c.fillRect(x+4,y+4,120,29);c.fillStyle='#e1dfc7';c.font='bold 20px sans-serif';c.textAlign='center';c.fillText('km',x+64,y+26);c.fillStyle='#2f352e';c.font='bold 60px sans-serif';c.fillText(String(n),x+64,y+96);c.fillStyle='#857d6340';for(let k=0;k<23;k++)c.fillRect(x+random(n*40+k)*128,y+random(n*40+k+11)*128,2+random(k)*4,1);}
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.name='ASFALTO_DISTANCE_MARKER_ATLAS';
    const positions=[],uv=[],idx=[];for(const {q,p,km}of points){const start=positions.length/3,cell=km%32,u=(cell%8)/8,v=1-(Math.floor(cell/8)+1)/4;
      for(const [l,y]of [[-.22,.79],[.22,.79],[.22,1.23],[-.22,1.23]])positions.push(p[0]+q.frame.left[0]*l,p[1]+y,p[2]+q.frame.left[2]*l);
      uv.push(u,v,u+.125,v,u+.125,v+.25,u,v+.25);idx.push(start,start+1,start+2,start,start+2,start+3);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();const mesh=new T.Mesh(g,new T.MeshStandardMaterial({name:'ASFALTO_DISTANCE_MARKER',map,roughness:.83,side:T.DoubleSide}));mesh.name='ASFALTO_KILOMETRE_MARKERS';group.add(mesh);
    const geometry=new T.BoxGeometry(1,1,1),material=new T.MeshStandardMaterial({color:'#777b70',roughness:.75,metalness:.35});instanceDetailTiles(T,group,geometry,material,posts,{name:'kilometre-post',distanceM:500});
  }
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
  return{kilometreMarkers:points.length,regionalLandmarks:landmarks};
}

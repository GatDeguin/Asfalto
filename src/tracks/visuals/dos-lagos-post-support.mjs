import {terrainHeightSampler} from './reference-landscape.mjs?v=ada39f9cec1a7220';

const NATIVE_POST=/^(PROP_(Guardrail_Posts|SignPosts)|DETAIL_Roadside_Posts)_Primitive_/;
const INSTANCE_POST=/^ASFALTO_DETAIL_(guard-post|sign-post|kilometre-post)_/;
const SHOULDER=/^(ROAD_Shoulder_|RETURN_(LEFT|RIGHT)_SHOULDER|PROP_Bridge_Deck)/;

// GLB positions are duplicated at hard edges. Weld for connectivity only,
// keeping the exported geometry and its lighting untouched.
function visitNativeFeet(T,mesh,visit){
 const {index,attributes:{position:p}}=mesh.geometry;
 if(!index)return;
 const parent=Int32Array.from({length:p.count},(_,i)=>i),vertices=new Map(),groups=new Map();
 const find=i=>{while(i!==parent[i]){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{parent[find(a)]=find(b);};
 for(let i=0;i<p.count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i)].join('/');
  if(vertices.has(key))join(i,vertices.get(key));else vertices.set(key,i);
 }
 for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
 for(let i=0;i<p.count;i++){const id=find(i);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(i);}
 const v=new T.Vector3(),low=new T.Box3();
 for(const indices of groups.values()){
  let bottom=Infinity;
  for(const i of indices)bottom=Math.min(bottom,v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).y);
  low.makeEmpty();
  for(const i of indices){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);if(v.y<bottom+.03)low.expandByPoint(v);}
  low.getCenter(v);v.y=bottom;visit(v);
 }
}

export function addDosLagosPostSupport(T,root,query,lengthM){
 if(!T||!root?.isObject3D||!query)return null;
 root.updateMatrixWorld(true);
 let material;
 const shoulder=m=>SHOULDER.test(m.name)||m.name==='ASFALTO_TERRAIN_SHOULDER_TRANSITION';
 root.traverse(m=>{if(m.isMesh&&/^ROAD_Shoulder_/.test(m.name))material??=m.material;});
 if(!material)return null;
 const height=terrainHeightSampler(T,root,shoulder).raw,records=[],matrix=new T.Matrix4(),point=new T.Vector3();
 const record=(v,guard)=>{
  if(v.y-height(v.x,v.z)<=.001)return;
  const q=query.project(v.toArray()),sample=query.sample(q.sM),distance=Math.abs(q.lateralM);
  // Connect only roadside feet close to their actual route and grade.
  if(distance<sample.widthM*.5+.04||distance>sample.widthM*.5+6||Math.abs(v.y-sample.position[1])>2)return;
  records.push({s:q.sM,side:Math.sign(q.lateralM),distance,y:v.y,guard});
 };
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(mesh.visible&&NATIVE_POST.test(mesh.name))visitNativeFeet(T,mesh,v=>record(v,mesh.name.startsWith('PROP_Guardrail_')));
  if(!mesh.isInstancedMesh||!INSTANCE_POST.test(mesh.name))return;
  const source=mesh.userData.asfaltoCloneForChart?.();if(!source)return;
  try{for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);record(point.set(0,-.5,0).applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld),mesh.name.startsWith('ASFALTO_DETAIL_guard-post_'));}}
  finally{source.dispose();}
 });
 records.sort((a,b)=>a.side-b.side||a.s-b.s);
 const pads=[];
 for(const foot of records){
  const last=pads.at(-1);
  if(last&&last.side===foot.side&&foot.s-last.end<=.65){last.end=foot.s;last.near=Math.min(last.near,foot.distance);last.far=Math.max(last.far,foot.distance);last.y=Math.max(last.y,foot.y);last.guard||=foot.guard;}
  else pads.push({side:foot.side,start:foot.s,end:foot.s,near:foot.distance,far:foot.distance,y:foot.y,guard:foot.guard});
 }
 if(!pads.length)return{feet:0,pads:0};
 const positions=[],indices=[],uv=[],color=[];
 const inverse=root.matrixWorld.clone().invert();
 function vertex(q,lateral,y){
  const x=q.position[0]+q.frame.left[0]*lateral,z=q.position[2]+q.frame.left[2]*lateral;
  point.set(x,y,z);
  uv.push(x/3,(z+point.y*.18)/3);color.push(.91,.89,.84);
  point.applyMatrix4(inverse);positions.push(...point.toArray());
 }
 function connectRows(first,second,side){
  for(let i=0;i<3;i++){
   const a=first+i,b=a+1,c=second+i,d=c+1;
   if(side>0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
  }
 }
 function addRow(pad,s){
  const offset=positions.length/3,q=query.sample(Math.max(0,Math.min(lengthM,s))),edge=q.widthM*.5;
  const inner=Math.max(edge+.015,Math.min(edge+.08,pad.near-.29)),plate=Math.max(inner+.025,pad.near-.21);
  const roadY=q.position[1]+q.frame.left[1]*pad.side*inner;
  const top=Math.max(pad.y+.065,Math.min(pad.y+.45,roadY-.035));
  vertex(q,pad.side*inner,roadY-.024);vertex(q,pad.side*plate,top);vertex(q,pad.side*(pad.far+.22),top);vertex(q,pad.side*(pad.far+.22),top-.30);
  return offset;
 }
 let previous=null;
 for(const pad of pads){
  const start=pad.start-.58,end=pad.end+.58;
  const span=previous?pad.start-previous.end:Infinity;
  let lastRow=null;
  if(previous?.guard&&pad.guard&&pad.side===previous.side&&span>1.16&&span<=13.2&&Math.abs(pad.far-previous.far)<.85&&Math.abs(pad.y-previous.y)<.25*span){
   lastRow=previous.lastRow;
   const from=previous.end+.58,steps=Math.ceil((start-from)/2);
   for(let i=1;i<steps;i++){
    const blend=i/steps,mix=key=>previous[key]+(pad[key]-previous[key])*blend;
    const next=addRow({side:pad.side,near:mix('near'),far:mix('far'),y:mix('y')},from+(start-from)*blend);
    connectRows(lastRow,next,pad.side);lastRow=next;
   }
  }
  const first=addRow(pad,start);pad.lastRow=addRow(pad,end);
  if(lastRow!==null)connectRows(lastRow,first,pad.side);
  connectRows(first,pad.lastRow,pad.side);previous=pad;
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(color,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,material);mesh.name='TERRAIN_DOS_LAGOS_POST_SUPPORT';mesh.receiveShadow=true;root.add(mesh);
 return root.userData.asfaltoPostSupport={feet:records.length,pads:pads.length};
}

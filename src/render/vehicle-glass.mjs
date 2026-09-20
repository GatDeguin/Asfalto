// Close only the open glazing planes from the original presentation derivatives.
// Supplied alternative cars already contain authored optical skins and keep them.
export function thickenVehicleGlass(T,object,model,{thicknessM=.0045}={}){
 const source=object.geometry,p=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv,index=source.index;
 if(!p||!n||!index||source.userData.vehicleGlassThicknessM)return null;
 const author=new T.Matrix4().copy(model.matrixWorld).invert().multiply(object.matrixWorld),inverse=author.clone().invert(),normalMatrix=new T.Matrix3().getNormalMatrix(author);
 const pos=[],normals=[],uvs=[],triangles=[],signs=[],point=new T.Vector3(),normal=new T.Vector3(),local=new T.Vector3(),outward=new T.Vector3();
 const authoredThickness=thicknessM/2.5;
 for(let side=0;side<2;side++)for(let i=0;i<p.count;i++){
  point.fromBufferAttribute(p,i).applyMatrix4(author);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
  const sign=normal.dot(outward.copy(point).sub(new T.Vector3(0,.16,0)))<0?-1:1;signs[i]=sign;
  if(side)point.addScaledVector(normal,-authoredThickness*sign);
  local.copy(point).applyMatrix4(inverse);pos.push(local.x,local.y,local.z);
  normals.push(n.getX(i)*sign*(side?-1:1),n.getY(i)*sign*(side?-1:1),n.getZ(i)*sign*(side?-1:1));
  uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);
 }
 const edges=new Map(),vertexKey=i=>`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
 for(let i=0;i<index.count;i+=3){let a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(signs[a]+signs[b]+signs[c]<0)[b,c]=[c,b];triangles.push(a,b,c,c+p.count,b+p.count,a+p.count);
  for(const [v,w]of [[a,b],[b,c],[c,a]]){const key=[vertexKey(v),vertexKey(w)].sort().join('|');const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{v,w,count:1});}
 }
 let boundaryEdges=0;
 for(const {v,w,count}of edges.values())if(count===1){
  // Separate wall vertices preserve the polished broad faces and crisp edge.
  const ids=[v,v+p.count,w+p.count,w],start=pos.length/3;
  const a=new T.Vector3().fromArray(pos,ids[0]*3),b=new T.Vector3().fromArray(pos,ids[1]*3),c=new T.Vector3().fromArray(pos,ids[2]*3);normal.crossVectors(b.sub(a),c.sub(a)).normalize();
  for(const id of ids){pos.push(pos[id*3],pos[id*3+1],pos[id*3+2]);normals.push(normal.x,normal.y,normal.z);uvs.push(uvs[id*2],uvs[id*2+1]);}
  triangles.push(start,start+1,start+2,start,start+2,start+3);boundaryEdges++;
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(triangles);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={...source.userData,vehicleGlassThicknessM:thicknessM,boundaryEdges,sourceTriangles:index.count/3};object.geometry=geometry;return source;
}

// One immutable, texture-free derived DEM loaded during track preparation.
export function decodeHorconesDEM(T, buffer) {
 const view=new DataView(buffer);if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw Error('Invalid Horcones DEM GLB');
 const jsonLength=view.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength))),bin=28+jsonLength,primitive=j.meshes?.[0]?.primitives?.[0];
 if(j.meshes.length!==1||j.meshes[0].primitives.length!==1||!primitive)throw Error('Horcones DEM must contain one primitive');
 const geometry=new T.BufferGeometry();
 function attr(i){const a=j.accessors[i],b=j.bufferViews[a.bufferView],C={5126:Float32Array,5123:Uint16Array}[a.componentType],size={SCALAR:1,VEC3:3}[a.type];if(!C||!size||b.byteStride||a.sparse)throw Error('Unsupported DEM accessor');return new T.BufferAttribute(new C(buffer.slice(bin+(b.byteOffset||0)+(a.byteOffset||0),bin+(b.byteOffset||0)+(a.byteOffset||0)+a.count*size*C.BYTES_PER_ELEMENT)),size);}
 try{for(const [semantic,name]of [['POSITION','position'],['NORMAL','normal'],['COLOR_0','color']])geometry.setAttribute(name,attr(primitive.attributes[semantic]));geometry.setIndex(attr(primitive.indices));if(geometry.attributes.position.count!==25921||geometry.index.count!==153600)throw Error('Unexpected DEM budget');geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;}catch(e){geometry.dispose();throw e;}
}
export async function loadHorconesDEM(T,signal){
 const base=new URL('../../../tracks/aconcagua-horcones/',import.meta.url);
 const placement=new URL('distant-aconcagua-dem.provenance.json?v=96e5cb91648be268c',base);
 const results=await Promise.all([fetch(new URL('distant-aconcagua-dem.glb',base),{signal}),fetch(placement,{signal})]);for(const r of results)if(!r.ok)throw Error('Horcones DEM fetch '+r.status);
 const [buffer,provenance]=await Promise.all([results[0].arrayBuffer(),results[1].json()]);if(signal?.aborted)throw signal.reason||Error('DEM load aborted');return {geometry:decodeHorconesDEM(T,buffer),provenance};
}
export function addHorconesDEM(T,root,asset,{heightAt=null}={}){
 if(!asset?.geometry||!asset?.provenance?.placement)throw Error('Horcones distant DEM must be loaded during preparation');
 const original=asset.geometry,placement=asset.provenance.placement,matrix=new T.Matrix4().fromArray(placement.matrixColumnMajor),g=original.clone().applyMatrix4(matrix),p=Array.from(g.attributes.position.array),c=Array.from(g.attributes.color.array),indices=Array.from(g.index.array),n=161,boundary=[];
 // Paint on the measured relief. Retain warm dry foothills, grey crests
 // and snow in the high hollows where the terrain can support it.
 const elevation=original.attributes.position,normals=g.attributes.normal,base=new T.Color(),
  dust=new T.Color('#a59076'),screeRock=new T.Color('#756d60'),highRock=new T.Color('#85817c'),
  apronRock=new T.Color('#8d765c'),snow=new T.Color('#e2e8ea');
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(lo,hi,x)=>{const t=clamp((x-lo)/(hi-lo));return t*t*(3-2*t);};
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const i=z*n+x,y=elevation.getY(i),nx=normals.getX(i),ny=Math.abs(normals.getY(i)),nz=normals.getZ(i);
  const neighbors=(elevation.getY(z*n+Math.max(0,x-1))+elevation.getY(z*n+Math.min(n-1,x+1))+elevation.getY(Math.max(0,z-1)*n+x)+elevation.getY(Math.min(n-1,z+1)*n+x))*.25;
  const hollow=clamp((neighbors-y)/38),scree=smooth(.45,.93,ny);
  const bedding=.5+.5*Math.sin(y*.007+elevation.getX(i)*.00011+Math.sin(elevation.getZ(i)*.00065)*.8);
  base.copy(screeRock).lerp(dust,scree*.74*(1-smooth(1700,3100,y))).lerp(highRock,smooth(2000,3150,y)*.69);
  base.multiplyScalar(.80+bedding*.23-hollow*.13);
  const sheltered=smooth(.10,.62,hollow)*smooth(2180,3220,y)*.58;
  const crown=smooth(2680,3710,y+(bedding-.5)*145)*smooth(.38,.82,ny)*.81;
  const aspect=.82-.10*nx+.08*nz;
  base.lerp(snow,clamp(Math.max(crown,sheltered)*aspect));base.toArray(c,i*3);
 }
 // A visual-only apron closes the geographic crop. Original sampled vertices stay unchanged.
 for(let x=0;x<n;x++)boundary.push(x);for(let z=1;z<n;z++)boundary.push(z*n+n-1);for(let x=n-2;x>=0;x--)boundary.push((n-1)*n+x);for(let z=n-2;z>0;z--)boundary.push(z*n);
 const center=g.boundingBox?.getCenter(new T.Vector3())||new T.Vector3(),start=p.length/3;
 for(const i of boundary){const x=p[i*3],z=p[i*3+2],dx=x-center.x,dz=z-center.z,len=Math.hypot(dx,dz),ox=x+dx/len*600,oz=z+dz/len*600,support=heightAt?.(ox,oz),oy=Number.isFinite(support)?support-1:-120;p.push(ox,oy,oz);base.fromArray(c,i*3).lerp(apronRock,.54).multiplyScalar(.88);c.push(base.r,base.g,base.b);}
 for(let k=0;k<boundary.length;k++){const next=(k+1)%boundary.length;indices.push(boundary[k],boundary[next],start+k,boundary[next],start+next,start+k);}
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(indices);
 // computeVertexNormals reuses an existing attribute, even if its array is too
 // short. The apron adds 640 vertices, which must receive normals of their own.
 g.deleteAttribute('normal');g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 const material=new T.MeshStandardMaterial({name:'ASFALTO_HORCONES_DEM_ROCK_SNOW',vertexColors:true,roughness:1,metalness:0,envMapIntensity:.12,side:T.DoubleSide});Object.assign(material.userData,{asfaltoRegion:'aconcagua_horcones',asfaltoVertexVariation:true,asfaltoDistantMountain:true});
 const mesh=new T.Mesh(g,material);mesh.name='ASFALTO_HORCONES_GEOGRAPHIC_DEM';mesh.userData.asfaltoVertexVariation=true;mesh.userData.asfaltoGeographicDEM=true;mesh.userData.asfaltoDistantRidge={layer:0,triangles:indices.length/3,source:'Copernicus DEM GLO30',visualOnly:true};root.add(mesh);root.userData.asfaltoGeographicMountain={...asset.provenance,acceptance:'awaiting GPU review',surfaceTreatment:'measured slope and concavity; altitude/aspect snow; original DEM positions preserved',apron:{widthM:600,triangles:1280,heightSource:'existing visual terrain where supported, otherwise scenic floor -120m'}};
 return {mountainTriangles:indices.length/3,mountainLayers:1,mountainSource:'Copernicus DEM GLO30'};
}



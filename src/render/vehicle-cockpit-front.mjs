// Derived presentation of the supplied quantized Chevy V3 front. Source data,
// vertex ownership, adjustable-cut indices and personal mount transforms survive.
// Measurements are in original scan authoring units (2.5 metres per unit).
const SCALE=.000115927542,SHIFT=[-.950601995,-.296283007,-.385340989];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const PROFILE=[[-.90,.0730],[-.86,.0783],[-.78,.0867],[-.70,.0910],[-.62,.0938],[-.54,.09665],[-.46,.09955],[-.38,.1023],[-.305,.1050]];
function skinHeight(x,z){
 let i=0;while(i<PROFILE.length-2&&x>PROFILE[i+1][0])i++;
 const a=PROFILE[i],b=PROFILE[i+1],t=clamp((x-a[0])/(b[0]-a[0]));
 const slopeA=i?(b[1]-PROFILE[i-1][1])/(b[0]-PROFILE[i-1][0]):(b[1]-a[1])/(b[0]-a[0]);
 const slopeB=i+2<PROFILE.length?(PROFILE[i+2][1]-a[1])/(PROFILE[i+2][0]-a[0]):(b[1]-a[1])/(b[0]-a[0]);
 const y=(2*t*t*t-3*t*t+1)*a[1]+(t*t*t-2*t*t+t)*(b[0]-a[0])*slopeA+(-2*t*t*t+3*t*t)*b[1]+(t*t*t-t*t)*(b[0]-a[0])*slopeB;
 return y+.0063*(1-Math.pow(clamp(Math.abs(z)/.278),1.3));
}
export function restoreCockpitFront(T,mesh){
 const source=mesh?.geometry,p=source?.attributes.position,n=source?.attributes.normal;
 if(p?.count!==201686||source.index?.count!==1135308||p.array?.constructor!==Uint16Array)return {restored:false,reason:'unknown source; preserved'};
 if(source.userData.vehicleFrontRestoration)return {...source.userData.vehicleFrontRestoration};
 const geometry=source.clone(),positions=new Float32Array(p.count*3),mask=new Float32Array(p.count);
 let fairedVertices=0,cowlVertices=0,analyticHoodNormals=0,maxDisplacementM=0,maxHoodDisplacementM=0;
 for(let i=0;i<p.count;i++){
  const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),x=px*SCALE+SHIFT[0],y=py*SCALE+SHIFT[1],z=pz*SCALE+SHIFT[2];
  positions[i*3]=px;positions[i*3+1]=py;positions[i*3+2]=pz;
  let weight=0,delta=0;
  if(x>-.90&&x<-.305&&Math.abs(z)<.278&&y>.062&&y<.125&&(!n||n.getY(i)>=.1)){
   weight=smooth(-.90,-.875,x)*(1-smooth(-.335,-.305,x))*(1-smooth(.254,.278,Math.abs(z)))*smooth(.062,.074,y);
   delta=(skinHeight(x,z)-y)*weight;
   maxHoodDisplacementM=Math.max(maxHoodDisplacementM,Math.abs(delta)*2.5);
  }
  // The 36.8858% default cut retains a torn fragment of the scan windshield
  // behind the hood (x=-.305..-.250, y up to .15931). The calibrated cockpit
  // already supplies its windshield. Reconstruct this duplicate as a shallow,
  // continuous steel cowl rather than preserving the broken glass silhouette.
  if(x>-.345&&x<-.235&&Math.abs(z)<.315&&y>.101&&y<.24){
   const cowl=smooth(-.345,-.320,x)*(1-smooth(-.247,-.235,x))*(1-smooth(.285,.315,Math.abs(z)))*smooth(.101,.118,y)*(1-smooth(.20,.24,y));
   if(cowl>0){const height=.108+smooth(-.33,-.24,x)*.004+.001*(1-Math.pow(Math.abs(z)/.315,2));delta=(height-y)*cowl;weight=Math.max(weight,cowl);cowlVertices++;}
  }
  if(weight<=0)continue;mask[i]=weight;
  positions[i*3+1]=(y+delta-SHIFT[1])/SCALE;fairedVertices++;
  maxDisplacementM=Math.max(maxDisplacementM,Math.abs(delta)*2.5);
 }
 geometry.setAttribute('position',new T.BufferAttribute(positions,3));
 geometry.setAttribute('vehicleRestoredPaint',new T.BufferAttribute(mask,1));
 geometry.setAttribute('vehicleReferencePosition',p);
 // Quantized scan normals cannot accumulate triangle areas: Int8 writes overflow.
 // A dedicated float buffer also avoids the interleaved clone's oversized view.
 geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(p.count*3),3));
 geometry.deleteAttribute('tangent');geometry.computeVertexNormals();
 // Weld only the normal neighbourhood across coincident UV seams. Neither UVs
 // nor indices are merged: source material/cut and wheel ownership stay exact.
 const normal=geometry.attributes.normal,sums=new Map();
 for(let i=0;i<p.count;i++)if(mask[i]>0){const key=`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;let sum=sums.get(key);if(!sum){sum=[0,0,0];sums.set(key,sum);}sum[0]+=normal.getX(i);sum[1]+=normal.getY(i);sum[2]+=normal.getZ(i);}
 for(let i=0;i<p.count;i++){
  if(mask[i]>0){const sum=sums.get(`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`),len=Math.hypot(...sum)||1;const weight=mask[i];let x=sum[0]/len,y=sum[1]/len,z=sum[2]/len;if(n){x=n.getX(i)*(1-weight)+x*weight;y=n.getY(i)*(1-weight)+y*weight;z=n.getZ(i)*(1-weight)+z*weight;}const norm=Math.hypot(x,y,z)||1;normal.setXYZ(i,x/norm,y/norm,z/norm);}
  else if(n)normal.setXYZ(i,n.getX(i),n.getY(i),n.getZ(i));
 }
 // A scan's triangle normals encode local reconstruction noise. The hood is
 // a continuous crowned steel panel; use its analytic derivative across every
 // interior vertex, independent of UV islands and original triangle density.
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)*SCALE+SHIFT[0],y=p.getY(i)*SCALE+SHIFT[1],z=p.getZ(i)*SCALE+SHIFT[2];
  if(x<=-.90||x>=-.305||Math.abs(z)>=.278||y<=.062||y>=.125||(n&&n.getY(i)<.1))continue;
  const e=.0001,dx=(skinHeight(x+e,z)-skinHeight(x-e,z))/(2*e),dz=(skinHeight(x,z+e)-skinHeight(x,z-e))/(2*e),len=Math.hypot(dx,1,dz);
  const weight=smooth(-.90,-.875,x)*(1-smooth(-.335,-.305,x))*(1-smooth(.254,.278,Math.abs(z)));
  let nx=normal.getX(i)*(1-weight)-dx/len*weight,ny=normal.getY(i)*(1-weight)+weight/len,nz=normal.getZ(i)*(1-weight)-dz/len*weight;
  const nl=Math.hypot(nx,ny,nz)||1;normal.setXYZ(i,nx/nl,ny/nl,nz/nl);analyticHoodNormals++;
 }
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const result={restored:true,source:'Chevy V3 frenteGz dd1b33e5743e',fairedVertices,cowlVertices,analyticHoodNormals,maxDisplacementM,maxHoodDisplacementM,triangles:geometry.index.count/3,addedTriangles:0,sourcePreserved:true};
 geometry.userData.vehicleFrontRestoration=result;mesh.geometry=geometry;
 const fairedPositions=positions.slice(),fairedNormals=normal.array.slice(),uniform={value:1};
 return {...result,uniform,setEnabled(value){
  const enabled=!!value;uniform.value=enabled?1:0;
  if(enabled){positions.set(fairedPositions);normal.array.set(fairedNormals);}
  else for(let i=0;i<p.count;i++){positions[i*3]=p.getX(i);positions[i*3+1]=p.getY(i);positions[i*3+2]=p.getZ(i);if(n)normal.setXYZ(i,n.getX(i),n.getY(i),n.getZ(i));}
  geometry.attributes.position.needsUpdate=true;normal.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();return enabled;
 }};
}

export function installCockpitFrontFinish(paintController,restoration=null){
 let count=0;
 paintController.forEachMaterial(material=>{
  if(material.userData.vehicleFrontFinish)return;
  const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=shader=>{
   before?.call(material,shader);
   shader.uniforms.vehicleRestorationEnabled=restoration?.uniform||{value:1};
   shader.vertexShader='attribute float vehicleRestoredPaint;\nuniform float vehicleRestorationEnabled;\nvarying float vVehicleRestoredPaint;\nvarying vec3 vVehicleFrontAuthoring;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvVehicleRestoredPaint=vehicleRestoredPaint*vehicleRestorationEnabled;\nvVehicleFrontAuthoring=position*.000115927542+vec3(-.950601995,-.296283007,-.385340989);');
   shader.fragmentShader='varying float vVehicleRestoredPaint;\nvarying vec3 vVehicleFrontAuthoring;\nuniform float vehicleRestorationEnabled;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float vehicleHoodSurfaceMask=smoothstep(-.900,-.875,vVehicleFrontAuthoring.x)*(1.0-smoothstep(-.335,-.305,vVehicleFrontAuthoring.x))*(1.0-smoothstep(.254,.278,abs(vVehicleFrontAuthoring.z)))*smoothstep(.062,.074,vVehicleFrontAuthoring.y)*(1.0-smoothstep(.123,.140,vVehicleFrontAuthoring.y));
    float vehicleFinishMask=max(vVehicleRestoredPaint,vehicleHoodSurfaceMask*vehicleRestorationEnabled);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('roughnessFactor = mix(roughnessFactor, .28, chevyPaintMask);','roughnessFactor = mix(roughnessFactor, .28, chevyPaintMask);\nroughnessFactor = mix(roughnessFactor, .29, vehicleFinishMask);');
   shader.fragmentShader=shader.fragmentShader.replace('float chevyShade = clamp(chevySourceColor.r, .08, 1.0);','chevyPaintMask = max(chevyPaintMask, vehicleFinishMask);\nfloat chevyShade = mix(clamp(chevySourceColor.r, .08, 1.0), .88, vehicleFinishMask);');
   // The source metal atlas carries purple studio reflections. Structural panel
   // ownership is authoritative even where those pixels fail the orange mask.
   shader.fragmentShader=shader.fragmentShader.replace('chevyChrome * .92','chevyChrome * .92 * (1.0-vehicleFinishMask)');
   shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, vehicleFinishMask);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1.0-vehicleFinishMask;');
   shader.fragmentShader=shader.fragmentShader.replace('chevyPaintMask * .68','max(chevyPaintMask * .68, vehicleFinishMask)');
  };
  material.customProgramCacheKey=()=>key()+':v7-restored-front-2-continuous';
  material.userData.vehicleFrontFinish=true;material.needsUpdate=true;count++;
 });return count;
}

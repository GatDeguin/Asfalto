// Visual state is derived from saved damage. Coordinates here are the GLB's
// normalized authoring space, before the physical calibration turns it 180°.
const clamp=(v,min,max,fallback)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
const ZONES=['front','rear','left','right','roof'];

export function normalizeVehicleAppearanceCondition(input={}){
 const condition={};
 for(const key of ['engine','oil','brakes','tires','body','paint','fuel','steering','suspension'])condition[key]=clamp(input?.[key],0,100,100);
 condition.dirt=clamp(input?.dirt,0,100,0);
 condition.damageZones=Object.fromEntries(ZONES.map(key=>[key,clamp(input?.damageZones?.[key],0,1,0)]));
 if(input?.mechanical?.body){
  condition.mechanical={body:{}};
  for(const key of ['frontCondition','sideCondition','undersideCondition'])condition.mechanical.body[key]=clamp(input.mechanical.body[key],0,1,1);
 }
 return condition;
}

function structuralDamage(condition){
 const {front,rear,left,right,roof}=condition.damageZones;
 const body=condition.mechanical?.body;
 const frontLoss=1-(body?.frontCondition??1),sideLoss=1-(body?.sideCondition??1),underside=1-(body?.undersideCondition??1);
 // Older saves can have aggregate chassis wear without any contact locations.
 const legacy=front||rear||left||right||roof||frontLoss||sideLoss||underside?0:(1-condition.body/100)*.46;
 return [
  Math.max(front,frontLoss,legacy),
  Math.max(rear,legacy),
  Math.max(left,(!right||left)?sideLoss:0,legacy),
  Math.max(right,(!left||right)?sideLoss:0,legacy),
  Math.max(roof,legacy*.75),
  Math.max(underside,legacy*.65),
 ];
}

// Physics +X is forward. Saved right (+Z) maps to -Z on the authored shell.
const FIELDS=[
 {center:[-.86,.015,0],radius:[.34,.29,.54],axis:0,depth:.16},
 {center:[.86,.015,0],radius:[.33,.27,.54],axis:0,depth:-.14},
 {center:[-.06,.015,.35],radius:[.74,.27,.20],axis:2,depth:-.137},
 {center:[-.06,.015,-.35],radius:[.74,.27,.20],axis:2,depth:.137},
 {center:[.06,.28,0],radius:[.59,.20,.39],axis:1,depth:-.131},
 {center:[0,-.20,0],radius:[.78,.15,.45],axis:1,depth:.104},
];
function displacement(x,y,z,damage,out){
 out[0]=out[1]=out[2]=0;
 let crease;
 for(let i=0;i<FIELDS.length;i++){
  if(!damage[i])continue;
  const {center:[cx,cy,cz],radius:[rx,ry,rz],axis,depth}=FIELDS[i];
  const distance=((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2;
  if(distance>=2)continue;
  const weight=1-distance*.5;
  crease??=.76+.24*Math.cos(x*29+y*38+z*31);
  out[axis]+=damage[i]*depth*weight**3*crease;
 }
 return out;
}
export function damageDisplacement(position,condition={}){
 return displacement(...position,structuralDamage(normalizeVehicleAppearanceCondition(condition)),[0,0,0]);
}

export function createVehicleConditionAppearance(T){
 let condition=normalizeVehicleAppearanceCondition(),damage=structuralDamage(condition),geometryDamage=damage,disposed=false;
 const surfaces=[],p=new T.Vector3(),delta=[0,0,0];

 function apply(surface){
  const {mesh,original,matrix,inverse,fields}=surface;
  const key=fields.map(i=>geometryDamage[i]).join(',');
  if(key===surface.key)return;
  surface.key=key;
  if(!fields.some(i=>geometryDamage[i]>0)){
   if(mesh.geometry!==original){mesh.geometry.dispose();mesh.geometry=original;}
   return;
  }
  if(mesh.geometry===original){
   mesh.geometry=original.clone();
   mesh.geometry.setAttribute('position',new T.Float32BufferAttribute(original.attributes.position.count*3,3));
   // Recompute into a float attribute even when the GLB used normalized integers.
   mesh.geometry.deleteAttribute('normal');
  }
  const {position}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++){
   p.fromBufferAttribute(original.attributes.position,i).applyMatrix4(matrix);
   displacement(p.x,p.y,p.z,geometryDamage,delta);
   p.set(p.x+delta[0],p.y+delta[1],p.z+delta[2]).applyMatrix4(inverse);
   position.setXYZ(i,p.x,p.y,p.z);
  }
  position.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
 }

 return {
  add(mesh,matrix){
   const original=mesh.geometry;
   if(disposed||!original?.attributes.position)return false;
   if(!original.boundingBox)original.computeBoundingBox();
   const box=original.boundingBox.clone().applyMatrix4(matrix);
   const fields=FIELDS.flatMap(({center,radius},i)=>{
    const distance=center.reduce((sum,v,k)=>{
     const axis=['x','y','z'][k],gap=Math.max(box.min[axis]-v,v-box.max[axis],0);
     return sum+(gap/radius[k])**2;
    },0);
    return distance<2?[i]:[];
   });
   const surface={mesh,original,matrix:matrix.clone(),inverse:matrix.clone().invert(),fields,key:''};
   surfaces.push(surface);
   apply(surface);
   return true;
  },
  set(value){
   if(disposed)return false;
   condition=normalizeVehicleAppearanceCondition(value);
   damage=structuralDamage(condition);
   const next=damage.map(value=>Math.round(value*32)/32);
   if(next.some((value,i)=>value!==geometryDamage[i])){
    geometryDamage=next;
    surfaces.forEach(apply);
   }
   return true;
  },
  visualState:()=>({condition,damage}),
  originalGeometries:()=>surfaces.filter(s=>s.mesh.geometry!==s.original).map(s=>s.original),
  diagnostics:()=>({condition:structuredClone(condition),surfaces:surfaces.length,deformedGeometries:surfaces.filter(s=>s.mesh.geometry!==s.original).length,disposed}),
  // The presentation releases both active and original geometry with its GLB.
  dispose(){if(disposed)return false;disposed=true;surfaces.length=0;return true;},
 };
}

export function vehicleConditionSurface(materialName='',objectName=''){
 if(/enginebay|^interior|^cabin|_interior|habitaculo|motor|steeringwheel|instrument/i.test(objectName))return null;
 if(/gauge|instrument|mirror|optical_silver/i.test(materialName))return null;
 if(/headlamp|faro|BrakeLens|LampLens|Optica|Window_seals|Burletes/i.test(materialName))return 'mounted';
 if(/glass|vidrio/i.test(materialName))return 'glass';
 if(/Paint|StripeAtlas|Black_lacquer|SatinStripe|Franjas_Negro|ReferenceIvoryEnamel|RoofIvory/i.test(materialName))return 'paint';
 if(/Underbody|Underframe|Chassis|Chasis|Bastidor|Inner_fender|Panel_gap|Grille|Bumper|Paragolpe|BodyTrim/i.test(materialName+' '+objectName))return 'structure';
 if(/_static_(?:Vehicle|BA57|C3100)_Chrome|^0[12]_(?:Carroceria|Opticas).*_Cromo/i.test(objectName))return 'structure';
 return null;
}

export const VEHICLE_GLASS_FRACTURE_GLSL=`
    float vehicleGlassFracture(vec2 point, float strength) {
      float extent=smoothstep(.08,.85,strength);
      float radius=length(point);
      float angle=atan(point.y,point.x+.00001);
      float sector=floor((angle+3.14159)*1.43);
      float reach=(.55+.45*fract(sin(sector*47.7)*873.1))*(.035+.33*extent);
      float spoke=abs(sin(angle*4.5+sin(radius*99.0+sector)*.17+radius*6.0));
      float branch=abs(sin(angle*8.0-radius*34.0+sin(sector*1.7)));
      float line=min(spoke, mix(1.0,branch,smoothstep(.27,.56,extent)*smoothstep(.025,.075,radius)));
      float width=.0014+.0012*extent;
      float edge=1.0-smoothstep(width,width+max(fwidth(radius),.0005),line*radius);
      float rings=abs(fract(radius*27.0+sin(angle*8.0)*.19)-.5);
      float web=(1.0-smoothstep(.025,.095,rings))*smoothstep(.45,.95,extent)*smoothstep(.15,.8,spoke)*.53;
      return max(edge,web)*(1.0-smoothstep(reach*.76,reach,radius))*extent;
    }
`;

// One procedural pass for both transparent glazing and the transmission tier.
export function installVehicleGlassCondition(material,matrix,uniforms){
 const prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey?.call(material)??prior?.toString()??'';
 material.onBeforeCompile=function(shader,renderer){
  prior?.call(this,shader,renderer);
  Object.assign(shader.uniforms,uniforms,{vehicleGlassMatrix:{value:matrix}});
  shader.vertexShader='varying vec3 vehicleGlassPosition;\nuniform mat4 vehicleGlassMatrix;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvehicleGlassPosition = (vehicleGlassMatrix * vec4(position,1.0)).xyz;');
  shader.fragmentShader=`varying vec3 vehicleGlassPosition;
    uniform float vehicleDirt;
    uniform vec3 vehicleDust;
    uniform vec2 vehicleDamageFrontRear;
    uniform vec3 vehicleDamageSidesRoof;
    ${VEHICLE_GLASS_FRACTURE_GLSL}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec3 glassPosition=vehicleGlassPosition;
    float glassFront=(1.0-smoothstep(-.23,-.08,glassPosition.x))*vehicleDamageFrontRear.x;
    float glassRear=smoothstep(.23,.41,glassPosition.x)*vehicleDamageFrontRear.y;
    float glassLeft=smoothstep(.19,.33,glassPosition.z)*vehicleDamageSidesRoof.x;
    float glassRight=(1.0-smoothstep(-.33,-.19,glassPosition.z))*vehicleDamageSidesRoof.y;
    float glassRoof=smoothstep(.14,.26,glassPosition.y)*vehicleDamageSidesRoof.z;
    float glassEndHit=max(glassFront,glassRear);
    float glassSideHit=max(glassLeft,glassRight);
    float glassCrack=0.0;
    if(max(max(vehicleDamageFrontRear.x,vehicleDamageFrontRear.y),vehicleDamageSidesRoof.z)>.08)
      glassCrack=vehicleGlassFracture(glassPosition.zy-vec2(.075,.16),max(glassEndHit,glassRoof*.76));
    if(max(vehicleDamageSidesRoof.x,vehicleDamageSidesRoof.y)>.08)
      glassCrack=max(glassCrack,vehicleGlassFracture(glassPosition.xy-vec2(-.035,.16),glassSideHit));
    float glassStreak=.5+.5*sin(glassPosition.x*76.0+glassPosition.z*63.0+sin(glassPosition.y*19.0)*.8);
    float glassFilm=vehicleDirt*(.045+.23*(1.0-smoothstep(.07,.27,glassPosition.y)))*(.48+.52*glassStreak);
    float glassHaze=smoothstep(.34,.88,max(glassRoof,max(glassEndHit,glassSideHit)))*.10;
    diffuseColor.a=mix(diffuseColor.a,1.0,clamp(glassFilm+glassCrack*.83+glassHaze,0.0,.89));
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_fragment>',`#include <transmission_fragment>
    totalDiffuse=mix(totalDiffuse,vehicleDust*.72,glassFilm*.83);
    totalDiffuse=mix(totalDiffuse,vec3(.68,.77,.78),clamp(glassCrack*.87+glassHaze,0.0,.87));
  `);
 };
 material.customProgramCacheKey=()=>JSON.stringify(['vehicle-glass-condition-v1',priorKey]);
 material.needsUpdate=true;
}

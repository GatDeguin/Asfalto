// Porous branch-tip foliage and tapering trunks in metres. No alpha blending or physics.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function random(seed){let s=seed;return()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);}
function merge(THREE,parts){
  const p=[],n=[],uv=[],color=[];
  for(const part of parts){const g=part.index?part.toNonIndexed():part;for(const [key,out]of [['position',p],['normal',n],['uv',uv],['color',color]])if(g.attributes[key])out.push(...g.attributes[key].array);if(g!==part)g.dispose();part.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(color.length===p.length)g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function branch(THREE,points,r0,r1){
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),g=new THREE.TubeGeometry(path,4,1,6,false),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const t=Math.floor(i/7)/4,c=path.getPointAt(t),r=r0*(1-t)+r1*t;p.setXYZ(i,c.x+(p.getX(i)-c.x)*r,c.y+(p.getY(i)-c.y)*r,c.z+(p.getZ(i)-c.z)*r);}
  g.computeVertexNormals();return g;
}
export function createRegionalTreeTemplates(THREE){
  const result=new Map();
  for(let variant=0;variant<3;variant++){
    const rng=random(217+variant*191),bark=[],leaf=[],lean=(variant-1)*.65;
    bark.push(branch(THREE,[[0,-.18,0],[lean*.3,2.5,.13],[lean,6,.1],[lean+.3,10,.5],[lean+.45,13.6,.7]],.43,.035));
    for(let k=0;k<5;k++){const a=k*2.399+variant*.6,l=.85+rng()*.7;bark.push(branch(THREE,[[0,.3,0],[Math.cos(a)*l*.6,.04,Math.sin(a)*l*.6],[Math.cos(a)*l,-.12,Math.sin(a)*l]],.2,.015));}
    const lobes=[];
    for(let k=0;k<10;k++){
      const angle=k*2.399+variant*.7,height=5.3+k*.73,radius=(k>7?1.5:3.2)+rng()*1.1;
      const x=lean+Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      bark.push(branch(THREE,[[lean*.7,height-2.2,.1],[x*.48,height-.8,z*.48],[x,height+.25,z]],.18-k*.012,.022));
      lobes.push([x,height+1.25,z,1.55+rng()*.9,1.35+rng()*.95,1.4+rng()*.85]);
    }
    lobes.push([lean+.4,14.15,.7,1.7,1.85,1.6]);
    for(const [x,y,z,sx,sy,sz]of lobes){
      // Overlapping curved leaflet clusters form an irregular porous crown, not
      // smooth ellipsoids and not the old isolated three-vertex leaf fragments.
      const positions=[],uv=[],colors=[],indices=[];
      const atlas=[[.002,.168,.53,.998],[.17,.346,.53,.998],[.35,.485,.53,.998],[.49,.635,.53,.998],[.64,.824,.53,.998],[.0,.18,.002,.44],[.20,.37,.002,.44],[.39,.57,.002,.44]];
      for(let cluster=0;cluster<40;cluster++){
        const phi=rng()*Math.PI*2,ny=rng()*2-1,nxz=Math.sqrt(1-ny*ny),normal=new THREE.Vector3(Math.cos(phi)*nxz,ny,Math.sin(phi)*nxz);
        const shell=.2+Math.pow(rng(),.48)*.88,center=new THREE.Vector3(x+normal.x*sx*shell,y+normal.y*sy*shell,z+normal.z*sz*shell);
        const tangent=new THREE.Vector3().crossVectors(normal,Math.abs(normal.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),bitangent=new THREE.Vector3().crossVectors(normal,tangent).normalize();
        for(let leaflet=0;leaflet<6;leaflet++){
          const side=leaflet%2?1:-1,offset=Math.floor(leaflet/2)-1,leafCenter=center.clone().addScaledVector(bitangent,offset*.28).addScaledVector(tangent,side*.11);
          const angle=side*(.28+rng()*.7),axisU=tangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(bitangent,Math.sin(angle)),axisV=bitangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent,-Math.sin(angle));
          const width=.12+rng()*.1,length=.28+rng()*.18,shade=.78+rng()*.22,start=positions.length/3,[u0,u1,v0,v1]=atlas[Math.floor(rng()*atlas.length)];
          for(const [du,dv]of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]){const p=leafCenter.clone().addScaledVector(axisU,du*width).addScaledVector(axisV,dv*length);positions.push(p.x,p.y,p.z);colors.push(shade*.96,shade,shade*.91);}
          uv.push(u0,v0,u1,v0,u1,v1,u0,v1);indices.push(start,start+1,start+2,start,start+2,start+3);
        }
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();leaf.push(g);
    }
    result.set('tree-'+variant+'-bark',merge(THREE,bark));result.set('tree-'+variant+'-leaf',merge(THREE,leaf));
  }
  return result;
}

// Opaque, fully covered leaflet texture. The source atlas has a black background
// intended for individual leaf triangles and cannot be wrapped around crown volumes.
export function createCrownTexture(THREE){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d'),rng=random(4181);c.fillStyle='#354132';c.fillRect(0,0,512,512);
  for(let layer=0;layer<3;layer++)for(let i=0;i<2100;i++){
    const x=rng()*512,y=rng()*512,r=2+rng()*5,angle=rng()*Math.PI*2;
    c.fillStyle=['#46533f','#526149','#647057','#394735','#738069'][Math.floor(rng()*5)];
    for(const dx of [-512,0,512])for(const dy of [-512,0,512]){
      if(x+dx+r<0||x+dx-r>512||y+dy+r<0||y+dy-r>512)continue;
      c.beginPath();c.ellipse(x+dx,y+dy,r,r*.48,angle,0,Math.PI*2);c.fill();
    }
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;map.name='ASFALTO_OPAQUE_CROWN_LEAFLETS';return map;
}

export function applyPhotographicLeafCutout(material){
  material.alphaTest=.42;material.alphaToCoverage=true;material.transparent=false;
  const previous=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=shader=>{
    previous(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
#ifdef USE_MAP
  diffuseColor.a*=smoothstep(.002,.009,max(sampledDiffuseColor.r,max(sampledDiffuseColor.g,sampledDiffuseColor.b)));
#endif`);
  };
  material.customProgramCacheKey=()=>cache()+'-photographic-leaf-cutout-v1';
}

export function applyCrownDistanceTransition(material){
  material.alphaToCoverage=true;
  const previous=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=shader=>{
    previous(shader);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vRegionalCrownDistance;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRegionalCrownDistance=distance(cameraPosition,(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vRegionalCrownDistance;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.a*=1.0-smoothstep(185.,240.,vRegionalCrownDistance);if(diffuseColor.a<.002)discard;');
  };
  material.customProgramCacheKey=()=>cache()+'-crown-distance-v1';
}

/** One state per visual root. Host/weather owner updates it; no global clock or timer. */
export function landscapeWindState(root){return root.userData.asfaltoLandscapeWind ||= {timeS:0,directionXZ:[.82,.57],speedMps:2,gust:0,wetness:0,snow:0};}
export function updateLandscapeWind(root,state={}){
  if(!root?.userData)return;
  const live=landscapeWindState(root);
  if(Number.isFinite(state.timeS))live.timeS=Math.max(0,state.timeS);
  const d=state.directionXZ;if(Array.isArray(d)&&d.length===2&&d.every(Number.isFinite)&&Math.hypot(...d)>.0001){const length=Math.hypot(...d);live.directionXZ=[d[0]/length,d[1]/length];}
  for(const key of ['speedMps','gust','wetness','snow'])if(Number.isFinite(state[key]))live[key]=clamp(state[key],0,key==='speedMps'?32:1);
}
export function applyFoliageWind(THREE,material,root,{heightM=16,flex=.7}={}){
  const state=landscapeWindState(root),previous=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey.bind(material);
  const uniforms={landscapeWindTime:{value:0},landscapeWindDirection:{value:new THREE.Vector2(.82,.57)},landscapeWindStrength:{value:0},landscapeSnow:{value:0}};
  material.userData.asfaltoFoliageUniforms=uniforms;
  material.userData.asfaltoFoliageUpdate=()=>{uniforms.landscapeWindTime.value=state.timeS;uniforms.landscapeWindDirection.value.fromArray(state.directionXZ);uniforms.landscapeWindStrength.value=Math.min(1.6,state.speedMps*.052+state.gust*.3);uniforms.landscapeSnow.value=state.snow;};
  material.onBeforeCompile=shader=>{
    previous(shader);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float landscapeWindTime; uniform vec2 landscapeWindDirection; uniform float landscapeWindStrength;
varying float vCanopyUp;`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 rootPosition=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
float treeHeight=length(instanceMatrix[1].xyz)*${heightM.toFixed(1)};
float exposure=.42+.58*(.5+.5*sin(dot(rootPosition.xz,vec2(.021,.033))));
float delayedGust=sin(landscapeWindTime*1.05-dot(rootPosition.xz,landscapeWindDirection)*.022);
float limb=pow(clamp(position.y/${heightM.toFixed(1)},0.0,1.0),2.0);
float sway=(delayedGust*.7+sin(landscapeWindTime*2.3+rootPosition.x*.031+position.y)*.19)*landscapeWindStrength*exposure*${flex.toFixed(2)}*clamp(18.0/treeHeight,.45,1.6)*limb;
transformed.xz+=landscapeWindDirection*sway;
vCanopyUp=max(0.0,normal.y);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float landscapeSnow; varying float vCanopyUp;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.68,.73,.74),landscapeSnow*smoothstep(.3,.88,vCanopyUp)*.68);');
  };
  material.customProgramCacheKey=()=>cache()+'-regional-wind-v1-'+heightM+'-'+flex;
}

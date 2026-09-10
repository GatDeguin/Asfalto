// Route-coordinate microdetail; road and collision positions remain unchanged.
export function improveRegionalRoadMaterials(THREE,root,{query,id}){
  if(!query?.project)return {roadMaterials:0,markingMaterials:0};
  root.updateMatrixWorld(true);const seen=new Set(),point=new THREE.Vector3();let roadMaterials=0,markingMaterials=0;
  root.traverse(mesh=>{
    if(!mesh.isMesh||/^COLLISION_|SOURCE_OWNER/.test(mesh.name)||!mesh.geometry?.attributes.position)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    // Paint is shared with guardrails/signs in Lipan's GLB. Only marking ribbons
    // get a route-space width mask; their authored positions remain untouched.
    if(id==='cuesta_lipan'&&/MARKING_(CENTER|EDGE_)/.test(mesh.name)){
      for(let i=0;i<materials.length;i++)if(materials[i]?.name==='V2_PAINT_PBR'){
        const source=materials[i],m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;
        m.name=/MARKING_CENTER/.test(mesh.name)?'V2_ROAD_MARKING_CENTER':'V2_ROAD_MARKING_EDGE';m.color.set('#c9c8ba');m.metalness=0;m.roughness=.91;m.envMapIntensity=.16;m.userData.asfaltoMetricRoadMarking=/CENTER/.test(m.name)?'center':'edge';
        materials[i]=m;
      }
      mesh.material=Array.isArray(mesh.material)?materials:materials[0];
    }
    if(!materials.some(m=>/ASPHALT|Asphalt_Wet|MAT_P1_ROAD|RoadPatch|ROAD_MARK|MARKING|Road_Marking|M_RoadLine|MAT_P1_MARK|SHOULDER|Shoulder_Gravel|MAT_P1_GRAVEL/.test(m?.name||'')))return;
    const positions=mesh.geometry.attributes.position,coordinates=new Float32Array(positions.count*2),halfWidths=new Float32Array(positions.count);let hint;
    for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);const projected=query.project(point.toArray());hint=projected.segmentIndex;coordinates[i*2]=projected.sM;coordinates[i*2+1]=projected.lateralM;halfWidths[i]=projected.widthM*.5;}
    mesh.geometry.setAttribute('asfaltoRoadCoordinates',new THREE.BufferAttribute(coordinates,2));mesh.geometry.setAttribute('asfaltoRoadHalfWidth',new THREE.BufferAttribute(halfWidths,1));
    for(const material of materials){if(!material||seen.has(material))continue;seen.add(material);const marking=/MARK|Line/.test(material.name),metricMarking=material.userData.asfaltoMetricRoadMarking,shoulder=/SHOULDER|Shoulder_Gravel|MAT_P1_GRAVEL/.test(material.name),previous=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey.bind(material);
      material.onBeforeCompile=shader=>{
        previous(shader);
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 asfaltoRoadCoordinates; attribute float asfaltoRoadHalfWidth; varying float vRegionalRoadHalfWidth; varying vec2 vRegionalRoad;');
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRegionalRoad=asfaltoRoadCoordinates;vRegionalRoadHalfWidth=asfaltoRoadHalfWidth;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec2 vRegionalRoad;
varying float vRegionalRoadHalfWidth;
float regionalRoadHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float regionalRoadNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(regionalRoadHash(i),regionalRoadHash(i+vec2(1.,0.)),f.x),mix(regionalRoadHash(i+vec2(0.,1.)),regionalRoadHash(i+vec2(1.)),f.x),f.y);}`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float roadStation=vRegionalRoad.x,roadLateral=vRegionalRoad.y;
${metricMarking?`float regionalMarkingDistance=${metricMarking==='center'?'abs(roadLateral)':'abs(abs(roadLateral)-max(0.,vRegionalRoadHalfWidth-.16))'};
if(regionalMarkingDistance>.12)discard;`:''}
float aggregate=regionalRoadNoise(vec2(roadStation,roadLateral)*19.0);
float section=regionalRoadNoise(vec2(roadStation*.023,2.0));
${shoulder?`
float edgeDistance=max(0.0,abs(roadLateral)-vRegionalRoadHalfWidth);
float soilPockets=regionalRoadNoise(vec2(roadStation*.14,roadLateral*.37));
float edgeBlend=smoothstep(.32+soilPockets*.65,1.75+soilPockets*1.4,edgeDistance);
vec3 soilTint=${id==='dos_lagos'||id==='paso_garibaldi'?'vec3(.51,.55,.40)':'vec3(.64,.57,.47)'};
diffuseColor.rgb*=mix(vec3(1.0),soilTint,edgeBlend*.7)*mix(.8,1.03,soilPockets);
`:marking?`float chips=smoothstep(.55,.85,regionalRoadNoise(vec2(roadStation*8.0,roadLateral*28.0)));
float turnWear=.5+.5*sin(roadStation*.028);diffuseColor.rgb*=1.0-chips*(.13+turnWear*.14);`:`
float cell=floor(roadStation/27.0),repairCentre=regionalRoadHash(vec2(cell,4.1))*4.4-2.2;
float patchLength=3.2+regionalRoadHash(vec2(cell,7.2))*5.7;
float repair=(1.0-smoothstep(patchLength,patchLength+.14,mod(roadStation,27.0)))*(1.0-smoothstep(.8,1.02,abs(roadLateral-repairCentre)))*step(.65,regionalRoadHash(vec2(cell,6.8)));
float joint=1.0-smoothstep(.012,.029,abs(sin(roadStation*.151+sin(roadLateral*8.)*.013)));
diffuseColor.rgb*=mix(.965,1.035,aggregate)*mix(.91,1.05,section)*(1.0-repair*.105-joint*.1);
`}`);
        if(!marking&&!shoulder)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
float laneRatio=abs(vRegionalRoad.y)/max(2.,vRegionalRoadHalfWidth);
float wheelDistance=min(abs(laneRatio-.25),abs(laneRatio-.73))*vRegionalRoadHalfWidth;
float wheelPolish=(1.-smoothstep(.13,.34,wheelDistance))*(.55+.45*regionalRoadNoise(vec2(vRegionalRoad.x*.041,8.)));
float marginDust=smoothstep(.80,.98,laneRatio)*regionalRoadNoise(vec2(vRegionalRoad.x*.13,vRegionalRoad.y*.7));
roughnessFactor=clamp(roughnessFactor*(1.-wheelPolish*.025)+marginDust*.012,.04,1.);
diffuseColor.rgb*=1.-wheelPolish*.015;
`);
      };
      material.customProgramCacheKey=()=>cache()+'-regional-road-v7-metric-markings-'+marking+'-'+shoulder+'-'+(metricMarking||'none');
      material.needsUpdate=true;material.userData.asfaltoRoadWear={regional:true,id,marking,physicalDeltaM:0};
      if(marking)markingMaterials++;else roadMaterials++;
    }
  });return {roadMaterials,markingMaterials};
}

// A feathered surface over the outer shoulder/soil junction. All geometry is
// outside the asphalt; steep cuts, water and hairpin crossings are excluded.
export function addTerrainShoulderTransition(THREE,root,{query,lengthM,heightAt,material,stepM=16,embankment=false}){
  if(!query?.sample||!heightAt||!material)return null;
  const offsets=[1.65,2.15,3.2,5.4,8.6],alpha=[0,.38,.65,.36,0];
  const positions=[],colors=[],indices=[];let previous=[null,null],acceptedRows=0;
  for(let s=0;s<=lengthM;s+=stepM){
    const sample=query.sample(Math.min(s,lengthM));
    for(let sideIndex=0;sideIndex<2;sideIndex++){
      const side=sideIndex?1:-1,row=[];let valid=true;
      for(let i=0;i<offsets.length;i++){
        const lateral=side*(sample.widthM/2+offsets[i]),x=sample.position[0]+sample.frame.left[0]*lateral,z=sample.position[2]+sample.frame.left[2]*lateral;
        const y=heightAt(x,z),roadY=sample.position[1]+sample.frame.left[1]*lateral;
        if(!Number.isFinite(y)||y-roadY>1.4||roadY-y>(embankment?3.2:1.4)){valid=false;break;}
        const t=Math.max(0,Math.min(1,(offsets[i]-2.15)/(offsets.at(-1)-2.15)));
        const elevation=embankment&&y<roadY?roadY+(y-roadY)*t*t*(3-2*t):Math.max(y,roadY);
        row.push([x,elevation+.023,z]);
      }
      if(valid&&query.project)for(const point of [row[0],row.at(-1)]){
        const q=query.project(point);
        if(q.distanceXZ<=q.widthM/2+1.4||Number.isFinite(q.sM)&&Math.abs(q.sM-s)>stepM*3){valid=false;break;}
      }
      if(!valid){previous[sideIndex]=null;continue;}
      const ids=[];for(let i=0;i<row.length;i++){ids.push(positions.length/3);positions.push(...row[i]);colors.push(1,1,1,alpha[i]);}
      const last=previous[sideIndex];if(last)for(let i=0;i<ids.length-1;i++)indices.push(last[i],ids[i],ids[i+1],last[i],ids[i+1],last[i+1]);
      previous[sideIndex]=ids;acceptedRows++;
    }
  }
  if(!indices.length){material.dispose();return{triangles:0,acceptedRows:0};}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='ASFALTO_TERRAIN_SHOULDER_TRANSITION';mesh.receiveShadow=true;mesh.castShadow=false;
  root.updateMatrixWorld(true);mesh.matrix.copy(root.matrixWorld).invert();mesh.matrixAutoUpdate=false;root.add(mesh);
  return{triangles:indices.length/3,acceptedRows};
}

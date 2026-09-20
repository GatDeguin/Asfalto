// Opaque, terrain-rooted gravel headland with all free edges below the actual lake level.
export function buildShorePromontory(T,{center,tangent,landNormal,waterLevelM,heightAt,lengthM=60,extensionM=18}){
 const positions=[],uv=[],index=[],cols=16,rows=8;
 for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
  const u=col/cols,v=row/rows,along=(u-.5)*lengthM,shape=Math.sin(u*Math.PI)**1.35,extension=extensionM*(.72+.28*Math.cos((u-.36)*Math.PI)),across=-extension+(extension+12)*v;
  const x=center[0]+tangent[0]*along+landNormal[0]*across,z=center[2]+tangent[2]*along+landNormal[2]*across,ground=heightAt(x,z);if(!Number.isFinite(ground))return null;
  const fill=waterLevelM-1.4+Math.sin(v*Math.PI)**1.2*shape*2.5;
  let y=Math.max(ground+.028,fill);if(row===0)y=Math.min(y,waterLevelM-1.05);if(row===rows||col===0||col===cols)y=ground+.028;
  positions.push(x,y,z);uv.push(along/4,across/4);
  if(row&&col){const a=(row-1)*(cols+1)+col-1,b=a+1,c=row*(cols+1)+col-1,d=c+1;index.push(a,c,d,a,d,b);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();let n=0;for(let i=0;i<g.attributes.normal.count;i++)n+=g.attributes.normal.getY(i);
 if(n<0){for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];g.setIndex(index);g.computeVertexNormals();}g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function shorelineFromGeometry(T,geometry,level){
 const p=geometry.attributes.position,index=geometry.index,segments=[];for(let i=0;i<index.count;i+=3){const points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,index.getX(i+j))),hits=[];
  for(let k=0;k<3;k++){const a=points[k],b=points[(k+1)%3];if((a.y-level)*(b.y-level)<0)hits.push(a.clone().lerp(b,(level-a.y)/(b.y-a.y)).toArray());}if(hits.length===2)segments.push({a:hits[0],b:hits[1]});
 }return segments;
}

/** CPU geometry operations for a direct seam. Never mutates a source attribute. */
const mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
/** Clip triangles against an interpolated scalar field. UV, color and all supplied attributes follow the exact cut. */
export function clipTrianglePayload(payload,scalarAt,{min=-Infinity,max=Infinity}={}){
 const attrs=payload?.attributes,position=attrs?.position;if(!position||position.itemSize!==3||typeof scalarAt!=='function'||Number.isNaN(min)||Number.isNaN(max)||min>max)throw new TypeError('Valid triangle attributes and scalar bounds required');
 const count=position.array.length/3,index=payload.indices||Uint32Array.from({length:count},(_,i)=>i),fields=new Float64Array(count),vertices=new Array(count),keys=Object.keys(attrs);
 if(index.length%3)throw new TypeError('Triangle index count must be divisible by three');
 for(const key of keys)if(!(attrs[key].itemSize>0)||attrs[key].array.length!==count*attrs[key].itemSize)throw new TypeError('Attribute lengths must agree');
 const decode=(value,attribute)=>{if(!attribute.normalized)return value;switch(attribute.array.constructor.name){case 'Uint8Array':case 'Uint8ClampedArray':return value/255;case 'Uint16Array':return value/65535;case 'Uint32Array':return value/4294967295;case 'Int8Array':return Math.max(-1,value/127);case 'Int16Array':return Math.max(-1,value/32767);case 'Int32Array':return Math.max(-1,value/2147483647);default:return value;}};
 for(let i=0;i<count;i++){const data={};for(const key of keys){const a=attrs[key];data[key]=Array.from(a.array.subarray(i*a.itemSize,(i+1)*a.itemSize),v=>decode(v,a));}if(!data.position.every(Number.isFinite))throw new TypeError('Clipping positions must be finite');fields[i]=scalarAt(data.position,i);if(!Number.isFinite(fields[i]))throw new TypeError('Clipping scalar must be finite');vertices[i]={field:fields[i],data};}
 const interpolate=(a,b,u)=>({field:a.field+(b.field-a.field)*u,data:Object.fromEntries(keys.map(key=>[key,mix(a.data[key],b.data[key],u)]))});
 const clip=(polygon,bound,sign)=>{if(!Number.isFinite(bound))return polygon;const out=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=sign*(a.field-bound)>=-1e-10,insideB=sign*(b.field-bound)>=-1e-10;if(insideA)out.push(a);if(insideA!==insideB){const u=(bound-a.field)/(b.field-a.field);out.push(interpolate(a,b,u));}}return out;};
 const arrays=Object.fromEntries(keys.map(key=>[key,[]])),indices=[],groups=[],sourceGroups=payload.groups?.length?payload.groups:[{start:0,count:index.length,materialIndex:0}];let vertexCount=0;
 for(const group of sourceGroups){if(group.start%3||group.count%3)throw new TypeError('Material groups must contain complete triangles');const start=indices.length;
  for(let i=group.start;i<Math.min(index.length,group.start+group.count);i+=3){let poly=[vertices[index[i]],vertices[index[i+1]],vertices[index[i+2]]];if(poly.some(x=>!x))throw new TypeError('Triangle index out of range');poly=clip(clip(poly,min,1),max,-1);if(poly.length<3)continue;
   for(let j=1;j+1<poly.length;j++){const triangle=[poly[0],poly[j],poly[j+1]],ab=sub(triangle[1].data.position,triangle[0].data.position),ac=sub(triangle[2].data.position,triangle[0].data.position),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...cross)<1e-12)continue;
    for(const vertex of triangle){for(const key of keys){let a=vertex.data[key];if(key==='normal'){const n=Math.hypot(...a);if(n>1e-12)a=a.map(v=>v/n);}arrays[key].push(...a);}indices.push(vertexCount++);}
   }
  }if(indices.length>start)groups.push({...group,start,count:indices.length-start});
 }
 return{attributes:Object.fromEntries(keys.map(key=>[key,{...attrs[key],normalized:false,array:new Float32Array(arrays[key])}])),indices:new Uint32Array(indices),groups,sourceTriangles:index.length/3,triangles:indices.length/3};
}
/** Correct the first 80 m, decaying through a real lateral collar. Source road edges map exactly to the seam edges. */
export function deformSeamPoint(seam,point,{sM,collarWidthM=120}={}){
 if(!Number.isFinite(sM)||!point?.every(Number.isFinite)||!(collarWidthM>0))throw new TypeError('Finite station, point and collar width required');
 if(sM>=seam.prefixM||sM<0)return[...point];const source=seam.sampleSource(sM),target=seam.sampleLocal(sM),relative=sub(point,source.position),lateral=dot(relative,source.left),vertical=dot(relative,source.normal),forward=dot(relative,source.tangent),weight=1-smooth((Math.abs(lateral)-source.widthM/2)/collarWidthM),widthRatio=target.widthM/source.widthM;
 const mapped=target.position.map((v,i)=>v+target.left[i]*lateral*widthRatio+target.normal[i]*vertical+target.tangent[i]*forward);return mix(point,mapped,weight);
}
/** A finite terrain strip joins two source cross-sections, with no skirt or vertical wall. Its explicit outer boundary is used to cut source terrain. */
export function buildSeamTerrainCollar(seam,{beforeM=100,afterM=120,outerM=180,lateralSegments=16,stepM=2,shoulderM=2,heightAt,referenceChart=0}={}){
 if(![beforeM,afterM,outerM,stepM,shoulderM].every(Number.isFinite)||beforeM<=0||afterM<=0||beforeM+afterM>1200||outerM<20||stepM<=0||shoulderM<0||!Number.isInteger(lateralSegments)||lateralSegments<2||lateralSegments>128||typeof heightAt!=='function')throw new TypeError('Finite bounded terrain collar and source height sampler required');
 const fromM=seam.lengthM-beforeM,toM=seam.lengthM+afterM,rows=Math.ceil((toM-fromM)/stepM)+1,columns=lateralSegments+1,positions=new Float32Array(rows*columns*2*3),uv=new Float32Array(rows*columns*2*2),stations=new Float64Array(rows),indices=[],sides=[],outerBoundaries=[],sourceAnchors=[];
 const anchors=[seam.sampleContinuous(fromM,referenceChart),seam.sampleContinuous(toM,referenceChart)];let missingHeightSamples=0;
 function terrainHeight(sample,offset){const p=sample.position.map((v,i)=>v+sample.left[i]*offset),inverse=seam.chartTransform(referenceChart-sample.lap),source=inverse.point(p),y=heightAt(source[0],source[2]);if(!Number.isFinite(y)){missingHeightSamples++;throw new Error('Missing source terrain height at seam collar anchor');}return seam.chartTransform(sample.lap-referenceChart).point([source[0],y,source[2]])[1];}
 for(const [sideIndex,sign]of [-1,1].entries()){
  const vertexOffset=sideIndex*rows*columns,outer=[];sides.push({sign,vertexOffset});const profiles=anchors.map(a=>Array.from({length:columns},(_,j)=>{const u=j/lateralSegments,offset=sign*(a.widthM/2+shoulderM+outerM*u),edgeY=a.position[1]+a.left[1]*sign*(a.widthM/2+shoulderM),raw=terrainHeight(a,offset);return(edgeY-a.position[1])*(1-smooth(u))+(raw-a.position[1])*smooth(u);}));sourceAnchors.push({sign,heights:profiles});
  for(let row=0;row<rows;row++){const progress=fromM+(toM-fromM)*row/(rows-1),sample=seam.sampleContinuous(progress,referenceChart),blend=smooth(row/(rows-1));stations[row]=progress;
   for(let col=0;col<columns;col++){const u=col/lateralSegments,offset=sign*(sample.widthM/2+shoulderM+outerM*u),p=sample.position.map((v,i)=>v+sample.left[i]*offset),edgeRelative=sample.left[1]*sign*(sample.widthM/2+shoulderM),profile=profiles[0][col]+(profiles[1][col]-profiles[0][col])*blend;p[1]=sample.position[1]+edgeRelative*(1-smooth(u))+profile*smooth(u);if(col===0)p[1]=sample.position[1]+edgeRelative;
    const index=vertexOffset+row*columns+col;positions.set(p,index*3);uv.set([offset,progress-fromM],index*2);if(col===columns-1)outer.push(p);
    if(row<rows-1&&col<columns-1){const a=index,b=index+1,c=index+columns,d=c+1;indices.push(...(sign>0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
   }
  }outerBoundaries.push({sign,points:outer});
 }
 const typedIndices=new Uint32Array(indices);return{positions,indices:typedIndices,uv,stations,rows,columns,sides,outerBoundaries,sourceAnchors,range:{fromM,toM,referenceChart},collision:{positions,indices:typedIndices},diagnostics:{missingHeightSamples,sourceHeightsRequired:true,verticalSkirts:false}};
}

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Pure metric fields: no scene, texture or physics ownership crosses the worker. */
export function computeWaterField({segments,bounds,maxDepth,resolution=96,depthSamples=new Float64Array()}){
 if(!(segments instanceof Float64Array)||segments.length%6||!(depthSamples instanceof Float64Array)||depthSamples.length%4||!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||!Number.isFinite(maxDepth)||maxDepth<=0||!Number.isInteger(resolution)||resolution<2||resolution>512)throw new TypeError('Invalid hydrology field input');
 const data=new Float32Array(resolution*resolution*4),step=Math.max(1,Math.ceil(segments.length/6/2048));
 for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  const wx=bounds[0]+bounds[2]*x/(resolution-1),wz=bounds[1]+bounds[3]*y/(resolution-1);let shore=Infinity;
  for(let e=0;e<segments.length;e+=step*6){const dx=segments[e+3]-segments[e],dz=segments[e+5]-segments[e+2],t=clamp(((wx-segments[e])*dx+(wz-segments[e+2])*dz)/(dx*dx+dz*dz||1),0,1);shore=Math.min(shore,Math.hypot(wx-segments[e]-dx*t,wz-segments[e+2]-dz*t));}
  if(!Number.isFinite(shore))shore=maxDepth/.22;
  let depth=clamp(shore*.22+.06,0,maxDepth);
  if(depthSamples.length){let numerator=0,denominator=0;for(let i=0;i<depthSamples.length;i+=4){const d=Math.hypot(wx-depthSamples[i],wz-depthSamples[i+2]),weight=1/Math.max(.2,d*d);numerator+=Math.max(0,depthSamples[i+3])*weight;denominator+=weight;}depth=numerator/denominator;}
  const offset=(y*resolution+x)*4;data[offset]=depth;data[offset+1]=shore;data[offset+2]=0;data[offset+3]=1;
 }
 return data;
}
export function computeRoadField({positions}){
 if(!(positions instanceof Float64Array)||positions.length%3)throw new TypeError('Invalid drainage positions');
 const values=new Float32Array(positions.length/3*2),grid=new Map(),cell=3;
 for(let i=0;i<positions.length;i+=3){const key=Math.floor(positions[i]/cell)+','+Math.floor(positions[i+2]/cell),g=grid.get(key)||{sum:0,count:0};g.sum+=positions[i+1];g.count++;grid.set(key,g);}
 for(let i=0;i<positions.length;i+=3){const cx=Math.floor(positions[i]/cell),cz=Math.floor(positions[i+2]/cell);let min=Infinity,max=-Infinity;
  for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){const g=grid.get((cx+x)+','+(cz+z));if(g){const h=g.sum/g.count;min=Math.min(min,h);max=Math.max(max,h);}}
  const local=grid.get(cx+','+cz),localHeight=local.sum/local.count;let curvature=0,pairs=0;
  for(const [x,z]of [[1,0],[0,1],[1,1],[1,-1]]){const a=grid.get((cx+x)+','+(cz+z)),b=grid.get((cx-x)+','+(cz-z));if(a&&b){curvature+=(a.sum/a.count+b.sum/b.count)*.5-localHeight;pairs++;}}
  const bowl=pairs?Math.max(0,curvature/pairs):0;values[i/3*2]=clamp(bowl,0,.035);values[i/3*2+1]=clamp((max-min)/(cell*2),0,1);
 }
 return values;
}

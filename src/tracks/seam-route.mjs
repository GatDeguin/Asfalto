/** Direct seam geometry and reference charts. Source route data remains unchanged. */
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,n)=>a.map(v=>v*n);
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),norm=a=>{const n=Math.hypot(...a);return n>1e-12?scale(a,1/n):[0,0,0];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mix=(a,b,u)=>add(scale(a,1-u),scale(b,u));
function frame(t,l){const tangent=norm(t),left=norm(sub(l,scale(tangent,dot(l,tangent))));return{tangent,left,normal:norm(cross(left,tangent))};}
function multiplyQuaternion(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return[w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];}
function transform(yaw,translation){
 const c=Math.cos(yaw),s=Math.sin(yaw),q=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];
 const vector=v=>[c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]],point=p=>add(vector(p),translation);
 return Object.freeze({yawRadians:yaw,translation:Object.freeze([...translation]),quaternion:Object.freeze(q),point,vector,rotation:orientation=>multiplyQuaternion(q,orientation),matrix:[c,0,-s,0,0,1,0,0,s,0,c,0,...translation,1]});
}
function inverse(t){const rotation=transform(-t.yawRadians,[0,0,0]);return transform(-t.yawRadians,scale(rotation.vector(t.translation),-1));}
function compose(a,b){return transform(a.yawRadians+b.yawRadians,a.point(b.translation));}
function power(t,n){
 if(!Number.isSafeInteger(n))throw new TypeError('Chart number must be a safe integer');
 let x=n<0?inverse(t):t,result=transform(0,[0,0,0]),k=Math.abs(n);
 while(k>0){if(k%2===1)result=compose(result,x);k=Math.floor(k/2);if(k)x=compose(x,x);}
 return result;
}
function segmentAt(samples,s){let low=0,high=samples.length-1;while(low+1<high){const mid=(low+high)>>>1;if(samples[mid].sM<=s)low=mid;else high=mid;}return Math.min(low,samples.length-2);}
function ribbonSample(source,s){
 const i=segmentAt(source.samples,s),a=source.samples[i],b=source.samples[i+1],u=Math.max(0,Math.min(1,(s-a.sM)/(b.sM-a.sM)));
 const position=mix(a.position,b.position,u),f=frame(mix(a.tangent,b.tangent,u),mix(a.left,b.left,u)),widthM=a.widthM+(b.widthM-a.widthM)*u,edgeOffset=scale(f.left,widthM/2);
 return {...a,sM:s,position,...f,widthM,edgeOffset,leftEdge:add(position,edgeOffset),rightEdge:sub(position,edgeOffset)};
}
function applySample(sample,t){return{...sample,position:t.point(sample.position),leftEdge:t.point(sample.leftEdge),rightEdge:t.point(sample.rightEdge),edgeOffset:t.vector(sample.edgeOffset),tangent:t.vector(sample.tangent),left:t.vector(sample.left),normal:t.vector(sample.normal)};}
/** Preserves fixed gravity. referenceChart is an origin index, never a lap counter reset. */
export function createSeamLoop(source,{prefixM=80}={}){
 if(!Array.isArray(source?.samples)||source.samples.length<2)throw new TypeError('Route samples are required');
 const L=source.lengthM;
 if(!(Number.isFinite(L)&&L>0)||source.samples[0].sM!==0||source.samples.at(-1).sM!==L)throw new TypeError('Route samples must span the original length');
 if(!(Number.isFinite(prefixM)&&prefixM>0&&prefixM<L/2))throw new TypeError('Prefix must be positive and shorter than half the source');
 for(let i=0;i<source.samples.length;i++){const s=source.samples[i];if(i&&!(s.sM>source.samples[i-1].sM))throw new TypeError('Route samples must be ordered');for(const k of ['position','tangent','left','normal'])if(!Array.isArray(s[k])||s[k].length!==3||!s[k].every(Number.isFinite))throw new TypeError('Route samples must contain finite frames');if(!(s.widthM>0))throw new TypeError('Route samples must have positive widths');}
 const sampleSource=s=>ribbonSample(source,Math.max(0,Math.min(L,s))),start=sampleSource(0),end=sampleSource(L),heading=v=>Math.atan2(v[0],v[2]);
 const yaw=heading(end.tangent)-heading(start.tangent),rotation=transform(yaw,[0,0,0]);
 const forward=transform(yaw,sub(end.position,rotation.vector(start.position))),backward=inverse(forward);
 // Match the actual polygonal center and edge derivatives, rather than trusting metadata tangents.
 const h=.0001,startNext=sampleSource(h),endPrevious=sampleSource(L-h);
 const startDerivative=scale(sub(startNext.position,start.position),1/h),endDerivative=scale(sub(end.position,endPrevious.position),1/h);
 const startEdgeDerivative=scale(sub(startNext.edgeOffset,start.edgeOffset),1/h),endEdgeDerivative=scale(sub(end.edgeOffset,endPrevious.edgeOffset),1/h);
 const centerDerivativeDelta=sub(backward.vector(endDerivative),startDerivative);
 const edgeValueDelta=sub(backward.vector(end.edgeOffset),start.edgeOffset),edgeDerivativeDelta=sub(backward.vector(endEdgeDerivative),startEdgeDerivative);
 const tangentDelta=sub(backward.vector(end.tangent),start.tangent);
 function sampleLocal(s){
  const original=sampleSource(s);if(s>=prefixM)return original;
  const u=Math.max(0,s)/prefixM,h00=1-3*u*u+2*u*u*u,h10=s*(1-u)*(1-u);
  const position=add(original.position,scale(centerDerivativeDelta,h10));
  const edgeOffset=add(original.edgeOffset,add(scale(edgeValueDelta,h00),scale(edgeDerivativeDelta,h10)));
  const left=norm(edgeOffset),rawTangent=add(original.tangent,scale(tangentDelta,h00));
  // Keep the physical cross-section exact; remove its tiny component from the declared forward axis.
  const tangent=norm(sub(rawTangent,scale(left,dot(rawTangent,left)))),normal=norm(cross(left,tangent));
  return{...original,position,edgeOffset,left,rightEdge:sub(position,edgeOffset),leftEdge:add(position,edgeOffset),tangent,normal,widthM:2*Math.hypot(...edgeOffset)};
 }
 function sampleContinuous(raceProgressM,referenceChart=0){
  if(!Number.isFinite(raceProgressM))throw new TypeError('Progress must be finite');
  const lap=Math.floor(raceProgressM/L),sM=raceProgressM-lap*L;
  const result=applySample(sampleLocal(sM),power(forward,lap-referenceChart));
  return{...result,lap,sM,raceProgressM,referenceChart};
 }
 return Object.freeze({id:source.id,lengthM:L,prefixM,topology:'seam_loop',sourceSpatiallyClosed:false,odometer:'original_source_sM',copyStartAtFinish:forward,rebaseToNext:backward,chartTransform:n=>power(forward,n),sampleSource,sampleLocal,sampleContinuous,diagnostics:Object.freeze({yawDegrees:yaw*180/Math.PI,centerDerivativeDelta,edgeValueDelta,edgeDerivativeDelta,maximumCenterOffsetM:4*prefixM*Math.hypot(...centerDerivativeDelta)/27})});
}
/** Explicit fields only: callers transform their own camera/contact caches using point/vector. */
export function rebaseKinematics(state,t){
 const result={...state};
 if(state.position)result.position=t.point(state.position);
 if(state.quaternion)result.quaternion=t.rotation(state.quaternion);
 for(const key of ['linearVelocity','angularVelocity','previousLinearVelocity','acceleration'])if(state[key])result[key]=t.vector(state[key]);
 return result;
}

/** One immutable mesh payload is passed to both renderer and collider builder. */
export function buildSeamStrip(seam,{fromM,toM,stepM=1,shoulderM=2,referenceChart=0}={}){
 if(![fromM,toM,stepM,shoulderM].every(Number.isFinite)||toM<=fromM||stepM<=0||shoulderM<0||toM-fromM>1200)throw new TypeError('A finite bounded seam strip of at most 1200 m is required');
 const intervals=Math.ceil((toM-fromM)/stepM),rows=intervals+1,positions=new Float32Array(rows*12),uv=new Float32Array(rows*8),stations=new Float64Array(rows),bands=[[],[],[]];
 for(let i=0;i<rows;i++){
  const progress=fromM+(toM-fromM)*i/intervals,s=seam.sampleContinuous(progress,referenceChart);stations[i]=progress;
  const offsets=[-s.widthM/2-shoulderM,-s.widthM/2,s.widthM/2,s.widthM/2+shoulderM];
  for(let j=0;j<4;j++){positions.set(add(s.position,scale(s.left,offsets[j])),i*12+j*3);uv.set([offsets[j],progress-fromM],i*8+j*2);}
  if(i===intervals)continue;
  for(let j=0;j<3;j++){const a=i*4+j,b=a+1,c=a+4,d=c+1;bands[j].push(a,b,c,b,d,c);}
 }
 const indices=new Uint32Array(bands.flat()),groups=[];let start=0;
 for(let i=0;i<3;i++){groups.push({start,count:bands[i].length,materialIndex:i===1?0:1,surface:i===1?'asphalt':'shoulder'});start+=bands[i].length;}
 return{positions,indices,uv,stations,groups,collision:{positions,indices,groups},range:{fromM,toM,referenceChart},rows,triangles:indices.length/3};
}

export {transform as createYawReferenceTransform};

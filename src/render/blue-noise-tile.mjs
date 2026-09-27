/** Deterministic 32x32 toroidal void-and-cluster rank tile (Ulichney method).
 * White noise only seeds the offline-style optimization; sampling uses the
 * optimized rank field, never a per-fragment hash. No external asset/license.
 */
export function createBlueNoiseRanks() {
 const size=32,count=size*size,sigma=1.5,occupied=new Uint8Array(count),density=new Float64Array(count),ranks=new Uint16Array(count),order=Uint16Array.from({length:count},(_,i)=>i);
 let seed=0x91e10da5;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 const kernel=[];
 for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++)kernel.push([x,y,Math.exp(-(x*x+y*y)/(2*sigma*sigma))]);
 function change(index,value){const delta=value-occupied[index];occupied[index]=value;const x=index%size,y=index/size|0;for(const [dx,dy,w]of kernel)density[((y+dy+size)%size)*size+(x+dx+size)%size]+=delta*w;}
 function choose(value,largest){let best=-1,score=largest?-Infinity:Infinity;for(const i of order)if(occupied[i]===value&&(largest?density[i]>score:density[i]<score)){score=density[i];best=i;}return best;}
 const initial=103;
 for(let i=0;i<initial;i++)change(order[i],1);
 for(let i=0;i<count*8;i++){const cluster=choose(1,true);change(cluster,0);const hole=choose(0,false);change(hole,1);if(hole===cluster)break;}
 const prototype=occupied.slice();
 for(let rank=initial-1;rank>=0;rank--){const i=choose(1,true);ranks[i]=rank;change(i,0);}
 for(let i=0;i<count;i++)if(prototype[i])change(i,1);
 for(let rank=initial;rank<count/2;rank++){const i=choose(0,false);ranks[i]=rank;change(i,1);}
 // Complement the half-full pattern; removing tight clusters ranks the upper
 // tail with the same blue-noise spacing as the lower tail.
 for(let i=0;i<count;i++)change(i,1-occupied[i]);
 for(let rank=count/2;rank<count;rank++){const i=choose(1,true);ranks[i]=rank;change(i,0);}
 return ranks;
}
export function createBlueNoiseTexture(T){
 const ranks=createBlueNoiseRanks(),data=Uint8Array.from(ranks,rank=>Math.floor(rank/4));
 const texture=new T.DataTexture(data,32,32,T.RedFormat,T.UnsignedByteType);
 texture.name='ASFALTO_BLUE_NOISE_VOID_CLUSTER_32';texture.colorSpace=T.NoColorSpace;
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.minFilter=texture.magFilter=T.NearestFilter;
 texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}

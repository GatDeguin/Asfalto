// Borrowed textures retain their owner, mip chain, color space and sampling mode.
// Multiple scenes can hold one texture: restore only after the last request ends.
const owners=new WeakMap();
const MAPS=['map','normalMap','roughnessMap','metalnessMap','aoMap','bumpMap','alphaMap','clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap','emissiveMap'];
function apply(entry){const value=Math.max(entry.original,...entry.requests.values());if(entry.texture.anisotropy!==value){entry.texture.anisotropy=value;entry.texture.needsUpdate=true;}}
export function createTextureFiltering(T,{root,renderer,quality='balanced'}={}){
 const token={},textures=new Map(),mipFilters=new Set([T.LinearMipmapLinearFilter,T.LinearMipmapNearestFilter,T.NearestMipmapLinearFilter,T.NearestMipmapNearestFilter]);
 let disposed=false;
 const maximum=Math.max(1,Math.min(8,renderer.capabilities?.getMaxAnisotropy?.()||1));
 function release(texture,entry){entry.requests.delete(token);apply(entry);if(!entry.requests.size)owners.delete(texture);textures.delete(texture);}
 function refresh(){
  if(disposed)return;const seen=new Set();
  if(quality==='cinematic')root.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!material)continue;for(const key of MAPS){const texture=material[key];
    if(!texture?.isTexture||texture.isRenderTargetTexture||texture.isVideoTexture||texture.isCubeTexture||!mipFilters.has(texture.minFilter)||!texture.generateMipmaps&&!(texture.mipmaps?.length>1))continue;
    seen.add(texture);let entry=owners.get(texture);if(!entry){entry={texture,original:texture.anisotropy,requests:new Map()};owners.set(texture,entry);}
    entry.requests.set(token,maximum);textures.set(texture,entry);apply(entry);
   }
  }});
  for(const [texture,entry]of textures)if(!seen.has(texture))release(texture,entry);
 }
 function setQuality(value){if(disposed||quality===value)return;quality=value;refresh();}
 function dispose(){if(disposed)return;disposed=true;for(const [texture,entry]of textures)release(texture,entry);}
 refresh();return{refresh,setQuality,dispose,diagnostics:()=>({quality,maximumAnisotropy:maximum,borrowedTextures:textures.size,ownedTextures:0,disposed})};
}

/** Orientation-stable phone budgets. Desktop quality and source assets keep their existing policy. */
export function detectDeviceProfile({userAgent=globalThis.navigator?.userAgent||'',maxTouchPoints=globalThis.navigator?.maxTouchPoints||0,coarsePointer=globalThis.matchMedia?.('(pointer: coarse)')?.matches===true,screenWidth=globalThis.screen?.width||0,screenHeight=globalThis.screen?.height||0}={}){
 const touch=maxTouchPoints>0||coarsePointer,shortSide=Math.min(Number(screenWidth)||Infinity,Number(screenHeight)||Infinity);
 const phone=touch&&(/iPhone|iPod|Android.*Mobile/i.test(userAgent)||(coarsePointer&&shortSide<=540));
 return Object.freeze({phone});
}
export function deviceGraphicsQuality(quality,profile=detectDeviceProfile()){return profile.phone&&quality==='auto'?'balanced':quality;}
export function devicePixelRatioLimit({quality='auto',width=1024,memory,profile=detectDeviceProfile()}={}){
 if(profile.phone)return quality==='eco'?1:quality==='balanced'?1.15:quality==='high'?1.45:1.25;
 if(quality==='eco')return 1;if(quality==='balanced')return width<700?1.15:1.45;if(quality==='high')return width<700?1.45:1.9;
 if(memory&&memory<=4)return width<700?1:1.25;return width<700?1.25:1.65;
}
export function automaticTextureLimit({memory,profile=detectDeviceProfile()}={}){return profile.phone?1536:memory>0&&memory<=4?1024:2048;}

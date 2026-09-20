
(function(root){
'use strict';
const skyIds=Object.freeze(['clear','overcast','golden','sunset','moonrise','night']);
const defaults=()=>({camera:{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},lens:28},chevy:{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},sky:{id:'clear',rotation:0,intensity:1,exposure:0}});
const clamp=(value,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):fallback));
const vec=(input,base,min,max)=>({x:clamp(input?.x,min,max,base.x),y:clamp(input?.y,min,max,base.y),z:clamp(input?.z,min,max,base.z)});
const normalize=input=>{const base=defaults(),source=input||{};return{camera:{position:vec(source.camera?.position,base.camera.position,-20,20),rotation:vec(source.camera?.rotation,base.camera.rotation,-180,180),lens:clamp(source.camera?.lens,12,200,base.camera.lens)},chevy:{position:vec(source.chevy?.position,base.chevy.position,-10,10),rotation:vec(source.chevy?.rotation,base.chevy.rotation,-180,180),scale:vec(source.chevy?.scale,base.chevy.scale,.1,3)},sky:{id:skyIds.includes(source.sky?.id)?source.sky.id:base.sky.id,rotation:((clamp(source.sky?.rotation,-3600,3600,base.sky.rotation)%360)+360)%360,intensity:clamp(source.sky?.intensity,0,2,base.sky.intensity),exposure:clamp(source.sky?.exposure,-4,4,base.sky.exposure)}}};
const clone=value=>JSON.parse(JSON.stringify(value));
function create(initial){let value=normalize(initial);const patchSection=(section,patch)=>{const merged={...value[section],...patch};for(const key of ['position','rotation','scale'])if(value[section][key])merged[key]={...value[section][key],...(patch?.[key]||{})};value={...value,[section]:normalize({[section]:merged})[section]};return clone(value[section])};return Object.freeze({snapshot:()=>clone(value),updateCamera:patch=>patchSection('camera',patch),updateChevy:patch=>patchSection('chevy',patch),updateSky:patch=>patchSection('sky',patch),reset:section=>{if(['camera','chevy','sky'].includes(section))value={...value,[section]:defaults()[section]};else value=defaults();return clone(value)}})}
root.AsfaltoV3WorkshopEditorState=Object.freeze({skyIds,create});
})(globalThis);

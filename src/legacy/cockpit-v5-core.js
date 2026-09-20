
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CockpitV5Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION='5.0.0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const lerp=(a,b,t)=>a+(b-a)*t;

function formatTime(seconds,empty='—'){
  if(!Number.isFinite(seconds))return empty;
  const value=Math.max(0,seconds),minutes=Math.floor(value/60),secs=Math.floor(value%60),millis=Math.floor((value%1)*1000+1e-7);
  return `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(millis).padStart(3,'0')}`;
}
function formatDelta(seconds,empty='±0.000'){
  if(!Number.isFinite(seconds))return empty;
  const sign=seconds>0?'+':seconds<0?'-':'±';
  return `${sign}${Math.abs(seconds).toFixed(3)}`;
}
function normalizeConfig(config={}){
  const a=config.assists||{};
  return {
    track:'dos_lagos',mode:String(config.mode||'timeTrial'),weather:String(config.weather||'clear'),timeOfDay:String(config.timeOfDay||'day'),
    difficulty:Math.round(clamp(config.difficulty??.62,0,1)*100),
    assists:{steering:a.steering!==false,abs:a.abs!==false,tcs:a.tcs!==false,stability:a.stability!==false},
    physics:String(config.physics||'racecore-v5')
  };
}
function recordKey(config={}){
  const c=normalizeConfig(config),a=c.assists;
  return `cockpit-record-v5:${c.track}:${c.mode}:${c.weather}:${c.timeOfDay}:${c.difficulty}:${a.steering?1:0}${a.abs?1:0}${a.tcs?1:0}${a.stability?1:0}:${c.physics}`;
}
function byteLength(text){try{return new TextEncoder().encode(String(text)).length}catch(_){return String(text).length*2}}
class RecordStoreV5{
  constructor(storage,options={}){this.storage=storage||null;this.prefix=options.prefix||'cockpit-record-v5:';this.maxBytes=options.maxBytes||1_500_000;this.indexKey='cockpit-record-v5:index';this.index=this._read(this.indexKey,[]);}
  _read(key,fallback=null){try{const v=this.storage?.getItem(key);return v==null?fallback:JSON.parse(v)}catch(_){return fallback}}
  _write(key,value){if(!this.storage)return false;const text=JSON.stringify(value);try{this.storage.setItem(key,text);return true}catch(_){this._trim(Math.max(0,this.maxBytes-byteLength(text)));try{this.storage.setItem(key,text);return true}catch(__){return false}}}
  _saveIndex(){this.index=this.index.filter((v,i,a)=>v&&a.indexOf(v)===i).slice(-256);this._write(this.indexKey,this.index)}
  _trim(target=this.maxBytes*.75){if(!this.storage)return;let total=0;const items=[];for(const key of this.index){const raw=this.storage.getItem(key)||'';total+=byteLength(raw);items.push({key,raw,at:this._read(key,{updatedAt:0})?.updatedAt||0})}items.sort((a,b)=>a.at-b.at);while(total>target&&items.length){const item=items.shift();total-=byteLength(item.raw);try{this.storage.removeItem(item.key)}catch(_){}this.index=this.index.filter(k=>k!==item.key)}this._saveIndex()}
  get(config){return this._read(recordKey(config),null)}
  submit(config,lap={}){const key=recordKey(config),time=Number(lap.time),valid=lap.valid!==false&&Number.isFinite(time)&&time>0,current=this._read(key,null);if(!valid)return{improved:false,record:current};const improved=!current||!Number.isFinite(current.bestLap)||time<current.bestLap;const sectors=Array.isArray(lap.sectors)?lap.sectors.filter(Number.isFinite):[];let bestSectors=Array.isArray(current?.bestSectors)?[...current.bestSectors]:[];sectors.forEach((v,i)=>{bestSectors[i]=!Number.isFinite(bestSectors[i])?v:Math.min(bestSectors[i],v)});const record={version:5,config:normalizeConfig(config),bestLap:improved?time:current.bestLap,bestSectors,ghost:improved&&lap.ghost?lap.ghost:current?.ghost||null,updatedAt:Date.now()};if(!this._write(key,record))return{improved:false,record:current,error:'storage'};if(!this.index.includes(key))this.index.push(key);this._saveIndex();this._trim();return{improved,record}}
  clear(){for(const key of [...this.index])try{this.storage?.removeItem(key)}catch(_){}this.index=[];try{this.storage?.removeItem(this.indexKey)}catch(_){} }
  export(){const records={};for(const key of this.index){const item=this._read(key,null);if(item)records[key]=item}return JSON.stringify({version:5,exportedAt:new Date().toISOString(),records},null,2)}
  import(value){const data=typeof value==='string'?JSON.parse(value):value;if(!data||typeof data!=='object'||typeof data.records!=='object')throw new Error('Formato de récords inválido');for(const [key,item] of Object.entries(data.records)){if(!key.startsWith(this.prefix)||!item||item.version!==5)continue;if(this._write(key,item)&&!this.index.includes(key))this.index.push(key)}this._saveIndex();this._trim();return this.index.length}
}
function ghostBracket(samples,value,key='s'){
  if(!Array.isArray(samples)||!samples.length||!Number.isFinite(value))return null;let lo=0,hi=samples.length-1;while(lo<hi){const mid=(lo+hi)>>1;if((samples[mid]?.[key]??0)<value)lo=mid+1;else hi=mid}return[Math.max(0,lo-1),lo];
}
function ghostTimeAtDistance(samples,distance){const br=ghostBracket(samples,distance,'s');if(!br)return null;const a=samples[br[0]],b=samples[br[1]],span=Math.max(1e-6,(b.s??0)-(a.s??0)),p=clamp((distance-(a.s??0))/span,0,1);return lerp(a.t??0,b.t??0,p)}
function deltaAtDistance(samples,distance,currentTime){const ghostTime=ghostTimeAtDistance(samples,distance);return Number.isFinite(ghostTime)&&Number.isFinite(currentTime)?currentTime-ghostTime:null}

class RaceEngineerV5{
  constructor(options={}){this.cooldown=options.cooldown??2.8;this.lastAt=-Infinity;this.lastKey='';this.lastStatus='IDLE';this.lastLap=null;this.lastSectorCount=0;this.lastTrapAttempts=0;}
  _emit(now,key,text,kind='info',duration=1800){if(key===this.lastKey&&now-this.lastAt<this.cooldown)return null;if(now-this.lastAt<this.cooldown&&kind!=='danger')return null;this.lastAt=now;this.lastKey=key;return{text,kind,duration,key}}
  update(s={}){const now=Number.isFinite(s.now)?s.now:Date.now()/1000;
    if(s.impact)return this._emit(now,'impact',s.speedKmh>90?'Impacto fuerte · revisá el auto':'Contacto · mantené la línea','danger',2400);
    if(s.status==='COUNTDOWN'&&this.lastStatus!=='COUNTDOWN'){this.lastStatus=s.status;return this._emit(now,'countdown','Prepará la salida','info',1000)}
    if(s.status==='RUNNING'&&this.lastStatus==='COUNTDOWN'){this.lastStatus=s.status;return this._emit(now,'green','¡Verde, verde, verde!','good',1300)}
    this.lastStatus=s.status||this.lastStatus;
    if(s.invalidLap&&s.offroadTime>1.8)return this._emit(now,'invalid','Vuelta invalidada · volvé al asfalto','warn',2200);
    if(['barrier','grass','gravel','sand','mud','shoulder'].includes(s.surface)&&s.offroadTime>.6)return this._emit(now,`surface:${s.surface}`,`Superficie: ${String(s.surface).toUpperCase()} · corregí con suavidad`,'warn',1800);
    if(s.speedTrap?.attempts>this.lastTrapAttempts){this.lastTrapAttempts=s.speedTrap.attempts;return this._emit(now,'trap',`Speed Trap ${Math.round(s.speedTrap.lastKmh)} km/h · mejor ${Math.round(s.speedTrap.bestKmh)} km/h`,'good',2300)}
    if(Number.isFinite(s.lastLapTime)&&s.lastLapTime!==this.lastLap){this.lastLap=s.lastLapTime;return this._emit(now,'lap',`Vuelta ${formatTime(s.lastLapTime)}${s.invalidLap?' · inválida':''}`,s.invalidLap?'warn':'good',2200)}
    const sectorCount=Array.isArray(s.currentSectorTimes)?s.currentSectorTimes.length:0;if(sectorCount>this.lastSectorCount){this.lastSectorCount=sectorCount;const t=s.currentSectorTimes.at(-1);return this._emit(now,'sector',`Sector ${sectorCount}: ${formatTime(t)}`,'info',1600)}if(sectorCount<this.lastSectorCount)this.lastSectorCount=sectorCount;
    if(Number.isFinite(s.tireTemp)&&(s.tireTemp>1.08||s.tireTemp<.48))return this._emit(now,'tires',s.tireTemp>1.08?'Neumáticos calientes · cuidá el deslizamiento':'Neumáticos fríos · ganá temperatura','warn',2000);
    return null;
  }
}
class PerformanceGovernorV5{
  constructor(options={}){this.level=options.initial||'high';this.downFrames=options.downFrames||45;this.upFrames=options.upFrames||240;this.slow=0;this.fast=0;this.lastChange=-Infinity;this.cooldown=options.cooldown??0;}
  sample(frameMs,now=Date.now()){const ms=Number(frameMs)||16.7;if(ms>24){this.slow++;this.fast=0}else if(ms<14.5){this.fast++;this.slow=Math.max(0,this.slow-1)}else{this.slow=Math.max(0,this.slow-1);this.fast=Math.max(0,this.fast-1)}if(now-this.lastChange<this.cooldown)return this.level;if(this.slow>=this.downFrames){this.level=this.level==='high'?'balanced':'eco';this.slow=0;this.lastChange=now}else if(this.fast>=this.upFrames){this.level=this.level==='eco'?'balanced':'high';this.fast=0;this.lastChange=now}return this.level}
}
function derivePosition(state={}){const progress=Number(state.raceProgress)||0,rivals=Array.isArray(state.rivals)?state.rivals:[];return 1+rivals.filter(r=>(Number(r.raceProgress)||0)>progress).length}
return{VERSION,clamp,lerp,formatTime,formatDelta,normalizeConfig,recordKey,RecordStoreV5,ghostBracket,ghostTimeAtDistance,deltaAtDistance,RaceEngineerV5,PerformanceGovernorV5,derivePosition};
});


import {createSoundscapeBanks} from './soundscape-banks.mjs?v=ab85d85161d96bc7';
import {createAudioTargets} from './audio-targets.mjs?v=1809a92251d864f2';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
/** Ambient-only bus. Engine, brakes, tire squeal, rivals and music remain with host mixer. */
export function createRaceSoundscape({context,destination=context?.destination,seed=6147,prepared=null}={}){
  if(!context?.createGain)throw new TypeError('An already-authorized AudioContext is required');
  let active=false,disposed=false,thunders=0,sceneTime=0,lastContextTime=context.currentTime;
  const hash=n=>{const s=Math.sin(n*127.1+seed*.07)*43758.5453;return s-Math.floor(s);};
  const variation=(t,offset=0)=>{const i=Math.floor(t),f=t-i,s=f*f*(3-2*f);return hash(i+offset)*(1-s)+hash(i+1+offset)*s;};
  const nodes=[],sources=[],oneshots=new Set(),channels={};
  let worldState={trackId:'',cameraMode:'chase',water:null,waterfall:null,forest:null,rainIntensity:0};
  const node=n=>(nodes.push(n),n),master=node(context.createGain());master.gain.value=0;master.connect(destination);
  const {buffers}=prepared||createSoundscapeBanks(context,seed).build();
  const [broadNoise,roofNoise,forestNoise,waterNoise,...thunderBuffers]=buffers;
  function source(buffer){const n=node(context.createBufferSource());n.buffer=buffer;n.loop=true;n.start();sources.push(n);return n;}
  function branch(name,input,type,frequency,Q,{output=0,occluded=true,pan=0}={}){const filter=node(context.createBiquadFilter()),cover=node(context.createBiquadFilter()),panner=node(context.createStereoPanner()),gain=node(context.createGain());filter.type=type;filter.frequency.value=frequency;filter.Q.value=Q;cover.type='lowpass';cover.frequency.value=20000;panner.pan.value=pan;gain.gain.value=0;input.connect(filter,output);filter.connect(cover).connect(panner).connect(gain).connect(master);channels[name]={filter,cover,panner,gain,target:0,occluded};}
  const windSource=source(forestNoise),windSplit=node(context.createChannelSplitter(3));windSource.connect(windSplit);
  branch('wind',windSplit,'lowpass',520,.5);branch('birds',windSplit,'highpass',1100,.4,{output:1});branch('insects',windSplit,'highpass',3100,.4,{output:2,pan:-.22});
  branch('rain',source(broadNoise),'highpass',1450,.5);branch('roof',source(roofNoise),'bandpass',720,.72,{occluded:false});
  const waterSource=source(waterNoise),waterSplit=node(context.createChannelSplitter(2));waterSource.connect(waterSplit);
  branch('water',waterSplit,'bandpass',460,.45);branch('waterfall',waterSplit,'lowpass',1900,.5,{output:1});
  const automation=createAudioTargets(context);
  const gain=(channel,value,tau=.16)=>{channel.target=value;automation.target(channel.gain.gain,value,tau);};
  function setActive(value){if(disposed||active===!!value)return;active=!!value;if(!active){automation.clear();lastContextTime=context.currentTime;master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(0,context.currentTime);for(const channel of Object.values(channels)){channel.gain.gain.cancelScheduledValues(context.currentTime);channel.gain.gain.setValueAtTime(0,context.currentTime);channel.target=0;}for(const entry of oneshots){try{entry.source.stop();}catch{}entry.dispose();}oneshots.clear();}}
  return{
    setActive,
    update({active:enabled=true,paused=false,masterGain=1,ambientGain=1,cameraMode='chase',windMps=0,speedMps=0,rainIntensity=0,water=null,waterfall=null,forest=null,night=false,trackId=''}={}){
      if(disposed)return;setActive(enabled&&!paused);if(!active)return;
      sceneTime+=Math.max(0,Math.min(.05,context.currentTime-lastContextTime));lastContextTime=context.currentTime;
      const gust=.72+variation(sceneTime*.16,8)*.38+variation(sceneTime*.63,67)*.12;
      const inside=cameraMode==='cockpit',wind=typeof windMps==='number'?Math.abs(windMps):Math.hypot(windMps.x??windMps[0]??0,windMps.y??windMps[1]??0,windMps.z??windMps[2]??0),speed=Math.abs(speedMps),rain=clamp(rainIntensity);
      for(const channel of Object.values(channels))automation.target(channel.cover.frequency,inside&&channel.occluded?1250:18000,.12);
      automation.target(master.gain,clamp(masterGain)*clamp(ambientGain)*.7,.06);
      const windLevel=clamp((wind*.8+speed*.44)/42)*(inside?.045:.11)*gust;automation.target(channels.wind.filter.frequency,inside?260+speed*7:480+wind*70,.25);
      gain(channels.rain,rain*(inside?.027:.12),.22);automation.target(channels.rain.filter.frequency,inside?600:1200,.2);
      gain(channels.roof,inside?rain*.15:rain*.012,.18);automation.target(channels.roof.filter.frequency,inside?680:1300,.12);
      worldState={trackId,cameraMode,rainIntensity:rain,waterfall:waterfall?{...waterfall}:null,forest:forest?{...forest}:null,night,water:water?{kind:water.kind,distanceM:water.distanceM,flowMps:water.flowMps,source:water.source}:null};
      const distance=Number(water?.distanceM??Infinity),near=Number.isFinite(distance)?Math.exp(-Math.max(0,distance)/65):0,river=water?.kind==='river'||water?.kind==='drain';
      const swell=.35+variation(sceneTime*.19,101)*.65,crest=Math.pow(variation(sceneTime*.37,203),3),flow=clamp(water?.flowMps??.5,0,2);
      gain(channels.water,near*(inside?.026:.075)*(river?(.6+flow*.3)*(.92+variation(sceneTime*.72,303)*.16):.35+swell*.42+crest*.24),river?.22:.7);automation.target(channels.water.filter.frequency,river?680:280,.4);
      const fallDistance=Number(waterfall?.distanceM??Infinity),impactDistance=Number(waterfall?.impactDistanceM??fallDistance),fallNear=Number.isFinite(fallDistance)?1/(1+Math.pow(Math.max(0,fallDistance)/150,1.4)):0,impactNear=Number.isFinite(impactDistance)?1/(1+Math.pow(Math.max(0,impactDistance)/90,1.5)):0;
      gain(channels.waterfall,(fallNear*.11+impactNear*.1)*clamp(waterfall?.scale??1,.2,1.5)*(inside?.28:1)*(.84+variation(sceneTime*.21,504)*.2),.55);
      automation.target(channels.waterfall.filter.frequency,450+fallNear*1600,.5);automation.target(channels.waterfall.panner.pan,clamp(waterfall?.pan??0,-.8,.8),.25);
      const jungle=trackId==='cataratas_iguazu'?clamp(forest?.proximity??0):0,quiet=(1-rain*.76)*(inside?.15:1),leaf=1+gust*.15;
      gain(channels.birds,jungle*quiet*(night?.007:.07),.65);gain(channels.insects,jungle*quiet*(night?.045:.024),.8);automation.target(channels.birds.panner.pan,clamp(forest?.pan??0,-.7,.7),.6);
      gain(channels.wind,windLevel+jungle*(inside?.003:.013)*clamp(wind/8)*leaf);
      return{trackId,active,inside,waterProximity:near,waterfallProximity:fallNear,forestProximity:jungle};
    },
    thunder({distanceM=1200,intensity=.4}={}){
      if(disposed||!active||oneshots.size>=2)return false;
      const duration=4.6,source=context.createBufferSource(),filter=context.createBiquadFilter(),gainNode=context.createGain();source.buffer=thunderBuffers[thunders%thunderBuffers.length];filter.type='lowpass';filter.frequency.value=clamp(2200-distanceM*.6,180,worldState.cameraMode==='cockpit'?650:1500);filter.Q.value=.48;
      const now=context.currentTime,level=clamp(intensity)*.46/(1+distanceM/1800);gainNode.gain.setValueAtTime(0,now);gainNode.gain.linearRampToValueAtTime(level,now+.08);gainNode.gain.exponentialRampToValueAtTime(Math.max(.001,level*.48),now+.8);gainNode.gain.exponentialRampToValueAtTime(.0001,now+duration);
      source.connect(filter).connect(gainNode).connect(master);const entry={source,dispose(){source.disconnect();filter.disconnect();gainNode.disconnect();oneshots.delete(entry);}};oneshots.add(entry);source.onended=entry.dispose;source.start(now);source.stop(now+duration+.02);thunders++;return true;
    },
    diagnostics:()=>({active,disposed,sceneTime,world:worldState,proceduralDetail:'iguazu-geometry-waterfall-jungle-banked-four-loops-v3',loopingSources:sources.length,transientSources:oneshots.size,thunders,targets:Object.fromEntries(Object.entries(channels).map(([key,value])=>[key,value.target]))}),
    dispose(){if(disposed)return;setActive(false);disposed=true;for(const source of sources){try{source.stop();}catch{}}for(const n of nodes){try{n.disconnect();}catch{}}sources.length=nodes.length=0;},
  };
}

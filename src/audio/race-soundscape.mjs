import { regionalAcoustics } from './v7-audio-state.mjs';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
/** Ambient-only bus. Engine, brakes, tire squeal, rivals and music remain with host mixer. */
export function createRaceSoundscape({context,destination=context?.destination,seed=6147}={}){
  if(!context?.createGain)throw new TypeError('An already-authorized AudioContext is required');
  let randomState=seed>>>0,active=false,disposed=false,thunders=0,sceneTime=0,lastContextTime=context.currentTime;
  const hash=n=>{const s=Math.sin(n*127.1+seed*.07)*43758.5453;return s-Math.floor(s);};
  const variation=(t,offset=0)=>{const i=Math.floor(t),f=t-i,s=f*f*(3-2*f);return hash(i+offset)*(1-s)+hash(i+1+offset)*s;};
  const random=()=>((randomState=Math.imul(randomState,1664525)+1013904223>>>0)/4294967296)*2-1;
  const nodes=[],sources=[],oneshots=new Set(),channels={};
  let worldState={trackId:'',cameraMode:'chase',water:null,waterfall:null,forest:null,rainIntensity:0};
  const node=n=>(nodes.push(n),n),master=node(context.createGain());master.gain.value=0;master.connect(destination);
  function noise(seconds,color=0,detail=''){const buffer=context.createBuffer(2,Math.ceil(context.sampleRate*seconds),context.sampleRate);
    for(let channel=0;channel<2;channel++){const samples=buffer.getChannelData(channel);let low=0,slower=0,pulse=0,phase=0,pitch=760;
      for(let i=0;i<samples.length;i++){const white=random();low=.96*low+.04*white;slower=.997*slower+.003*white;let value=(white*(1-color)+low*color*3+slower*color*4)*.48;
        if(detail==='roof'){if(random()>.997){pulse=.15+Math.abs(random())*.65;phase=0;pitch=540+Math.abs(random())*1300;}pulse*=Math.exp(-1/(context.sampleRate*.014));phase+=pitch*2*Math.PI/context.sampleRate;value=value*.24+pulse*(Math.sin(phase)*.58+white*.16);}
        if(detail==='water'){if(random()>.99985)pulse=.15+Math.abs(random())*.35;pulse*=Math.exp(-1/(context.sampleRate*.06));value=value*(.7+variation(i/context.sampleRate*.31,channel+41)*.6)+white*pulse*.16;}
        samples[i]=value;}}
    return buffer;}
  function forestBank(){
    const seconds=41.3,buffer=context.createBuffer(3,Math.ceil(context.sampleRate*seconds),context.sampleRate),wind=buffer.getChannelData(0),birds=buffer.getChannelData(1),insects=buffer.getChannelData(2);
    let low=0,slower=0,phase=0;const calls=[.9,4.3,10.8,17.7,26.2,33.8,38.9];let call=0;
    for(let i=0;i<wind.length;i++){const t=i/context.sampleRate,white=random();low=.96*low+.04*white;slower=.997*slower+.003*white;wind[i]=(.2*white+2.4*low+3.2*slower)*.48;
      const window=Math.sin(Math.PI*t/seconds)**.2;
      const buzz=(Math.sin(t*2*Math.PI*4721+.7*Math.sin(t*8.3))+Math.sin(t*2*Math.PI*6173+.5*Math.sin(t*11.7))*.45)*(.45+.55*Math.max(0,Math.sin(t*2*Math.PI*23.7)))*(.65+.35*variation(t*.47,910));
      insects[i]=(buzz*.035+white*.009)*window;
      while(call<calls.length-1&&t>calls[call]+1.25)call++;const age=t-calls[call];let value=0;
      if(age>=0&&age<1.15){const phrase=Math.floor(age/.23),u=(age% .23)/.23,env=Math.sin(Math.PI*u)**2*Math.exp(-phrase*.15),pitch=1450+call*77+650*Math.sin(u*2.5+phrase*.38);phase+=pitch*2*Math.PI/context.sampleRate;value=env*(Math.sin(phase)+Math.sin(phase*2.03)*.12)*.21;}birds[i]=value*window;
    }return buffer;
  }
  function waterBank(){const buffer=noise(14.3,.8,'water'),river=buffer.getChannelData(0),fall=buffer.getChannelData(1);let low=0,sub=0;
    for(let i=0;i<fall.length;i++){const t=i/context.sampleRate,white=random();low=.975*low+.025*white;sub=.9985*sub+.0015*white;fall[i]=(.27*white+low*3.6+sub*8)*(.4+.15*variation(t*.4,870));river[i]*=.95;}return buffer;}
  const broadNoise=noise(8,.35),roofNoise=noise(11.7,.45,'roof'),forestNoise=forestBank(),waterNoise=waterBank();
  function source(buffer){const n=node(context.createBufferSource());n.buffer=buffer;n.loop=true;n.start();sources.push(n);return n;}
  function branch(name,input,type,frequency,Q,{output=0,occluded=true,pan=0}={}){const filter=node(context.createBiquadFilter()),cover=node(context.createBiquadFilter()),panner=node(context.createStereoPanner()),gain=node(context.createGain());filter.type=type;filter.frequency.value=frequency;filter.Q.value=Q;cover.type='lowpass';cover.frequency.value=20000;panner.pan.value=pan;gain.gain.value=0;input.connect(filter,output);filter.connect(cover).connect(panner).connect(gain).connect(master);channels[name]={filter,cover,panner,gain,target:0,occluded};}
  const windSource=source(forestNoise),windSplit=node(context.createChannelSplitter(3));windSource.connect(windSplit);
  branch('wind',windSplit,'lowpass',520,.5);branch('birds',windSplit,'highpass',1100,.4,{output:1});branch('insects',windSplit,'highpass',3100,.4,{output:2,pan:-.22});
  branch('rain',source(broadNoise),'highpass',1450,.5);branch('roof',source(roofNoise),'bandpass',720,.72,{occluded:false});
  const waterSource=source(waterNoise),waterSplit=node(context.createChannelSplitter(2));waterSource.connect(waterSplit);
  branch('water',waterSplit,'bandpass',460,.45);branch('waterfall',waterSplit,'lowpass',1900,.5,{output:1});
  const gain=(channel,target,tau=.16)=>{channel.target=target;channel.gain.gain.setTargetAtTime(target,context.currentTime,tau);};
  function setActive(value){if(disposed)return;active=!!value;if(!active){lastContextTime=context.currentTime;master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(0,context.currentTime);for(const channel of Object.values(channels)){channel.gain.gain.cancelScheduledValues(context.currentTime);channel.gain.gain.setValueAtTime(0,context.currentTime);channel.target=0;}for(const entry of oneshots){try{entry.source.stop();}catch{}entry.dispose();}oneshots.clear();}}
  return{
    setActive,
    update({active:enabled=true,paused=false,masterGain=1,ambientGain=1,cameraMode='chase',windMps=0,speedMps=0,rainIntensity=0,water=null,waterfall=null,forest=null,night=false,trackId=''}={}){
      if(disposed)return;setActive(enabled&&!paused);if(!active)return;
      sceneTime+=Math.max(0,Math.min(.05,context.currentTime-lastContextTime));lastContextTime=context.currentTime;
      const gust=.72+variation(sceneTime*.16,8)*.38+variation(sceneTime*.63,67)*.12;
      const inside=cameraMode==='cockpit',wind=typeof windMps==='number'?Math.abs(windMps):Math.hypot(windMps.x??windMps[0]??0,windMps.y??windMps[1]??0,windMps.z??windMps[2]??0),speed=Math.abs(speedMps),rain=clamp(rainIntensity);
      for(const channel of Object.values(channels))channel.cover.frequency.setTargetAtTime(inside&&channel.occluded?1250:18000,context.currentTime,.12);
      master.gain.setTargetAtTime(clamp(masterGain)*clamp(ambientGain)*clamp(globalThis.__asfaltoV7Experience?.preferences?.().ambientVolume??1)*.7,context.currentTime,.06);
      gain(channels.wind,clamp((wind*.8+speed*.44)/42)* (inside?.045:.11)*gust);channels.wind.filter.frequency.setTargetAtTime(inside?260+speed*7:480+wind*70,context.currentTime,.25);
      gain(channels.rain,rain*(inside?.027:.12),.22);channels.rain.filter.frequency.setTargetAtTime(inside?600:1200,context.currentTime,.2);
      gain(channels.roof,inside?rain*.15:rain*.012,.18);channels.roof.filter.frequency.setTargetAtTime(inside?680:1300,context.currentTime,.12);
      worldState={trackId,cameraMode,rainIntensity:rain,waterfall:waterfall?{...waterfall}:null,forest:forest?{...forest}:null,night,water:water?{kind:water.kind,distanceM:water.distanceM,flowMps:water.flowMps,source:water.source}:null};
      const distance=Number(water?.distanceM??Infinity),near=Number.isFinite(distance)?Math.exp(-Math.max(0,distance)/65):0,river=water?.kind==='river'||water?.kind==='drain';
      const swell=.35+variation(sceneTime*.19,101)*.65,crest=Math.pow(variation(sceneTime*.37,203),3),flow=clamp(water?.flowMps??.5,0,2);
      gain(channels.water,near*(inside?.026:.075)*(river?(.6+flow*.3)*(.92+variation(sceneTime*.72,303)*.16):.35+swell*.42+crest*.24),river?.22:.7);channels.water.filter.frequency.setTargetAtTime(river?680:280,context.currentTime,.4);
      const fallDistance=Number(waterfall?.distanceM??Infinity),impactDistance=Number(waterfall?.impactDistanceM??fallDistance),fallNear=Number.isFinite(fallDistance)?1/(1+Math.pow(Math.max(0,fallDistance)/150,1.4)):0,impactNear=Number.isFinite(impactDistance)?1/(1+Math.pow(Math.max(0,impactDistance)/90,1.5)):0;
      gain(channels.waterfall,(fallNear*.11+impactNear*.1)*clamp(waterfall?.scale??1,.2,1.5)*(inside?.28:1)*(.84+variation(sceneTime*.21,504)*.2),.55);
      channels.waterfall.filter.frequency.setTargetAtTime(450+fallNear*1600,context.currentTime,.5);channels.waterfall.panner.pan.setTargetAtTime(clamp(waterfall?.pan??0,-.8,.8),context.currentTime,.25);
      const regional=regionalAcoustics({trackId,forest,night,rainIntensity:rain}),jungle=regional.proximity,quiet=inside?.15:1,leaf=1+gust*.15;
      gain(channels.birds,regional.birds*quiet,.65);gain(channels.insects,regional.insects*quiet,.8);channels.birds.panner.pan.setTargetAtTime(clamp(forest?.pan??0,-.7,.7),context.currentTime,.6);
      if(jungle)gain(channels.wind,channels.wind.target+regional.leaf*(inside?.2:1)*clamp(wind/8)*leaf);
      return{trackId,active,inside,waterProximity:near,waterfallProximity:fallNear,forestProximity:jungle};
    },
    thunder({distanceM=1200,intensity=.4}={}){
      if(disposed||!active||oneshots.size>=2)return false;
      const duration=4.6,source=context.createBufferSource(),filter=context.createBiquadFilter(),gainNode=context.createGain();source.buffer=noise(duration,.84);filter.type='lowpass';filter.frequency.value=clamp(2200-distanceM*.6,180,worldState.cameraMode==='cockpit'?650:1500);filter.Q.value=.48;
      const now=context.currentTime,level=clamp(intensity)*.46/(1+distanceM/1800);gainNode.gain.setValueAtTime(0,now);gainNode.gain.linearRampToValueAtTime(level,now+.08);gainNode.gain.exponentialRampToValueAtTime(Math.max(.001,level*.48),now+.8);gainNode.gain.exponentialRampToValueAtTime(.0001,now+duration);
      source.connect(filter).connect(gainNode).connect(master);const entry={source,dispose(){source.disconnect();filter.disconnect();gainNode.disconnect();oneshots.delete(entry);}};oneshots.add(entry);source.onended=entry.dispose;source.start(now);source.stop(now+duration+.02);thunders++;return true;
    },
    diagnostics:()=>({active,disposed,sceneTime,world:worldState,proceduralDetail:'iguazu-geometry-waterfall-jungle-banked-four-loops-v3',loopingSources:sources.length,transientSources:oneshots.size,thunders,targets:Object.fromEntries(Object.entries(channels).map(([key,value])=>[key,value.target]))}),
    dispose(){if(disposed)return;setActive(false);disposed=true;for(const source of sources){try{source.stop();}catch{}}for(const n of nodes){try{n.disconnect();}catch{}}sources.length=nodes.length=0;},
  };
}

import { drivingAudioState } from './race-driving-state.mjs';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));

/** Physical contacts and one spatial rival. All nodes belong to the supplied context. */
export function createRaceDrivingAudio({context,destination=context?.destination,seed=7139}={}) {
  if(!context?.createGain)throw new TypeError('An authorized AudioContext is required');
  let disposed=false,active=false,randomState=seed>>>0,lastImpact=-Infinity,lastImpactEvent=null;
  const nodes=[],sources=[],transients=new Set(),bumpState=new Map();
  const own=node=>(nodes.push(node),node),master=own(context.createGain());master.gain.value=0;
  const compressor=own(context.createDynamicsCompressor());Object.assign(compressor.threshold,{value:-12});compressor.knee.value=14;compressor.ratio.value=3;compressor.attack.value=.004;compressor.release.value=.16;
  master.connect(compressor).connect(destination);
  const random=()=>((randomState=(Math.imul(randomState,1664525)+1013904223)>>>0)/4294967296)*2-1;
  function noise(seconds) {const b=context.createBuffer(2,Math.ceil(context.sampleRate*seconds),context.sampleRate);
    for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch);let pink=0;for(let i=0;i<a.length;i++){const w=random();pink=.965*pink+.035*w;a[i]=(w*.5+pink*3)*.7;}}
    return b;}
  const roadBuffer=noise(7.1),impactBuffer=noise(.48),channels={};
  function layer(name,type,hz,Q,pan=0) {
    const source=own(context.createBufferSource()),filter=own(context.createBiquadFilter()),gain=own(context.createGain()),panner=own(context.createStereoPanner());
    source.buffer=roadBuffer;source.loop=true;filter.type=type;filter.frequency.value=hz;filter.Q.value=Q;gain.gain.value=0;panner.pan.value=pan;
    source.connect(filter).connect(gain).connect(panner).connect(master);source.start(0,pan<0?0:2.17);sources.push(source);
    return channels[name]={source,filter,gain,panner,target:0};
  }
  layer('rollingLeft','bandpass',330,.55,-.55);layer('rollingRight','bandpass',350,.55,.55);
  layer('skidLeft','bandpass',1850,2.7,-.67);layer('skidRight','bandpass',1910,2.5,.67);
  layer('gravel','bandpass',1550,.55);layer('wetRoad','highpass',1650,.6);layer('brakeFriction','bandpass',2450,1.2);
  const brakeOsc=own(context.createOscillator()),brakeGain=own(context.createGain());brakeOsc.type='sine';brakeOsc.frequency.value=2380;brakeGain.gain.value=0;brakeOsc.connect(brakeGain).connect(master);brakeOsc.start();sources.push(brakeOsc);
  // A pulse harmonic bank with a quieter mechanical order replaces the old sawtooth rival.
  const rivalFilter=own(context.createBiquadFilter()),rivalGain=own(context.createGain()),rivalPan=own(context.createStereoPanner());
  rivalFilter.type='lowpass';rivalFilter.Q.value=.6;rivalGain.gain.value=0;rivalFilter.connect(rivalGain).connect(rivalPan).connect(master);
  const rivalVoices=[{order:3,level:.066},{order:6,level:.024},{order:1,level:.015}].map(({order,level})=>{
    const osc=own(context.createOscillator()),gain=own(context.createGain());osc.type=order===1?'sine':'triangle';gain.gain.value=level;osc.connect(gain).connect(rivalFilter);osc.start();sources.push(osc);return{osc,order};});
  let lastState=null,inside=true,rivalLevel=0;
  const target=(param,value,tau=.04)=>param.setTargetAtTime(value,context.currentTime,tau);
  const set=(name,value,hz)=>{const c=channels[name];c.target=value;target(c.gain.gain,value);if(hz)target(c.filter.frequency,hz,.08);};
  function stopTransient(t){try{t.source.stop();}catch{}t.dispose();}
  function setActive(value){if(disposed)return;active=!!value;if(!active){master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(0,context.currentTime);for(const c of Object.values(channels)){c.gain.gain.cancelScheduledValues(context.currentTime);c.gain.gain.setValueAtTime(0,context.currentTime);c.target=0;}brakeGain.gain.cancelScheduledValues(context.currentTime);brakeGain.gain.setValueAtTime(0,context.currentTime);rivalGain.gain.setValueAtTime(0,context.currentTime);rivalLevel=0;for(const t of [...transients])stopTransient(t);bumpState.clear();}}
  function transient({intensity=.3,pan=0,metal=false,bump=false}={}) {
    if(!active||disposed||transients.size>=8)return false;
    const now=context.currentTime,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),panner=context.createStereoPanner();
    source.buffer=impactBuffer;filter.type='lowpass';filter.frequency.value=bump?170:metal?2800:720;filter.Q.value=metal?1.3:.6;panner.pan.value=clamp(pan,-1,1);
    const duration=bump?.14:metal?.36:.23,level=clamp(intensity)*(bump?.16:.32)*(inside?.72:1);
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(Math.max(.0001,level),now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter).connect(gain).connect(panner).connect(master);
    const entry={source,dispose(){source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();transients.delete(entry);}};source.onended=entry.dispose;transients.add(entry);source.start();source.stop(now+duration+.02);return true;
  }
  return {
    setActive,
    update({snapshot={},controls={},speedMps,wetness=0,active:enabled=true,paused=false,cameraMode='cockpit',tiresGain=1,roadGain=1,brakesGain=.56,impactsGain=.78,rival=null}={}) {
      if(disposed)return;setActive(enabled&&!paused);if(!active)return;
      inside=cameraMode==='cockpit';lastState=drivingAudioState({snapshot,controls,speedMps,wetness});const speed=lastState.speedMps;
      target(master.gain,.8,.025);
      const wheels=lastState.wheels,mean=(field,side=0)=>wheels.reduce((sum,w)=>sum+(side&&Math.sign(w.pan)!==side?0:w[field]),0)/(side?2:4);
      const tireLevel=clamp(tiresGain),roadLevel=clamp(roadGain,0,1.25),perspective=inside?.58:1;
      for(const [suffix,side] of [['Left',-1],['Right',1]]){
        set('rolling'+suffix,mean('rolling',side)*.11*roadLevel*tireLevel*perspective,150+speed*15);
        set('skid'+suffix,mean('skid',side)*.19*tireLevel*perspective,1200+Math.sqrt(clamp(speed,0,100))*130+(side<0?-45:45));
      }
      set('gravel',mean('loose')*.21*tireLevel*perspective,800+speed*27);
      set('wetRoad',mean('wet')*.17*tireLevel*(inside?.4:1),inside?2300:1150);
      const braking=mean('braking')*clamp(brakesGain,0,1.25);
      set('brakeFriction',braking*.026*perspective,1900+speed*19);
      const temperature=Math.max(20,...wheels.map(w=>w.temperatureC)),squeak=clamp((temperature-65)/100)*braking*.003;
      target(brakeGain.gain,squeak*perspective);target(brakeOsc.frequency,2240+speed*11+Math.sin(context.currentTime*3.7)*45);
      for(const w of wheels){const previous=bumpState.get(w.id)||0;if(w.bump>.24&&w.bump>previous+.18)transient({intensity:w.bump*clamp(impactsGain),pan:w.pan,bump:true});bumpState.set(w.id,w.bump);}
      const distance=Math.max(0,Number(rival?.distanceM)||0),audible=rival&&Number.isFinite(rival.distanceM)&&distance<160;
      rivalLevel=audible?(.22+.78*clamp(rival.throttle))*Math.pow(1+distance/7,-1.25)*(inside?.38:1):0;
      target(rivalGain.gain,rivalLevel,.045);target(rivalPan.pan,audible?clamp(rival.pan,-1,1):0);
      const doppler=clamp(343/(343+clamp(rival?.radialSpeedMps,-70,70)),.82,1.22),rpm=clamp(rival?.rpm||750,300,7000);
      for(const voice of rivalVoices)target(voice.osc.frequency,rpm/60*voice.order*doppler,.022);
      target(rivalFilter.frequency,(inside?2100:5700)/(1+distance/60),.12);
      return lastState;
    },
    impact({intensity=.5,eventId=null,pan=0,metal=false}={}) {
      if(!active||disposed||(eventId!==null&&eventId===lastImpactEvent)||context.currentTime-lastImpact<.08)return false;
      lastImpactEvent=eventId;lastImpact=context.currentTime;return transient({intensity,pan,metal});
    },
    diagnostics:()=>({active,disposed,inside,loopingSources:sources.length,transientSources:transients.size,rivalLevel,targets:Object.fromEntries(Object.entries(channels).map(([k,v])=>[k,v.target])),wheelContacts:lastState?.wheels||[]}),
    dispose(){if(disposed)return;setActive(false);disposed=true;for(const source of sources)try{source.stop();}catch{}for(const n of nodes)try{n.disconnect();}catch{}sources.length=nodes.length=0;},
  };
}

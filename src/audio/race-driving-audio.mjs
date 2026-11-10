import {createDrivingAudioBanks} from './driving-audio-banks.mjs?v=81162803ee9cade0';
import {createAudioTargets} from './audio-targets.mjs?v=d16a18410f46456b';
import { mechanicalEvents } from './v7-audio-state.mjs?v=e6720400866e4cbf';
import { drivingAudioState } from './race-driving-state.mjs?v=84ddd7aeddea355c';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const metalMaterials=new Set(['metal','steel','guardrail','vehicle-metal']);
const strikeVoices={
  bump:{frequency:170,brightness:0,resonance:.6,duration:.14,tail:0,level:.16},
  metal:{frequency:2250,brightness:1050,resonance:1.7,duration:.18,tail:.22,level:.32},
  hard:{frequency:710,brightness:380,resonance:.85,duration:.14,tail:.15,level:.32},
  wood:{frequency:495,brightness:460,resonance:.78,duration:.13,tail:.10,level:.32},
  soil:{frequency:370,brightness:270,resonance:.6,duration:.13,tail:.09,level:.32},
  other:{frequency:630,brightness:340,resonance:.6,duration:.14,tail:.15,level:.32},
};

/** Physical contacts and one spatial rival. All nodes belong to the supplied context. */
export function createRaceDrivingAudio({context,destination=context?.destination,seed=7139,prepared=null}={}) {
  if(!context?.createGain)throw new TypeError('An authorized AudioContext is required');
  let disposed=false,active=false,lastImpactSequence=0;
  const nodes=[],sources=[],transients=new Set(),bumpState=new Map();
  const own=node=>(nodes.push(node),node),master=own(context.createGain());master.gain.value=0;
  const compressor=own(context.createDynamicsCompressor());Object.assign(compressor.threshold,{value:-12});compressor.knee.value=14;compressor.ratio.value=3;compressor.attack.value=.004;compressor.release.value=.16;
  master.connect(compressor).connect(destination);
  const collisionGain=own(context.createGain());collisionGain.gain.value=0;collisionGain.connect(master);
  const [roadBuffer,impactBuffer]=prepared||createDrivingAudioBanks(context,seed),channels={};
  function layer(name,type,hz,Q,pan=0,output=master) {
    const source=own(context.createBufferSource()),filter=own(context.createBiquadFilter()),gain=own(context.createGain()),panner=own(context.createStereoPanner());
    source.buffer=roadBuffer;source.loop=true;filter.type=type;filter.frequency.value=hz;filter.Q.value=Q;gain.gain.value=0;panner.pan.value=pan;
    source.connect(filter).connect(gain).connect(panner).connect(output);source.start(0,pan<0?0:2.17);sources.push(source);
    return channels[name]={source,filter,gain,panner,target:0};
  }
  layer('rollingLeft','bandpass',330,.55,-.55);layer('rollingRight','bandpass',350,.55,.55);
  layer('skidLeft','bandpass',1850,2.7,-.67);layer('skidRight','bandpass',1910,2.5,.67);
  layer('gravel','bandpass',1550,.55);layer('wetRoad','highpass',1650,.6);layer('brakeFriction','bandpass',2450,1.2);
  layer('scrape','bandpass',1300,1.4,0,collisionGain);
  const brakeOsc=own(context.createOscillator()),brakeGain=own(context.createGain());brakeOsc.type='sine';brakeOsc.frequency.value=2380;brakeGain.gain.value=0;brakeOsc.connect(brakeGain).connect(master);brakeOsc.start();sources.push(brakeOsc);
  // A pulse harmonic bank with a quieter mechanical order replaces the old sawtooth rival.
  const rivalFilter=own(context.createBiquadFilter()),rivalGain=own(context.createGain()),rivalPan=own(context.createStereoPanner());
  rivalFilter.type='lowpass';rivalFilter.Q.value=.6;rivalGain.gain.value=0;rivalFilter.connect(rivalGain).connect(rivalPan).connect(master);
  const rivalVoices=[{order:3,level:.066},{order:6,level:.024},{order:1,level:.015}].map(({order,level})=>{
    const osc=own(context.createOscillator()),gain=own(context.createGain());osc.type=order===1?'sine':'triangle';gain.gain.value=level;osc.connect(gain).connect(rivalFilter);osc.start();sources.push(osc);return{osc,order};});
  let lastState=null,inside=true,rivalLevel=0,previousMechanical=null;
  const automation=createAudioTargets(context),target=automation.target;
  const set=(name,value,hz)=>{const c=channels[name];c.target=value;target(c.gain.gain,value);if(hz)target(c.filter.frequency,hz,.08);};
  function stopTransient(t){try{t.source.stop();}catch{}t.dispose();}
  function setActive(value){if(disposed||active===!!value)return;active=!!value;if(!active){automation.clear();master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(0,context.currentTime);for(const c of Object.values(channels)){c.gain.gain.cancelScheduledValues(context.currentTime);c.gain.gain.setValueAtTime(0,context.currentTime);c.target=0;}brakeGain.gain.cancelScheduledValues(context.currentTime);brakeGain.gain.setValueAtTime(0,context.currentTime);rivalGain.gain.setValueAtTime(0,context.currentTime);rivalLevel=0;for(const t of [...transients])stopTransient(t);bumpState.clear();previousMechanical=null;}}
  function transient({intensity,pan=0,voice='other',collision=false}) {
    if(!active||disposed||intensity<=0||transients.size>=8)return false;
    const now=context.currentTime,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),panner=context.createStereoPanner();
    const strength=clamp(intensity),profile=strikeVoices[voice];
    source.buffer=impactBuffer;filter.type='lowpass';filter.frequency.value=profile.frequency+strength*profile.brightness;
    filter.Q.value=profile.resonance;panner.pan.value=clamp(pan,-1,1);
    const duration=profile.duration+strength*profile.tail,level=strength*profile.level*(inside?.72:1);
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(Math.max(.0001,level),now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter).connect(gain).connect(panner).connect(collision?collisionGain:master);
    const entry={source,collision,dispose(){source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();transients.delete(entry);}};source.onended=entry.dispose;transients.add(entry);source.start();source.stop(now+duration+.02);return true;
  }
  function consumeImpacts(snapshot) {
    // Several 120 Hz ticks can reach one render frame. Keep its strongest
    // strike and consume every sequence, including when audio is inactive.
    let strongest=null;
    for(const event of snapshot.impacts||[]) {
      if(!Number.isSafeInteger(event.sequence)||event.sequence<=lastImpactSequence)continue;
      lastImpactSequence=event.sequence;
      const age=snapshot.timeSeconds-event.timeSeconds;
      if(age>=0&&age<=.26&&Number.isFinite(event.impulseNs)&&event.impulseNs>(strongest?.impulseNs||0))strongest=event;
    }
    return strongest;
  }
  return {
    setActive,
    update({snapshot={},controls={},speedMps,wetness=0,active:enabled=true,paused=false,cameraMode='cockpit',tiresGain=1,roadGain=1,brakesGain=.56,impactsGain=.78,rival=null}={}) {
      if(disposed)return;setActive(enabled&&!paused);const strike=consumeImpacts(snapshot);if(!active)return;
      inside=cameraMode==='cockpit';lastState=drivingAudioState({snapshot,controls,speedMps,wetness});const speed=lastState.speedMps;
      const prefs=globalThis.__asfaltoV7Experience?.preferences?.()||{};
      target(master.gain,.8*clamp(prefs.roadVolume??1),.04);target(compressor.threshold,prefs.reducedRange?-25:-12,.1);target(compressor.ratio,prefs.reducedRange?5:3,.1);
      const mechanical={rpm:snapshot.engine?.rpm,gear:snapshot.transmission?.gear??snapshot.gearbox?.gear,cranking:snapshot.engine?.cranking,running:snapshot.engine?.running};
      for(const kind of mechanicalEvents(previousMechanical,mechanical)){if(kind==='shift')transient({intensity:.13,voice:'metal'});if(kind==='stall'){transient({intensity:.22,voice:'bump'});globalThis.__asfaltoV7Experience?.announce('Motor detenido');}if(kind==='ignition')transient({intensity:.12,voice:'bump'});}
      previousMechanical=mechanical;
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
      const collisionVolume=clamp(impactsGain);
      target(collisionGain.gain,collisionVolume,.015);
      if(!collisionVolume)for(const voice of transients)if(voice.collision)stopTransient(voice);
      if(collisionVolume&&strike){
        const material=strike.material;
        let voice='other';
        if(metalMaterials.has(material))voice='metal';
        else if(material==='stone'||material==='concrete')voice='hard';
        else if(material==='soil')voice='soil';
        else if(material==='wood')voice='wood';
        transient({intensity:Math.sqrt(clamp(strike.impulseNs/6500)),pan:clamp(strike.localPointM?.[2]*.7,-.85,.85),voice,collision:true});
      }
      const scrape=snapshot.scrapeContact,scrapeAge=snapshot.timeSeconds-scrape?.timeSeconds;
      const sliding=collisionVolume&&scrapeAge>=0&&scrapeAge<=.065;
      if(sliding){
        const metal=metalMaterials.has(scrape.material),speed=scrape.tangentialSpeedMps;
        const load=clamp(Math.sqrt(scrape.normalForceN/6500));
        set('scrape',clamp((speed-2.5)/16)*load*(metal?.27:.18)*perspective,(metal?1450:610)+Math.min(speed,38)*(metal?80:29));
        target(channels.scrape.filter.Q,metal?2.3:.8,.08);
        target(channels.scrape.panner.pan,clamp(scrape.localSideM*.8,-.85,.85),.045);
      }else set('scrape',0);
      for(const w of wheels){const previous=bumpState.get(w.id)||0;if(collisionVolume&&w.bump>.24&&w.bump>previous+.18)transient({intensity:w.bump,pan:w.pan,voice:'bump',collision:true});bumpState.set(w.id,w.bump);}
      const distance=Math.max(0,Number(rival?.distanceM)||0),audible=rival&&Number.isFinite(rival.distanceM)&&distance<160;
      rivalLevel=audible?(.22+.78*clamp(rival.throttle))*Math.pow(1+distance/7,-1.25)*(inside?.38:1):0;
      target(rivalGain.gain,rivalLevel,.045);target(rivalPan.pan,audible?clamp(rival.pan,-1,1):0);
      const doppler=clamp(343/(343+clamp(rival?.radialSpeedMps,-70,70)),.82,1.22),rpm=clamp(rival?.rpm||750,300,7000);
      for(const voice of rivalVoices)target(voice.osc.frequency,rpm/60*voice.order*doppler,.022);
      target(rivalFilter.frequency,(inside?2100:5700)/(1+distance/60),.12);
      return lastState;
    },
    diagnostics:()=>({active,disposed,inside,loopingSources:sources.length,transientSources:transients.size,rivalLevel,targets:Object.fromEntries(Object.entries(channels).map(([k,v])=>[k,v.target])),wheelContacts:lastState?.wheels||[]}),
    dispose(){if(disposed)return;setActive(false);disposed=true;for(const source of sources)try{source.stop();}catch{}for(const n of nodes)try{n.disconnect();}catch{}sources.length=nodes.length=0;},
  };
}

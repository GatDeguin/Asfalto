import {createAudioTargets} from './audio-targets.mjs?v=d16a18410f46456b';

const clamp=value=>Math.max(0,Math.min(1,value));
// A representative Chevy driveline for the scripted departure.
const IDLE_RPM=825,FINAL_DRIVE=3.36,FIRST_RATIO=3.11,SECOND_RATIO=2.2;
const UPSHIFT_RPM=2350,SHIFT_SECONDS=.42,ENGAGE_SECOND=.23;
const silent={phase(){},update(){},dispose(){}};

function smooth(value){
  const t=clamp(value);
  return t*t*(3-2*t);
}

export function createWorkshopDepartureAudio(settings){
  const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
  const volume=clamp(Number.isFinite(settings?.masterVolume)?settings.masterVolume:.78);
  if(settings?.soundEnabled===false||!volume||!AudioContext)return silent;

  let context;
  try{
    context=new AudioContext();
    const targets=createAudioTargets(context),master=context.createGain(),sources=[];
    master.gain.value=volume*.62;
    master.connect(context.destination);
    const noise=context.createBuffer(1,Math.ceil(context.sampleRate*.49),context.sampleRate),data=noise.getChannelData(0);
    let seed=1973;
    for(let i=0;i<data.length;i++){
      seed=(Math.imul(1664525,seed)+1013904223)>>>0;
      data[i]=seed/2147483648-1;
    }

    function voice(type,filterType,frequency,q=.7){
      const source=type==='noise'?context.createBufferSource():context.createOscillator();
      if(type==='noise'){source.buffer=noise;source.loop=true;}else source.type=type;
      const filter=context.createBiquadFilter(),gain=context.createGain();
      filter.type=filterType;filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=0;
      source.connect(filter).connect(gain).connect(master);
      sources.push(source);source.start();
      return {source,filter,gain:gain.gain};
    }

    const engine=voice('sawtooth','lowpass',270);
    const crank=voice('noise','bandpass',690,1.2);
    const roller=voice('triangle','lowpass',370);
    const slats=voice('noise','bandpass',1350,1.7);
    const tires=voice('noise','lowpass',390);
    const target=(param,value,tau=.035)=>targets.target(param,value,tau);
    function click(frequency,level,duration){
      const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
      osc.type='triangle';osc.frequency.setValueAtTime(frequency,now);
      osc.frequency.exponentialRampToValueAtTime(frequency*.47,now+duration);
      gain.gain.setValueAtTime(level,now);
      gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      osc.connect(gain).connect(master);osc.start(now);osc.stop(now+duration);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }
    void context.resume().catch(()=>{});
    let disposed=false,shiftTime=-1;
    return {
      phase(id){
        if(id==='door'){click(96,.24,.13);click(325,.065,.05);}
        if(id==='ignition')click(430,.11,.064);
        if(id==='headlamps')click(380,.079,.06);
        if(id==='lights')click(220,.14,.086);
        if(id==='gate')click(308,.19,.14);
        if(id==='gate-stop')click(148,.19,.19);
        if(id==='exit')click(176,.105,.085);
        if(id==='threshold')click(96,.24,.19);
      },
      update({cranking,speed,wheelRps,canUpshift,dt,gate,gateSpeed,throttle,distanceFade,fade}){
        const starter=cranking>=0&&cranking<.52?(1-clamp((cranking-.34)/.18))*(.59+.41*Math.sin(cranking*108)**2):0;
        const catchAmount=clamp((cranking-.30)/.32),motion=clamp(speed/6.2),lifting=clamp(gateSpeed/.88);
        const inputRpm=wheelRps*60*FINAL_DRIVE;
        if(shiftTime>=0)shiftTime=Math.min(SHIFT_SECONDS,shiftTime+dt);
        else if(canUpshift&&inputRpm*FIRST_RATIO>=UPSHIFT_RPM)shiftTime=0;
        // Lift, let the revs fall to the new ratio, then feed torque back in.
        const engagement=smooth((shiftTime-.06)/(ENGAGE_SECOND-.06));
        const ratio=FIRST_RATIO+(SECOND_RATIO-FIRST_RATIO)*engagement;
        const uncoupledRpm=IDLE_RPM+throttle*850*(1-smooth(speed/3));
        const engineRpm=Math.max(uncoupledRpm,inputRpm*ratio);
        const lift=smooth(shiftTime/.08)*(1-smooth((shiftTime-ENGAGE_SECOND)/(SHIFT_SECONDS-ENGAGE_SECOND)));
        const load=clamp(motion*.72+throttle)*(1-.90*lift);
        target(crank.gain,starter*.24,.021);
        target(engine.gain,catchAmount*(.12+load*.23));
        target(engine.source.frequency,24+catchAmount*(engineRpm*3/60-24),.039);
        target(engine.filter.frequency,245+load*310);
        target(roller.source.frequency,72+lifting*32);
        target(roller.gain,lifting*.12);
        target(slats.gain,lifting*(.049+.082*Math.sin(gate*93)**2),.025);
        target(tires.gain,motion*.15,.05);
        target(master.gain,volume*.62*(1-.80*distanceFade)*(1-fade),.026);
      },
      dispose(){
        if(disposed)return;disposed=true;
        for(const source of sources)source.stop();
        master.disconnect();
        if(context.state!=='closed')void context.close().catch(()=>{});
      },
    };
  }catch{
    if(context&&context.state!=='closed')void context.close().catch(()=>{});
    return silent;
  }
}

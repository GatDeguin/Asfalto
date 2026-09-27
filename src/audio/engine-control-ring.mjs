/** Fixed SPSC controls. Shared slots publish only after payload; producers never wait. */
export const ENGINE_CONTROL_NAMES=Object.freeze(['rpm','throttle','load','speed','brake','accel','clutch','gear','limiter','engineLevel','exhaustLevel','intakeLevel','mechanicalLevel','roadLevel','brakeLevel','profile','idleRoughness','exhaustCharacter','intakeCharacter','transmissionCharacter','popsLevel','stereoWidth','quality']);
export const ENGINE_CONTROL_INDEX=Object.freeze(Object.fromEntries(ENGINE_CONTROL_NAMES.map((n,i)=>[n,i])));
const DEFAULTS=[820,0,0,0,0,0,0,0,1,1,.92,.62,.38,.44,.56,0,.38,.52,.48,.42,.24,.68,1];
const MIN=[0,0,-1,0,0,-15,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const MAX=[6000,1,1,70,1,15,1,5,1,1.25,1.25,1.25,1.25,1.25,1.25,2,1,1,1,1,1,1,1];
const STRIDE=32,CAPACITY=32;
export function createEngineControlRing({shared=globalThis.crossOriginIsolated===true&&typeof SharedArrayBuffer==='function'}={}){
  const buffer=shared?new SharedArrayBuffer(16+CAPACITY*STRIDE*4):new ArrayBuffer(16+CAPACITY*STRIDE*4);
  const indices=new Int32Array(buffer,0,4),slots=new Float32Array(buffer,16),values=new Float32Array(STRIDE),consumed=new Float32Array(STRIDE);
  values.set(DEFAULTS);consumed.set(values);
  // Browser-created message wrappers still allocate. Payload/backing-store capacity is fixed.
  const free=shared?null:[new Float32Array(STRIDE),new Float32Array(STRIDE),new Float32Array(STRIDE)],transfers=[null];
  let port=null,freeCount=3,dropped=0,closed=false,acknowledgedShift=0;
  function readIndex(i){return shared?Atomics.load(indices,i):indices[i];}
  function writeIndex(i,v){if(shared)Atomics.store(indices,i,v);else indices[i]=v;}
  function publish(){
    if(closed)return false;
    if(port&&!shared){
      if(freeCount===0){dropped++;return false;}
      const data=free[--freeCount];free[freeCount]=null;data.set(values);transfers[0]=data.buffer;
      port.postMessage(data,transfers);transfers[0]=null;return true;
    }
    const write=readIndex(0),next=(write+1)%CAPACITY;
    if(next===readIndex(1)){dropped++;return false;}
    const offset=write*STRIDE;for(let i=0;i<STRIDE;i++)slots[offset+i]=values[i];
    writeIndex(0,next);return true;
  }
  return{values,buffer,shared,
    set(name,value){const i=ENGINE_CONTROL_INDEX[name];if(i===undefined||!Number.isFinite(value))return false;values[i]=Math.max(MIN[i],Math.min(MAX[i],value));return true;},
    // Cumulative sequences survive coalesced/full frames. Bounded to exact Float32 integers.
    start(rpm){values[23]=(values[23]+1)%1048576;values[25]=rpm;},
    shift(intensity){const ack=port&&!shared?acknowledgedShift:readIndex(2);values[26]=values[24]===ack?intensity:Math.max(values[26],intensity);values[24]=(values[24]+1)%1048576;},
    attach(nextPort){port=nextPort;if(!shared)port.onmessage=event=>{const data=event.data;if(!closed&&data instanceof Float32Array&&data.length===STRIDE&&freeCount<free.length){acknowledgedShift=data[24];free[freeCount++]=data;}};},
    publish,
    consume(){let read=readIndex(1),write=readIndex(0),peak=0,sequence=consumed[24];while(read!==write){const offset=read*STRIDE;if(slots[offset+24]!==sequence){peak=Math.max(peak,slots[offset+26]);sequence=slots[offset+24];}for(let i=0;i<STRIDE;i++)consumed[i]=slots[offset+i];read=(read+1)%CAPACITY;}consumed[26]=peak;writeIndex(2,sequence);writeIndex(1,read);return consumed;},
    diagnostics:()=>({shared,dropped,availableTransfers:shared?0:freeCount}),
    dispose(){closed=true;if(port&&!shared)port.onmessage=null;port=null;}
  };
}
/** Self-contained function embedded in the existing AudioWorklet Blob. */
export function createEngineControlReader(port,buffer,initial){
  const stride=32,capacity=32,state=new Float32Array(stride),transfer=[null];state.set(initial);
  const indices=buffer?new Int32Array(buffer,0,4):null,slots=buffer?new Float32Array(buffer,16):null;
  let pendingShift=0,sequence=state[24];
  port.onmessage=event=>{const data=event.data;if(!(data instanceof Float32Array)||data.length!==stride)return;if(data[24]!==sequence){sequence=data[24];pendingShift=Math.max(pendingShift,data[26]);}state.set(data);transfer[0]=data.buffer;port.postMessage(data,transfer);transfer[0]=null;};
  return{state,read(){if(!indices){state[26]=pendingShift;pendingShift=0;return state;}let read=Atomics.load(indices,1),write=Atomics.load(indices,0),peak=0;while(read!==write){const offset=read*stride;if(slots[offset+24]!==sequence){sequence=slots[offset+24];peak=Math.max(peak,slots[offset+26]);}for(let i=0;i<stride;i++)state[i]=slots[offset+i];read=(read+1)%capacity;}state[26]=peak;Atomics.store(indices,2,sequence);Atomics.store(indices,1,read);return state;}};
}

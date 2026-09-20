import {createSoundscapeBanks} from './soundscape-banks.mjs?v=ab85d85161d96bc7';
import {createDrivingAudioBanks} from './driving-audio-banks.mjs?v=81162803ee9cade0';
self.onmessage=({data:{sampleRate,seed}})=>{try{
 const context={sampleRate,createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{data,getChannelData:i=>data[i]};}};
 const result=createSoundscapeBanks(context,seed).build();
 const buffers=result.buffers.map(b=>b.data),drivingBuffers=createDrivingAudioBanks(context).map(b=>b.data);
 self.postMessage({buffers,drivingBuffers,randomState:result.randomState},[...buffers,...drivingBuffers].flat().map(a=>a.buffer));
}catch(error){self.postMessage({error:String(error)});}};

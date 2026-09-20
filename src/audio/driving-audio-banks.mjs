export function createDrivingAudioBanks(context,seed=7139){
 let randomState=seed>>>0;
  const random=()=>((randomState=(Math.imul(randomState,1664525)+1013904223)>>>0)/4294967296)*2-1;
  function noise(seconds) {const b=context.createBuffer(2,Math.ceil(context.sampleRate*seconds),context.sampleRate);
    for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch);let pink=0;for(let i=0;i<a.length;i++){const w=random();pink=.965*pink+.035*w;a[i]=(w*.5+pink*3)*.7;}}
    return b;}
  return [noise(7.1),noise(.48)];

}

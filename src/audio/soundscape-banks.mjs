export function createSoundscapeBanks(context,seed=6147,initialState=seed>>>0){
 let randomState=initialState;
  const hash=n=>{const s=Math.sin(n*127.1+seed*.07)*43758.5453;return s-Math.floor(s);};
  const variation=(t,offset=0)=>{const i=Math.floor(t),f=t-i,s=f*f*(3-2*f);return hash(i+offset)*(1-s)+hash(i+1+offset)*s;};
  const random=()=>((randomState=Math.imul(randomState,1664525)+1013904223>>>0)/4294967296)*2-1;
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

 return {noise,build(){const buffers=[noise(8,.35),noise(11.7,.45,'roof'),forestBank(),waterBank(),noise(4.6,.84),noise(4.6,.84),noise(4.6,.84)];return {buffers,randomState};}};
}

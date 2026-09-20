
// Periodic, asymmetric regional massifs. Low harmonics form connected ridges;
// broad summit lobes and branching gullies replace the repeated scalloped rim.
export function mountainProfile(id,angle,u,layer=0){
  const forest=id==='dos_lagos'||id==='paso_garibaldi';
  const phase=id==='cuesta_lipan'?.9:id==='aconcagua_horcones'?2.2:id==='paso_garibaldi'?3.8:0;
  const a=angle+phase+layer*.49;
  const crest=.42+.065*Math.sin(a*3+1.2)+.035*Math.sin(a*7);
  const falloff=Math.max(0,u<crest?u/crest:(1-u)/(1-crest));
  let summits=0;
  for(const [centre,width,height]of [[.65,.24,.54],[1.85,.39,.27],[3.2,.3,.42],[4.62,.2,.63],[5.65,.35,.25]]){
    const delta=Math.atan2(Math.sin(a-centre),Math.cos(a-centre));
    summits+=Math.exp(-delta*delta/(2*width*width))*height;
  }
  const base=.43+.085*Math.sin(a*3-.7)+.045*Math.sin(a*6+1.2);
  const amplitude=(id==='aconcagua_horcones'?3950:id==='cuesta_lipan'?1750:forest?1330:1400)*(1+layer*.16);
  const ribs=(Math.abs(Math.sin(a*19+u*7+Math.sin(a*5)*2))-.5)*.075+
    (Math.abs(Math.sin(a*37-u*13))-.5)*.028;
  const height=Math.max(0,amplitude*(Math.pow(falloff,1.12)*(base+summits)+ribs*Math.pow(falloff,1.8)));
  return{height,falloff,crest,radius:1+u*.8,rockBand:.5+.5*Math.sin(u*22+Math.sin(a*4)*1.5)};
}

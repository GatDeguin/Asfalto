// Five chapters per fictional return, in travel order. Dimensions are metres.
// Relief features remain outside the road/shoulder envelope.
const designs={
  dos_lagos:[
    ['Bahía y barranca','shore',730,42,8,.35],['Lomas del bosque','grove',710,56,16,.15],
    ['Abra de los lagos','lookout',930,96,18,.9],['Ladera de coihues','cut',640,51,-11,-.25],
    ['Camino de la ribera','shore',780,59,-8,.45],
  ],
  aconcagua_horcones:[
    ['Quebrada alta','cut',1320,126,24,.25],['Terrazas de acarreo','talus',1590,192,42,-.45],
    ['Abanico aluvial','wash',2090,220,-27,.85],['Piedemonte de Horcones','lookout',1740,157,36,.55],
    ['Lomas de entrada','cut',1280,96,-14,.25],
  ],
  cuesta_lipan:[
    ['Repisas de la puna','lookout',870,73,18,.5],['Contracurvas de la quebrada','cut',620,71,-17,-.35],
    ['Laderas estratificadas','talus',820,104,31,.15],['Bajada de los cardones','wash',710,67,-22,.55],
    ['Abra baja','cut',930,96,-12,.3],
  ],
  paso_garibaldi:[
    ['Bosque de altura','grove',1130,100,33,-.15],['Bajada de las turberas','shore',1320,147,-14,.45],
    ['Mirador del paso','lookout',1100,121,28,.9],['Laderas de lenga','cut',830,83,20,-.2],
    ['Valle del arroyo','wash',970,95,-16,.25],
  ],
  cataratas_iguazu:[
    ['Selva cerrada','grove',590,48,10,-.25],['Barrancas de basalto','cut',685,58,17,.35],
    ['Arroyos y palmitos','wash',770,74,-10,.55],['Pozones de laterita','shore',655,62,-6,.15],
    ['Claro del camino','lookout',725,67,9,.6],
  ],
};

export function returnChapters(id){
  return (designs[id]||[]).map(([name,landscape,wavelengthM,offsetM,riseM,widthDeltaM],i)=>({
    id:'return_'+String(i+1).padStart(2,'0'),name,landscape,wavelengthM,offsetM,riseM,widthDeltaM,
  }));
}

export function returnRoadShape(chapters,stationM,lengthM){
  if(!chapters.length)return {offset:0,rise:0,grade:0,width:0};
  const segment=lengthM/chapters.length,index=Math.min(chapters.length-1,Math.floor(stationM/segment));
  const q=chapters[index],s=Math.max(0,Math.min(segment,stationM-index*segment)),u=s/segment;
  // The zero value and zero slope at chapter limits preserve all joins.
  const window=Math.sin(Math.PI*u)**2,dWindow=Math.PI/segment*Math.sin(2*Math.PI*u);
  const wave=2*Math.PI*s/q.wavelengthM,phase=index*1.07;
  const offset=q.offsetM*window*(.86*Math.sin(wave+phase)+.14*Math.sin(wave*1.46+phase*2));
  const riseWave=Math.sin(Math.PI*u*(index%2===0?2:1)+phase);
  const riseFrequency=Math.PI/segment*(index%2===0?2:1);
  return {offset,rise:q.riseM*window*riseWave,grade:q.riseM*(dWindow*riseWave+window*riseFrequency*Math.cos(riseFrequency*s+phase)),
    width:q.widthDeltaM*window};
}

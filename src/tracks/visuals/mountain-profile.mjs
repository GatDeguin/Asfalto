// Artist-authored regional envelopes, in normalized angular coordinates. These are
// scenic adaptations, not a survey/DEM. Sources and image review: regional-v7-references.json.
// Knots describe connected massif/ridge groups; drainage ribs only shape their faces.
const TAU=Math.PI*2;
const ENVELOPES={
 dos_lagos:[[0,.24],[24,.43],[37,.67],[53,.6],[68,.26],[91,.32],[115,.79],[130,.66],[151,.28],[178,.2],[196,.46],[216,.9],[228,.78],[250,.31],[273,.37],[292,.66],[309,.61],[335,.3],[360,.24]],
 paso_garibaldi:[[0,.37],[19,.47],[36,.29],[62,.35],[83,.78],[94,1],[104,.62],[117,.73],[132,.38],[153,.26],[182,.38],[206,.64],[221,.85],[230,.67],[245,.46],[269,.23],[292,.29],[314,.52],[332,.62],[349,.39],[360,.37]],
 aconcagua_horcones:[[0,.15],[25,.2],[48,.26],[61,.41],[73,.62],[81,.86],[85,1],[89,.925],[94,.965],[100,.73],[108,.58],[125,.32],[149,.24],[180,.2],[213,.36],[224,.43],[244,.25],[277,.17],[307,.31],[328,.27],[348,.18],[360,.15]],
 cuesta_lipan:[[0,.44],[23,.58],[47,.53],[71,.37],[88,.22],[110,.28],[135,.61],[163,.75],[183,.66],[204,.36],[217,.21],[239,.32],[257,.69],[278,.87],[301,.79],[319,.58],[339,.33],[360,.44]]
};
// Spend the existing ring vertices on the visible main massif, not empty bearings.
export function mountainAngleAtFraction(id,fraction){
 const f=Math.max(0,Math.min(1,fraction));
 if(id!=='aconcagua_horcones')return f*TAU;
 return (f<.1?f/.1*60:f<.7?60+(f-.1)/.6*60:120+(f-.7)/.3*240)*Math.PI/180;
}
export function mountainProfile(id,angle,u,layer=0){
 const knots=ENVELOPES[id]||ENVELOPES.dos_lagos;
 const a=((angle+(id==='aconcagua_horcones'?0:layer*.29))%TAU+TAU)%TAU,degrees=a/TAU*360;
 let k=0;while(k<knots.length-2&&degrees>knots[k+1][0])k++;
 const t=(degrees-knots[k][0])/(knots[k+1][0]-knots[k][0]);
 // Mainly planar buttresses; subtle easing avoids infinitely sharp, artificial teeth.
 const blend=t*.86+t*t*(3-2*t)*.14,envelope=knots[k][1]*(1-blend)+knots[k+1][1]*blend;
 const crest=.4+.05*Math.sin(a*3+.7)+.035*Math.sin(a*7-1.3);
 const falloff=Math.max(0,u<crest?u/crest:(1-u)/(1-crest));
 const lipan=id==='cuesta_lipan',horcones=id==='aconcagua_horcones';
 const amplitude=horcones?4600:lipan?1750:id==='paso_garibaldi'?1640:1430;
 const valleyProfile=horcones?Math.pow(falloff,1.65):lipan?Math.pow(falloff,.92):Math.pow(falloff,1.16);
 const tributary=Math.sin(a*(lipan?23:31)+u*8+Math.sin(a*7)*1.3);
 const gullies=Math.pow(Math.max(0,1-Math.abs(tributary)*5),2)*Math.sin(Math.PI*falloff)*.052;
 const buttresses=(Math.abs(Math.sin(a*17+u*4))-.5)*.023*Math.pow(falloff,1.3);
 // Connected ribs and incised drainage follow the front/back faces and vanish
 // at the original skyline. Snow retention is an authored deposition proxy.
 const face=Math.pow(Math.max(0,Math.sin(Math.PI*falloff)),.8);
 const massif=Math.max(0,Math.min(1,(envelope-.3)/.5));
 const channelPhase=a*53+u*3.5+Math.sin(a*9)*.5;
 const channel=Math.pow(Math.max(0,1-Math.abs(Math.sin(channelPhase))*3),1.4);
 const rib=(Math.abs(Math.sin(a*27+u*1.6))-.48)*.21;
 const fractured=Math.sin(u*83+a*5)*Math.sin(a*41)*.018;
 const faceRelief=horcones?face*massif*(rib-channel*.095+fractured):0;
 const snowRetention=horcones?Math.max(0,Math.min(1,.07+channel*.8+(.5+.5*Math.cos(a*27+u*1.6))*.13)):1;
 const height=Math.max(0,amplitude*(horcones?[1,.64,.46][Math.min(2,layer)]:1+layer*.09)*(envelope*valleyProfile-gullies+buttresses+faceRelief));
 return{height,falloff,crest,snowRetention,radius:1+u*.8,rockBand:.5+.5*Math.sin(u*19+a*2+Math.sin(a*3)*.8)};
}

export const RADIUS=.044831, ROD_LENGTH=.14478;
export const FIRING_ORDER=[1,5,3,6,2,4], FIRING_PHASES=[0,480,240,600,120,360];
export const VALVE_ANGLE=.15708, MAX_LIFT=.008;
export const PULLEY_RADII={crank:.071,water:.062,alternator:.029};
export const mod=(n,m)=>((n%m)+m)%m;
export function pistonHeight(a,r=RADIUS,l=ROD_LENGTH){if(!(l>r&&r>0))throw new RangeError('La biela debe superar el radio positivo.');return r*Math.cos(a)+Math.sqrt(l*l-(r*Math.sin(a))**2);}
export function rodAngle(a){return Math.asin(RADIUS*Math.sin(a)/ROD_LENGTH);}
export function cycleState(deg,c=1){const phase=mod(deg-FIRING_PHASES[c-1],720),index=Math.floor(phase/180);return {phase,index,name:['Expansión','Escape','Admisión','Compresión'][index],color:['#dc5728','#8c748f','#599bae','#c9a151'][index]};}
// Illustrative 240-degree events and 60-degree overlap; not measured Serie 2 timing.
// Wide enough to admit a convex cam envelope for the modelled flat tappet.
export function valveLift(deg,c,type){const start=type==='valve_intake'?330:150;const p=mod(cycleState(deg,c).phase-start,720);return p<240?MAX_LIFT*Math.sin(Math.PI*p/240)**2:0;}
const normal=[-Math.sin(VALVE_ANGLE),Math.cos(VALVE_ANGLE)];
export const ROCKER_LEFT=[-.012+normal[0]*.135-.043,.259+normal[1]*.135-.393];
export const ROCKER_RIGHT=[.043,-.003];
export const PUSHROD_LENGTH=.253;
export function valveTrain(deg,c,type){const lift=valveLift(deg,c,type);const [x,y]=ROCKER_LEFT,A=normal[0]*x+normal[1]*y,B=-normal[0]*y+normal[1]*x;let lo=0,hi=.2;
 for(let i=0;i<38;i++){const a=(lo+hi)/2;if(-(A*(Math.cos(a)-1)+B*Math.sin(a))<lift)lo=a;else hi=a;}
 const rocker=(lo+hi)/2,co=Math.cos(rocker),si=Math.sin(rocker);const topX=.043+ROCKER_RIGHT[0]*co-ROCKER_RIGHT[1]*si,topY=.393+ROCKER_RIGHT[0]*si+ROCKER_RIGHT[1]*co,dx=topX-.086,dy=Math.sqrt(PUSHROD_LENGTH**2-dx**2),bottomY=topY-dy;
 return {lift,rocker,lifter:bottomY-.137,pushrodAngle:Math.atan2(-dx,dy),top:[topX,topY],bottom:[.086,bottomY]};
}
export function explosionOffset(v,a){const t=Math.max(0,Math.min(1,Number(a)||0));return v.map(n=>n*t);}

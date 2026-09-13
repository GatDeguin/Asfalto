const finite=n=>Number.isFinite(n);
export function createRolloverDetector({confirmSeconds=1.5}={}){
 let unstableSeconds=0,rolledOver=false,upDot=1,lastHeight=null;
 const reset=()=>{unstableSeconds=0;rolledOver=false;lastHeight=null;};
 const diagnostics=()=>({rolledOver,unstableSeconds,upDot});
 return{reset,diagnostics,update({snapshot,status,dt,routeNormal=[0,1,0]}={}){
  if(['IDLE','FINISHED'].includes(status)){reset();return diagnostics();}if(status!=='RUNNING')return diagnostics();
  const c=snapshot?.chassis,q=c?.rotation,v=c?.linearVelocity,a=c?.angularVelocity;
  if(!Array.isArray(q)||q.length!==4||!q.every(finite)||!Array.isArray(v)||!v.every(finite)||!Array.isArray(a)||!a.every(finite)){reset();return diagnostics();}
  const length=Math.hypot(...q);if(length<1e-6){reset();return diagnostics();}const[x,y,z,w]=q.map(n=>n/length),n=Array.isArray(routeNormal)&&routeNormal.length===3&&routeNormal.every(finite)?routeNormal:[0,1,0],nl=Math.hypot(...n)||1;
  upDot=(2*(x*y-w*z)*n[0]+(1-2*(x*x+z*z))*n[1]+2*(y*z+w*x)*n[2])/nl;
  const height=c.position?.[1],stationaryHeight=lastHeight===null||!finite(height)||Math.abs(height-lastHeight)<.04;lastHeight=finite(height)?height:null;
  const unstable=upDot<.2&&Math.hypot(...v)<3&&Math.abs(v[1])<1.2&&Math.hypot(...a)<.8&&stationaryHeight;
  if(upDot>.35||!unstable){unstableSeconds=0;rolledOver=false;}else{unstableSeconds+=Math.max(0,Math.min(.1,finite(dt)?dt:0));rolledOver=unstableSeconds>=confirmSeconds;}
  return diagnostics();
 }};
}

/** Visible segment of the speedometer pointer behind its narrow dial aperture.
 * Coordinates are metres in the instrument plane, relative to its hidden pivot.
 * This is rendering geometry; it does not claim to reproduce the internal mechanism.
 */
export const SS250_SPEED_WINDOW=Object.freeze({minX:-.249,maxX:.249,minY:.053,maxY:.162,halfScaleWidth:.228,scaleHeight:.120,width:.0014});
export function projectSS250SpeedNeedle(speedKph){
 const w=SS250_SPEED_WINDOW,v=Number.isFinite(speedKph)?Math.max(0,Math.min(200,speedKph)):0;
 const dx=(v/200*2-1)*w.halfScaleWidth,dy=w.scaleHeight,length=Math.hypot(dx,dy),u=[dx/length,dy/length],margin=w.width;
 let near=0,far=length+.003;
 for(const [i,min,max] of [[0,w.minX+margin,w.maxX-margin],[1,w.minY+margin,w.maxY-margin]]){
  if(Math.abs(u[i])<1e-12){if(0<min||0>max)throw new Error('Needle misses aperture');continue;}
  const a=min/u[i],b=max/u[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
 }
 if(far<=near)throw new Error('Empty speed pointer segment');
 return {value:v,start:u.map(n=>n*near),end:u.map(n=>n*far),width:w.width};
}
export function createSS250SpeedPointer(T,root){
 const node=root.getObjectByName('SS250_SpeedNeedle'),mesh=node?.isMesh?node:node?.children.find(child=>child.isMesh);if(!mesh?.isMesh)throw new Error('SS250 speed pointer missing');
 const sourceGeometry=mesh.geometry,geometry=new T.BoxGeometry(1,1,1);mesh.geometry=geometry;sourceGeometry.dispose();
 let value=0;
 return {update(kph){const p=projectSS250SpeedNeedle(kph),dx=p.end[0]-p.start[0],dy=p.end[1]-p.start[1];value=p.value;mesh.position.set((p.start[0]+p.end[0])/2,0,-(p.start[1]+p.end[1])/2);mesh.rotation.set(0,Math.atan2(dx,-dy),0);mesh.scale.set(p.width,.0005,Math.hypot(dx,dy));return value;},getReading(){return value;}};
}


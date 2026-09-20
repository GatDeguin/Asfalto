
(function(root){
'use strict';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const lerp=(a,b,t)=>a+(b-a)*t;

function requireFinite(value,label){
  if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} debe ser un número finito`);
  return value;
}

function requireNonNegative(value,label){
  requireFinite(value,label);
  if(value<0)throw new TypeError(`${label} no puede ser negativo`);
  return value;
}

function validateVector(value,label){
  if(!Array.isArray(value)||value.length!==3)throw new Error(`${label} debe tener tres componentes`);
  for(let index=0;index<3;index++)requireFinite(value[index],`${label}[${index}]`);
  return value;
}

function validateSample(point,index,step){
  if(!point||typeof point!=='object')throw new Error(`Muestra ${index} inválida`);
  requireFinite(point.s,`samples[${index}].s`);
  if(point.s!==index*step)throw new Error('Las muestras deben respetar la grilla canónica');
  const tangent=validateVector(point.tangent,`samples[${index}].tangent`);
  validateVector(point.position,`samples[${index}].position`);
  validateVector(point.left,`samples[${index}].left`);
  if(!Number.isFinite(Math.hypot(...tangent))||Math.hypot(...tangent)===0)throw new Error(`samples[${index}].tangent inválida`);
  for(const field of ['elevationAbs','curvature','bankRad','width','targetSpeedKph'])requireFinite(point[field],`samples[${index}].${field}`);
  if(point.width<=0)throw new Error(`samples[${index}].width debe ser positiva`);
}
const freeze=value=>Object.freeze(value);


function validateRoute(route){
  if(!route||route.coordinateSystem!=='Y_UP_METERS')throw new Error('Dos Lagos requiere una ruta Y_UP_METERS');
  if(route.routeLengthM!==10250||route.sampleStepM!==5||route.samples?.length!==2051)throw new Error('Contrato de ruta Dos Lagos inválido');
  if(!Array.isArray(route.sectors)||route.sectors.length!==6)throw new Error('Dos Lagos requiere seis sectores');
  for(let index=0;index<route.samples.length;index++)validateSample(route.samples[index],index,route.sampleStepM);
  return route;
}

function createDosLagosTrack(routeInput){
  const route=validateRoute(routeInput);
  const source=route.samples;
  const length=route.routeLengthM;
  const step=route.sampleStepM;
  let maxCurvature=0;
  for(const point of source)maxCurvature=Math.max(maxCurvature,Math.abs(Number(point.curvature)||0));

  function sample(distance){
    requireFinite(distance,'distance');
    const s=clamp(distance,0,length);
    const lower=Math.min(source.length-1,Math.floor(s/step));
    const upper=Math.min(source.length-1,lower+1);
    const a=source[lower],b=source[upper];
    const span=Math.max(1e-9,b.s-a.s);
    const t=upper===lower?0:clamp((s-a.s)/span,0,1);
    const x=lerp(a.position[0],b.position[0],t);
    const y=lerp(a.position[1],b.position[1],t);
    const z=lerp(a.position[2],b.position[2],t);
    let tx=lerp(a.tangent[0],b.tangent[0],t);
    let ty=lerp(a.tangent[1],b.tangent[1],t);
    let tz=lerp(a.tangent[2],b.tangent[2],t);
    const tangentLength=Math.hypot(tx,ty,tz)||1;
    tx/=tangentLength;ty/=tangentLength;tz/=tangentLength;
    const heading=Math.atan2(tx,-tz);
    return {
      s,
      u:s/length,
      sectorId:t<.5?a.sectorId:b.sectorId,
      x,y,z,tx,ty,tz,
      rx:Math.cos(heading),
      rz:Math.sin(heading),
      heading,
      curvature:lerp(Number(a.curvature)||0,Number(b.curvature)||0,t),
      width:lerp(Number(a.width)||7,Number(b.width)||7,t),
      bank:lerp(Number(a.bankRad)||0,Number(b.bankRad)||0,t),
      targetSpeedKph:lerp(Number(a.targetSpeedKph)||110,Number(b.targetSpeedKph)||110,t),
    };
  }

  const shoulder=.9;
  const barrier=2.8;
  function widthAt(distance){return sample(distance).width}
  function bankAt(distance){return sample(distance).bank}
  function idealLineOffset(distance){
    requireFinite(distance,'distance');
    const here=sample(distance),ahead=sample(distance+35);
    const turn=clamp(here.curvature*130+ahead.curvature*75,-1,1);
    return -turn*here.width*.16;
  }
  function surfaceAt(distance,lateral,vehicleHalfWidth=0){
    requireFinite(distance,'distance');
    requireFinite(lateral,'lateral');
    requireNonNegative(vehicleHalfWidth,'vehicleHalfWidth');
    const width=widthAt(distance);
    const edge=width*.5-Math.max(0,vehicleHalfWidth);
    const absolute=Math.abs(lateral);
    const side=lateral<0?-1:1;
    if(absolute<=edge)return {kind:'asphalt',grip:1,drag:.006,roughness:.02,side};
    if(absolute<=edge+.36)return {kind:'curb',grip:.86,drag:.04,roughness:.62,side};
    if(absolute<=edge+shoulder)return {kind:'shoulder',grip:.72,drag:.15,roughness:.35,side};
    if(absolute>=edge+barrier)return {kind:'barrier',grip:.25,drag:1.8,roughness:1,side};
    return {kind:'grass',grip:.48,drag:.58,roughness:.72,side};
  }
  function resolveBarrierCollision(distance,lateral,lateralSpeedMps=0,vehicleHalfWidth=.91){
    requireFinite(distance,'distance');
    requireFinite(lateral,'lateral');
    requireFinite(lateralSpeedMps,'lateralSpeedMps');
    requireNonNegative(vehicleHalfWidth,'vehicleHalfWidth');
    const frame=sample(distance);
    const allowed=frame.width*.5+barrier-Math.max(0,vehicleHalfWidth);
    if(Math.abs(lateral)<=allowed){
      return freeze({collided:false,lateral,lateralSpeedMps});
    }
    const side=lateral<0?-1:1;
    const inwardSpeed=lateralSpeedMps*side;
    return freeze({
      collided:true,
      lateral:side*allowed,
      lateralSpeedMps:inwardSpeed>0?-lateralSpeedMps*.08:lateralSpeedMps,
    });
  }

  const checkpoints=route.sectors.map(sector=>Math.round(Number(sector.km_end)*1000));
  const brakingMarkers=(route.corners||[]).map(corner=>freeze({
    s:clamp(Number(corner.apex_km)*1000-150,0,length),
    targetS:clamp(Number(corner.apex_km)*1000,0,length),
    distance:150,
    direction:String(corner.direction||'').includes('Izquierda')?-1:1,
    severity:clamp(90/Math.max(30,Number(corner.radius_m)||90),.18,1),
  }));

  return freeze({
    id:'dos_lagos',
    name:'Dos Lagos',
    description:'Ruta patagónica punto a punto entre Villarino y Falkner.',
    biome:'patagonia',
    environment:'forest',
    seed:501,
    palette:freeze({
      skyTop:'#527f9d',skyHorizon:'#cadce3',ground:'#526448',dirt:'#806c55',
      grassBottom:'#344e2f',grassTop:'#69805b',treeBottom:'#173326',treeTop:'#45694a',
      curbA:'#e9e7df',curbB:'#c43d32',fog:'#b9cbd0',waterDeep:'#173f55',
      waterMid:'#427b91',waterHighlight:'#b9e0e5',
    }),
    shoulder,
    barrier,
    closed:false,
    length,
    maxCurvature,
    checkpoints:freeze(checkpoints),
    speedTrap:freeze({start:7550,end:8250}),
    brakingMarkers:freeze(brakingMarkers),
    sample,widthAt,bankAt,idealLineOffset,surfaceAt,resolveBarrierCollision,
    forwardDistance(from,to){
      requireFinite(from,'from');requireFinite(to,'to');
      return clamp(to,0,length)-clamp(from,0,length);
    },
    shortestDistance(from,to){
      requireFinite(from,'from');requireFinite(to,'to');
      return clamp(to,0,length)-clamp(from,0,length);
    },
  });
}

function createWorldMatrix(frame,options={}){
  if(!frame||typeof frame!=='object')throw new TypeError('Frame de ruta inválido');
  requireFinite(frame.x,'frame.x');
  requireFinite(frame.y,'frame.y');
  requireFinite(frame.z,'frame.z');
  requireFinite(frame.heading,'frame.heading');
  if(!options||typeof options!=='object')throw new TypeError('Opciones de mundo inválidas');
  const lateral=options.lateral===undefined?0:requireFinite(options.lateral,'options.lateral');
  const roadY=options.roadY===undefined?-1.035:requireFinite(options.roadY,'options.roadY');
  const viewZ=options.viewZ===undefined?1.35:requireFinite(options.viewZ,'options.viewZ');
  const forwardX=Math.sin(frame.heading),forwardZ=-Math.cos(frame.heading);
  const lateralX=Math.cos(frame.heading),lateralZ=Math.sin(frame.heading);
  const carX=frame.x+lateralX*lateral,carZ=frame.z+lateralZ*lateral;
  return freeze([
    lateralX,0,lateralZ,-(lateralX*carX+lateralZ*carZ),
    0,1,0,roadY-frame.y,
    -forwardX,0,-forwardZ,viewZ+forwardX*carX+forwardZ*carZ,
    0,0,0,1,
  ]);
}

root.AsfaltoV5TrackCore=freeze({validateRoute,createDosLagosTrack,createWorldMatrix});
})(globalThis);


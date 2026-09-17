import {VEHICLE_CATALOG} from '../render/vehicle-catalog.mjs?v=balance-20260917';
import {AWARDS} from './v7-championship-catalog.mjs';
import {FUEL_MODEL_ID} from '../game/fuel-observer.mjs';
// Selectable presentation identity only; the catalog does not establish historical physics calibration.
// Retiring a selectable model must not erase legitimately earned historical medals.
const SELECTABLE_VEHICLES=new Set(['chevy',...Object.values(VEHICLE_CATALOG).filter(vehicle=>vehicle.selectable===true).map(vehicle=>vehicle.id)]);
const TRACKS=new Set(['dos_lagos','aconcagua_horcones','cuesta_lipan','paso_garibaldi','cataratas_iguazu']);
const TYPES={vmax:['maximumStableSpeedKph','km/h','physical-stable-speed-window'],accel100:['elapsedSeconds','s','physical-speed-crossing'],accel160:['elapsedSeconds','s','physical-speed-crossing'],m500:['elapsedSeconds','s','physical-route-distance-gate'],m1000:['elapsedSeconds','s','physical-route-distance-gate'],recovery:['elapsedSeconds','s','physical-fourth-gear-speed-crossings'],brake100:['brakingDistanceM','m','physical-brake-torque-to-supported-stop'],slalom:['physicalGates','puertas','ordered-physical-gate-crossings'],turn:['turningDiameterM','m','observed-circle-fit'],wet:['wetDistanceM','m','physical-wet-support-and-braking'],speedo:['speedometerRmsErrorKph','km/h RMS','actual-display-versus-physical-velocity'],consumption:['modeledLitersPer100Km','L/100 km estimados por modelo','integrated-reference-fuel-model']};
export const ROAD_TEST_AWARDS=Object.freeze(AWARDS.filter(a=>a.kind==='test-medal'));
export function freezeRoadTestData(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeRoadTestData);Object.freeze(value);}return value;}
const finite=value=>typeof value==='number'&&Number.isFinite(value),positive=value=>finite(value)&&value>0,integer=value=>Number.isSafeInteger(value)&&value>=0;
const requireValue=(condition,message)=>{if(!condition)throw new TypeError('Recibo de prueba física inválido: '+message);};
export function validateRoadTestReceipt(value){
 const r=structuredClone(value),m=r?.measurement,e=r?.evidence,type=TYPES[r?.testId];
 requireValue(r?.schema==='asfalto-road-test-receipt/v1'&&r.source==='authoritative-road-test'&&r.qa===false&&r.valid===true&&r.objectiveComplete===true,'origen u objetivo');
 requireValue(type&&['sessionId','resultId','configurationHash'].every(key=>typeof r[key]==='string'&&r[key].length>0&&r[key].length<=256),'identidad');
 requireValue(integer(r.sessionSequence)&&r.sessionSequence>0&&TRACKS.has(r.trackId)&&SELECTABLE_VEHICLES.has(r.vehicleId)&&['Histórica','Restomod'].includes(r.class),'sesión, vehículo o ruta');
 requireValue(typeof r.finishedAt==='string'&&finite(Date.parse(r.finishedAt))&&Array.isArray(r.invalidReasons)&&r.invalidReasons.length===0,'fecha o invalidaciones');
 requireValue(e?.fixedHz===120&&integer(e.startTick)&&integer(e.endTick)&&e.endTick>=e.startTick&&integer(e.sampleCount)&&e.sampleCount>0&&e.sampleCount<=e.endTick-e.startTick+1&&finite(e.distanceM)&&e.distanceM>=0&&Array.isArray(e.gates),'evidencia física');
 requireValue(m?.metric===type[0]&&m.unit===type[1]&&m.method===type[2]&&finite(m.value)&&m.value>=0,'medición');
 if(m.metric==='elapsedSeconds')requireValue(positive(m.value)&&m.value<=e.sampleCount/120,'tiempo medido');
 if(r.testId==='vmax')requireValue(m.value>=175&&m.stableSeconds===3&&e.sampleCount>=361,'ventana de velocidad máxima');
 if(r.testId==='accel100'||r.testId==='accel160')requireValue(m.targetKph===(r.testId==='accel100'?100:160)&&e.sampleCount>=61,'salida detenida');
 if(r.testId==='m500'||r.testId==='m1000'){const target=r.testId==='m500'?500:1000;requireValue(m.targetMeters===target&&finite(m.measuredProgressM)&&m.measuredProgressM>=target&&e.sampleCount>=61,'distancia desde partida');}
 if(r.testId==='brake100')requireValue(positive(m.value)&&positive(m.elapsedSeconds)&&m.elapsedSeconds<=e.sampleCount/120&&e.sampleCount>=31,'frenada');
 if(r.testId==='slalom'){requireValue(m.value===8&&e.gates.length===8,'ocho puertas');let last=e.startTick-1;for(let i=0;i<8;i++){const g=e.gates[i];requireValue(g?.id==='slalom-'+(i+1)&&integer(g.tick)&&g.tick>last&&g.tick<=e.endTick&&Array.isArray(g.position)&&g.position.length===3&&g.position.every(finite),'cruce ordenado');last=g.tick;}}
 else requireValue(e.gates.length===0,'puertas ajenas');
 if(r.testId==='turn')requireValue(finite(m.radiusM)&&m.radiusM>=2&&m.radiusM<=30&&Math.abs(m.value-2*m.radiusM)<1e-8&&finite(m.rmsResidualM)&&m.rmsResidualM>=0&&m.rmsResidualM<=Math.max(.1,m.radiusM*.08)&&finite(m.sweepRad)&&Math.abs(m.sweepRad)>=2*Math.PI-.08,'círculo observado');
 if(r.testId==='wet')requireValue(m.value>=1800&&finite(m.brakeSpeedDropMps)&&m.brakeSpeedDropMps>=10/3.6&&finite(m.peakLateralAccelerationMps2)&&m.peakLateralAccelerationMps2>=.5,'apoyo y frenada en mojado');
 if(r.testId==='speedo')requireValue(m.stableSeconds===5&&e.sampleCount>=600&&finite(m.signedBiasKph)&&Math.abs(m.signedBiasKph)<=m.value+1e-8,'comparación de instrumento');
 if(r.testId==='consumption'){const f=e.fuel;requireValue(m.modeled===true&&m.modelId===FUEL_MODEL_ID&&f?.modeled===true&&f.modelId===FUEL_MODEL_ID&&positive(f.displacementLiters)&&positive(f.fuelMultiplier)&&f.sampleCount===e.sampleCount&&finite(m.speedStdDevKph)&&m.speedStdDevKph>=0&&m.speedStdDevKph<=2&&m.windowDistanceM>=2400&&positive(m.fuelUsedLiters)&&integer(m.windowStartTick)&&e.endTick-m.windowStartTick>=14399&&e.sampleCount>=14400&&Math.abs(m.value-m.fuelUsedLiters/m.windowDistanceM*100000)<1e-8,'consumo estimado por modelo');}
 else requireValue(e.fuel===null,'combustible ajeno');
 return freezeRoadTestData(r);
}
export function getRoadTestDisplayItems(profile){
 const extension=profile?.roadTestsV7;if(extension?.schema!=='asfalto-road-tests/v1'||!extension.receipts||typeof extension.receipts!=='object'||Array.isArray(extension.receipts))return[];
 const byTest=new Map(),seenSessions=new Set();for(const [id,value] of Object.entries(extension.receipts)){try{const receipt=validateRoadTestReceipt(value);if(id!==receipt.resultId||seenSessions.has(receipt.sessionId))continue;seenSessions.add(receipt.sessionId);const previous=byTest.get(receipt.testId);if(!previous||Date.parse(receipt.finishedAt)<Date.parse(previous.finishedAt))byTest.set(receipt.testId,receipt);}catch{/* Invalid saved data never unlocks a medal. */}}
 return ROAD_TEST_AWARDS.filter(a=>byTest.has(a.testId)).map(award=>{const receipt=byTest.get(award.testId);return{...award,receiptId:receipt.resultId,sessionId:receipt.sessionId,vehicleId:receipt.vehicleId,class:receipt.class,earnedAt:receipt.finishedAt,conditions:[{trackId:receipt.trackId}],measurement:receipt.measurement,source:'road-test-receipt'};});
}
export function roadTestResultSheet(receipt,{title=receipt.testId,series=[]}={}){const r=validateRoadTestReceipt(receipt),m=r.measurement;return{id:r.resultId,receiptId:r.resultId,date:r.finishedAt,testId:r.testId,title,valid:true,source:'authoritative-road-test',main:m.value.toFixed(m.metric==='elapsedSeconds'?3:2),unit:m.unit,elapsed:r.evidence.sampleCount/120*1000,distance:r.evidence.distanceM,class:r.class,vehicleId:r.vehicleId,measurement:m,reasons:[],series:series.slice(-500),note:r.testId==='consumption'?'Consumo estimado por modelo genérico; no es un sensor ni una calibración histórica.':''};}

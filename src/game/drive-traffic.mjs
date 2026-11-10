import {TRAFFIC_PARKING} from './traffic-parking.mjs?v=3006726ba162354a';

// Shared finishes, with a paint and running gear combination selected for each body.
const FINISHES = ['restored','daily','work'];
const FLEET = {
  chevy:[['#284c6c',0,0,0],['#967b55',1,1,2],['#354740',2,2,1]],
  chevrolet_1969:[['#b85c2b',0,0,0],['#a39b8d',1,1,2],['#516c73',2,2,1]],
  chevy_400_1957:[['#782a29',0,1,0],['#4f6467',2,0,1],['#9e8c70',1,2,2]],
  falcon:[['#2c614f',0,0,0],['#6d5954',2,1,2],['#525842',1,2,1]],
  belair_1957:[['#087782',0,0,1],['#924637',2,1,0],['#6f7775',1,2,2]],
  pickup_3100:[['#1d6580',0,1,1],['#7b3930',2,0,0],['#58674d',1,2,2]],
};
const MODELS = Object.keys(FLEET);
const MAX_REGULAR_SPEED = 60 / 3.6;
const VISIBILITY_M = 270;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function finishFor(model,index) {
  const [color,rim,tire,brake]=FLEET[model][index];
  return {finish:FINISHES[index],color,rim,tire,brake};
}

export function createDriveTrafficPlan({lengthM, seed, trackId, canPark = () => true}) {
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 2 ** 32;
  };
  const roster = [];
  for (const model of MODELS) {
    const count = 2 + Number(random() > .55);
    const base = Math.floor(random() * FINISHES.length);
    const firstDriver = Math.floor(random() * 6);
    const sameDirection = Math.floor(random() * count);
    for (let i = 0; i < count; i++) {
      roster.push({kind:'regular', model, direction:i === sameDirection ? 1 : -1,
        ...finishFor(model,(base+i)%FINISHES.length), driver:(firstDriver+i)%6,
        speedMps:MAX_REGULAR_SPEED * (.74 + .26 * random())});
    }
  }
  for (let i = roster.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }
  const special = (kind, speedMps) => {
    const model=MODELS[Math.floor(random()*MODELS.length)];
    return {kind,speedMps,direction:1,model,...finishFor(model,Math.floor(random()*FINISHES.length)),
      driver:Math.floor(random()*6)};
  };
  const slotCount = roster.length + 2;
  const margin = Math.min(480, lengthM * .08);
  const spacing = (lengthM - 2 * margin) / (slotCount - 1);
  const station = (slot, jitter = 0) => margin + (slot + jitter) * spacing;
  const parkSlots = Array.from({length:slotCount - 2}, (_, i) => i + 1);
  const parked = special('parked', 0);
  const sites = (TRAFFIC_PARKING[trackId] || []).filter(site => site.atM > margin && site.atM < lengthM-margin && canPark(site.atM,site));
  let parking, parkingSlot;
  if (trackId) {
    parking = sites[Math.floor(random()*sites.length)];
    if (parking) parkingSlot = clamp(Math.round((parking.atM-margin)/spacing),1,slotCount-2);
  } else {
    // Compatibility for callers with custom routes and their own placement validation.
    const start=Math.floor(random()*parkSlots.length);
    parkingSlot=[...parkSlots.slice(start),...parkSlots.slice(0,start)].find(slot=>canPark(station(slot)));
  }
  const passing = special('passing', 30 + random() * 5);
  const passingSlots = parkSlots.filter(slot => slot !== parkingSlot);
  const passingSlot = passingSlots[Math.floor(random() * passingSlots.length)];
  return Array.from({length:slotCount}, (_, id) => {
    if (id === parkingSlot) return {...parked, id, atM:parking?.atM??station(id), ...(parking?{parking}:{})};
    if (id === passingSlot) return {...passing, id, atM:station(id)};
    const regular = roster.pop();
    const jitter = (random() - .5) * (id===0||id===slotCount-1?.08:.32);
    return regular && {...regular, id, atM:station(id,jitter)};
  }).filter(Boolean).sort((a,b)=>a.atM-b.atM).map((event,index)=>({
    ...event,
    passenger:(index+seed%3)%3===0 ? (event.driver+1+index%5)%6 : null,
  }));
}

export function createDriveTraffic(plan, {lengthM}) {
  const active = [];
  let cursor = 0, elapsed = 0;
  function update({progressM, speedMps, lateralM, dt, passingAllowed = () => true}) {
    if (!(dt >= 0) || !Number.isFinite(progressM)) return active;
    elapsed += dt;
    for (let i = active.length - 1; i >= 0; i--) {
      const car = active[i];
      car.poseTimeS += dt;
      const gap = car.progressM - progressM;
      if (car.kind === 'parked') {
        car.hazards = elapsed % 1.08 < .54;
      } else if (car.kind === 'passing') {
        car.currentSpeedMps = Math.min(car.speedMps, Math.max(24, speedMps + 8));
        car.progressM = Math.min(lengthM, car.progressM + dt * car.currentSpeedMps);
        const before=car.side;
        if (gap > 42) car.side = Math.min(1, car.side + dt * .52);
        car.laneChangeRate=dt>0?(car.side-before)/dt:0;
      } else {
        car.progressM = clamp(car.progressM + dt * car.speedMps * car.direction, 0, lengthM);
      }
      if (Math.abs(car.progressM - progressM) > VISIBILITY_M || car.progressM <= 0 || car.progressM >= lengthM) {
        active.splice(i, 1);
      }
    }
    while (cursor < plan.length) {
      const event = plan[cursor], gap = event.atM - progressM;
      if (event.kind === 'passing') {
        if (gap > 0) break;
        if (gap < -500) { cursor++; continue; }
        if (lateralM < -.35 || speedMps < 4 || speedMps > 26 ||
          active.some(car => car.kind !== 'parked') || !passingAllowed()) break;
        active.push({...event, progressM:Math.max(1, progressM - 105), side:-1, hazards:false, poseTimeS:0});
      } else {
        if (gap > 210) break;
        if (gap < -45) { cursor++; continue; }
        if (event.kind === 'regular' && active.some(car => car.kind !== 'parked')) break;
        const parked = event.kind === 'parked';
        const lead=event.direction===1?165:212;
        active.push({...event, progressM:parked ? event.atM : Math.min(lengthM - 1, progressM + lead),
          side:parked ? 1 : event.direction, hazards:parked && elapsed % 1.08 < .54, poseTimeS:0});
      }
      cursor++;
    }
    return active;
  }
  return {update, clearActive(){active.length=0;}, diagnostics:() => ({scheduled:plan.length, triggered:cursor, next:plan[cursor]?.kind||null, active:active.map(car => ({...car}))})};
}

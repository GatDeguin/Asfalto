const MODELS = ['chevy', 'chevrolet_1969', 'chevy_400_1957', 'falcon', 'belair_1957', 'pickup_3100'];
const PAINTS = ['#193d55', '#943829', '#45654c', '#d5bc88', '#604451', '#bfc6bb', '#444843', '#af793c'];
const MAX_REGULAR_SPEED = 60 / 3.6;
const VISIBILITY_M = 270;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createDriveTrafficPlan({lengthM, seed, canPark = () => true}) {
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 2 ** 32;
  };
  const roster = [];
  for (const model of MODELS) {
    const count = 2 + Number(random() > .55);
    const base = Math.floor(random() * PAINTS.length);
    const sameDirection = Math.floor(random() * count);
    for (let i = 0; i < count; i++) {
      roster.push({kind:'regular', model, direction:i === sameDirection ? 1 : -1,
        color:PAINTS[(base + i * 3) % PAINTS.length], rim:(base + i) % 3,
        tire:(base + i * 2) % 3, brake:(base + i) % 3,
        driver:(base + i) % 6,
        speedMps:MAX_REGULAR_SPEED * (.74 + .26 * random())});
    }
  }
  for (let i = roster.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }
  const special = (kind, speedMps) => ({
    kind, speedMps, direction:1, model:MODELS[Math.floor(random() * MODELS.length)],
    color:PAINTS[Math.floor(random() * PAINTS.length)], rim:Math.floor(random() * 3),
    tire:Math.floor(random() * 3), brake:Math.floor(random() * 3), driver:Math.floor(random() * 6),
  });
  const slotCount = roster.length + 2;
  const margin = Math.min(480, lengthM * .08);
  const spacing = (lengthM - 2 * margin) / (slotCount - 1);
  const station = (slot, jitter = 0) => margin + (slot + jitter) * spacing;
  const parkSlots = Array.from({length:slotCount - 2}, (_, i) => i + 1);
  const start = Math.floor(random() * parkSlots.length);
  const parkingSlot = [...parkSlots.slice(start), ...parkSlots.slice(0, start)]
    .find(slot => canPark(station(slot)));
  const parked = special('parked', 0);
  const passing = special('passing', 30 + random() * 5);
  const passingSlots = parkSlots.filter(slot => slot !== parkingSlot);
  const passingSlot = passingSlots[Math.floor(random() * passingSlots.length)];
  return Array.from({length:slotCount}, (_, id) => {
    if (id === parkingSlot) return {...parked, id, atM:station(id)};
    if (id === passingSlot) return {...passing, id, atM:station(id)};
    const regular = roster.pop();
    const jitter = (random() - .5) * (id===0||id===slotCount-1?.08:.32);
    return regular && {...regular, id, atM:station(id,jitter)};
  }).filter(Boolean);
}

export function createDriveTraffic(plan, {lengthM}) {
  const active = [];
  let cursor = 0, elapsed = 0;
  function update({progressM, speedMps, lateralM, dt, passingAllowed = () => true}) {
    if (!(dt >= 0) || !Number.isFinite(progressM)) return active;
    elapsed += dt;
    for (let i = active.length - 1; i >= 0; i--) {
      const car = active[i];
      const gap = car.progressM - progressM;
      if (car.kind === 'parked') {
        car.hazards = elapsed % 1.08 < .54;
      } else if (car.kind === 'passing') {
        car.currentSpeedMps = Math.min(car.speedMps, Math.max(24, speedMps + 8));
        car.progressM = Math.min(lengthM, car.progressM + dt * car.currentSpeedMps);
        if (gap > 42) car.side = Math.min(1, car.side + dt * .52);
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
        active.push({...event, progressM:Math.max(1, progressM - 105), side:-1, hazards:false});
      } else {
        if (gap > 210) break;
        if (gap < -45) { cursor++; continue; }
        if (event.kind === 'regular' && active.some(car => car.kind !== 'parked')) break;
        const parked = event.kind === 'parked';
        const lead=event.direction===1?165:212;
        active.push({...event, progressM:parked ? event.atM : Math.min(lengthM - 1, progressM + lead),
          side:parked ? 1 : event.direction, hazards:parked && elapsed % 1.08 < .54});
      }
      cursor++;
    }
    return active;
  }
  return {update, diagnostics:() => ({scheduled:plan.length, triggered:cursor, next:plan[cursor]?.kind||null, active:active.map(car => ({...car}))})};
}

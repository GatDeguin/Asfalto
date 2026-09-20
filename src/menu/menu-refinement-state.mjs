import { summarizeRoadTestRecords } from './roadtest-records.mjs?v=680bf8ce08be7252';

export function testPresentationState({ sheets, testId, vehicleClass, locked = false, selected = false }) {
  const records = summarizeRoadTestRecords(sheets, testId, vehicleClass);
  const progress = records.best ? 'completed' : records.attempts ? 'attempted' : 'untried';
  return { ...records, progress, selected: selected && !locked, available: !locked,
    label: locked ? 'Por desbloquear' : records.best ? 'Ficha válida' : records.attempts ? 'Buscá tu ficha válida' : 'Sin intentar' };
}

export function testCollectionSummary(sheets, testIds, vehicleClass) {
  const ids = [...new Set(testIds)];
  const records = ids.map(testId => summarizeRoadTestRecords(sheets, testId, vehicleClass));
  const completed = records.filter(r => r.best).length;
  return { completed, total: ids.length, finished: ids.length > 0 && completed === ids.length,
    attempts: records.reduce((s, r) => s + r.attempts, 0),
    validAttempts: records.reduce((s, r) => s + r.validAttempts, 0),
    entries: ids.map((testId, i) => ({testId, best: records[i].best})) };
}

export function routePreviewKey(track, sky, weather) {
  return [track, sky, weather].map(value => String(value || '').replace(/[^a-z0-9_-]/g, '')).join('--');
}

// Reserve the navigation, lower identification plate and the full car silhouette.
export function menuFrameRegion({ width, height, view = 'home', reservedLeftPx = 650 }) {
  if (width <= 720 && height > width) return { left:.07, right:.93, top:.17, bottom:.82 };
  if (view === 'appearance') return { left:Math.min(.86, Math.max(0, reservedLeftPx / width)), right:.96, top:.22, bottom:.81 };
  if (view === 'modes') return { left:.62, right:.96, top:.05, bottom:.45 };
  return { left:width / height > 2.1 ? .36 : .34, right:.95, top:.17, bottom:.76 };
}

export function fitMenuCar(T, car, camera, {width, height, view='home', yaw=.56, pitch=.13, reservedLeftPx}={}) {
  if (!(width > 0 && height > 0)) throw new RangeError('Viewport inválido');
  car.updateWorldMatrix(true, true);
  const box = new T.Box3().setFromObject(car), target = box.getCenter(new T.Vector3());
  const region = menuFrameRegion({width, height, view, reservedLeftPx});
  const forward = new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  const right = new T.Vector3().crossVectors(new T.Vector3(0,1,0), forward).normalize();
  const up = new T.Vector3().crossVectors(forward, right).normalize();
  const tan = Math.tan(camera.fov * Math.PI / 360), aspect=width/height;
  let radius=3.3;
  for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
    const v = new T.Vector3(x,y,z).sub(target), near=v.dot(forward);
    radius=Math.max(radius, near+Math.abs(v.dot(right))/(tan*aspect*(region.right-region.left)*.94), near+Math.abs(v.dot(up))/(tan*(region.bottom-region.top)*.94));
  }
  return { yaw, pitch, radius, target:target.toArray(), region,
    offset:[(.5-(region.left+region.right)/2)*width, (.5-(region.top+region.bottom)/2)*height] };
}

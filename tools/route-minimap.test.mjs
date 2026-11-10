import test from 'node:test';
import assert from 'node:assert/strict';

import { createRouteMinimapGeometry } from '../src/ui/route-minimap.mjs?v=4ea627b08927281c';

function route(points, closed = false) {
  const length = points.at(-1)[0];
  const samples = [];
  return {
    length,
    closed,
    samples,
    routeQuery: {
      sample(s) {
        assert.ok(s >= 0 && s <= length, `station ${s} must be within the route`);
        samples.push(s);
        const next = points.findIndex(([station]) => station > s);
        const end = next < 0 ? points.length - 1 : next;
        const [startS, x, z] = points[end - 1];
        const [endS, endX, endZ] = points[end];
        const t = (s - startS) / (endS - startS);
        const dx = endX - x;
        const dz = endZ - z;
        const d = Math.hypot(dx, dz);
        return { position: [x + t * dx, 0, z + t * dz], frame: { tangent: [dx / d, 0, dz / d] } };
      },
    },
  };
}

test('the map shows the right-hand bend and tracks the car relative to the road', () => {
  const track = route([[0, 0, 0], [160, 160, 0], [440, 160, 280]]);
  const minimap = createRouteMinimapGeometry();
  const frame = minimap.update(track, { s: 80, lateral: -4, headingError: Math.PI / 2 });

  assert.deepEqual([...frame.ahead.slice(0, 4)], [0, 0, 0, -8]);
  assert.deepEqual([...frame.ahead.slice(40, 42)], [80, -80]);
  assert.equal(frame.markerX, -4);
  assert.equal(frame.markerAngle, Math.PI / 2);
});

test('a point-to-point map ends at the exact finish and never joins it to the start', () => {
  const track = route([[0, 0, 0], [160, 160, 0], [205, 160, 45]]);
  const minimap = createRouteMinimapGeometry();
  const nearFinish = minimap.update(track, { s: 200 });
  assert.deepEqual([...nearFinish.ahead.slice(0, nearFinish.aheadCount * 2)], [0, 0, 0, -5]);

  const atFinish = minimap.update(track, { s: 205 });
  assert.equal(atFinish.aheadCount, 1);
  assert.ok(track.samples.includes(205));
});

test('a circuit previews the same road on either side of the lap seam', () => {
  const track = route([[0, 0, 0], [100, 100, 0], [200, 100, 100], [300, 0, 100], [400, 0, 0]], true);
  const minimap = createRouteMinimapGeometry();
  const beforeSeam = minimap.update(track, { s: 392 });
  assert.deepEqual([...beforeSeam.ahead.slice(0, 6)], [0, 0, 0, -8, 8, -8]);

  const afterSeam = minimap.update(track, { s: 0 });
  const last = (afterSeam.behindCount - 2) * 2;
  assert.equal(afterSeam.behind[last], 8);
  assert.ok(afterSeam.behind[last + 1] === 0);
  assert.deepEqual([...afterSeam.ahead.slice(0, 4)], [0, 0, 0, -8]);
});

test('the minimap reuses samples and buffers between ticks and switches route geometry with the track', () => {
  const straight = route([[0, 0, 0], [800, 800, 0]]);
  const turn = route([[0, 0, 0], [160, 160, 0], [440, 160, 280]]);
  const minimap = createRouteMinimapGeometry();
  const frame = minimap.update(straight, { s: 81 });
  const samples = straight.samples.length;
  assert.equal(minimap.update(straight, { s: 82 }), frame);
  assert.equal(straight.samples.length, samples);
  minimap.update(turn, { s: 80 });
  assert.deepEqual([...frame.ahead.slice(40, 42)], [80, -80]);
});

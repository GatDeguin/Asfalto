import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {authoredWindshieldMount} from '../src/game/expansion-vehicle-runtime.mjs?v=aaacadfb3c716f14';
import {createWeatherWindshield, windshieldLayout} from '../src/render/weather-windshield.mjs?v=b0d766ee92317059';

for (const vehicle of ['chevy', 'chevrolet_1969', 'chevy_400_1957', 'pickup_3100', 'belair_1957']) {
  test(`${vehicle} wiper blades and cleared film follow the glass throughout the sweep`, () => {
    const root = new T.Group();
    const mount = authoredWindshieldMount(T, {root}, vehicle) || {cabinMount:root};
    const fit = windshieldLayout(mount);
    const width = .007 * Math.min(1, fit.widthM / 1.54);
    for (const [x, y] of fit.pivots) {
      for (let step = 0; step <= 200; step++) {
        const angle = fit.angleMin + step / 200 * (fit.angleMax - fit.angleMin);
        for (let radial = 0; radial <= 6; radial++) {
          const radius = fit.innerRadius + radial / 6 * (fit.outerRadius - fit.innerRadius);
          for (const side of [-width / 2, width / 2]) {
            const bladeX = x + Math.cos(angle) * radius - Math.sin(angle) * side;
            const bladeY = y + Math.sin(angle) * radius + Math.cos(angle) * side;
            const glassHalfWidth = fit.widthM / 2 * fit.widthAt(bladeY / fit.surfaceHeight);
            const clearance = Math.min(bladeY, fit.surfaceHeight - bladeY, glassHalfWidth - Math.abs(bladeX));
            assert.ok(clearance >= .0005, `${vehicle} at step ${step}, clearance ${clearance} m`);
          }
        }
      }
    }
    const controller = createWeatherWindshield(T, mount);
    try {
      for (let frame = 0; frame < 32; frame++) controller.update({dt:1 / 60, rain:1, wiperMode:'fast'});
      const diagnostics = controller.diagnostics();
      assert.ok(diagnostics.phase > 0);
      for (const [i, wiper] of diagnostics.measurements.wipers.entries()) {
        assert.deepEqual(wiper.wipeSurface, [...fit.pivots[i], fit.innerRadius, fit.outerRadius]);
        for (const [j, point] of wiper.bladeEndsLocal.entries()) {
          const expected = mount.cabinMount.localToWorld(new T.Vector3(...point));
          assert.ok(expected.distanceTo(new T.Vector3(...wiper.bladeEndsWorld[j])) < 1e-5);
        }
      }
    } finally {
      controller.dispose();
    }
  });
}

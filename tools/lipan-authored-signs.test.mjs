import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { THREE as T } from './cinematic-three.mjs';
import { readCircuitSource } from './fixtures/closed-circuit-source.mjs';
import { createRouteQuery } from '../src/tracks/route-query.mjs';
import { terrainHeightSampler } from '../src/tracks/visuals/reference-landscape.mjs?v=30a528c61c10745d';
import { prepareLipanAuthoredSigns } from '../src/tracks/visuals/lipan-authored-signs.mjs?v=2895050bf24b111d';
import { decodeGlbDocument, parseGlbContainer } from '../src/runtime/glb-decode-worker.mjs?v=4e5a55f83b79f7c1';
import { makeGlbAttribute } from '../src/runtime/glb-accessors.mjs';

const track = new URL('../tracks/cuesta-lipan/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', track)));
const query = createRouteQuery(readCircuitSource('cuesta_lipan'));
const layerName = 'ASFALTO_LIPAN_AUTHORED_SIGNS';

async function openSector(sectorId, lod) {
  const file = readFileSync(new URL(`sectors/${sectorId}/lod${lod}.glb`, track));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const { json, bin } = await decodeGlbDocument(buffer);
  const root = await globalThis.AsfaltoV5GlbCore.completeGlbToObject(T, buffer, sectorId, {
    decodedDocument: { json, bin },
    parseGlb: parseGlbContainer,
    makeAttribute: makeGlbAttribute,
    textureFromInfo: () => null,
  });
  const [x, y, z] = manifest.streaming.sectors.find(sector => sector.id === sectorId).localOrigin;
  root.position.set(x, z, -y);
  const native = root.children.find(node => node.userData.semantic === 'ROAD_SIGNAGE');
  const rail = root.children.find(node => node.userData.semantic === 'GUARDRAIL_DETAIL');
  return { root, native, rail };
}

for (const [sectorId, expected] of [['S03', 13], ['S05', 3]]) {
  test(`${sectorId} uses grounded chevrons with unobstructed faces at all three detail levels`, async () => {
    let firstLod;
    for (const lod of [0, 1, 2]) {
      const { root, native, rail } = await openSector(sectorId, lod);
      assert.equal(Boolean(native), lod < 2);
      const cues = prepareLipanAuthoredSigns(root, { THREE: T, sectorId, query, heightAt: terrainHeightSampler(T, root) });
      if (native) assert.equal(native.visible, false, 'old sign node stays owned by the streamed root');
      assert.equal(rail.visible, true);
      assert.equal(cues.length, expected);

      root.updateMatrixWorld(true);
      const layer = root.getObjectByName(layerName);
      const posts = layer.getObjectByName(`${layerName}_SUPPORTS`);
      const roadside = [];
      root.traverseVisible(node => {
        if (node.isMesh && /TERRAIN|CUT_FILL|GUARDRAIL/.test(node.name)) roadside.push(node);
      });
      assert.equal(posts.count, expected);
      const centres = cues.map((cue, i) => {
        assert.equal(cue.kind, 'chevron');
        const sample = query.sample(cue.sM);
        const projection = query.project(cue.position);
        assert.ok(Math.abs(projection.sM - cue.sM) < 1, `near station ${cue.sM}`);
        assert.ok(Math.abs(projection.lateralM) > 5.4, 'past the 4.9 m collision rail');
        const before = query.sample(cue.sM - 25).frame.tangent;
        const after = query.sample(cue.sM + 25).frame.tangent;
        const turn = Math.sign(before[0] * after[2] - before[2] * after[0]);
        assert.equal(cue.turn, turn);
        assert.equal(Math.sign(projection.lateralM), -turn, 'outside of the bend');

        const pose = new T.Matrix4();
        posts.getMatrixAt(i, pose);
        const foot = pose.elements[13] - pose.elements[5] * .5;
        assert.ok(Math.abs(cue.position[1] - foot - .12) < .001, 'post penetrates the ground');
        const bottomY = cue.position[1] + cue.bottomM;
        assert.ok(bottomY > sample.position[1] + 1.1, 'plate clears the rail');

        const driver = query.sample(cue.sM - 18);
        const origin = new T.Vector3(...driver.position)
          .addScaledVector(new T.Vector3(...driver.frame.left), 1.7);
        origin.y += 1.25;
        const target = new T.Vector3(cue.position[0], bottomY + .38, cue.position[2]);
        const aim = target.clone().sub(origin).normalize();
        const [first] = new T.Raycaster(origin, aim, 0, target.distanceTo(origin) + .2)
          .intersectObjects([layer, ...roadside], true);
        assert.equal(first?.object.name, `${layerName}_FACES`, `driver approach at ${cue.sM} m`);
        return [cue.sM, target.x, target.y, target.z];
      });
      if (firstLod) assert.deepEqual(centres, firstLod, 'plate location does not jump between levels');
      else firstLod = centres;
    }
  });
}

test('blank midpoint markers yield to the numbered kilometre markers in every remaining sector', async () => {
  for (const sectorId of ['S01', 'S02', 'S04', 'S06', 'S07', 'S08']) {
    for (const lod of [0, 1]) {
      const { root, native } = await openSector(sectorId, lod);
      const cues = prepareLipanAuthoredSigns(root, { THREE: T, sectorId, query });
      assert.deepEqual(cues, []);
      assert.equal(native.visible, false);
      assert.equal(root.getObjectByName(layerName), undefined);
      assert.ok(root.children.find(node => node.userData.semantic === 'ROAD_ASPHALT').visible);
    }
  }
});

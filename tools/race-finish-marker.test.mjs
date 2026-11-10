import test from 'node:test';
import assert from 'node:assert/strict';
import { THREE as T } from './cinematic-three.mjs?v=1538801f0545ceb6';
import { createRaceFinishMarker } from '../src/render/race-start-signal.mjs?v=62d43d5a178b174f';

test('finish marker stays at the physical line through a reference shift and only shows on approach', () => {
  const scene = new T.Scene();
  const finish = createRaceFinishMarker(T, {scene});
  const frame = {left:[0,0,1], normal:[0,1,0], tangent:[1,0,0]};
  finish.set({position:[20,3,-10], frame, widthM:8});
  finish.update(300, 'RUNNING');
  assert.equal(finish.diagnostics().visible, false);
  finish.update(150, 'COUNTDOWN');
  assert.equal(finish.diagnostics().visible, false);
  finish.update(150, 'RUNNING');
  assert.equal(finish.diagnostics().visible, true);
  finish.rebase({matrix:new T.Matrix4().makeTranslation(-13, 0, 4).toArray(), referenceChart:1});
  assert.deepEqual(finish.diagnostics().position, [7,3,-6]);
  assert.equal(finish.diagnostics().referenceChart, 1);
  finish.update(0, 'FINISHED');
  assert.equal(finish.diagnostics().visible, true);
  finish.clear();
  assert.equal(finish.diagnostics().visible, false);
  finish.dispose();
  assert.equal(scene.children.length, 0);
});

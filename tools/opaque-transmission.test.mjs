import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as transmission from '../src/render/opaque-transmission.mjs?v=74188532df76e9a7';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';

const scene = new T.Scene();
scene.background = new T.Color(0x193045);
const camera = new T.PerspectiveCamera();

function fixture() {
  const gl = {
    READ_FRAMEBUFFER: 0x8ca8, DRAW_FRAMEBUFFER: 0x8ca9,
    COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x0100, NEAREST: 0x2600,
    isContextLost: () => false,
  };
  const buffers = new WeakMap();
  const copies = [], disposed = [];
  let read, written, target;
  const renderer = {
    properties: {get: value => buffers.get(value)},
    state: {bindFramebuffer(kind, value) {
      if (kind === gl.READ_FRAMEBUFFER) read = value;
      else written = value;
    }},
    extensions: {has: () => false},
    getContext: () => gl,
    getRenderTarget: () => target,
    getActiveMipmapLevel: () => 0,
    getScissorTest: () => false,
    getClearAlpha: () => 0,
    setRenderTarget(value) {
      target = value;
      if (!buffers.has(value)) {
        buffers.set(value, {__webglFramebuffer: value.texture.name});
        if (value.samples) buffers.get(value).__webglMultisampledFramebuffer = 'msaa';
        value.addEventListener('dispose', () => disposed.push(value.texture.name));
      }
    },
    transmissionResolutionScale: 1,
    toneMapping: T.ACESFilmicToneMapping,
  };
  gl.blitFramebuffer = (...args) => copies.push({read, written, mask: args[8]});
  const source = new T.WebGLRenderTarget(400, 200, {
    type: T.HalfFloatType, samples: 2, depthTexture: new T.DepthTexture(400, 200, T.UnsignedIntType),
  });
  source.texture.colorSpace = T.LinearSRGBColorSpace;
  source.texture.name = 'scene';
  renderer.setRenderTarget(source);
  return {renderer, source, copies, disposed};
}

test('the renderer hook patches the exact shipped Three module and keeps a fallback for unknown revisions', async () => {
  const bootstrap = JSON.parse(await readFile(new URL('../assets/manifests/workshop-bootstrap.json', import.meta.url)));
  const original = gunzipSync(Buffer.from(bootstrap.threeModuleGz, 'base64')).toString();
  const patched = transmission.patchOpaqueTransmissionSource(original);
  assert.notEqual(patched, original);
  assert.match(patched, /asfaltoOpaqueTransmission/);
  assert.equal(transmission.patchOpaqueTransmissionSource(patched), patched);
  assert.equal(transmission.patchOpaqueTransmissionSource('unrecognized renderer'), 'unrecognized renderer');
});

test('transmission copies the opaque result once and draws double-sided back faces against copied depth', () => {
  const {renderer, source, copies, disposed} = fixture();
  const controller = transmission.createOpaqueTransmission(T, renderer);
  const single = new T.Mesh(new T.PlaneGeometry(), new T.MeshPhysicalMaterial({transmission: 1}));
  const double = new T.Mesh(new T.PlaneGeometry(), new T.MeshPhysicalMaterial({transmission: 1, side: T.DoubleSide}));
  const items = [{object: single, material: single.material}, {object: double, material: double.material}];
  let bound, duringBack;
  const mipmaps = [];
  controller.draw(source, () => {
    const hook = renderer.asfaltoOpaqueTransmission;
    assert.equal(hook.canReuse(source, scene, camera), true);
    assert.equal(hook.capture({
      source, items, camera, renderBackFaces: true,
      bind: target => { bound = target; },
      mipmaps: target => mipmaps.push(target),
      drawBack: item => {
        assert.equal(item.object, double);
        assert.equal(item.material.side, T.BackSide);
        assert.equal(renderer.toneMapping, T.NoToneMapping);
        assert.notEqual(renderer.getRenderTarget(), bound);
        duringBack = renderer.getRenderTarget();
      },
    }), true);
    assert.equal(bound, duringBack);
    assert.equal(renderer.getRenderTarget(), source);
    assert.deepEqual(mipmaps.map(target => target.samples), [0, 0]);
    assert.equal(double.material.side, T.DoubleSide);
    assert.equal(renderer.toneMapping, T.ACESFilmicToneMapping);
  });
  assert.equal(renderer.asfaltoOpaqueTransmission, undefined);
  assert.deepEqual(copies.map(x => [x.read, x.mask]), [['msaa', 0x4000], ['msaa', 0x4100]]);
  controller.release();
  assert.equal(disposed.length, 2);
});

test('transmission uses the native renderer for reduced size and transparent backgrounds', () => {
  const {renderer, source, copies} = fixture();
  const controller = transmission.createOpaqueTransmission(T, renderer);
  controller.draw(source, () => {
    const hook = renderer.asfaltoOpaqueTransmission;
    renderer.transmissionResolutionScale = .5;
    assert.equal(hook.canReuse(source, scene, camera), false);
    renderer.transmissionResolutionScale = 1;
    assert.equal(hook.canReuse(source, new T.Scene(), camera), false);
    assert.equal(hook.canReuse(source, scene, camera), true);
  });
  assert.equal(copies.length, 0);
});

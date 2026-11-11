import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {startServer} from '../server.mjs?v=d5132a06b199d493';
import {patchOpaqueTransmissionSource} from '../src/render/opaque-transmission.mjs?v=74188532df76e9a7';

const output = process.argv[2];
assert.ok(output, 'Indicate an external evidence file.');
const {chromium} = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url)('playwright');
const bootstrap = JSON.parse(await readFile(new URL('../assets/manifests/workshop-bootstrap.json', import.meta.url)));
const core = 'data:text/javascript;base64,' + gunzipSync(Buffer.from(bootstrap.threeCoreGz, 'base64')).toString('base64');
const three = patchOpaqueTransmissionSource(gunzipSync(Buffer.from(bootstrap.threeModuleGz, 'base64')).toString())
  .replaceAll('./three.core.min.js', core);
const server = await startServer({root: import.meta.dirname + '/..'});
const report = {errors: [], warnings: []};
let browser;
try {
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-angle=d3d11']});
  report.browser = browser.version();
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(message.text());
    if (message.type() === 'warning') report.warnings.push(message.text());
  });
  await page.route('**/refraction-fixture', route => route.fulfill({contentType: 'text/html', body: '<!doctype html>'}));
  await page.goto(server.url + 'refraction-fixture');
  report.cases = await page.evaluate(async source => {
    const url = URL.createObjectURL(new Blob([source], {type: 'text/javascript'}));
    const T = await import(url);
    const {createOpaqueTransmission} = await import('/src/render/opaque-transmission.mjs');
    const {createScreenSpaceTarget} = await import('/src/render/screen-space-targets.mjs');
    const {supportedHdrSamples} = await import('/src/render/render-target-capabilities.mjs');
    const renderer = new T.WebGLRenderer({logarithmicDepthBuffer: true});
    const controller = createOpaqueTransmission(T, renderer);
    const gl = renderer.getContext();
    const blit = gl.blitFramebuffer, blits = [];
    gl.blitFramebuffer = function(...args) {
      const same = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) === gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
      blit.apply(this, args);
      blits.push({same, mask: args[8], error: gl.getError()});
    };
    const scene = new T.Scene();
    scene.background = new T.Color('#223d72');
    const camera = new T.PerspectiveCamera(45, 1, .1, 100);
    camera.position.z = 5;
    let opaqueDraws = 0;
    const make = (geometry, material, x, y, z, opaque = false) => {
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      if (opaque) mesh.onBeforeRender = () => opaqueDraws++;
      return mesh;
    };
    make(new T.PlaneGeometry(2, 3), new T.MeshBasicMaterial({color: '#e07a20'}), -1, 0, -1, true);
    make(new T.PlaneGeometry(2, 3), new T.MeshBasicMaterial({color: '#49a622'}), 1, 0, -1, true);
    make(new T.BoxGeometry(.45, .65, .45), new T.MeshBasicMaterial({color: '#f1ddd9'}), .55, -.2, .85, true);
    make(new T.PlaneGeometry(1.22, 1.8), new T.MeshPhysicalMaterial({
      color: '#c5e5ff', roughness: .18, transmission: .88, thickness: .45, ior: 1.45,
    }), -.7, 0, .5);
    make(new T.BoxGeometry(1.1, 1.75, .36), new T.MeshPhysicalMaterial({
      color: '#ffe5d4', roughness: .12, transmission: .94, thickness: .55, ior: 1.45, side: T.DoubleSide,
    }), .6, 0, .43);

    try {
      const cases = [];
      const msaa = supportedHdrSamples(renderer, 2);
      for (const samples of new Set([0, msaa])) {
        const target = createScreenSpaceTarget(T, 96, 96, 'fixture', {color: true, samples});
        const sample = (reuse, scale = 1) => {
          renderer.transmissionResolutionScale = scale;
          renderer.setRenderTarget(target);
          opaqueDraws = 0;
          blits.length = 0;
          const draw = () => renderer.render(scene, camera);
          const start = controller.diagnostics().captures;
          if (reuse) controller.draw(target, draw);
          else draw();
          const pixels = [[20,44], [33,61], [58,63], [60,44], [67,36], [85,86]].map(([x,y]) => {
            const p = new Uint16Array(4);
            renderer.readRenderTargetPixels(target, x, y, 1, 1, p);
            return Array.from(p, v => T.DataUtils.fromHalfFloat(v));
          });
          return {opaqueDraws, pixels, blits: [...blits], captures: controller.diagnostics().captures - start, glError: gl.getError()};
        };
        cases.push({samples, native: sample(false), reuse: sample(true), fallback: sample(true, .5)});
        renderer.setRenderTarget(null);
        target.dispose();
      }
      controller.release();
      return {cases, released: controller.diagnostics().targets === 0};
    } finally {
      controller.release();
      scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
      renderer.dispose();
      URL.revokeObjectURL(url);
    }
  }, three);
  assert.deepEqual(report.errors, []);
  assert.ok(report.cases.released);
  for (const {native, reuse, fallback} of report.cases.cases) {
    assert.deepEqual([native.glError, reuse.glError, fallback.glError], [0, 0, 0]);
    assert.ok([native, reuse, fallback].every(r => r.blits.every(b => !b.same && !b.error)));
    assert.equal(native.opaqueDraws, 6);
    assert.equal(reuse.opaqueDraws, 3);
    assert.equal(reuse.captures, 1);
    assert.equal(fallback.opaqueDraws, 6);
    assert.equal(fallback.captures, 0);
    for (const [i, pixel] of native.pixels.entries()) {
      assert.ok(pixel.every((channel, j) => Math.abs(channel - reuse.pixels[i][j]) < .035),
        'Refraction and its foreground occlusion should agree with the native pass');
    }
  }
  console.log(JSON.stringify(report.cases));
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await server.close();
}

import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs?v=d5132a06b199d493';

const output = process.argv[2];
assert.ok(output, 'Indicate an external evidence file.');
const {chromium} = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url)('playwright');
const server = await startServer({root: import.meta.dirname + '/..'});
const report = {errors: []};
let browser;
try {
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-angle=d3d11']});
  report.browser = browser.version();
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(message.text());
  });
  await page.route('**/visibility-fixture', route => route.fulfill({contentType: 'text/html',
    body: '<!doctype html><link rel="icon" href="data:,">'}));
  await page.goto(new URL('visibility-fixture', server.url).href);
  Object.assign(report, await page.evaluate(async () => {
    const {createVirtualTerrainRaster} = await import('/src/render/virtual-terrain-gpu.mjs');
    const {createVirtualTerrainSurfaces, packGaribaldiSurfaces, readGaribaldiSurfaceMeshes} =
      await import('/src/render/virtual-terrain-surface.mjs');
    const {createVirtualTerrainAtlas, createVirtualTerrainSurfaceComposite} =
      await import('/src/render/virtual-terrain-composite.mjs');
    const {packTerrainNormal, VISIBILITY_OBJECT_SHIFT, VISIBILITY_TRIANGLE_MASK} =
      await import('/src/render/virtual-terrain-data.mjs');
    const bootstrap = await fetch('/assets/manifests/workshop-bootstrap.json').then(r => r.json());
    const inflate = b64 => new Response(new Blob([Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))]).stream()
      .pipeThrough(new DecompressionStream('gzip'))).text();
    const core = URL.createObjectURL(new Blob([await inflate(bootstrap.threeCoreGz)], {type: 'text/javascript'}));
    const module = URL.createObjectURL(new Blob([(await inflate(bootstrap.threeModuleGz)).replaceAll('./three.core.min.js', core)],
      {type: 'text/javascript'}));
    const THREE = await import(module);
    URL.revokeObjectURL(core);
    URL.revokeObjectURL(module);

    const adapter = await navigator.gpu.requestAdapter({powerPreference: 'high-performance'});
    if (!adapter || adapter.info?.isFallbackAdapter) throw new Error('A hardware WebGPU adapter is required.');
    const width = 64, height = 48;
    const camera = new THREE.PerspectiveCamera(90, 1, 0.02, 32000);
    camera.position.set(17, 25, 13);
    camera.rotation.set(0.29, 0.8, 0.07);
    camera.updateMatrixWorld(true);
    const mvp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(mvp);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    const packedNormal = packTerrainNormal(normal.x, normal.y, normal.z);
    const point = ([x, y, w]) => new THREE.Vector3((x * 2 / width - 1) * w, (1 - y * 2 / height) * w, -w)
      .applyMatrix4(camera.matrixWorld);
    const triangle = (left, top, right, bottom, depth) => [[left,top,depth], [left,bottom,depth], [right,top,depth]];
    function map(bytes) {
      const texture = new THREE.DataTexture(new Uint8Array(bytes), 1, 1);
      texture.needsUpdate = true;
      return texture;
    }
    const diffuse = map([255,255,255,255]), normals = map([128,128,255,255]), roughness = map([255,255,255,255]);
    const root = new THREE.Group();
    function mesh(name, shape, tint, isRoad = false) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(shape.flatMap(v => point(v).toArray()), 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(shape.flatMap(() => normal.toArray()), 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(shape.flatMap(() => tint), 3));
      // The only visible road triangle must survive an address wider than 16 bits.
      const indices = new Uint32Array(isRoad ? 65537 * 3 : 3);
      indices.set([0,1,2], indices.length - 3);
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      const material = new THREE.MeshStandardMaterial({map: diffuse, normalMap: normals, roughnessMap: roughness,
        vertexColors: true, envMapIntensity: 0});
      material.asfaltoTerrainRockTexture = diffuse;
      material.normalScale.set(0, 0);
      Object.assign(material.userData, {asfaltoSurfaceMetres: 8, asfaltoVertexVariation: true});
      const object = new THREE.Mesh(geometry, material);
      object.name = name + '_WEB_MESH_Primitive_0';
      root.add(object);
      return object;
    }
    const vista = mesh('TERRAIN_VISTA', triangle(0,0,3,3,2), [1,1,1]);
    mesh('ROAD_RENDER', triangle(8,5,23,21,4), [0,1,0], true);
    mesh('TERRAIN_HERO', triangle(2,1,38,38,8), [1,0,0]);
    mesh('TERRAIN_TRANSITION', triangle(38,1,61,24,20020), [0,0,1]);
    const sources = readGaribaldiSurfaceMeshes(THREE, root, vista);
    const controller = new AbortController();
    const geometry = await packGaribaldiSurfaces(sources.slice(1), controller.signal);
    const cases = [];
    for (const indexed of adapter.features.has('primitive-index') ? [false, true] : [false]) {
      const activeAdapter = indexed ? await navigator.gpu.requestAdapter({powerPreference: 'high-performance'}) : adapter;
      const device = await activeAdapter.requestDevice({requiredFeatures: indexed ? ['primitive-index'] : []});
      const errors = [];
      device.addEventListener('uncapturederror', event => errors.push(event.error.message));
      const surfaces = await createVirtualTerrainSurfaces(device, sources, geometry, controller.signal);
      const canvas = document.createElement('canvas');
      const raster = await createVirtualTerrainRaster(device, {canvas, slots: 1, doubleSided: false, surfaces});
      const atlas = createVirtualTerrainAtlas(THREE, 1);
      // Near micro vs road, far micro vs road, and fixed Vista vs Transition.
      const page = new Float32Array([
        ...triangle(9,6,13,10,3), ...triangle(14,6,18,10,6), ...triangle(45,1,60,14,20000),
      ].flatMap(v => [...point(v).toArray(), packedNormal]));
      raster.upload(0, page);
      atlas.upload(0, page);
      const selected = [{slot: 0, triangles: 3, objectId: 1}];
      const viewport = new THREE.Vector4(0, 0, width, height);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, Math.PI));
      const composite = createVirtualTerrainSurfaceComposite(THREE, sources, canvas, {atlas, geometry, maxTextureSize: 2048});
      for (const mesh of composite.meshes) {
        mesh.visible = true;
        scene.add(mesh);
      }
      const renderer = new THREE.WebGLRenderer({logarithmicDepthBuffer: true, preserveDrawingBuffer: true, antialias: false});
      renderer.setSize(width, height, false);
      const gl = renderer.getContext();
      const packetGL = document.createElement('canvas').getContext('webgl2');
      const texture = packetGL.createTexture(), fbo = packetGL.createFramebuffer();
      packetGL.pixelStorei(packetGL.UNPACK_COLORSPACE_CONVERSION_WEBGL, packetGL.NONE);
      packetGL.bindTexture(packetGL.TEXTURE_2D, texture);
      packetGL.texStorage2D(packetGL.TEXTURE_2D, 1, packetGL.RGBA8, width, height);
      packetGL.bindFramebuffer(packetGL.FRAMEBUFFER, fbo);
      packetGL.framebufferTexture2D(packetGL.FRAMEBUFFER, packetGL.COLOR_ATTACHMENT0, packetGL.TEXTURE_2D, texture, 0);
      const samples = {road:[13,9], hero:[4,6], nearMicro:[9,7], behindRoad:[14,7],
        fixedVista:[46,4], transition:[39,8], background:[63,47]};
      function readPixels(context, x, y) {
        const rgba = new Uint8Array(4);
        context.readPixels(x, y, 1, 1, context.RGBA, context.UNSIGNED_BYTE, rgba);
        return [...rgba];
      }
      const sample = (x, y) => readPixels(gl, x, height - 1 - y);
      function draw() {
        raster.submit(selected, mvp.elements, camera.far, width, height, performance.now(), {camera, frustum});
        composite.update(camera, viewport);
        renderer.render(scene, camera);
      }
      draw();
      packetGL.texSubImage2D(packetGL.TEXTURE_2D, 0, 0, 0, packetGL.RGBA, packetGL.UNSIGNED_BYTE, canvas);
      const ids = Object.fromEntries(Object.entries(samples).map(([key, [x,y]]) => {
        const [r,g,b,a] = readPixels(packetGL, x, y);
        const bits = r | (g << 8) | (b << 16);
        return [key, [bits >> VISIBILITY_OBJECT_SHIFT, bits & VISIBILITY_TRIANGLE_MASK, a]];
      }));
      const colors = Object.fromEntries(Object.entries(samples).map(([key, location]) => [key, sample(...location)]));

      const opaque = new THREE.Mesh(new THREE.PlaneGeometry(8 / width, 8 / height), new THREE.MeshBasicMaterial({color:0xffffff}));
      opaque.quaternion.copy(camera.quaternion);
      opaque.position.copy(point([13.5,9.5,2]));
      scene.add(opaque);
      draw();
      const nearerNative = sample(...samples.road);
      opaque.position.copy(point([13.5,9.5,7]));
      draw();
      const fartherNative = sample(...samples.road);
      scene.remove(opaque);

      const material = composite.meshes.find(mesh => mesh.name.includes('ROAD')).material;
      const previous = material.onBeforeCompile;
      material.onBeforeCompile = shader => {
        previous(shader);
        shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>',
          'gl_FragColor = vec4(0.5 + roadDx * 2.0, 0.5 + roadDy.x * 2.0, 1.0);');
      };
      material.customProgramCacheKey = () => 'fixture-visible-road-gradients';
      material.needsUpdate = true;
      draw();
      const dx = point([14.5,9.5,4]).sub(point([13.5,9.5,4]));
      const dy = point([13.5,8.5,4]).sub(point([13.5,9.5,4]));
      const expectedGradients = [dx.x, dx.z + dx.y * .18, dy.x].map(value => Math.round((.5 + value / 4) * 255));
      await device.queue.onSubmittedWorkDone();
      cases.push({indexed, errors, ids, colors, nearerNative, fartherNative, gradients: sample(...samples.road).slice(0,3),
        expectedGradients, dimensions: [canvas.width, canvas.height], raster: raster.diagnostics(),
        submitted: surfaces.diagnostics().submittedTriangles, glErrors: [gl.getError(), packetGL.getError()]});

      opaque.geometry.dispose();
      opaque.material.dispose();
      packetGL.deleteTexture(texture);
      packetGL.deleteFramebuffer(fbo);
      packetGL.getExtension('WEBGL_lose_context')?.loseContext();
      composite.dispose();
      atlas.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      raster.dispose();
      surfaces.dispose();
      device.destroy();
    }
    root.traverse(object => {
      if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); }
    });
    for (const texture of [diffuse, normals, roughness]) texture.dispose();
    return {architecture: adapter.info.architecture, cases};
  }));
  assert.deepEqual(report.errors, []);
  for (const result of report.cases) {
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.glErrors, [0,0]);
    assert.deepEqual(result.ids, {
      road:[2,65537,255], hero:[3,65538,255], nearMicro:[1,1,255], behindRoad:[2,65537,255],
      fixedVista:[1,3,255], transition:[4,65539,255], background:[0,0,255],
    });
    assert.equal(result.submitted, 65539);
    assert.equal(result.raster.visibilityBytes, 64 * 48 * 4);
    assert.equal(result.raster.packetBytes, result.raster.visibilityBytes);
    assert.deepEqual(result.dimensions, [64,48]);
    assert.deepEqual(result.colors.background, [0,0,0,255]);
    for (const [key, channel] of [['road',1], ['hero',0], ['transition',2]]) {
      assert.ok(result.colors[key][channel] > 180, JSON.stringify(result.colors));
      assert.ok(result.colors[key].slice(0,3).every((value, i) => i === channel || value < 10));
    }
    assert.ok(result.colors.nearMicro.every(value => value > 100));
    assert.ok(result.colors.fixedVista.every(value => value > 100));
    assert.deepEqual(result.nearerNative, [255,255,255,255]);
    assert.deepEqual(result.fartherNative, result.colors.road);
    for (const [i, value] of result.gradients.entries()) assert.ok(Math.abs(value - result.expectedGradients[i]) < 2,
      JSON.stringify({value, expected: result.expectedGradients[i]}));
  }
  console.log(JSON.stringify({status:'pass', variants: report.cases.map(({indexed}) => indexed ? 'indexed' : 'vertex-pulling')}));
} finally {
  try { await browser?.close(); }
  finally { await server.close(); }
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}

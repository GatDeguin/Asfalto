import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {startServer} from '../server.mjs?v=9eba410657deb1ea';

const [output, vehicle = 'chevy_400_1957', root = path.resolve(import.meta.dirname, '..')] = process.argv.slice(2);
assert.ok(output, 'Indica el directorio de evidencia.');
assert.ok(['chevy_400_1957', 'belair_1957'].includes(vehicle), 'Vehículo desconocido.');
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('playwright');
await mkdir(output, {recursive:true});
const server = await startServer({root});
const report = {vehicle, viewport:[1280, 800], errors:[], httpErrors:[]};
let browser;
let page;

try {
  browser = await chromium.launch({
    headless:true,
    executablePath:process.env.CHROME_PATH,
    args:['--use-angle=d3d11'],
  });
  report.browser = browser.version();
  page = await browser.newPage({viewport:{width:1280,height:800}, reducedMotion:'reduce'});
  page.setDefaultTimeout(120_000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) report.httpErrors.push([response.status(), new URL(response.url()).pathname]);
  });
  await page.addInitScript(id => {
    localStorage.setItem('asfalto:v7:@migration-v1', 'complete');
    localStorage.setItem('asfalto:recovery:v8-v7:complete', 'complete');
    localStorage.setItem('asfalto:nacional:v6:selected-vehicle', id);
    localStorage.setItem('asfalto:v7:cockpit-chevy-settings-v6', JSON.stringify({transmissionMode:'automatic'}));
  }, vehicle);
  await page.goto(server.url + '?qa=1', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => globalThis.__chevyV6Complete?.initialized);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => __chevyV6Complete.workshop.loaded && document.querySelector('#loading')?.hidden);
  assert.equal(await page.evaluate(id => __chevyV6Complete.workshop.vehicleSelector.select(id), vehicle), true);
  await page.waitForFunction(id => __chevyV6Complete.workshop.vehicleId === id && document.querySelector('#loading')?.hidden, vehicle);
  console.log(`Taller listo para ${vehicle}.`);
  await page.locator('[data-v6-panel=drive]').click();
  await page.locator('[data-an-mode=drive]').click();
  await page.locator('#v6-drive-start').click();
  await page.waitForFunction(id => globalThis.__asfaltoSelectedPlayerVehicle === id &&
    globalThis.__cockpit?.raceWorld?.state.status === 'RUNNING' && document.body.classList.contains('v6-driving'), vehicle);
  await page.keyboard.press('Enter');
  console.log('Carrera lista.');
  const frames = () => page.evaluate(() => __cockpit.v7Presentation.diagnostics().actualSceneFrames);
  const waitFrames = async count => {
    const start = await frames();
    await page.waitForFunction(target => __cockpit.v7Presentation.diagnostics().actualSceneFrames >= target, start + count);
  };
  const mirrors = () => page.evaluate(() => __cockpit.mirrorDiagnostics());
  const waitCaptures = async previous => {
    await waitFrames(20);
    if ((await mirrors()).preparation.status === 'idle') return;
    await page.waitForFunction(({centerFrames, leftFrames}) => {
      const current = __cockpit.mirrorDiagnostics();
      return current.centerFrames > centerFrames && current.leftFrames > leftFrames;
    }, previous, {timeout:45_000});
  };
  const optics = () => page.evaluate(() => {
    const T = __chevyV6Complete.workshop.T;
    const root = __asfaltoVehiclePresentations.chevy.root;
    const face = root.getObjectByName('AuthoredMirrorFace_left');
    const silver = root.getObjectByName('Details__26_Mirror_optical_silver')?.getObjectByProperty('isMesh', true);
    const {camera:pose} = __cockpit.v7RenderDiagnostics();
    const camera = new T.PerspectiveCamera(pose.fov, 1280 / 800, pose.near, pose.far);
    camera.position.fromArray(pose.position);
    camera.quaternion.fromArray(pose.quaternion);
    camera.updateMatrixWorld(true);
    const screen = point => {
      point.project(camera);
      return [+(640 * (1 + point.x)).toFixed(2), +(400 * (1 - point.y)).toFixed(2)];
    };
    return {
      faceVisible:face?.parent.visible ?? false,
      faceScreen:face ? screen(face.getWorldPosition(new T.Vector3())) : null,
      silverMaterials:silver ? [silver.material].flat().map(material => material.name) : null,
      interior:__cockpit.interiorDiagnostics(),
    };
  });
  report.start = await mirrors();
  await waitCaptures(report.start);
  report.cabin = {mirrors:await mirrors(), ...await optics()};
  await page.screenshot({path:path.join(output, vehicle + '-cabina.png')});
  await page.evaluate(() => __cockpit.raceSetCamera('chase'));
  await waitFrames(8);
  report.chaseStart = await mirrors();
  await waitFrames(8);
  report.chase = {mirrors:await mirrors(), ...await optics()};
  await page.screenshot({path:path.join(output, vehicle + '-exterior.png')});
  await page.evaluate(() => __cockpit.raceSetCamera('cockpit'));
  await waitCaptures(report.chase.mirrors);
  report.returned = await mirrors();
  await page.screenshot({path:path.join(output, vehicle + '-vuelta-a-cabina.png')});

  assert.ok(report.cabin.faceVisible, 'El disco dinámico debe estar visible en cabina.');
  assert.ok(report.cabin.mirrors.leftFrames > report.start.leftFrames, 'El espejo lateral debe capturar cuadros en cabina.');
  assert.ok(report.cabin.mirrors.centerFrames > report.start.centerFrames, 'El espejo central debe capturar cuadros en cabina.');
  assert.ok(!report.chase.faceVisible, 'La cámara exterior debe mostrar el espejo original.');
  assert.equal(report.chase.mirrors.leftFrames, report.chaseStart.leftFrames, 'La cámara exterior debe detener la captura.');
  assert.equal(report.chase.mirrors.centerFrames, report.chaseStart.centerFrames, 'La cámara exterior debe detener la captura.');
  assert.ok(report.returned.leftFrames > report.chase.mirrors.leftFrames, 'El reflejo lateral debe volver al regresar a cabina.');
  if (vehicle === 'chevy_400_1957') {
    assert.deepEqual(report.cabin.silverMaterials, ['26_Mirror_optical_silver', 'Left door mirror live view glass']);
    assert.deepEqual(report.chase.silverMaterials, ['26_Mirror_optical_silver']);
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.httpErrors, []);
  console.log(JSON.stringify({start:report.start, cabin:report.cabin.mirrors, chase:report.chase.mirrors, returned:report.returned}));
} catch (error) {
  report.failure = error.stack;
  if (page && !page.isClosed()) {
    await page.screenshot({path:path.join(output, vehicle + '-fallo.png'), timeout:10_000}).catch(() => {});
  }
  throw error;
} finally {
  await writeFile(path.join(output, vehicle + '.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await server.close();
}

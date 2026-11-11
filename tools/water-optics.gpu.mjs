import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {startServer} from '../server.mjs?v=9eba410657deb1ea';

const output=process.argv[2];
assert.ok(output,'Indica un archivo JSON externo para la evidencia.');
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const bootstrap=JSON.parse(await readFile(new URL('../assets/manifests/workshop-bootstrap.json',import.meta.url)));
const core='data:text/javascript;base64,'+gunzipSync(Buffer.from(bootstrap.threeCoreGz,'base64')).toString('base64');
const three=gunzipSync(Buffer.from(bootstrap.threeModuleGz,'base64')).toString('utf8').replaceAll('./three.core.min.js',core);
const server=await startServer({root:import.meta.dirname+'/..'});
let browser;
const report={errors:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=d3d11']});
 report.browser=browser.version();
 const page=await browser.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await page.route('**/optics-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Water optics fixture</title>'}));
 await page.goto(server.url+'optics-fixture');
 report.result=await page.evaluate(async source=>{
  const moduleUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  const T=await import(moduleUrl);
  const {createWeatherSurfaceController}=await import('/src/render/weather-surfaces.mjs');
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});
  renderer.setSize(64,64);
  renderer.outputColorSpace=T.LinearSRGBColorSpace;
  renderer.toneMapping=T.NoToneMapping;
  const scene=new T.Scene(),root=new T.Group(),camera=new T.PerspectiveCamera(45,1,.1,100);
  const geometry=new T.PlaneGeometry(60,60).rotateX(-Math.PI/2);
  const original=new T.MeshStandardMaterial({name:'M_Lake_Water'});
  const water=new T.Mesh(geometry,original);scene.add(root);root.add(water);
  const surfaces=createWeatherSurfaceController(T);
  const depths=new Float32Array([2,5,0,1]);
  const field=new T.DataTexture(depths,1,1,T.RGBAFormat,T.FloatType);field.needsUpdate=true;
  try{
   surfaces.setTransmission(0);
   surfaces.setTrack({visualRoot:root});
   const material=water.material;
   material.userData.assetUniforms.uAnWaterField.value=field;
   const compile=material.onBeforeCompile;
   material.onBeforeCompile=function(shader,r){
    compile.call(this,shader,r);
    // Read the absorption term produced by the production fragment.
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight=vec3(anAbsorption);\n#include <opaque_fragment>');
   };
   material.needsUpdate=true;
   const gl=renderer.getContext(),pixel=new Uint8Array(4);
   const sample=(x,y,z)=>{
    camera.position.set(x,y,z);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
    renderer.render(scene,camera);gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    return {absorption:pixel[0]/255,draws:renderer.info.render.calls};
   };
   const normal=sample(0,5,0),grazing=sample(0,1,8);
   depths[0]=0;field.needsUpdate=true;
   const shore=sample(0,1,8);
   return {normal,grazing,shore,glError:gl.getError()};
  }finally{
   surfaces.dispose();field.dispose();geometry.dispose();original.dispose();renderer.dispose();URL.revokeObjectURL(moduleUrl);
  }
 },three);
 const {normal,grazing,shore,glError}=report.result;
 assert.deepEqual(report.errors,[]);
 assert.equal(glError,0);
 assert.ok(Math.abs(normal.absorption-(1-Math.exp(-.32)))<.012,'Normal incidence preserves the vertical-depth reference.');
 assert.ok(grazing.absorption>normal.absorption+.07,'The oblique ray travels farther through the same depth.');
 assert.equal(shore.absorption,0);
 assert.ok([normal,grazing,shore].every(sample=>sample.draws===1));
 console.log(JSON.stringify(report.result));
}catch(error){
 report.failure=error.stack;
 throw error;
}finally{
 await writeFile(output,JSON.stringify(report,null,2)+'\n');
 await browser?.close();
 await server.close();
}

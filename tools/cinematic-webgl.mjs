// Reproducible WebGL integration fixture, not a substitute for full-track or hardware QA.
import {createAdvancedGraphics} from '../src/render/advanced-graphics.mjs';
import {createRaceColorGrade} from '../src/render/race-color-grade.mjs';
import {createCockpitRenderPass} from '../src/render/cockpit-render-pass.mjs';
import {createChevyPaintController} from '../src/render/chevy-paint-controller.mjs';
import {configureSurfaceRelief,installSurfaceRelief,setSurfaceReliefQuality} from '../src/tracks/visuals/surface-relief.mjs';
import {createWeatherSurfaceController} from '../src/render/weather-surfaces.mjs';
const report={checks:[],errors:[],technique:'WebGL2 spatial, no temporal accumulation',frames:[]};
globalThis.__cinematicWebglReport=report;
const require=(condition,message)=>{if(!condition)throw new Error(message);report.checks.push(message);};
const blobUrls=[];
async function decompress(value){const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}
const urlFor=source=>{const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));blobUrls.push(url);return url;};
let renderer,advanced,color,weather,paint;
try{
 const payload=await (await fetch('../assets/manifests/workshop-bootstrap.json')).json();
 const core=urlFor(await decompress(payload.threeCoreGz));
 const T=await import(urlFor((await decompress(payload.threeModuleGz)).replaceAll('./three.core.min.js',core)));
 require(T.REVISION==='180','Uses the shipped Three r180');
 const params=new URLSearchParams(location.search),logarithmic=params.get('log')!=='0';
 renderer=new T.WebGLRenderer({canvas:document.getElementById('qa'),antialias:true,logarithmicDepthBuffer:logarithmic,preserveDrawingBuffer:true});
 renderer.setSize(640,360);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
 report.device={revision:T.REVISION,webgl:gl.getParameter(gl.VERSION),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),maxSamples:renderer.capabilities.maxSamples,logarithmic,resolution:[640,360],pixelRatio:1};
 renderer.debug.onShaderError=(context,program,vs,fs)=>report.errors.push({program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vs),fragment:context.getShaderInfoLog(fs)});
 const scene=new T.Scene();scene.background=new T.Color('#7395ad');scene.fog=new T.FogExp2('#7395ad',.004);
 const camera=new T.PerspectiveCamera(48,640/360,.05,400);camera.position.set(5,3.4,6);camera.lookAt(0,.55,0);camera.updateMatrixWorld();
 const hemi=new T.HemisphereLight('#d3e7ff','#55483d',1.4);scene.add(hemi);
 const sun=new T.DirectionalLight('#fff1d5',2.7);sun.position.set(3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-6;scene.add(sun);
 const point=new T.PointLight('#c7ddff',8,14);point.position.set(-3,3,0);point.castShadow=true;point.shadow.mapSize.set(128,128);scene.add(point);
 const pixels=new Uint8Array(16*16*4);for(let i=0;i<pixels.length;i+=4){const n=(i/4*37)%113;pixels.set([50+n,50+n,50+n,255],i);}
 const texture=new T.DataTexture(pixels,16,16);texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.needsUpdate=true;
 const road=new T.MeshStandardMaterial({color:'#424348',roughness:.84,map:texture});road.name='Road_Asphalt';
 configureSurfaceRelief(T);installSurfaceRelief(road,{heightMap:texture,depthM:.0015,metres:1.5});setSurfaceReliefQuality('cinematic');
 const floor=new T.Mesh(new T.BoxGeometry(12,.1,12),road);floor.position.y=-.1;floor.receiveShadow=true;floor.name='Road_Asphalt';scene.add(floor);
 const body=new T.Mesh(new T.BoxGeometry(2,.8,1.1),new T.MeshStandardMaterial({color:'#d25b21',roughness:.3}));body.position.set(0,.75,0);body.castShadow=true;body.receiveShadow=true;body.name='CarBody';const car=new T.Group();car.add(body);scene.add(car);
 paint=createChevyPaintController(T,car,{partitionWheels:false});
 const tireMat=new T.MeshStandardMaterial({color:'#16191b',roughness:.85});tireMat.name='Tire_Rubber';
 for(const x of [-.7,.7])for(const z of [-.6,.6]){const tire=new T.Mesh(new T.CylinderGeometry(.3,.3,.2,24),tireMat);tire.rotation.x=Math.PI/2;tire.position.set(x,.3,z);tire.castShadow=true;tire.receiveShadow=true;scene.add(tire);}
 const rockMat=new T.MeshStandardMaterial({color:'#625a50',roughness:.8});rockMat.name='Rock_Mineral';
 const rock=new T.Mesh(new T.DodecahedronGeometry(.8,1),rockMat);rock.name='Rock_Contact';rock.position.set(-2,.65,-1);rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
 const leafMat=new T.MeshStandardMaterial({map:texture,color:'#35542d',side:T.DoubleSide,alphaTest:.45,roughness:.85});leafMat.name='Tree_Leaf';
 const leaves=new T.Mesh(new T.PlaneGeometry(1.5,2,2,4),leafMat);leaves.name='Tree_Leaves';leaves.position.set(2,1.5,-2);leaves.castShadow=true;leaves.receiveShadow=true;scene.add(leaves);
 // Weather/POM hooks exist before Pivot Painter and material enhancement, as in the host.
 weather=createWeatherSurfaceController(T);weather.setTrack({visualRoot:scene,materialBindings:[{material:road,role:'asphalt'}]});
 const cockpit=new T.Group();const dashMat=new T.MeshStandardMaterial({color:'#292521',roughness:.65});dashMat.name='Dashboard_Vinyl';
 const dash=new T.Mesh(new T.BoxGeometry(1,.08,.12),dashMat);cockpit.add(dash);cockpit.position.copy(camera.position).add(new T.Vector3(0,-.8,-1));cockpit.visible=false;scene.add(cockpit);
 let tier='cinematic';advanced=createAdvancedGraphics(T,{renderer,scene,camera,getQuality:()=>tier});advanced.setSettings({quality:'cinematic'});
 color=createRaceColorGrade({THREE:T,renderer,samples:4});await color.setSettings({contrast:1.02});
 const interior=createCockpitRenderPass({renderer,scene,camera,cockpit,renderWorld:()=>advanced.render(()=>renderer.render(scene,camera))});
 const draw=()=>color.render(()=>interior.render());
 const environment={skyId:'clear',weather:'clear',sunIntensity:2.7,keyLightDirection:[3,7,4],keyLightColor:'#fff1d5'};
 const measure=label=>{const start=performance.now();advanced.update({time:10,environment});draw();gl.finish();report.frames.push({label,cpuAndSoftwareCompletionMs:performance.now()-start,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resources:{...renderer.info.memory},advanced:advanced.diagnostics(),color:color.diagnostics()});};
 measure('cinematic-exterior');require(report.errors.length===0,'Cinematic visible + depth/distance + POM/weather shaders compile');
 require(advanced.diagnostics().pivotPainter.meshes>0,'Pivot Painter includes a real foliage mesh and its shadow variants');
 require(advanced.diagnostics().screenSpace.policy.aoSamples===32,'GTAO compiled with 32 samples');
 require(advanced.diagnostics().screenSpace.effectSize[0]<=960,'Effects have a bounded width');
 const samples=advanced.diagnostics().screenSpace.samples;
 require(samples===0||samples===2||samples===4,'HDR target reports a supported spatial MSAA count');
 for(const next of ['high','balanced','low','cinematic']){tier=next;measure(next+'-transition');}
 require(report.errors.length===0,'All quality transitions compile without shader errors');
 cockpit.visible=true;measure('cockpit-independent-depth');cockpit.visible=false;
 await color.setSettings({contrast:1});tier='cinematic';measure('neutral-color-single-tone-map');
 advanced.setSettings({quality:'off'});draw();require(advanced.diagnostics().screenSpace.targets===0,'Off releases advanced postprocess render targets');
 advanced.setSettings({quality:'cinematic'});measure('cinematic-restored');
 require(report.errors.length===0,'World, cockpit and neutral color paths compile');
 report.status='passed';globalThis.__cinematicCapture=(next='cinematic')=>{tier=next;advanced.update({time:10,environment});draw();gl.finish();return advanced.diagnostics();};
 globalThis.__cinematicDispose=()=>{advanced.dispose();color.dispose();weather.dispose();paint.dispose();renderer.dispose();for(const url of blobUrls)URL.revokeObjectURL(url);return advanced.diagnostics();};
}catch(error){report.status='failed';report.failure=error.stack;}
document.getElementById('result').textContent=JSON.stringify(report,null,2);
globalThis.__cinematicWebglDone=true;

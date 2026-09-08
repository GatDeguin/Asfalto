import { reflectorClass } from './reflector-factory.mjs';
import { hdrLoaderClass } from './hdr-loader-factory.mjs';
import { createChevyPaintController } from './chevy-paint-controller.mjs';
import { createWorkshopDetailPass, applyPatina } from './workshop-detail-pass.mjs';
import { createWorkshopStaticBatches } from './workshop-static-batches.mjs';
import { configureSurfaceRelief, installSurfaceRelief, surfaceReliefDiagnostics } from '../tracks/visuals/surface-relief.mjs';
import { createWorkshopVertexGeometry } from './workshop-vertex-colors.mjs';

const SURFACES = Object.freeze({
  MAT_Floor_Concrete_Oily: { id: 'floor', tile: 3, color: '#b7b5ae', roughness: .88, normal: .55, depthM: .006 },
  MAT_Wall_Plaster_Aged: { id: 'plaster', tile: 4, color: '#c9bca7', roughness: .94, normal: .42, depthM: .008 },
  MAT_Wall_Blue_OilPaint: { id: 'blue-paint', tile: 2, color: '#6d8988', roughness: .82, normal: .34, depthM: .0035 },
  MAT_Wood_Dark_Oiled: { id: 'wood', tile: 1.2, color: '#a5947f', roughness: .76, normal: .30, depthM: .004, silhouette: true, detail: true },
  MAT_Steel_Blackened: { id: 'steel', tile: .75, color: '#4e504b', roughness: .68, normal: .22, depthM: .0015, silhouette: true, metalness: .7, detail: true },
  MAT_PaintedMetal_Teal: { id: 'steel', tile: .7, color: '#3b6860', roughness: .74, normal: .18, depthM: .001, silhouette: true, metalness: .2, detail: true },
  MAT_PaintedMetal_Red: { id: 'steel', tile: .7, color: '#9b3728', roughness: .69, normal: .18, depthM: .001, silhouette: true, metalness: .2, detail: true },
});

// Assign UVs in scene metres after authoring transforms, rather than repeating
// a full-room image once per tiny GLB face. Dominant normal handles wall returns.
export function projectSurfaceUVs(T, object, tile) {
  const geometry = object.geometry.clone();
  object.geometry = geometry;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const matrix = new T.Matrix3().getNormalMatrix(object.matrixWorld);
  const point = new T.Vector3(), normal = new T.Vector3();
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
    if (normals) normal.fromBufferAttribute(normals, i).applyMatrix3(matrix).normalize();
    else normal.set(0, 1, 0);
    const x = Math.abs(normal.x), y = Math.abs(normal.y), z = Math.abs(normal.z);
    const a = y >= x && y >= z ? point.x : x > z ? point.z : point.x;
    const b = y >= x && y >= z ? -point.z : point.y;
    uv[i * 2] = a / tile; uv[i * 2 + 1] = b / tile;
  }
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geometry.deleteAttribute('tangent');
  return geometry;
}

export async function enhanceWorkshop(workshop, { loadHdr, loadDetails } = {}) {
  const T = workshop.T;
  const { scene, renderer, workshopRoot: root, car } = workshop;
  const owned = [], originals = [];
  const vertexColors = {meshes:0,vertices:0,triangles:0};
  configureSurfaceRelief(T);
  let reflector = null;
  let hdriEnvironment = null, detailsRoot = null;
  let staticBatches=null;
  let detailPass = null, night = false, lastTime = null, probeDirty = false;
  const previousEnvironment = scene.environment;
  const previousEnvironmentIntensity = scene.environmentIntensity;
  const previousEnvironmentRotation = scene.environmentRotation?.clone();
  const disposeOwned = () => {
    staticBatches?.dispose();staticBatches=null;
    detailPass?.dispose(); detailPass=null;
    for (const [object,state] of originals.splice(0)) Object.assign(object,state);
    reflector?.removeFromParent();
    detailsRoot?.removeFromParent();
    if (hdriEnvironment && scene.environment === hdriEnvironment.texture) {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousEnvironmentIntensity;
      if (previousEnvironmentRotation) scene.environmentRotation.copy(previousEnvironmentRotation);
    }
    for (const resource of owned.splice(0)) resource.dispose?.();
  };
  const loader = new T.TextureLoader();
  const textureTasks = new Map();
  const load = (spec, role) => {
    const key = `${spec.id}:${role}`;
    if (textureTasks.has(key)) return textureTasks.get(key);
    const task = (async () => {
    const asset = role === 'height' ? `workshop-surfaces/${spec.id}-height-1k.png`
      : `${spec.detail ? 'workshop-detail' : 'workshop-surfaces'}/${spec.id}-${role}-${spec.detail ? '1k' : '2k'}.jpg`;
    const url = new URL(`../../assets/${asset}`, import.meta.url);
    const texture = await loader.loadAsync(url.href);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.colorSpace = role === 'baseColor' ? T.SRGBColorSpace : T.NoColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    owned.push(texture); return texture;
    })();
    textureTasks.set(key, task); return task;
  };
  const materials = new Map();
  try {
  const extraLoads = Promise.allSettled([
    (async () => {
      const texture = await (loadHdr ? loadHdr() : new (hdrLoaderClass(T))().loadAsync(new URL('../../assets/workshop-detail/workshop_2k.hdr', import.meta.url).href));
      owned.push(texture); return texture;
    })(),
    (async () => {
      if (loadDetails) return loadDetails();
      const response = await fetch(new URL('../../assets/workshop-detail/workshop-details.glb', import.meta.url));
      if (!response.ok) throw new Error('No se pudo cargar la utilería del taller.');
      return workshop.buildGLTF(workshop.parseGLB(await response.arrayBuffer()), () => {});
    })(),
  ]);
  // Wait for every in-flight load before cleanup: a rejected sibling must not
  // leave textures arriving after the failed initialization has been disposed.
  const materialLoads = await Promise.allSettled(Object.entries(SURFACES).map(async ([name, spec]) => {
    const maps = await Promise.allSettled(['baseColor','normal','roughness','height'].map(role => load(spec, role)));
    const failedMap = maps.find(result => result.status === 'rejected');
    if (failedMap) throw failedMap.reason;
    const [map, normalMap, roughnessMap, heightMap] = maps.map(result => result.value);
    const material = new T.MeshPhysicalMaterial({name, map, normalMap, roughnessMap,
      color: spec.color, roughness: spec.roughness, metalness: spec.metalness || 0,
      normalScale: new T.Vector2(spec.normal, spec.normal),
      clearcoat: spec.id === 'floor' ? .04 : .02,
      clearcoatRoughness: spec.id === 'floor' ? .45 : .5,
      side: T.DoubleSide});
    materials.set(name, material); owned.push(material);
    applyPatina(material, spec.id==='floor'?'floor':/plaster|blue-paint/.test(spec.id)?'wall':'metal');
    installSurfaceRelief(material,{heightMap,metres:spec.tile,depthM:spec.depthM,silhouette:!!spec.silhouette});
    material.vertexColors=true;
  }));
  const extras = await extraLoads;
  const failedMaterial = materialLoads.find(result => result.status === 'rejected');
  if (failedMaterial) throw failedMaterial.reason;
  const failedExtra = extras.find(result => result.status === 'rejected');
  if (failedExtra) throw failedExtra.reason;
  const hdr = extras[0].value;
  hdr.mapping = T.EquirectangularReflectionMapping;
  const environmentGenerator = new T.PMREMGenerator(renderer);
  try {
    hdriEnvironment = environmentGenerator.fromEquirectangular(hdr);
    owned.push(hdriEnvironment);
  } finally {
    environmentGenerator.dispose();
    hdr.dispose(); owned.splice(owned.indexOf(hdr), 1);
  }
  scene.environment = hdriEnvironment.texture;
  scene.environmentIntensity = .34;
  scene.environmentRotation?.set(0, .72, 0);
  detailsRoot = extras[1].value;
  detailsRoot.name = 'Workshop_Blender_Service_Details'; scene.add(detailsRoot);

  root.updateMatrixWorld(true);
  const floorBounds = new T.Box3();
  let hiddenDecals = 0, texturedMeshes = 0;
  for (const scenePart of [root, detailsRoot]) {
  scenePart.updateMatrixWorld(true);
  scenePart.traverse(object => {
    if (!object.isMesh) return;
    originals.push([object,{geometry:object.geometry,material:object.material,visible:object.visible,castShadow:object.castShadow,receiveShadow:object.receiveShadow}]);
    const name = object.material?.name;
    const parentName = object.parent?.name || '';
    if (['MAT_Floor_WetPatch','MAT_Floor_TireFade','MAT_Wall_Grime'].includes(name)) {
      object.visible = false; hiddenDecals++; return;
    }
    // The authored floor has a second coincident slab beneath its detailed top.
    if (parentName === 'ARC_Floor') { object.visible = false; return; }
    const material = materials.get(name);
    if (material) {
      object.material = material;
      const projected=projectSurfaceUVs(T, object, SURFACES[name].tile);
      object.geometry=createWorkshopVertexGeometry(T,object,SURFACES[name].id);
      projected.dispose();owned.push(object.geometry);
      vertexColors.meshes++;vertexColors.vertices+=object.geometry.attributes.position.count;
      vertexColors.triangles+=object.geometry.userData.workshopVertexColors.triangles;
      texturedMeshes++;
      if (name === 'MAT_Floor_Concrete_Oily') floorBounds.union(new T.Box3().setFromObject(object));
    }
    object.castShadow = !/^ARC_(Floor|Wall|Ceiling)/.test(parentName)
      && !['MAT_Glass_Dirty','MAT_Fluorescent_Emission'].includes(name);
    // VSM also includes receivers in its depth pass. Keep room shells and
    // luminous/glass panels out of that pass while the floor receives contact.
    object.receiveShadow = object.castShadow || name === 'MAT_Floor_Concrete_Oily';
  });
  }

  // Scene-specific material copies keep garage lighting independent from the
  // playable car template and its wheel partitions.
  const paint = createChevyPaintController(T, car, { color: workshop.paintColor || '#d66a24' });
  owned.push(paint);
  car.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
  });
  detailPass=createWorkshopDetailPass(T,workshop,{floorY:floorBounds.isEmpty()?.188:floorBounds.max.y});
  staticBatches=createWorkshopStaticBatches(T,scene,[root,detailsRoot]);

  function configure() {
    workshop.hemi.color.set('#b8c3cb'); workshop.hemi.groundColor.set('#3c3023');
    workshop.hemi.intensity = night ? .15 : .42;
    workshop.key.color.set(night?'#899caf':'#ffe0b5'); workshop.key.intensity = night?.10:2.35;
    workshop.key.position.set(-8.1, 3.85, -.45);
    workshop.key.target.position.set(0, .5, 0); scene.add(workshop.key.target);
    workshop.fill.color.set('#bfd0d1'); workshop.fill.intensity = night?.14:.72;
    workshop.fill.position.set(5.5, 3.8, -4);
    workshop.warm.color.set('#ffd4a3'); workshop.warm.intensity = night?32:5;
    workshop.warm.distance = 16; workshop.warm.decay = 2;
    workshop.warm.position.set(1, 4.2, -2.5);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.VSMShadowMap;
    workshop.key.castShadow = true;
    workshop.key.shadow.mapSize.set(1024, 1024);
    Object.assign(workshop.key.shadow.camera, {left:-7,right:7,top:7,bottom:-7,near:.2,far:24});
    workshop.key.shadow.camera.updateProjectionMatrix();
    workshop.key.shadow.bias = -.00012; workshop.key.shadow.normalBias = .012;
    workshop.key.shadow.radius = 10;
    workshop.key.shadow.blurSamples = 12;
    scene.fog = new T.FogExp2('#171511', .012);
    workshop.hotspots.bench = {yaw:.5,pitch:.22,radius:4.8,target:[-2.3,1.35,-4.4]};
    detailPass?.setNight(night);
  }
  configure();

  // Capture the room once for chrome/paint reflections. Sharing the outdoor
  // sky alone produces white chrome bands and no workshop detail on the car.
  const cubeTarget = new T.WebGLCubeRenderTarget(256, {type:T.HalfFloatType});
  const probe = new T.CubeCamera(.1, 45, cubeTarget);
  probe.position.set(0, 1.3, 0); scene.add(probe);
  const carWasVisible = car.visible;
  let generator, room;
  try {
    car.visible = false;
    probe.update(renderer, scene);
    generator = new T.PMREMGenerator(renderer);
    room = generator.fromCubemap(cubeTarget.texture);
    owned.push(room);
  } finally {
    car.visible = carWasVisible;
    scene.remove(probe);
    generator?.dispose(); cubeTarget.dispose();
  }
  paint.forEachMaterial(m => {m.envMap = room.texture; m.needsUpdate = true;});
  const reflectedCarPosition=new T.Vector3();car.getWorldPosition(reflectedCarPosition);
  function refreshRoomReflection() {
    const cube=new T.WebGLCubeRenderTarget(256,{type:T.HalfFloatType}),camera=new T.CubeCamera(.1,45,cube),pmrem=new T.PMREMGenerator(renderer);
    car.getWorldPosition(camera.position);camera.position.y+=1.15;scene.add(camera);
    const visible=car.visible, floorVisible=reflector?.visible, detailVisible=detailPass.group.visible;
    try {
      car.visible=false;if(reflector)reflector.visible=false;detailPass.group.visible=true;
      camera.update(renderer,scene);const next=pmrem.fromCubemap(cube.texture);
      paint.forEachMaterial(m=>{m.envMap=next.texture;m.needsUpdate=true;});
      owned.splice(owned.indexOf(room),1);room.dispose();room=next;owned.push(next);
      car.getWorldPosition(reflectedCarPosition);probeDirty=false;
    } finally {car.visible=visible;if(reflector)reflector.visible=floorVisible;detailPass.group.visible=detailVisible;camera.removeFromParent();cube.dispose();pmrem.dispose();}
  }

  if (!floorBounds.isEmpty()) {
    const size = floorBounds.getSize(new T.Vector3()), center = floorBounds.getCenter(new T.Vector3());
    const floor = materials.get('MAT_Floor_Concrete_Oily');
    const Reflector = reflectorClass(T);
    const shader = {
      name:'Workshop_Worn_Concrete_Reflection',
      uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},
        roughMap:{value:floor.roughnessMap},normalMap:{value:floor.normalMap},
        repeats:{value:new T.Vector2(size.x/3,size.z/3)}},
      vertexShader:`uniform mat4 textureMatrix; varying vec4 vReflection; varying vec2 vSurface;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main(){vSurface=uv;vReflection=textureMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D roughMap;uniform sampler2D normalMap;
        uniform vec2 repeats;varying vec4 vReflection;varying vec2 vSurface;
        #include <logdepthbuf_pars_fragment>
        void main(){
        #include <logdepthbuf_fragment>
        vec2 p=vSurface*repeats;float rough=texture2D(roughMap,p).r;
        vec2 n=(texture2D(normalMap,p).rg-.5)*.022;
        vec2 uv=vReflection.xy/vReflection.w+n;vec2 d=vec2(.003+.006*rough);
        vec3 reflected=(texture2D(tDiffuse,uv+d).rgb+texture2D(tDiffuse,uv-d).rgb+
          texture2D(tDiffuse,uv+vec2(d.x,-d.y)).rgb+texture2D(tDiffuse,uv+vec2(-d.x,d.y)).rgb)*.25;
        gl_FragColor=vec4(reflected,.025+(1.0-rough)*.12);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    };
    const geometry = new T.PlaneGeometry(size.x, size.z);
    reflector = new Reflector(geometry,{shader,textureWidth:768,textureHeight:512,multisample:0,clipBias:.002});
    // Reflector clones custom uniform textures. Share the managed PBR maps so
    // it does not upload and retain two additional, undisposed GPU textures.
    for (const [uniform, texture] of [['roughMap',floor.roughnessMap],['normalMap',floor.normalMap]]) {
      reflector.material.uniforms[uniform].value.dispose();
      reflector.material.uniforms[uniform].value = texture;
    }
    reflector.name = 'Workshop_Concrete_Reflection';
    reflector.rotation.x = -Math.PI/2;
    reflector.position.set(center.x,floorBounds.max.y+.008,center.z);
    reflector.material.transparent = true; reflector.material.depthWrite = false;
    reflector.renderOrder = 2;
    scene.add(reflector); owned.push(geometry, reflector);
  }
  const presentation = {
    configure,
    setLighting(mode) {const next=mode==='night';if(next!==night){night=next;configure();probeDirty=true;}return night?'night':'day';},
    getRoomEnvironment:()=>room.texture,
    setPaintColor: hex => paint.setColor(hex),
    update(t=0) {
      const dt=lastTime===null?0:Math.max(0,Math.min(.05,(t-lastTime)/1000));lastTime=t;
      workshop.warm.position.set(1,4.2,-2.5);workshop.warm.intensity=night?32:5;
      detailPass.update(dt,{reducedMotion:globalThis.document?.body?.classList.contains('v6-reduce-motion')||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
      staticBatches.update(workshop.camera);
      if(workshop.camera&&!workshop.drag&&(probeDirty||car.position.distanceTo(reflectedCarPosition)>.25))refreshRoomReflection();
    },
    diagnostics:()=>({lighting:night?'night':'day',texturedMeshes,hiddenDecals,roomReflection:true,planarReflection:!!reflector,textures:textureTasks.size,
      surfaceRelief:{...surfaceReliefDiagnostics(),materials:materials.size,heightMaps:5},vertexColors:{...vertexColors,instances:detailPass.diagnostics().coloredInstances},
      hdri:'Poly Haven Workshop 2K CC0',environmentIntensity:scene.environmentIntensity,details:true,staticBatches:staticBatches.diagnostics(),detailPass:detailPass.diagnostics(),paint:paint.diagnostics()}),
    dispose(){ disposeOwned(); if (workshop.presentation === presentation) workshop.presentation = null; },
  };
  workshop.presentation = presentation;
  return presentation;
  } catch (error) {
    disposeOwned();
    throw error;
  }
}

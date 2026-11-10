import { getVehicleDefinition } from './vehicle-catalog.mjs?v=1fb2dbf31facc389';
import { VEHICLE_VISUAL_CALIBRATION } from './vehicle-physical-calibration.mjs?v=dc9a8e2b14a2b21c';
import { releaseVehicleModel } from './vehicle-resource-pool.mjs?v=564628ad31eed1e7';
import { vehicleAssetVersions } from '../runtime/vehicle-asset-versions.mjs?v=49590cd241f95e87';
import { createVehicleRefractionPolicy } from './vehicle-glass.mjs?v=d312f5431381b89c';
import { createTrafficDriver } from './traffic-driver.mjs?v=15a626a866acb5ac';

function release(model) {
  const materials = new Set();
  model.traverse(node => {
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material) materials.add(material);
    }
  });
  model.removeFromParent();
  materials.forEach(material => material.dispose());
  releaseVehicleModel(model);
}

export function createDriveTrafficView(T, {scene, loadGlb, prepareTexture = () => {}}) {
  const root = new T.Group();
  root.name = 'DriveTraffic';
  root.userData.visualOnly = true;
  scene.add(root);
  const entries = new Map(), errors = [], warmedTextures = new Set();
  const controller = new AbortController();
  let disposed = false;
  const x = new T.Vector3(), y = new T.Vector3(), z = new T.Vector3(), left = new T.Vector3(), basis = new T.Matrix4();
  function spokeGeometry(count) {
    const positions = [], normals = [];
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count, c = Math.cos(angle), s = Math.sin(angle);
      for (const [a,b] of [[.14,-.055],[.63,-.055],[.63,.055],[.14,-.055],[.63,.055],[.14,.055]]) {
        positions.push(a*c-b*s, a*s+b*c, 0);
        normals.push(0,0,1);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(normals,3));
    return geometry;
  }
  const geometries = {
    tire:new T.TorusGeometry(.81, .19, 7, 24),
    rotor:new T.CircleGeometry(.61, 20),
    rim:new T.RingGeometry(.61, .68, 24),
    hub:new T.CircleGeometry(.21, 18),
    caliper:new T.BoxGeometry(.10, .20, .09),
    lamp:new T.BoxGeometry(.07, .09, .22),
    positionLamp:new T.BoxGeometry(.038,.048,.10),
    steering:new T.TorusGeometry(.16,.012,6,22),
  };
  const spokeStyles = [4,5,8].map(spokeGeometry);
  const rotor = new T.MeshStandardMaterial({color:0x727472, metalness:.65, side:T.DoubleSide});
  const amber = new T.MeshBasicMaterial({color:0xffa21d, toneMapped:false});
  const lowBeam = new T.MeshBasicMaterial({color:0xffecd0,toneMapped:false});
  const tailLight = new T.MeshBasicMaterial({color:0xd92b19,toneMapped:false});
  const positionLight = new T.MeshBasicMaterial({color:0xfcc17a,toneMapped:false});
  const projectors=Array.from({length:2},()=>{
    const light=new T.SpotLight(0xffe5bb,0,53,.36,.65,2);
    light.userData.excludeFromCameraInterior=true;
    root.add(light,light.target);
    return light;
  });
  const steeringMaterial = new T.MeshStandardMaterial({color:0x302821,roughness:.76});
  const tires = [0x171819, 0x262628, 0x15181c].map(color => new T.MeshStandardMaterial({color, roughness:.92}));
  const rims = [0xd3d1c6, 0x494b4c, 0xbc934f].map(color => new T.MeshStandardMaterial({color, metalness:.72, roughness:.27, side:T.DoubleSide}));
  const brakes = [0x851a17, 0xb39b63, 0x3a3d47].map(color => new T.MeshStandardMaterial({color, roughness:.48}));

  function makeVehicle(model, id, canCarryPassenger) {
    const def = getVehicleDefinition(id), spec = def.calibration || VEHICLE_VISUAL_CALIBRATION[id];
    const scale = 1 / (def.sourceScale || .4), ground = spec.sourceWheelY * scale - spec.radiusM;
    const group = new T.Group(), lamps = new T.Group(), wheelViews = [];
    const paint = new Set(), materials = new Set(), hidden = [];
    const replacedGlass = new Set();
    let cabinGlass = null, authoredWheel = false;
    let frontLenses=0,rearLenses=0;
    group.name = 'DriveTraffic_' + id;
    group.visible = false;
    group.userData.asfaltoPrewarm = true;
    model.scale.multiplyScalar(scale);
    model.position.y -= ground;
    model.traverse(node => {
      const data = node.userData || {};
      if (data.wheelId || data.stationaryWheelId || /EngineBay|^Interior$|^05_Habitaculo$|CabinSeats/i.test(node.name)) {
        hidden.push(node);
      }
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = true;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!material) continue;
        materials.add(material);
        if (/Paint/.test(material.name) && material.color) {
          if (/PaintAtlas/.test(material.name)) material.map = null;
          paint.add(material);
        }
      }
    });
    for (const node of hidden) node.visible = false;
    createVehicleRefractionPolicy(materials).setReduced(true);
    model.traverseVisible(node => {
      authoredWheel ||= !!node.userData?.steeringWheel || /steering.?wheel|volante/i.test(node.name);
      if (!node.isMesh) return;
      const substitute = material => {
        if (!material) return material;
        if(material.emissive&&/headlamp|headlight|vidrio_faro/i.test(material.name)){
          material.emissive.setHex(0xffe5af);material.emissiveIntensity=1.35;frontLenses++;
        }
        if(material.emissive&&/brakelens|tail.?light|optica_trasera/i.test(material.name)){
          material.emissive.setHex(0xf52b12);material.emissiveIntensity=.72;rearLenses++;
        }
        if (/(?:^|_)Glass(?:$|_)/i.test(material.name) && !/Gauge/i.test(material.name)) {
          cabinGlass ||= new T.MeshBasicMaterial({color:0x85999b,transparent:true,opacity:.14,
            depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false});
          replacedGlass.add(material);
          return cabinGlass;
        }
        for (const value of Object.values(material)) {
          if (!value?.isTexture || value.isRenderTargetTexture || warmedTextures.has(value)) continue;
          prepareTexture(value);
          warmedTextures.add(value);
        }
        return material;
      };
      node.material=Array.isArray(node.material)?node.material.map(substitute):substitute(node.material);
    });
    // The same cloned lens can also belong to a culled node. Keep one owner.
    if(replacedGlass.size)model.traverse(node=>{
      if(!node.isMesh)return;
      const replace = material=>replacedGlass.has(material)?cabinGlass:material;
      node.material=Array.isArray(node.material)?node.material.map(replace):replace(node.material);
    });
    replacedGlass.forEach(material=>material.dispose());
    group.add(model, lamps);
    const sourceAnchor = (point) => [point[0]*scale,point[1]*scale-ground,point[2]*scale];
    const eye = def.cockpitEyeSource ? sourceAnchor(def.cockpitEyeSource) : [.39,spec.heightM-.245,.40];
    const wheel = def.steeringCenterSource ? sourceAnchor(def.steeringCenterSource) : [eye[0]-.46,eye[1]-.29,eye[2]];
    const driver=createTrafficDriver(T,{eye,wheel,roofM:spec.heightM});
    group.add(driver.root);
    const passenger=canCarryPassenger?createTrafficDriver(T,{
      eye:[eye[0]+.035,eye[1]-.05,-eye[2]],wheel,roofM:spec.heightM,passenger:true,
    }):null;
    if(passenger){passenger.root.visible=false;group.add(passenger.root);}
    if(!authoredWheel){
      const steering=new T.Mesh(geometries.steering,steeringMaterial);
      steering.position.fromArray(wheel);
      steering.rotation.y=Math.PI/2;
      driver.root.add(steering);
    }
    const halfLength = (def.sourceBoundsM?.size[0] || def.physicsEstimate?.dimensionsM.length || 4.85) / 2;
    for(const side of [-1,1]){
      const lamp=new T.Mesh(geometries.positionLamp,positionLight);
      lamp.position.set(-halfLength+.015,.51,side*.66);
      group.add(lamp);
    }
    for(const [end,lenses,material] of [[-1,frontLenses,lowBeam],[1,rearLenses,tailLight]]){
      if(lenses)continue;
      for(const side of [-1,1]){
        const lamp=new T.Mesh(geometries.lamp,material);
        lamp.position.set(end*(halfLength-.015),.62,side*.70);
        group.add(lamp);
      }
    }
    for (const end of [-1, 1]) for (const side of [-1, 1]) {
      const light = new T.Mesh(geometries.lamp, amber);
      light.position.set(end * (halfLength + .03), .65, side * .74);
      lamps.add(light);
    }
    const centers = def.centers || [
      [spec.sourceFrontX, 0, -spec.sourceHalfTrack], [spec.sourceFrontX, 0, spec.sourceHalfTrack],
      [spec.sourceRearX, 0, -spec.sourceHalfTrack], [spec.sourceRearX, 0, spec.sourceHalfTrack],
    ];
    for (const [wx,,wz] of centers) {
      const wheel = new T.Group(), spin = new T.Group(), face = new T.Group();
      const side = Math.sign(wz), radius = spec.radiusM;
      wheel.position.set(wx * scale, radius, wz * scale);
      spin.scale.setScalar(radius);
      const tire = new T.Mesh(geometries.tire, tires[0]);
      tire.scale.z = 1.6;
      face.position.z = side * .22;
      const disc = new T.Mesh(geometries.rotor, rotor);
      disc.position.z = side * .13;
      const lip = new T.Mesh(geometries.rim, rims[0]), hub = new T.Mesh(geometries.hub, rims[0]);
      const spokes = new T.Mesh(spokeStyles[0], rims[0]);
      face.add(lip, hub, spokes);
      spin.add(tire, disc, face);
      const caliper = new T.Mesh(geometries.caliper, brakes[0]);
      caliper.position.set(radius * .51, radius * .08, side * radius * .17);
      wheel.add(spin, caliper);
      group.add(wheel);
      wheelViews.push({spin, tire, lip, hub, spokes, caliper, radius});
    }
    root.add(group);
    return {model, group, paint, lamps, driver, passenger, wheelViews, lastId:null, drawn:false,
      halfLength,runningLights:{front:frontLenses||2,rear:rearLenses||2,positions:true}};
  }

  function applyVariant(entry, car) {
    for (const material of entry.paint) material.color.set(car.color);
    entry.driver.setVariant(car.driver);
    entry.driver.setParked(car.kind==='parked');
    if(car.passenger!=null)entry.passenger?.setVariant(car.passenger);
    for (const {tire,lip,hub,spokes,caliper} of entry.wheelViews) {
      tire.material = tires[car.tire];
      tire.scale.z = [1.4, 1.67, 1.96][car.tire];
      lip.material = hub.material = spokes.material = rims[car.rim];
      spokes.geometry = spokeStyles[car.rim];
      caliper.material = brakes[car.brake];
    }
    entry.lastId = car.id;
  }

  async function prepare(plan, signal) {
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, {once:true});
    try {
      for (const id of new Set(plan.map(car => car.model))) {
        controller.signal.throwIfAborted();
        const name = id + '-lod2.glb', url = new URL('../../assets/vehicles/' + name, import.meta.url);
        url.searchParams.set('v', vehicleAssetVersions[name]);
        let model;
        try {
          model = await loadGlb(url.href, id + ' · tráfico', controller.signal);
          controller.signal.throwIfAborted();
          entries.set(id, makeVehicle(model, id, plan.some(car=>car.model===id&&car.passenger!=null)));
        } catch (error) {
          if (model) release(model);
          controller.signal.throwIfAborted();
          errors.push({id, message:String(error.message || error)});
        }
      }
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }

  function update(cars, sample, playerProgress, night=0) {
    for (const entry of entries.values()) entry.drawn = false;
    for(const projector of projectors)projector.intensity=0;
    let beamIndex=0;
    for (const car of cars) {
      const entry = entries.get(car.model);
      if (!entry || entry.drawn) continue;
      const route = sample(car.progressM), {group, lamps, wheelViews} = entry;
      x.fromArray(route.frame.tangent).multiplyScalar(-car.direction);
      y.fromArray(route.frame.normal);
      z.crossVectors(x, y).normalize();
      basis.makeBasis(x, y, z);
      group.quaternion.setFromRotationMatrix(basis);
      const half = route.widthM / 2;
      // In the physical chart the stored lateral vector points to the
      // driver's right when facing increasing route progress.
      const offset = car.kind === 'parked' ? half + .48 : car.side * Math.min(2.2, half * .52);
      group.position.fromArray(route.position).addScaledVector(left.fromArray(route.frame.left), offset);
      group.position.addScaledVector(y, .03);
      if (entry.lastId !== car.id) applyVariant(entry, car);
      lamps.visible = !!car.hazards;
      entry.driver.root.visible=Math.abs(car.progressM-playerProgress)<82;
      if(entry.passenger)entry.passenger.root.visible=car.passenger!=null&&entry.driver.root.visible;
      if(night>.08&&Math.abs(car.progressM-playerProgress)<105&&beamIndex<projectors.length){
        const light=projectors[beamIndex++];
        group.updateWorldMatrix(true,false);
        light.position.set(-entry.halfLength,.65,0).applyMatrix4(group.matrixWorld);
        light.target.position.set(-32,-.13,0).applyMatrix4(group.matrixWorld);
        light.intensity=3100*night;
      }
      for (const {spin, radius} of wheelViews) {
        spin.rotation.z = car.kind === 'parked' ? 0 : (-car.progressM * car.direction / radius) % (2 * Math.PI);
      }
      entry.drawn = true;
    }
    for (const entry of entries.values()) entry.group.visible = entry.drawn;
  }

  return {
    prepare, update,
    diagnostics:() => ({models:[...entries.keys()], drawn:[...entries].filter(([,e]) => e.drawn).map(([id]) => id),
      drivers:[...entries].filter(([,e])=>e.drawn&&e.driver.root.visible).map(([id])=>id),
      passengers:[...entries].filter(([,e])=>e.drawn&&e.passenger?.root.visible).map(([id])=>id),
      runningLights:Object.fromEntries([...entries].filter(([,e])=>e.drawn).map(([id,e])=>[id,e.runningLights])),
      texturesWarmed:warmedTextures.size, errors:[...errors]}),
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      root.removeFromParent();
      for (const entry of entries.values()) {entry.driver.dispose();entry.passenger?.dispose();release(entry.model);}
      entries.clear();
      warmedTextures.clear();
      root.clear();
      projectors.forEach(light=>light.dispose());
      [...Object.values(geometries), ...spokeStyles].forEach(geometry => geometry.dispose());
      [amber, lowBeam, tailLight, positionLight, rotor, steeringMaterial, ...tires, ...rims, ...brakes].forEach(material => material.dispose());
    },
  };
}

import { getVehicleDefinition } from './vehicle-catalog.mjs?v=d34c237e4bf2bab0';
import { VEHICLE_VISUAL_CALIBRATION } from './vehicle-physical-calibration.mjs?v=dc9a8e2b14a2b21c';
import { releaseVehicleModel } from './vehicle-resource-pool.mjs?v=564628ad31eed1e7';
import { vehicleAssetVersions } from '../runtime/vehicle-asset-versions.mjs?v=76e9c5fc6321daf4';
import { createVehicleRefractionPolicy } from './vehicle-glass.mjs?v=d312f5431381b89c';
import { createTrafficDriver, trafficOccupantSeat } from './traffic-driver.mjs?v=9229a704a8fd763a';
import { createTrafficLamps } from './traffic-lamps.mjs?v=a2ab692c3e977c61';

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

export function createDriveTrafficView(T, {scene, loadGlb, prepareTexture = () => {}, sampleCurvature = () => 0}) {
  const root = new T.Group();
  root.name = 'DriveTraffic';
  root.userData.visualOnly = true;
  scene.add(root);
  const entries = new Map(), errors = [], warmedTextures = new Set();
  const poses=[];
  const controller = new AbortController();
  let disposed = false;
  const x = new T.Vector3(), y = new T.Vector3(), z = new T.Vector3(), left = new T.Vector3(), basis = new T.Matrix4();
  const posePosition=new T.Vector3(),poseRotation=new T.Quaternion();
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
    lamp:new T.CircleGeometry(1,14),
    steering:new T.TorusGeometry(1,.07,6,22),
    seat:new T.SphereGeometry(1,8,5),
  };
  const spokeStyles = [4,5,8].map(spokeGeometry);
  const rotor = new T.MeshStandardMaterial({color:0x727472, metalness:.65, side:T.DoubleSide});
  const projectors=Array.from({length:2},()=>{
    const light=new T.SpotLight(0xffe5bb,0,53,.36,.65,2);
    light.userData.excludeFromCameraInterior=true;
    root.add(light,light.target);
    return light;
  });
  const steeringMaterial = new T.MeshStandardMaterial({color:0x302821,roughness:.76});
  const seatMaterial = new T.MeshStandardMaterial({color:0x423936,roughness:.89});
  const tires = [0x171819, 0x262628, 0x15181c].map(color => new T.MeshStandardMaterial({color, roughness:.92}));
  const rims = [0xd3d1c6, 0x494b4c, 0xbc934f].map(color => new T.MeshStandardMaterial({color, metalness:.72, roughness:.27, side:T.DoubleSide}));
  const brakes = [0x851a17, 0xb39b63, 0x3a3d47].map(color => new T.MeshStandardMaterial({color, roughness:.48}));
  const finishRoughness={restored:.31,daily:.48,work:.65};

  function measureHull(model,spec) {
    const bounds=new T.Box3(),paintBounds=new T.Box3(),part=new T.Box3();
    model.updateWorldMatrix(true,true);
    model.traverseVisible(node=>{
      if(!node.isMesh||!node.geometry||/antenna|mirror|espejo|mastil/i.test(node.name))return;
      const geometry=node.geometry;
      if(!geometry.boundingBox)geometry.computeBoundingBox();
      part.copy(geometry.boundingBox).applyMatrix4(node.matrixWorld);
      bounds.union(part);
      const materials=Array.isArray(node.material)?node.material:[node.material];
      if(materials.some(m=>/paint|barniz|lacquer/i.test(m?.name||'')))paintBounds.union(part);
    });
    if(bounds.isEmpty())throw new Error('Traffic model has no exterior geometry');
    const min=bounds.min,max=bounds.max;
    // The lower shell supplies bumper and side contact. Keep cabin accessories
    // out of the road-level collision envelope.
    min.y=Math.max(min.y,spec.radiusM*.56);
    max.y=Math.min(max.y,spec.heightM*.76);
    if(!paintBounds.isEmpty()){
      min.z=Math.max(min.z,paintBounds.min.z-.045);
      max.z=Math.min(max.z,paintBounds.max.z+.045);
    }
    if(max.x<=min.x||max.y<=min.y||max.z<=min.z)throw new Error('Traffic model has no body footprint');
    return {center:bounds.getCenter(new T.Vector3()).toArray(),halfExtents:bounds.getSize(new T.Vector3()).multiplyScalar(.5).toArray()};
  }

  function makeVehicle(model, id, canCarryPassenger) {
    const def = getVehicleDefinition(id), spec = def.calibration || VEHICLE_VISUAL_CALIBRATION[id];
    const scale = 1 / (def.sourceScale || .4), ground = spec.sourceWheelY * scale - spec.radiusM;
    const group = new T.Group(), wheelViews = [], steeringParts = [];
    const paint = new Set(), materials = new Set(), hidden = [];
    const replacedGlass = new Set();
    let cabinGlass = null, authoredSeats = false;
    group.name = 'DriveTraffic_' + id;
    group.visible = false;
    group.userData.asfaltoPrewarm = true;
    model.scale.multiplyScalar(scale);
    model.position.y -= ground;
    model.traverse(node => {
      const data = node.userData || {};
      if (data.wheelId || data.stationaryWheelId || /EngineBay|^Interior$|^05_Habitaculo$/i.test(node.name)) {
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
      if (node.userData?.steeringWheel) steeringParts.push(node);
      authoredSeats ||= /CabinSeats|BenchSeat|SeatCushion|SeatBack/i.test(node.name);
      if (!node.isMesh) return;
      const substitute = material => {
        if (!material) return material;
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
    group.add(model);
    const hull=measureHull(model,spec);
    const sourceAnchor = (point) => [point[0]*scale,point[1]*scale-ground,point[2]*scale];
    const sourceEye = def.cockpitEyeSource || (id === 'chevy_400_1957' ? [.22,.235,.15865] : null);
    const eye = sourceEye ? sourceAnchor(sourceEye) : [.39,spec.heightM-.245,.40];
    const seat = trafficOccupantSeat(id), steeringAxis = def.steeringAxis || seat.steering?.axis || [1,0,0];
    const wheelSource = def.steeringCenterSource || seat.steering?.center;
    const wheel = wheelSource ? sourceAnchor(wheelSource) : [eye[0]-.46,eye[1]-.29,eye[2]];
    const steeringNormal = new T.Vector3(...steeringAxis).normalize();
    const driver=createTrafficDriver(T,{eye,wheel,roofM:spec.heightM,model:id,steeringAxis});
    group.add(driver.root);
    const passenger=canCarryPassenger ? createTrafficDriver(T,{eye,wheel,roofM:spec.heightM,model:id,passenger:true}) : null;
    if(passenger){passenger.root.visible=false;group.add(passenger.root);}
    const steeringPivot = new T.Group();
    steeringPivot.position.fromArray(wheel);
    steeringPivot.userData.asfaltoDynamicTransform = true;
    group.add(steeringPivot);
    if (steeringParts.length) {
      for (const part of steeringParts) steeringPivot.attach(part);
    } else {
      const steering=new T.Mesh(geometries.steering,steeringMaterial);
      steering.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),steeringNormal);
      steering.scale.setScalar(seat.radius);
      steeringPivot.add(steering);
    }
    if (!authoredSeats) {
      const bench=seat.seat==='bench';
      for (const lateral of bench ? [0] : [-eye[2],eye[2]]) {
        const backrest = new T.Mesh(geometries.seat,seatMaterial);
        backrest.name = bench ? 'TrafficBench' : 'TrafficSeatBack';
        backrest.position.set(eye[0]+seat.hip[0]+.11,eye[1]+seat.hip[1]+.16,lateral);
        backrest.scale.set(.063,.245,bench?.66:.23);
        backrest.rotation.z=.18;
        group.add(backrest);
      }
    }
    const lamps=createTrafficLamps(T,{group,model,id,disc:geometries.lamp});
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
    return {model, group, paint, lamps, driver, passenger, wheelViews, steeringPivot,
      steeringAxis:steeringNormal, lastId:null, drawn:false, selected:false, occupantLod:'near',
      pose:{id:null,car:null,position:[0,0,0],rotation:[0,0,0,1],hull,steering:0}};
  }

  function applyVariant(entry, car) {
    for (const material of entry.paint) {
      material.color.set(car.color);
      material.roughness=finishRoughness[car.finish]??finishRoughness.daily;
    }
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

  function stage(cars, sample) {
    poses.length=0;
    for (const entry of entries.values()) entry.selected=false;
    for (const car of cars) {
      const entry = entries.get(car.model);
      if (!entry || entry.selected) continue;
      const route=sample(car.progressM),pose=entry.pose;
      x.fromArray(route.frame.tangent).multiplyScalar(-car.direction);
      y.fromArray(route.frame.normal);
      z.crossVectors(x, y).normalize();
      basis.makeBasis(x, y, z);
      poseRotation.setFromRotationMatrix(basis).toArray(pose.rotation);
      const half = route.widthM / 2;
      // In the physical chart the stored lateral vector points to the
      // driver's right when facing increasing route progress.
      const offset = car.kind === 'parked' ? half + (car.parking?.edgeOffsetM ?? .48) : car.side * Math.min(2.2, half * .52);
      posePosition.fromArray(route.position).addScaledVector(left.fromArray(route.frame.left), offset);
      posePosition.addScaledVector(y,car.parking?.liftM ?? .03).toArray(pose.position);
      const curvature=car.kind==='parked'?0:(route.curvaturePerM??sampleCurvature(car.progressM))||0;
      pose.steering=car.kind==='parked' ? 0 : Math.max(-.63,Math.min(.63,-curvature*car.direction*45+(car.laneChangeRate||0)*.25));
      pose.id=car.id;pose.car=car;entry.selected=true;poses.push(pose);
    }
    return poses;
  }

  function update(trafficPoses, playerProgress, night=0) {
    for (const entry of entries.values()) entry.drawn = false;
    for(const projector of projectors)projector.intensity=0;
    let beamIndex=0;
    for (const {car,position,rotation,steering} of trafficPoses) {
      const entry=entries.get(car.model),{group,lamps,wheelViews}=entry;
      group.position.fromArray(position);
      group.quaternion.fromArray(rotation);
      if (entry.lastId !== car.id) applyVariant(entry, car);
      const distance = Math.abs(car.progressM-playerProgress), parked = car.kind==='parked';
      const lampMode = !parked && night>.10 ? 'low' : 'position';
      lamps.update(lampMode,!!car.hazards);
      if (entry.occupantLod==='near' && distance>41) entry.occupantLod='far';
      if (entry.occupantLod==='far' && distance<34) entry.occupantLod='near';
      entry.driver.root.visible=distance<118;
      if (entry.passenger) entry.passenger.root.visible=car.passenger!=null && distance<118;
      if (entry.driver.root.visible) {
        const pose={steering, parked, seconds:car.poseTimeS||0, facing:steering};
        entry.driver.setLod(entry.occupantLod);
        entry.driver.update(pose);
        if (entry.passenger?.root.visible) {
          entry.passenger.setLod(entry.occupantLod);
          entry.passenger.update(pose);
        }
        entry.steeringPivot.quaternion.setFromAxisAngle(entry.steeringAxis,steering);
      }
      if (lampMode==='low' && distance<105 && beamIndex===0) {
        group.updateWorldMatrix(true,false);
        for (const mount of lamps.lowMounts) {
          const light=projectors[beamIndex++];
          light.position.copy(mount.position).applyMatrix4(group.matrixWorld);
          light.target.position.copy(mount.position).addScaledVector(x.set(-1,0,0),32);
          light.target.position.y-=.78;
          light.target.position.applyMatrix4(group.matrixWorld);
          light.intensity=1800*night;
        }
      }
      for (const {spin, radius} of wheelViews) {
        spin.rotation.z = car.kind === 'parked' ? 0 : (-car.progressM * car.direction / radius) % (2 * Math.PI);
      }
      entry.drawn = true;
    }
    for (const entry of entries.values()) entry.group.visible = entry.drawn;
  }

  return {
    prepare, stage, update,
    diagnostics:() => ({models:[...entries.keys()], drawn:[...entries].filter(([,e]) => e.drawn).map(([id]) => id),
      drivers:[...entries].filter(([,e])=>e.drawn&&e.driver.root.visible).map(([id])=>id),
      passengers:[...entries].filter(([,e])=>e.drawn&&e.passenger?.root.visible).map(([id])=>id),
      runningLights:Object.fromEntries([...entries].filter(([,e])=>e.drawn).map(([id,e])=>[id,e.lamps.diagnostics()])),
      occupants:Object.fromEntries([...entries].filter(([,e])=>e.drawn&&e.driver.root.visible).map(([id,e])=>[id,{
        driver:e.driver.diagnostics(),passenger:e.passenger?.root.visible?e.passenger.diagnostics():null,
      }])),
      texturesWarmed:warmedTextures.size, errors:[...errors]}),
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      root.removeFromParent();
      for (const entry of entries.values()) {
        entry.driver.dispose();entry.passenger?.dispose();entry.lamps.dispose();
        // Return authored wheel meshes to the model that owns their materials.
        for (const child of [...entry.steeringPivot.children]) {
          if (child.userData?.steeringWheel) entry.model.add(child);
        }
        release(entry.model);
      }
      entries.clear();
      poses.length=0;
      warmedTextures.clear();
      root.clear();
      projectors.forEach(light=>light.dispose());
      [...Object.values(geometries), ...spokeStyles].forEach(geometry => geometry.dispose());
      [rotor, steeringMaterial, seatMaterial, ...tires, ...rims, ...brakes].forEach(material => material.dispose());
    },
  };
}

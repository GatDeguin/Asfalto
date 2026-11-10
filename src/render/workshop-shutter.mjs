const SHUTTER_ASSET = '../../assets/workshop-detail/workshop-departure.glb';
const SLAT_COUNT = 66;

export async function loadWorkshopShutter(workshop) {
  const response = await fetch(new URL(SHUTTER_ASSET, import.meta.url));
  if (!response.ok) throw new Error('No se pudo cargar la cortina del taller.');
  const parsed = workshop.parseGLB(await response.arrayBuffer());
  const model = await workshop.buildGLTF(parsed, () => {});
  return prepareWorkshopShutter(workshop, parsed, model);
}

export function prepareWorkshopShutter(workshop, parsed, model) {
  const { T } = workshop;
  const { nodes, animations } = parsed.json;
  const fixed = model.getObjectByName('E31_ShutterFixed');
  const moving = model.getObjectByName('E31_ShutterMoving');
  const driveway = model.getObjectByName('E31_ShutterDriveway');
  const seal = moving?.getObjectByName('E31_BottomSeal');
  const drum = moving?.getObjectByName('E31_RollerDrum');
  const anchor = name => model.getObjectByName(name)?.getWorldPosition(new T.Vector3());
  const exitLight = anchor('E31_ExitFillAnchor');
  const workbenchLight = anchor('E31_WorkbenchWarmAnchor');
  const displayLight = anchor('E31_DisplayWarmAnchor');
  const photoAngles = Object.fromEntries(['Front','Profile','Quarter','Interior'].map(name => [name.toLowerCase(),anchor(`E31_Photo${name}`)]));
  const paintedGeometry = name => model.getObjectByName(name)?.children.find(child => child.isMesh)?.geometry;
  const beamGeometry = paintedGeometry('E31_DepartureBeam'), wearGeometry = paintedGeometry('E31_ConcreteWear');
  if (!fixed || !moving || !driveway || !seal || !drum || !exitLight || !workbenchLight || !displayLight ||
      beamGeometry?.attributes.color?.itemSize !== 4 || wearGeometry?.attributes.color?.itemSize !== 4) {
    throw new Error('Falta una pieza de la cortina del taller.');
  }
  driveway.userData.cameraCollision = false;

  const tracks = new Map();
  let first = Infinity, last = -Infinity;
  for (const animation of animations) {
    for (const { sampler, target } of animation.channels) {
      const name = nodes[target.node].name;
      const { input, output, interpolation } = animation.samplers[sampler];
      const Track = target.path === 'translation' ? T.VectorKeyframeTrack : T.QuaternionKeyframeTrack;
      if (interpolation !== 'LINEAR' || !['translation', 'rotation'].includes(target.path)) {
        throw new Error('Canal de la cortina incompatible.');
      }
      const times = workshop.accessor(parsed, input).array;
      const values = workshop.accessor(parsed, output).array;
      first = Math.min(first, times[0]);
      last = Math.max(last, times.at(-1));
      if (!tracks.has(name)) tracks.set(name, {});
      tracks.get(name)[target.path] = new Track(name, times, values).createInterpolant();
    }
  }

  const slats = Array.from({ length: SLAT_COUNT }, (_, i) => moving.getObjectByName(`E31_Slat_${String(i).padStart(2, '0')}`));
  const prototype = slats[0]?.children.find(child => child.isMesh);
  const hasPose = node => tracks.get(node?.name)?.translation && tracks.get(node?.name)?.rotation;
  const driverDoor = tracks.get('E31_DriverDoorTravel')?.translation;
  if (!prototype || !slats.every(hasPose) || !hasPose(seal) || !tracks.get(drum.name)?.rotation || !driverDoor || !(last > first)) {
    throw new Error('La cortina no tiene todos sus fotogramas de apertura.');
  }

  const curtain = new T.InstancedMesh(prototype.geometry, prototype.material, SLAT_COUNT);
  curtain.name = 'E31_RollerCurtain';
  curtain.castShadow = true;
  curtain.receiveShadow = true;
  curtain.instanceMatrix.setUsage(T.DynamicDrawUsage);
  moving.add(curtain);
  const slatTracks = slats.map(node => tracks.get(node.name));
  for (const node of slats) node.removeFromParent();
  const sealTracks = tracks.get(seal.name), drumTracks = tracks.get(drum.name);
  const matrix = new T.Matrix4(), position = new T.Vector3(), rotation = new T.Quaternion();
  const scale = new T.Vector3(1, 1, 1);
  const paint = { vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide };
  const beam = new T.Mesh(beamGeometry, new T.MeshBasicMaterial({ ...paint, blending: T.AdditiveBlending }));
  const wear = new T.Mesh(wearGeometry, new T.MeshBasicMaterial(paint));
  beam.name = 'E31_DepartureBeam'; wear.name = 'E31_ConcreteWear';
  beam.userData.asfaltoPrewarm = true;
  beam.userData.cameraCollision = wear.userData.cameraCollision = false;
  beam.visible = false;

  function setOpen(amount) {
    const t = first + Math.max(0, Math.min(1, amount)) * (last - first);
    for (const [index, pose] of slatTracks.entries()) {
      position.fromArray(pose.translation.evaluate(t));
      rotation.fromArray(pose.rotation.evaluate(t));
      curtain.setMatrixAt(index, matrix.compose(position, rotation, scale));
    }
    curtain.instanceMatrix.needsUpdate = true;
    curtain.computeBoundingBox();
    curtain.computeBoundingSphere();
    seal.position.fromArray(sealTracks.translation.evaluate(t));
    seal.quaternion.fromArray(sealTracks.rotation.evaluate(t));
    drum.quaternion.fromArray(drumTracks.rotation.evaluate(t));
  }

  const diagnostics = () => ({ source: 'workshop-departure.glb', slats: SLAT_COUNT, sampledObjects: tracks.size,
    travelSeconds: Math.round((last - first) * 1000) / 1000, lowestY: Math.min(curtain.boundingBox.min.y, seal.position.y - .01) });
  setOpen(0);
  return { fixed, moving, driveway, exitLight, workbenchLight, displayLight, photoAngles, beam, wear, setOpen, diagnostics,
    doorOpenAt: seconds => driverDoor.evaluate(first + seconds)[0],
    dispose() { curtain.dispose(); beam.material.dispose(); wear.material.dispose(); } };
}

import { createIgnitionMotion } from './ignition-motion.mjs?v=138ba0c547873787';

// The authored GLBs use meters, Y up and +Z toward the driver. The lock
// origin is its front face; the main key origin is the tip of its blade.
const ASSETS = ['lock', 'key', 'ring', 'fob'];
const RUN_ANGLE = -42 * Math.PI / 180;

function disposeModels(models) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  for (const root of Object.values(models)) {
    root.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
        if (!material || materials.has(material)) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    root.removeFromParent();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

export function createCockpitIgnition({ THREE, models } = {}) {
  if (!THREE?.Group || ASSETS.some(id => !models?.[id]?.isObject3D)) throw new TypeError('Faltan los modelos de cerradura y llave.');
  const mount = new THREE.Group();
  mount.name = 'CerraduraChevyEditable';
  mount.position.set(-.94, .50, .52);
  mount.scale.setScalar(2);
  mount.add(models.lock);
  const rotor = models.lock.getObjectByName('ignition-rotor');
  if (rotor) rotor.rotation.z = RUN_ANGLE;

  const keyMount = new THREE.Group();
  keyMount.name = 'LlaveContactoChevyEditable';
  keyMount.position.z = -.030;
  keyMount.rotation.z = RUN_ANGLE;
  const keyMotion = new THREE.Group();
  keyMotion.name = 'LlaveHolguraFisica';
  keyMount.add(keyMotion);
  keyMotion.add(models.key);
  mount.add(keyMount);

  // Keep the ring through the authored bow aperture, with the fob hanging
  // below it. These remain children of the key when the editor moves it.
  const keychainMount = new THREE.Group();
  keychainMount.name = 'LlaveroChevyEditable';
  keychainMount.position.z = .052;
  keychainMount.rotation.z = -RUN_ANGLE;
  keychainMount.scale.setScalar(.7);
  models.ring.position.set(0, -.014, 0);
  models.fob.position.set(-.009, -.051, .001);
  models.fob.rotation.set(0, .10, -.16);
  const chainMotion = new THREE.Group(), fobMotion = new THREE.Group();
  chainMotion.name = 'LlaveroPenduloFisico';
  fobMotion.name = 'ColganteArticulacionFisica';
  fobMotion.position.y = -.028;
  models.fob.position.y -= fobMotion.position.y;
  fobMotion.add(models.fob);
  chainMotion.add(models.ring, fobMotion);
  keychainMount.add(chainMotion);
  keyMotion.add(keychainMount);
  const motion = createIgnitionMotion(), basis = new THREE.Quaternion(), worldScale = new THREE.Vector3();
  const frameQuaternion = [0,0,0,1];
  let ignitionSequence=0,ignitionStartAtS=null,ignitionLastTime=null,ignitionTurn=0,ignitionState='ready',ignitionFault='none';
  function resetMotion() {
    motion.reset();
    ignitionStartAtS=null;ignitionTurn=0;if(rotor)rotor.rotation.z=RUN_ANGLE;
    keyMotion.rotation.set(0,0,0);chainMotion.rotation.set(0,0,0);fobMotion.rotation.set(0,0,0);
  }
  mount.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = false;
    node.frustumCulled = true;
  });
  let disposed = false;
  const availability = mode => ({ available: mode === 'cockpit', reason: mode === 'cockpit' ? '' : 'El contacto requiere la vista cockpit' });
  const capabilities = { position: true, rotation: true, scale: true, lens: false };
  return Object.freeze({
    mount, keyMount, keychainMount,
    motionPivots: Object.freeze({key:keyMotion,chain:chainMotion,fob:fobMotion}),
    resetMotion,
    update(snapshot, options = {}) {
      if (disposed) return false;
      basis.copy(mount.quaternion).multiply(keyMount.quaternion).multiply(keychainMount.quaternion).toArray(frameQuaternion);
      keychainMount.getWorldScale(worldScale);
      const state = motion.step(snapshot, { ...options, frameQuaternion, lengthM:.064*Math.abs(worldScale.y) });
      const ignition=snapshot?.engine?.ignition,time=snapshot?.timeSeconds;
      if(ignition&&Number.isFinite(ignition.sequence)&&Number.isFinite(time)){
        if(ignition.sequence>ignitionSequence){ignitionSequence=ignition.sequence;ignitionStartAtS=Number.isFinite(ignition.startedAtS)?ignition.startedAtS:time;}
        else if(ignitionLastTime!==null&&time<ignitionLastTime)ignitionStartAtS=null;
        ignitionLastTime=time;ignitionState=ignition.state;ignitionFault=snapshot.engine.fault||'none';
      }
      if(options.editing||options.reducedMotion){ignitionStartAtS=null;ignitionTurn=0;}
      else if(!options.paused){const age=ignitionStartAtS===null?Infinity:Math.max(0,time-ignitionStartAtS);ignitionTurn=age<.35?(-12*Math.PI/180)*Math.exp(-age/.075)*Math.cos(age*22):0;}
      // Starter travel stays on physical child pivots; the user's key and
      // ignition editor mounts, their offsets and blade insertion never change.
      keyMotion.rotation.set(state.keyPitch,0,state.keyRoll+ignitionTurn);
      if(rotor)rotor.rotation.z=RUN_ANGLE+ignitionTurn;
      chainMotion.rotation.set(state.pitch,0,state.roll);
      fobMotion.rotation.set(-state.pitch*.18,state.twist,-state.roll*.12);
      return true;
    },
    editorTargets: Object.freeze([
      { id: 'ignition', label: 'Cerradura y llave · conjunto', object: mount, capabilities, availability },
      { id: 'ignition-key', label: 'Llave de contacto', object: keyMount, capabilities, availability },
      { id: 'ignition-keychain', label: 'Llavero Chevrolet', object: keychainMount, capabilities, availability },
    ]),
    diagnostics: () => ({ ready: !disposed, disposed, inserted: true, presentationAngleDeg: -42, models: ASSETS.slice(), motion:motion.getState(), ignition:{state:ignitionState,sequence:ignitionSequence,fault:ignitionFault,turnRad:ignitionTurn} }),
    dispose() {
      if (disposed) return false;
      disposed = true;
      resetMotion();
      mount.removeFromParent();
      disposeModels(models);
      mount.clear(); keyMount.clear(); keychainMount.clear();
      return true;
    },
  });
}

export async function loadCockpitIgnition({ THREE, decodeGlb, fetchBytes, signal } = {}) {
  const models = {};
  const checkAborted = () => { if (signal?.aborted) throw signal.reason || new Error('Carga del contacto cancelada.'); };
  try {
    for (const id of ASSETS) {
      checkAborted();
      const url = new URL(`../../assets/cockpit/ignition/${id}.glb`, import.meta.url);
      const bytes = await fetchBytes(url, { signal });
      checkAborted();
      models[id] = await decodeGlb(bytes, `Contacto Chevy · ${id}`);
      checkAborted();
    }
    return createCockpitIgnition({ THREE, models });
  } catch (error) {
    disposeModels(models);
    throw error;
  }
}

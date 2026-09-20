
(function publishEnvironmentCore(global) {
  'use strict';

  const WEATHER = Object.freeze(['clear', 'cloudy', 'rain', 'storm', 'fog', 'light-snow', 'heavy-snow']);
  const TIMES_OF_DAY = Object.freeze(['day', 'dawn', 'afternoon', 'sunset', 'moonrise', 'night']);
  const PRECIPITATION = Object.freeze(['none', 'rain', 'storm', 'light-snow', 'heavy-snow']);
  const SKY_PRESETS = Object.freeze({ clear: 'clear_day', overcast: 'overcast_day', 'golden-hour': 'golden_hour', sunset: 'sunset', moonrise: 'moonrise', night: 'dark_night' });

  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
    return value;
  }

  function assertFiniteNumber(value, field) {
    if (!Number.isFinite(value)) throw new TypeError('Invalid ' + field);
  }

  function assertHexColor(value, field) {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
      throw new TypeError('Invalid ' + field);
    }
  }

  function preset(values) {
    const required = [
      'hdri', 'source', 'environmentIntensity', 'keyLightIntensity', 'exposure',
      'fogDensity', 'fogColor', 'keyLightColor', 'keyLightDirection',
      'precipitation', 'roadWetness', 'headlights', 'artificialLights',
    ];
    for (const field of required) {
      if (!Object.prototype.hasOwnProperty.call(values, field)) {
        throw new TypeError('Missing preset field: ' + field);
      }
    }
    if (typeof values.hdri !== 'string' || typeof values.source !== 'string') {
      throw new TypeError('Invalid preset source');
    }
    for (const field of ['environmentIntensity', 'keyLightIntensity', 'exposure', 'fogDensity']) {
      assertFiniteNumber(values[field], field);
    }
    assertHexColor(values.fogColor, 'fogColor');
    assertHexColor(values.keyLightColor, 'keyLightColor');
    if (!Array.isArray(values.keyLightDirection) || values.keyLightDirection.length !== 3) {
      throw new TypeError('Invalid keyLightDirection');
    }
    values.keyLightDirection.forEach((value) => assertFiniteNumber(value, 'keyLightDirection'));
    if (!PRECIPITATION.includes(values.precipitation)) throw new TypeError('Invalid precipitation');
    values.precipitationIntensity ??= { none: 0, rain: .65, storm: 1, 'light-snow': .35, 'heavy-snow': 1 }[values.precipitation];
    if (!Number.isFinite(values.precipitationIntensity) || values.precipitationIntensity < 0 || values.precipitationIntensity > 1) throw new TypeError('Invalid precipitation intensity');
    if (!Number.isFinite(values.roadWetness) || values.roadWetness < 0 || values.roadWetness > 1) {
      throw new TypeError('Invalid roadWetness');
    }
    if (typeof values.headlights !== 'boolean' || typeof values.artificialLights !== 'boolean') {
      throw new TypeError('Invalid light state');
    }
    return freeze(values);
  }

  const PRESETS = freeze({
    clear_day: preset({
      hdri: 'clear', source: 'Cielos/runtime/clear.av3hdri',
      environmentIntensity: 1.00, keyLightIntensity: 1.10, exposure: 1.00,
      fogDensity: 0.0015, fogColor: '#cadce3', keyLightColor: '#fff0d2',
      keyLightDirection: [-0.45, 0.82, 0.35],
      precipitation: 'none', roadWetness: 0.00, headlights: false, artificialLights: false,
    }),
    overcast_day: preset({
      hdri: 'overcast', source: 'Cielos/runtime/overcast.av3hdri',
      environmentIntensity: 0.76, keyLightIntensity: 0.24, exposure: 1.35,
      fogDensity: 0.0040, fogColor: '#b9cbd0', keyLightColor: '#d8e2e8',
      keyLightDirection: [-0.20, 0.95, 0.10],
      precipitation: 'none', roadWetness: 0.35, headlights: false, artificialLights: false,
    }),
    golden_hour: preset({
      hdri: 'golden', source: 'Cielos/runtime/golden.av3hdri',
      environmentIntensity: 0.84, keyLightIntensity: 0.66, exposure: 1.15,
      fogDensity: 0.0022, fogColor: '#c9a77c', keyLightColor: '#ffd19a',
      keyLightDirection: [-0.80, 0.22, 0.55],
      precipitation: 'none', roadWetness: 0.00, headlights: false, artificialLights: false,
    }),
    sunset: preset({
      hdri: 'sunset', source: 'Cielos/runtime/sunset.av3hdri',
      environmentIntensity: 0.60, keyLightIntensity: 0.34, exposure: 1.50,
      fogDensity: 0.0030, fogColor: '#8f7280', keyLightColor: '#ffad7a',
      keyLightDirection: [-0.90, 0.08, 0.35],
      precipitation: 'none', roadWetness: 0.05, headlights: true, artificialLights: true,
    }),
    moonrise: preset({
      hdri: 'moonrise', source: 'Cielos/runtime/moonrise.av3hdri',
      environmentIntensity: 0.040, keyLightIntensity: 0.010, exposure: 1.70,
      fogDensity: 0.0020, fogColor: '#35445e', keyLightColor: '#9db8dc',
      keyLightDirection: [0.45, 0.55, -0.70],
      precipitation: 'none', roadWetness: 0.00, headlights: true, artificialLights: true,
    }),
    dark_night: preset({
      hdri: 'night', source: 'Cielos/runtime/night.av3hdri',
      environmentIntensity: 0.010, keyLightIntensity: 0.000, exposure: 1.65,
      fogDensity: 0.0012, fogColor: '#101727', keyLightColor: '#6f86ad',
      keyLightDirection: [0.00, 1.00, 0.00],
      precipitation: 'none', roadWetness: 0.00, headlights: true, artificialLights: true,
    }),
  });

  function validateSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new TypeError('Invalid settings object');
    }
    if (!WEATHER.includes(settings.weather)) throw new RangeError('Invalid weather');
    if (!TIMES_OF_DAY.includes(settings.timeOfDay)) throw new RangeError('Invalid timeOfDay');
  }

  function chooseEnvironmentPreset(settings) {
    validateSettings(settings);
    if (settings.skyId != null) {
      if (!Object.prototype.hasOwnProperty.call(SKY_PRESETS, settings.skyId)) throw new RangeError('Invalid skyId');
      return SKY_PRESETS[settings.skyId];
    }
    if (settings.timeOfDay === 'afternoon') return 'golden_hour';
    if (settings.timeOfDay === 'moonrise') return 'moonrise';
    if (settings.timeOfDay === 'night') {
      return settings.weather === 'clear' ? 'moonrise' : 'dark_night';
    }
    if (settings.weather !== 'clear') return 'overcast_day';
    if (settings.timeOfDay === 'dawn') return 'golden_hour';
    if (settings.timeOfDay === 'sunset') return 'sunset';
    return 'clear_day';
  }

  function getEnvironmentPreset(id) {
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(PRESETS, id)) {
      throw new RangeError('Invalid environment preset: ' + id);
    }
    return PRESETS[id];
  }

  function selectPreset(settings) {
    validateSettings(settings);
    const id = chooseEnvironmentPreset(settings);
    const selected = getEnvironmentPreset(id);
    if (settings.skyId == null && (settings.weather === 'clear' || settings.weather === 'cloudy')) return selected;
    const climate = {
      clear: ['none', 0, 0], cloudy: ['none', .35, .004],
      rain: ['rain', .70, .006], storm: ['storm', .90, .009],
      fog: ['none', .35, .018], 'light-snow': ['light-snow', .10, .006], 'heavy-snow': ['heavy-snow', .12, .014],
    }[settings.weather];
    return preset({
      ...selected,
      keyLightDirection: [...selected.keyLightDirection],
      precipitation: climate[0], roadWetness: climate[1],
      precipitationIntensity: { none: 0, rain: .65, storm: 1, 'light-snow': .35, 'heavy-snow': 1 }[climate[0]],
      fogDensity: Math.max(selected.fogDensity, climate[2]),
    });
  }
  function getResolvedEnvironmentStateSignature(id, selected) {
    return JSON.stringify([
      id,
      selected.hdri,
      selected.source,
      selected.environmentIntensity,
      selected.keyLightIntensity,
      selected.exposure,
      selected.fogDensity,
      selected.fogColor,
      selected.keyLightColor,
      ...selected.keyLightDirection,
      selected.precipitation,
      selected.precipitationIntensity,
      selected.roadWetness,
      selected.headlights,
      selected.artificialLights,
    ]);
  }

  function getEnvironmentStateSignature(settings) {
    const id = chooseEnvironmentPreset(settings);
    const selected = selectPreset(settings);
    return getResolvedEnvironmentStateSignature(id, selected);
  }



  function decodeAv3HdriRgb(bytes, id) {
    const label = String(id || 'unknown');
    const input = bytes instanceof Uint8Array
      ? bytes
      : ArrayBuffer.isView(bytes)
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null;
    if (!input || input.byteLength < 16) throw new Error('HDRI v5 inválido: ' + label);
    const expectedMagic = 'AV3HDRI1';
    for (let index = 0; index < expectedMagic.length; index += 1) {
      if (input[index] !== expectedMagic.charCodeAt(index)) {
        throw new Error('HDRI v5 inválido: ' + label);
      }
    }
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    const width = view.getUint32(8, true);
    const height = view.getUint32(12, true);
    const componentCount = width * height * 3;
    if (width !== 1024 || height !== 512
        || input.byteLength !== 16 + componentCount * 2) {
      throw new Error('HDRI v5 inválido: ' + label);
    }
    const rgb = new Uint16Array(componentCount);
    for (let index = 0; index < componentCount; index += 1) {
      rgb[index] = view.getUint16(16 + index * 2, true);
    }
    return { width, height, rgb };
  }

  function applyTrackWetness(root, wetness, options = {}) {
    if (options.skip === true) return 0;
    if (!root || typeof root.traverse !== 'function') {
      throw new TypeError('Invalid authored visual root');
    }
    if (!Number.isFinite(wetness) || wetness < 0 || wetness > 1) {
      throw new TypeError('Invalid road wetness');
    }
    const affected = new Set();
    root.traverse((object) => {
      if (!object?.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material || affected.has(material) || !/asphalt|road/i.test(material.name || '')) {
          continue;
        }
        if (!Number.isFinite(material.roughness)) continue;
        if (!material.userData || typeof material.userData !== 'object') material.userData = {};
        if (!Object.prototype.hasOwnProperty.call(material.userData, 'v5DryRoughness')) {
          material.userData.v5DryRoughness = material.roughness;
        }
        const dry = material.userData.v5DryRoughness;
        material.roughness = wetness === 0 ? dry : dry + (0.34 - dry) * wetness;
        material.needsUpdate = true;
        affected.add(material);
      }
    });
    return affected.size;
  }

  function createEnvironmentDataTexture(THREE, validated, id) {
    if (!THREE || typeof THREE.DataTexture !== 'function') {
      throw new TypeError('Invalid THREE DataTexture factory');
    }
    const rgba = new Uint16Array(validated.width * validated.height * 4);
    for (let sourceIndex = 0, targetIndex = 0;
      sourceIndex < validated.rgb.length;
      sourceIndex += 3, targetIndex += 4) {
      rgba[targetIndex] = validated.rgb[sourceIndex];
      rgba[targetIndex + 1] = validated.rgb[sourceIndex + 1];
      rgba[targetIndex + 2] = validated.rgb[sourceIndex + 2];
      rgba[targetIndex + 3] = 0x3c00;
    }
    let texture = null;
    try {
      texture = new THREE.DataTexture(
        rgba, validated.width, validated.height, THREE.RGBAFormat, THREE.HalfFloatType,
      );
      texture.name = 'AsfaltoV5_HDRI_' + id;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      if ('colorSpace' in texture) {
        texture.colorSpace = THREE.LinearSRGBColorSpace || THREE.NoColorSpace || '';
      }
      texture.needsUpdate = true;
      return texture;
    } catch (error) {
      texture?.dispose?.();
      throw error;
    }
  }

  function createEnvironmentPayloadLoader(options = {}) {
    const payloadCore = options.payloadCore;
    const documentRoot = options.documentRoot;
    const gunzipBase64 = options.gunzipBase64;
    const createTexture = options.createTexture;
    const allowedIds = new Set(options.allowedIds || []);
    if (!payloadCore || typeof payloadCore.decodePayloadById !== 'function'
        || !documentRoot || typeof documentRoot.getElementById !== 'function'
        || typeof gunzipBase64 !== 'function' || typeof createTexture !== 'function') {
      throw new TypeError('Invalid environment payload loader options');
    }
    const cache = new Map();
    let hits = 0;
    let misses = 0;

    async function load(id) {
      if (!allowedIds.has(id)) throw new Error('HDRI v5 no autorizado: ' + id);
      const cached = cache.get(id);
      if (cached) {
        hits += 1;
        return createTexture(cached, id);
      }
      misses += 1;
      return payloadCore.decodePayloadById(
        documentRoot,
        'asfalto-v5-hdri-' + id,
        async (encoded) => {
          const bytes = await gunzipBase64(encoded);
          const decoded = decodeAv3HdriRgb(bytes, id);
          const validated = {
            width: decoded.width,
            height: decoded.height,
            rgb: new Uint16Array(decoded.rgb),
          };
          const texture = await createTexture(validated, id);
          cache.set(id, validated);
          return texture;
        },
      );
    }

    function getDiagnostics() {
      let bytes = 0;
      for (const cached of cache.values()) bytes += cached.rgb.byteLength;
      return Object.freeze({ entries: cache.size, bytes, hits, misses });
    }

    function clear() {
      cache.clear();
    }

    return Object.freeze({ load, getDiagnostics, clear });
  }

  function createEnvironmentController(options = {}) {
    const decodeHdri = options.decodeHdri;
    const buildPmrem = options.buildPmrem;
    const applyScene = options.applyScene;
    const resolvePreset = options.resolvePreset || selectPreset;
    if (typeof decodeHdri !== 'function'
        || typeof buildPmrem !== 'function'
        || typeof applyScene !== 'function' || typeof resolvePreset !== 'function') {
      throw new TypeError('Environment controller callbacks are required');
    }

    let active = null;
    let requestToken = 0;
    let disposed = false;
    let inFlight = 0;
    const disposedResources = new WeakSet();
    const counters = {
      started: 0,
      applied: 0,
      noops: 0,
      stale: 0,
      failed: 0,
      sourcesProduced: 0,
      sourcesCreated: 0,
      sourcesInvalid: 0,
      targetsProduced: 0,
      targetsCreated: 0,
      targetsInvalid: 0,
      sourcesDisposed: 0,
      targetsDisposed: 0,
    };

    function disposeResource(resource, kind) {
      if (!resource || (typeof resource !== 'object' && typeof resource !== 'function')
          || typeof resource.dispose !== 'function') return;
      if (disposedResources.has(resource)) return;
      disposedResources.add(resource);
      try {
        resource.dispose();
      } finally {
        if (kind === 'source') counters.sourcesDisposed += 1;
        else counters.targetsDisposed += 1;
      }
    }

    function disposePair(pair) {
      if (!pair) return;
      disposeResource(pair.source, 'source');
      disposeResource(pair.target, 'target');
    }

    function snapshot() {
      const state = active?.state || null;
      return Object.freeze({
        disposed,
        inFlight,
        preset: state?.id || null,
        source: state?.preset?.hdri || null,
        sourcePath: state?.preset?.source || null,
        pmremActive: Boolean(active?.target?.texture),
        exposure: state?.preset?.exposure ?? null,
        keyLight: state ? Object.freeze({
          color: state.preset.keyLightColor,
          intensity: state.preset.keyLightIntensity,
          direction: Object.freeze([...state.preset.keyLightDirection]),
        }) : null,
        headlights: state?.preset?.headlights ?? false,
        artificialLights: state?.preset?.artificialLights ?? false,
        precipitation: state?.preset?.precipitation || 'none',
        precipitationIntensity: state?.preset?.precipitationIntensity ?? 0,
        wetness: state?.preset?.roadWetness ?? 0,
        requests: Object.freeze({
          started: counters.started,
          applied: counters.applied,
          noops: counters.noops,
          stale: counters.stale,
          failed: counters.failed,
        }),
        resources: Object.freeze({
          sourcesProduced: counters.sourcesProduced,
          sourcesCreated: counters.sourcesCreated,
          sourcesInvalid: counters.sourcesInvalid,
          targetsProduced: counters.targetsProduced,
          targetsCreated: counters.targetsCreated,
          targetsInvalid: counters.targetsInvalid,
        }),
        disposals: Object.freeze({
          sources: counters.sourcesDisposed,
          targets: counters.targetsDisposed,
        }),
      });
    }

    function isStale(token) {
      return disposed || token !== requestToken;
    }

    async function restoreActiveScene() {
      try {
        await applyScene(active?.state || null);
      } catch {
        // The original request error remains authoritative.
      }
    }

    async function applyResolved(id, selected, signature, requestSettings, transaction = {}) {
      if (disposed) throw new Error('Environment controller is disposed');
      const token = ++requestToken;
      if (active?.signature === signature) {
        if (inFlight > 0) await restoreActiveScene();
        counters.noops += 1;
        return snapshot();
      }

      counters.started += 1;
      inFlight += 1;
      let source = null;
      let target = null;
      let applyAttempted = false;
      let rollbackBeforeCommit = null;
      let commitBeforeCommit = null;
      let inFlightEnded = false;
      function finishRequest() {
        if (!inFlightEnded) {
          inFlight -= 1;
          inFlightEnded = true;
        }
        return snapshot();
      }
      try {
        source = await decodeHdri(selected.hdri, {
          id,
          preset: selected,
          settings: requestSettings,
        });
        if (source !== null && source !== undefined) counters.sourcesProduced += 1;
        if (!source || typeof source.dispose !== 'function') {
          counters.sourcesInvalid += 1;
          throw new TypeError('Invalid HDRI source texture');
        }
        counters.sourcesCreated += 1;
        if (isStale(token)) {
          counters.stale += 1;
          disposePair({ source });
          return finishRequest();
        }

        target = await buildPmrem(source, { id, preset: selected });
        if (target !== null && target !== undefined) counters.targetsProduced += 1;
        if (!target || typeof target.dispose !== 'function' || !target.texture) {
          counters.targetsInvalid += 1;
          throw new TypeError('Invalid PMREM target');
        }
        counters.targetsCreated += 1;
        if (isStale(token)) {
          counters.stale += 1;
          disposePair({ source, target });
          return finishRequest();
        }

        const state = {
          id,
          preset: selected,
          source,
          target,
          environment: target.texture,
        };
        applyAttempted = true;
        await applyScene(state);
        if (isStale(token)) {
          counters.stale += 1;
          await restoreActiveScene();
          disposePair({ source, target });
          return finishRequest();
        }

        if (typeof transaction.beforeCommit === 'function') {
          const hooks = await transaction.beforeCommit(Object.freeze({
            id,
            preset: selected,
            settings: Object.freeze({ ...requestSettings }),
          }));
          if (typeof hooks === 'function') {
            rollbackBeforeCommit = hooks;
          } else if (hooks != null && typeof hooks === 'object' && !Array.isArray(hooks)) {
            if (hooks.rollback != null && typeof hooks.rollback !== 'function') {
              throw new TypeError('Environment transaction rollback must be a function');
            }
            if (hooks.commit != null && typeof hooks.commit !== 'function') {
              throw new TypeError('Environment transaction commit must be a function');
            }
            rollbackBeforeCommit = hooks.rollback || null;
            commitBeforeCommit = hooks.commit || null;
          } else if (hooks != null) {
            throw new TypeError('Environment beforeCommit returned invalid hooks');
          }
        }
        if (isStale(token)) {
          counters.stale += 1;
          const rollback = rollbackBeforeCommit;
          rollbackBeforeCommit = null;
          await rollback?.();
          await restoreActiveScene();
          disposePair({ source, target });
          return finishRequest();
        }

        const previous = active;
        active = { signature, state, source, target };
        try {
          await commitBeforeCommit?.();
        } catch (error) {
          active = previous;
          throw error;
        }
        rollbackBeforeCommit = null;
        commitBeforeCommit = null;
        counters.applied += 1;
        disposePair(previous);
        return finishRequest();
      } catch (error) {
        counters.failed += 1;
        let failure = error;
        const rollback = rollbackBeforeCommit;
        rollbackBeforeCommit = null;
        if (rollback) {
          try {
            await rollback();
          } catch (rollbackError) {
            failure = new AggregateError(
              [error, rollbackError],
              'Environment apply and rollback failed',
              { cause: error },
            );
          }
        }
        if (applyAttempted) await restoreActiveScene();
        disposePair({ source, target });
        throw failure;
      } finally {
        if (!inFlightEnded) inFlight -= 1;
      }
    }

    async function apply(settings, transaction = {}) {
      if (disposed) throw new Error('Environment controller is disposed');
      validateSettings(settings);
      if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)
          || (transaction.beforeCommit != null
            && typeof transaction.beforeCommit !== 'function')) {
        throw new TypeError('Invalid environment transaction');
      }
      const id = chooseEnvironmentPreset(settings);
      const selected = preset({ ...resolvePreset(settings) });
      if (transaction.contextKey != null && typeof transaction.contextKey !== 'string') throw new TypeError('Invalid environment context key');
      return applyResolved(
        id,
        selected,
        transaction.contextKey ? JSON.stringify([transaction.contextKey, getResolvedEnvironmentStateSignature(id, selected)]) : getResolvedEnvironmentStateSignature(id, selected),
        { weather: settings.weather, timeOfDay: settings.timeOfDay, skyId: settings.skyId },
        transaction,
      );
    }

    async function applyPreset(id, overrides = {}) {
      if (disposed) throw new Error('Environment controller is disposed');
      const base = getEnvironmentPreset(id);
      if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
        throw new TypeError('Invalid environment preset overrides');
      }
      const allowed = new Set([
        'environmentIntensity', 'keyLightIntensity', 'exposure', 'fogDensity',
        'fogColor', 'keyLightColor', 'keyLightDirection', 'precipitation',
        'roadWetness', 'headlights', 'artificialLights',
      ]);
      for (const field of Object.keys(overrides)) {
        if (!allowed.has(field)) throw new TypeError('Invalid environment preset override: ' + field);
      }
      const selected = preset({
        ...base,
        ...overrides,
        keyLightDirection: [...(overrides.keyLightDirection || base.keyLightDirection)],
      });
      return applyResolved(
        id,
        selected,
        getResolvedEnvironmentStateSignature(id, selected),
        { presetId: id },
      );
    }

    function cancelPending() {
      if (!disposed) requestToken += 1;
      return snapshot();
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      requestToken += 1;
      try {
        applyScene(null);
      } catch {
        // Resource ownership must still be released.
      }
      const previous = active;
      active = null;
      disposePair(previous);
    }

    return Object.freeze({
      apply, applyPreset, cancelPending, getDiagnostics: snapshot, dispose,
    });
  }

  global.AsfaltoV5EnvironmentCore = freeze({
    PRESETS,
    chooseEnvironmentPreset,
    getEnvironmentPreset,
    selectPreset,
    getEnvironmentStateSignature,
    decodeAv3HdriRgb,
    createEnvironmentDataTexture,
    createEnvironmentPayloadLoader,
    applyTrackWetness,
    createEnvironmentController,
  });
}(globalThis));

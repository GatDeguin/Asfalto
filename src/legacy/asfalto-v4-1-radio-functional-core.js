
(function(root){
"use strict";
const RADIO_SNAPSHOT_VERSION = 2;

const signatureFor = (ids) => ids.join('|');
const normalizedTime = (value) => {
  const time = Number(value);
  return Number.isFinite(time) ? Math.max(0, time) : 0;
};

function createRadioSnapshot(state, embeddedTrackIds, updatedAt) {
  return {
    version: RADIO_SNAPSHOT_VERSION,
    playlistSignature: signatureFor(embeddedTrackIds),
    currentTrackId: state.tracks?.[state.currentIndex]?.id || embeddedTrackIds[state.currentIndex] || embeddedTrackIds[0] || null,
    currentTime: normalizedTime(state.currentTime),
    volume: Math.max(0, Math.min(1, Number(state.volume) || 0)),
    updatedAt: Number(updatedAt) || 0,
  };
}

function restoreRadioSnapshot(snapshot, tracks) {
  if (!snapshot || snapshot.version !== RADIO_SNAPSHOT_VERSION) return { statePatch: {}, restored: false, reason: 'invalid-version' };
  const embeddedIds = tracks.filter((track) => !track.objectUrl).map((track) => track.id);
  if (snapshot.playlistSignature !== signatureFor(embeddedIds)) return { statePatch: {}, restored: false, reason: 'playlist-signature-mismatch' };
  const index = tracks.findIndex((track) => track.id === snapshot.currentTrackId);
  if (index < 0) return { statePatch: { currentIndex: 0, currentTime: 0, volume: Math.max(0, Math.min(1, Number(snapshot.volume) || 0)) }, restored: true, reason: 'missing-local-track' };
  return {
    statePatch: { currentIndex: index, currentTime: normalizedTime(snapshot.currentTime), volume: Math.max(0, Math.min(1, Number(snapshot.volume) || 0)) },
    restored: true,
    reason: 'restored',
  };
}

function selectNewMp3Files(files, knownIds) {
  const additions = [];
  const rejected = [];
  const duplicates = [];
  const ids = new Set(knownIds);

  for (const file of files) {
    const isMp3 = /\.mp3$/i.test(file.name) && (!file.type || file.type === 'audio/mpeg' || file.type === 'audio/mp3');
    if (!isMp3) {
      rejected.push(file);
      continue;
    }

    const id = `local-${file.name}-${file.size}-${file.lastModified}`;
    if (ids.has(id)) {
      duplicates.push(file);
      continue;
    }

    ids.add(id);
    additions.push({ id, file });
  }

  return { additions, rejected, duplicates };
}

function classifyPlaybackError(error, obsolete) {
  if (obsolete) return 'obsolete';
  if (error?.name === 'NotAllowedError') return 'blocked';
  return 'media-error';
}

function createRadioFunctionalCore(options) {
  const audio = options.createAudio();
  audio.volume = 1;
  let state = options.stateApi.createRadioState(options.tracks);
  let graph = null;
  let graphPromise = null;
  let mediaSource = null;
  let mediaSourceContext = null;
  let loadedTrackId = null;
  let sourceRevision = 0;
  let metadataSourceRevision = 0;
  let pendingMediaSeek = null;
  let playGeneration = 0;
  let focused = false;
  let disposed = false;
  let mediaPausedForDispose = false;
  let mediaClearedForDispose = false;
  let pendingReflect = Promise.resolve();
  const removers = [];
  const objectUrls = new Set();
  const activeEffectSources = new Set();
  const activeEffectNodes = new Set();
  const graphNodes = new Set();
  const ownedContexts = new Set();
  let lastPersistAt = -Infinity;
  let lastSeekBurstAt = -Infinity;
  let effectGeneration = 0;
  const soundDiagnostics = {
    trackBursts: 0,
    seekBursts: 0,
    completedSources: 0,
  };
  const persistenceDiagnostics = {
    version: RADIO_SNAPSHOT_VERSION,
    restored: false,
    restoreReason: 'invalid-version',
    lastSavedAt: null,
    writeCount: 0,
  };

  restoreSavedState();

  function listen(target, type, handler, listenerOptions) {
    if (!target?.addEventListener) return;
    const once = Boolean(listenerOptions && typeof listenerOptions === 'object' && listenerOptions.once);
    let remove = null;
    const registeredHandler = once
      ? function onceHandler(...args) {
        try {
          return handler.apply(this, args);
        } finally {
          const index = removers.indexOf(remove);
          if (index >= 0) removers.splice(index, 1);
        }
      }
      : handler;
    target.addEventListener(type, registeredHandler, listenerOptions);
    remove = () => target.removeEventListener(type, registeredHandler, listenerOptions);
    removers.push(remove);
  }

  function intentIsObsolete(generation) {
    return disposed || generation !== playGeneration;
  }

  function obsoleteIntentError() {
    return Object.assign(new Error('Playback intent obsolete'), { code: 'playback-intent-obsolete' });
  }

  function isObsoleteIntentError(error) {
    return error?.code === 'playback-intent-obsolete';
  }

  async function buildGraph(generation) {
    try {
      const acquired = await options.acquireAudioGraph();
      if (acquired?.context && !acquired.shared) ownedContexts.add(acquired.context);
      if (intentIsObsolete(generation)) throw obsoleteIntentError();
      if (!acquired?.context || !acquired?.destination) {
        throw Object.assign(new Error('Audio graph unavailable'), { code: 'shared-audio-unavailable' });
      }
      if (mediaSource && mediaSourceContext !== acquired.context) {
        throw Object.assign(new Error('Audio graph context changed after source creation'), { code: 'shared-audio-unavailable' });
      }
      if (!mediaSource) {
        if (intentIsObsolete(generation)) throw obsoleteIntentError();
        mediaSource = acquired.context.createMediaElementSource(audio);
        mediaSourceContext = acquired.context;
        graphNodes.add(mediaSource);
      }
      if (intentIsObsolete(generation)) throw obsoleteIntentError();
      const localGain = acquired.context.createGain();
      graphNodes.add(localGain);
      localGain.gain.value = state.volume;
      mediaSource.connect(localGain);
      localGain.connect(acquired.destination);
      if (intentIsObsolete(generation)) throw obsoleteIntentError();
      graph = { ...acquired, source: mediaSource, localGain };
      return graph;
    } finally {
      graphPromise = null;
    }
  }

  async function ensureGraph(generation) {
    while (true) {
      if (intentIsObsolete(generation)) throw obsoleteIntentError();
      if (graph) return graph;
      if (!graphPromise) graphPromise = buildGraph(generation);
      try {
        const ready = await graphPromise;
        if (intentIsObsolete(generation)) throw obsoleteIntentError();
        return ready;
      } catch (error) {
        if (isObsoleteIntentError(error) && !intentIsObsolete(generation)) continue;
        throw error;
      }
    }
  }

  function restoreSavedState() {
    try {
      const raw = options.storage?.getItem?.(options.storageKey);
      const snapshot = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const restored = restoreRadioSnapshot(snapshot, state.tracks);
      state = { ...state, ...restored.statePatch, powered: false, playing: false };
      persistenceDiagnostics.restored = restored.restored;
      persistenceDiagnostics.restoreReason = restored.reason;
    } catch {
      persistenceDiagnostics.restored = false;
      persistenceDiagnostics.restoreReason = 'storage-error';
    }
  }

  function persistNow(force = false) {
    if (!options.storage?.setItem || !options.storageKey) return false;
    const time = Number(options.now()) || 0;
    if (!force && time - lastPersistAt < 1000) return false;
    lastPersistAt = time;
    try {
      const embeddedIds = options.tracks.map((track) => track.id);
      const snapshot = createRadioSnapshot(state, embeddedIds, time);
      options.storage.setItem(options.storageKey, JSON.stringify(snapshot));
      persistenceDiagnostics.lastSavedAt = time;
      persistenceDiagnostics.writeCount += 1;
      return true;
    } catch { return false; }
  }

  function disconnectEffectNodes(nodes) {
    for (const node of nodes) {
      if (!activeEffectNodes.has(node)) continue;
      try {
        node.disconnect?.();
        activeEffectNodes.delete(node);
      } catch {}
    }
  }

  function trackEffectSource(source, nodes) {
    activeEffectSources.add(source);
    listen(source, 'ended', () => {
      activeEffectSources.delete(source);
      soundDiagnostics.completedSources += 1;
      disconnectEffectNodes(nodes);
    }, { once: true });
  }

  function scheduleRadioEffect(kind, requestedAt, generation) {
    const context = graph?.context;
    if (disposed || generation !== effectGeneration || !state.powered || !context || context.state !== 'running') return;
    if (!context.createBuffer || !context.createBufferSource || !context.createBiquadFilter || !context.createOscillator) return;
    const duration = kind === 'track' ? 0.14 : 0.065;
    const start = context.currentTime + 0.004;
    const sampleCount = Math.max(1, Math.ceil(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const decay = 1 - index / sampleCount;
      samples[index] = (Math.random() * 2 - 1) * decay;
    }

    const noise = context.createBufferSource();
    activeEffectNodes.add(noise);
    noise.buffer = buffer;
    const filter = context.createBiquadFilter();
    activeEffectNodes.add(filter);
    filter.type = kind === 'track' ? 'bandpass' : 'highpass';
    filter.frequency.setValueAtTime(kind === 'track' ? 1750 : 2350, start);
    filter.Q.setValueAtTime(kind === 'track' ? 0.72 : 0.48, start);

    const envelope = context.createGain();
    activeEffectNodes.add(envelope);
    const level = Math.min(0.18, state.volume * 0.155 * (kind === 'track' ? 1 : 0.58));
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(graph.localGain);
    trackEffectSource(noise, [noise, filter, envelope]);
    noise.start(start);
    noise.stop(start + duration + 0.008);

    if (kind === 'track') {
      const click = context.createOscillator();
      activeEffectNodes.add(click);
      const clickEnvelope = context.createGain();
      activeEffectNodes.add(clickEnvelope);
      click.type = 'square';
      click.frequency.setValueAtTime(96, start);
      click.frequency.exponentialRampToValueAtTime(54, start + 0.028);
      clickEnvelope.gain.setValueAtTime(Math.max(0.0001, Math.min(0.075, state.volume * 0.075)), start);
      clickEnvelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.032);
      click.connect(clickEnvelope);
      clickEnvelope.connect(graph.localGain);
      trackEffectSource(click, [click, clickEnvelope]);
      click.start(start);
      click.stop(start + 0.036);
    }

    if (kind === 'track') soundDiagnostics.trackBursts += 1;
    else soundDiagnostics.seekBursts += 1;
    soundDiagnostics.lastAt = requestedAt;
  }

  function playRadioEffect(kind) {
    if (disposed || !state.powered || !graph) return;
    const generation = effectGeneration;
    const requestedAt = Number(options.now()) || 0;
    if (kind === 'seek' && requestedAt - lastSeekBurstAt < 90) return;
    if (kind === 'seek') lastSeekBurstAt = requestedAt;
    const context = graph.context;
    if (context.state === 'running') {
      scheduleRadioEffect(kind, requestedAt, generation);
      return;
    }
    if (context.state === 'suspended' && context.resume) {
      void Promise.resolve(context.resume()).then(() => {
        if (!disposed && generation === effectGeneration && state.powered) scheduleRadioEffect(kind, requestedAt, generation);
      }).catch(() => {});
    }
  }

  function stopEffects() {
    effectGeneration += 1;
    for (const source of activeEffectSources) {
      try { source.stop(); } catch {}
    }
    activeEffectSources.clear();
    disconnectEffectNodes([...activeEffectNodes]);
  }

  function reportPlaybackFailure(error, obsolete) {
    const kind = classifyPlaybackError(error, obsolete);
    if (kind === 'obsolete') return;
    state = options.stateApi.reduceRadio(state, { type: 'PLAYBACK_FAILED' });
    audio.pause();
    options.announce(kind === 'blocked' ? 'Tocá nuevamente para habilitar el audio' : 'No se pudo reproducir la pista');
    emitStateChange();
    persistNow(true);
  }

  function selectedTrack() {
    return state.tracks[state.currentIndex] || null;
  }

  function queueMediaSeek(track, time) {
    if (!track || loadedTrackId !== track.id || sourceRevision <= 0) return;
    pendingMediaSeek = {
      trackId: track.id,
      sourceRevision,
      time: Math.max(0, Number(time) || 0),
    };
  }

  function applyPendingMediaSeek() {
    if (!pendingMediaSeek) return false;
    const track = selectedTrack();
    if (!track
      || loadedTrackId !== track.id
      || pendingMediaSeek.trackId !== loadedTrackId
      || pendingMediaSeek.sourceRevision !== sourceRevision
      || metadataSourceRevision !== sourceRevision) return false;
    const duration = Number(audio.duration);
    if (!Number.isFinite(duration) || duration < 0) return false;
    const target = Math.max(0, Math.min(duration, pendingMediaSeek.time));
    try {
      audio.currentTime = target;
      pendingMediaSeek = null;
      return true;
    } catch {
      return false;
    }
  }

  async function reflect(previous, nextState, action, generation) {
    if (intentIsObsolete(generation)) return;
    const playbackRequested = previous.playbackRevision !== nextState.playbackRevision
      || previous.currentIndex !== nextState.currentIndex;
    const track = nextState.tracks[nextState.currentIndex];
    if (playbackRequested || (nextState.powered && track && loadedTrackId !== track.id)) {
      if (track) {
        const source = track.objectUrl || await options.resolveEmbeddedTrack(track);
        if (intentIsObsolete(generation)) return;
        audio.src = source;
        loadedTrackId = track.id;
        sourceRevision += 1;
        metadataSourceRevision = 0;
        queueMediaSeek(track, nextState.currentTime);
        audio.load();
        const readyState = Number(audio.readyState);
        const duration = Number(audio.duration);
        if ((!Number.isFinite(readyState) || readyState >= 1) && Number.isFinite(duration) && duration >= 0) {
          metadataSourceRevision = sourceRevision;
        }
      }
    }
    if (intentIsObsolete(generation)) return;
    if (action.type === 'SEEK_TO' || action.type === 'SEEK_BY') {
      queueMediaSeek(track, nextState.currentTime);
    }
    applyPendingMediaSeek();
    if (!nextState.powered || !nextState.playing) {
      audio.pause();
      return;
    }
    try {
      await ensureGraph(generation);
    } catch (error) {
      reportPlaybackFailure(error, intentIsObsolete(generation) || isObsoleteIntentError(error));
      return;
    }
    if (intentIsObsolete(generation)) return;
    try {
      await audio.play();
      if (intentIsObsolete(generation)) return;
    } catch (error) {
      reportPlaybackFailure(error, intentIsObsolete(generation));
    }
  }

  function dispatch(action) {
    if (disposed) return getState();
    const previous = state;
    const nextState = options.stateApi.reduceRadio(state, action);
    state = nextState;
    const generation = ++playGeneration;
    if (graph && action.type === 'SET_VOLUME') graph.localGain.gain.value = state.volume;
    if (previous.powered && !state.powered) stopEffects();
    if (state.powered && (action.type === 'NEXT' || action.type === 'PREVIOUS' || action.type === 'TRACK_ENDED')) {
      playRadioEffect('track');
    } else if (state.powered && (action.type === 'SEEK_TO' || action.type === 'SEEK_BY')) {
      playRadioEffect('seek');
    }
    pendingReflect = reflect(previous, nextState, action, generation)
      .catch((error) => reportPlaybackFailure(error, intentIsObsolete(generation) || isObsoleteIntentError(error)));
    emitStateChange();
    const paused = previous.playing && !state.playing;
    const trackChanged = action.type === 'NEXT' || action.type === 'PREVIOUS' || action.type === 'TRACK_ENDED';
    const poweredOff = previous.powered && !state.powered;
    if (paused || trackChanged || poweredOff) persistNow(true);
    return getState();
  }

  async function activate(controlName) {
    const actions = {
      CTRL_POWER_VOLUME: { type: 'TOGGLE_POWER' },
      CTRL_PREVIOUS: { type: 'PREVIOUS' },
      CTRL_REWIND: { type: 'SEEK_BY', seconds: -10 },
      CTRL_PLAY_PAUSE: { type: 'TOGGLE_PLAYBACK' },
      CTRL_FORWARD: { type: 'SEEK_BY', seconds: 10 },
      CTRL_NEXT: { type: 'NEXT' },
    };
    if (actions[controlName]) dispatch(actions[controlName]);
    await pendingReflect;
    return getState();
  }

  async function addFiles(files) {
    if (disposed) return { additions: [], rejected: [], duplicates: [] };
    const selection = selectNewMp3Files(files || [], new Set(state.tracks.map((track) => track.id)));
    const localTracks = selection.additions.map(({ id, file }) => {
      const objectUrl = options.createObjectURL(file);
      objectUrls.add(objectUrl);
      return {
        id,
        title: file.name.replace(/\.mp3$/i, ''),
        artist: '',
        filename: file.name,
        duration: 0,
        objectUrl,
      };
    });
    if (localTracks.length) dispatch({ type: 'ADD_TRACKS', tracks: localTracks });
    for (const file of selection.duplicates) options.announce(`Ya agregaste ${file.name}`);
    return selection;
  }

  function getState() {
    return {
      ...state,
      tracks: state.tracks.map(({ objectUrl, payloadId, payload, dataBase64, file, ...track }) => ({ ...track })),
    };
  }

  function emitStateChange() {
    options.onStateChange(getState());
  }

  function setFocused(value) {
    focused = Boolean(value);
    return focused;
  }

  function isFocused() {
    return focused;
  }

  function getMediaDiagnostics() {
    return {
      loadedTrackId,
      sourceRevision,
      hasSource: Boolean(audio.currentSrc || audio.src),
      paused: Boolean(audio.paused),
      currentTime: Number(audio.currentTime) || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
      statePlaying: state.playing,
      playGeneration,
    };
  }

  function getSoundDiagnostics() {
    return {
      contextState: disposed ? 'disposed' : (graph?.context?.state ?? null),
      sharedDestination: Boolean(graph?.shared),
      localGain: graph?.localGain?.gain?.value ?? null,
      trackBursts: soundDiagnostics.trackBursts,
      seekBursts: soundDiagnostics.seekBursts,
      activeSources: activeEffectSources.size,
      completedSources: soundDiagnostics.completedSources,
    };
  }

  function getPersistenceDiagnostics() {
    return { ...persistenceDiagnostics };
  }

  function dispose() {
    if (!disposed) {
      disposed = true;
      playGeneration += 1;
      persistNow(true);
      setFocused(false);
      loadedTrackId = null;
      metadataSourceRevision = 0;
      pendingMediaSeek = null;
    }
    if (!mediaPausedForDispose) {
      try {
        audio.pause();
        mediaPausedForDispose = true;
      } catch {}
    }
    if (!mediaClearedForDispose) {
      try {
        audio.removeAttribute('src');
        mediaClearedForDispose = true;
      } catch {}
    }
    stopEffects();
    const pendingRemovers = removers.splice(0);
    for (const remove of pendingRemovers) {
      try { remove(); } catch { removers.push(remove); }
    }
    for (const url of [...objectUrls]) {
      try {
        options.revokeObjectURL(url);
        objectUrls.delete(url);
      } catch {}
    }
    for (const node of [...graphNodes]) {
      try {
        node.disconnect();
        graphNodes.delete(node);
      } catch {}
    }
    for (const context of [...ownedContexts]) {
      if (context.state === 'closed') {
        ownedContexts.delete(context);
        continue;
      }
      try {
        const closing = context.close();
        ownedContexts.delete(context);
        void Promise.resolve(closing).catch(() => { ownedContexts.add(context); });
      } catch {}
    }
  }

  function onLoadedMetadata() {
    const track = selectedTrack();
    if (!track || loadedTrackId !== track.id) return;
    metadataSourceRevision = sourceRevision;
    dispatch({ type: 'SET_TRACK_DURATION', duration: audio.duration });
  }

  function onTimeUpdate() {
    const track = selectedTrack();
    if (!track || loadedTrackId !== track.id) return;
    if (pendingMediaSeek
      && pendingMediaSeek.trackId === loadedTrackId
      && pendingMediaSeek.sourceRevision === sourceRevision
      && !applyPendingMediaSeek()) return;
    dispatch({ type: 'SYNC_TIME', time: audio.currentTime });
    persistNow(false);
  }

  function onEnded() {
    dispatch({ type: 'TRACK_ENDED' });
  }

  function onError() {
    const track = state.tracks[state.currentIndex];
    options.announce(`No se pudo reproducir ${track?.title || 'el archivo'}`);
  }

  function onVisibilityChange() {
    const target = options.visibilityTarget;
    if (target?.hidden === true || (typeof target?.visibilityState === 'string' && target.visibilityState !== 'visible')) {
      persistNow(true);
    }
  }

  function onPageHide() {
    persistNow(true);
  }

  listen(audio, 'loadedmetadata', onLoadedMetadata);
  listen(audio, 'timeupdate', onTimeUpdate);
  listen(audio, 'ended', onEnded);
  listen(audio, 'error', onError);
  listen(options.visibilityTarget, 'visibilitychange', onVisibilityChange);
  listen(options.pageLifecycleTarget, 'pagehide', onPageHide);

  return {
    dispatch,
    activate,
    addFiles,
    getState,
    setFocused,
    isFocused,
    getMediaDiagnostics,
    getSoundDiagnostics,
    getPersistenceDiagnostics,
    dispose,
  };
}

root.AsfaltoNacionalRadioCore=Object.freeze({RADIO_SNAPSHOT_VERSION,createRadioSnapshot,restoreRadioSnapshot,selectNewMp3Files,classifyPlaybackError,createRadioFunctionalCore});
})(globalThis);

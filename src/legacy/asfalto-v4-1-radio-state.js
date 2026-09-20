
(function(root){
'use strict';
const DEFAULT_VOLUME = 0.68;

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function normalizeTrack(track, index) {
  const id = String(track?.id || `track-${index + 1}`);
  return {
    ...track,
    id,
    title: String(track?.title || id),
    duration: Math.max(0, Number(track?.duration) || 0),
  };
}

function currentDuration(state) {
  return state.tracks[state.currentIndex]?.duration || 0;
}

function moveTrack(state, step) {
  if (!state.tracks.length) return state;
  const count = state.tracks.length;
  const currentIndex = (state.currentIndex + step + count) % count;
  return {
    ...state,
    currentIndex,
    currentTime: 0,
    playing: state.powered,
    playbackRevision: (Number(state.playbackRevision) || 0) + 1,
  };
}

function createRadioState(tracks = []) {
  return {
    tracks: tracks.map(normalizeTrack),
    currentIndex: 0,
    currentTime: 0,
    powered: false,
    playing: false,
    volume: DEFAULT_VOLUME,
    playbackRevision: 0,
  };
}

function reduceRadio(state, action) {
  switch (action?.type) {
    case 'TOGGLE_POWER': {
      const powered = !state.powered;
      return {
        ...state,
        powered,
        playing: powered && state.tracks.length > 0,
      };
    }
    case 'TOGGLE_PLAYBACK':
      if (!state.powered || !state.tracks.length) return state;
      return { ...state, playing: !state.playing };
    case 'PLAYBACK_FAILED':
      return state.playing ? { ...state, playing: false } : state;
    case 'NEXT':
    case 'TRACK_ENDED':
      return moveTrack(state, 1);
    case 'PREVIOUS':
      return moveTrack(state, -1);
    case 'SET_VOLUME':
      return { ...state, volume: clamp(action.volume, 0, 1) };
    case 'SET_TRACK_DURATION': {
      if (!state.tracks.length) return state;
      const tracks = state.tracks.slice();
      tracks[state.currentIndex] = {
        ...tracks[state.currentIndex],
        duration: Math.max(0, Number(action.duration) || 0),
      };
      return { ...state, tracks };
    }
    case 'SYNC_TIME':
    case 'SEEK_TO':
      return {
        ...state,
        currentTime: clamp(action.type === 'SYNC_TIME' ? action.time : action.time, 0, currentDuration(state)),
      };
    case 'SEEK_BY':
      return {
        ...state,
        currentTime: clamp(state.currentTime + Number(action.seconds || 0), 0, currentDuration(state)),
      };
    case 'ADD_TRACKS': {
      const known = new Set(state.tracks.map((track) => track.id));
      const additions = [];
      for (const [index, track] of (action.tracks || []).entries()) {
        const normalized = normalizeTrack(track, state.tracks.length + index);
        if (known.has(normalized.id)) continue;
        known.add(normalized.id);
        additions.push(normalized);
      }
      if (!additions.length) return state;
      return { ...state, tracks: [...state.tracks, ...additions] };
    }
    default:
      return state;
  }
}



root.AsfaltoNacionalRadioState=Object.freeze({createRadioState,reduceRadio});
})(globalThis);

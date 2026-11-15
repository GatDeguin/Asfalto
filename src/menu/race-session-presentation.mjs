import { mountV7Experience } from './v7-experience.mjs?v=bbec4f4b2f5ab527';
import { createRacePauseMenu } from './race-pause-menu.mjs?v=07f938cad06708c8';
import { createMenuMusic } from './menu-music.mjs?v=a4f79eee7063acc3';
import { bindSelectedVehicleLabels } from './selected-vehicle-labels.mjs?v=0d60824a2ee0ea4d';

const body = document.body;
const world = () => globalThis.__cockpit?.raceWorld;
const game = () => globalThis.__chevyV6Complete;
let settingsFromPause = false, introAudioAllowed = true, resumeRadio = false, disposed = false, departureMix = false;
let visitedRace = false, restartMenuMusic = false;
const audio = document.createElement('audio');
audio.dataset.asfaltoAudio = 'menu'; audio.hidden = true;
body.append(audio);
const music = createMenuMusic({ audio, deferUntilGesture:true, tracks:[new URL('../../assets/audio/menu-1.mp3', import.meta.url).href, new URL('../../assets/audio/menu-2.mp3', import.meta.url).href] });
const pause = createRacePauseMenu({
  document,
  onResume() { world()?.resume(); },
  onRestart() { void Promise.resolve(game()?.restartSession?.()).catch(error => { showPause(); console.error('No se pudo reiniciar la sesión', error); }); },
  onSettings() { settingsFromPause = true; body.classList.remove('an-race-pause-visible'); globalThis.__cockpit?.openCockpitSettings(true); },
  onReturnToWorkshop() {
    const app=game();
    if(app?.exitDrive)app.exitDrive();
    else app?.openMenu?.('drive');
  },
});

const experienceV7 = mountV7Experience();
const resultVehicleLabels = bindSelectedVehicleLabels({root:document.querySelector('#v6-results-sheet')});

function showPause() {
  if (body.classList.contains('v6-menu-open') || body.classList.contains('an-intro-open')) return;
  body.classList.add('an-race-paused', 'an-race-pause-visible');
  pause.show({ sessionLabel:[world()?.track?.name, game()?.sessionTitle?.()].filter(Boolean).join(' · ') || 'Carrera en curso', detail:'La carrera está detenida.', exitLabel:document.querySelector('#v6-return-menu')?.textContent, returnFocus:document.querySelector('#viewport canvas') });
  syncAudio();
}
function closePause() {
  settingsFromPause = false;
  pause.hide({ restoreFocus:false }); body.classList.remove('an-race-paused', 'an-race-pause-visible'); syncAudio();
}
function requestPause() {
  const status = world()?.getState?.().status;
  if (status === 'PAUSED') { showPause(); return; }
  if (status === 'RUNNING' || status === 'COUNTDOWN') world().pause();
}
function syncAudio() {
  if (disposed) return;
  const inMenu = body.classList.contains('v6-menu-open');
  if (!inMenu && body.classList.contains('v6-driving')) visitedRace = true;
  if (inMenu && visitedRace) { visitedRace = false; restartMenuMusic = true; }
  const silent = inMenu || !body.classList.contains('v6-driving') || body.classList.contains('an-intro-open') || body.classList.contains('an-race-paused') || document.hidden;
  const radio = globalThis.__asfaltoNacionalV41?.radio;
  const state = radio?.getState?.();
  if (silent && state?.playing) { resumeRadio = !inMenu; radio.dispatch({type:'TOGGLE_PLAYBACK'}); }
  if (inMenu) resumeRadio = false;
  if (!silent && resumeRadio) { resumeRadio = false; if (state?.powered && !state.playing) radio.dispatch({type:'TOGGLE_PLAYBACK'}); }
  globalThis.__cockpit?.refreshAudioGate?.();
  const settings = globalThis.__cockpit?.getState?.().settings;
  music.setVolume(settings?.soundEnabled === false ? 0 : (departureMix ? .075 : .32) * (settings?.masterVolume ?? 1));
  const menuAudioActive = inMenu && introAudioAllowed && !body.classList.contains('an-intro-open') && !document.hidden;
  music.setActive(menuAudioActive, { restart:menuAudioActive && restartMenuMusic });
  if (menuAudioActive) restartMenuMusic = false;
}
function onState(event) {
  const { status, reason } = event.detail || {};
  game()?.setSessionPaused?.(status === 'PAUSED');
  if (status === 'PAUSED') {
    body.classList.add('an-race-paused');
    if (!['menu','settings','mobile-inspection','result'].includes(reason)) showPause();
  } else closePause();
  syncAudio();
}
function onSettings(event) { if (!event.detail?.open && settingsFromPause) { settingsFromPause = false; showPause(); } }
function onKey(event) {
  if (event.defaultPrevented || event.repeat || pause.isOpen() || event.key !== 'Escape') return;
  if (body.classList.contains('editor-mode-active') || document.querySelector('#settings-panel')?.hidden === false) return;
  if (body.classList.contains('v6-driving') && !body.classList.contains('an-intro-open')) { event.preventDefault(); requestPause(); }
}
function onGesture() { syncAudio(); void music.retry(); }
function onVisibility() { if (document.hidden && body.classList.contains('v6-driving')) requestPause(); syncAudio(); }
const observer = new MutationObserver(() => {
  if (body.classList.contains('v6-menu-open') && pause.isOpen()) closePause();
  syncAudio();
});
observer.observe(body, { attributes:true, attributeFilter:['class'] });
window.addEventListener('asfalto:race-state', onState);
window.addEventListener('asfalto:race-settings', onSettings);
window.addEventListener('asfalto:audio-settings', syncAudio);
document.addEventListener('keydown', onKey);
document.addEventListener('pointerdown', onGesture);
document.addEventListener('visibilitychange', onVisibility);
globalThis.__asfaltoRacePresentation = Object.freeze({
  requestPause, closePause,
  isOpen:pause.isOpen,
  setMenuAudioActive(value) { introAudioAllowed = !!value; syncAudio(); },
  setDepartureAudioMix(value) { departureMix = !!value; syncAudio(); },
  syncAudio,
  diagnostics() { return { pauseOpen:pause.isOpen(), music:music.diagnostics() }; },
  dispose() {
    if (disposed) return; disposed = true; observer.disconnect(); experienceV7?.dispose(); resultVehicleLabels.dispose(); pause.dispose(); music.dispose(); audio.remove();
    window.removeEventListener('asfalto:race-state', onState); window.removeEventListener('asfalto:race-settings', onSettings); window.removeEventListener('asfalto:audio-settings', syncAudio);
    document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onGesture); document.removeEventListener('visibilitychange', onVisibility);
    body.classList.remove('an-race-paused', 'an-race-pause-visible');
  },
});
syncAudio();

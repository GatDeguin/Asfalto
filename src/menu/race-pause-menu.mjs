import { bindSelectedVehicleLabels } from './selected-vehicle-labels.mjs?v=body-r2-20260916';

let instanceCount = 0;

/** UI-only state. Closing never resumes physics unless the caller receives resume. */
export function reduceRacePauseState(view, event) {
  if (event === 'show') return { view:'menu', action:null };
  if (event === 'hide') return { view:'closed', action:null };
  if (view === 'closed') return { view, action:null };
  if (view === 'confirm-restart') {
    if (event === 'confirm-restart') return { view:'closed', action:'restart' };
    if (event === 'escape' || event === 'cancel') return { view:'menu', action:null };
    return { view, action:null };
  }
  if (event === 'restart') return { view:'confirm-restart', action:null };
  if (event === 'resume' || event === 'escape') return { view:'closed', action:'resume' };
  if (event === 'settings' || event === 'workshop') return { view:'closed', action:event };
  return { view, action:null };
}

/**
 * Create once; the caller pauses simulation/audio before show().
 * Callbacks fire after the dialog hides. Settings keeps simulation paused and
 * transfers focus to the caller's settings UI. hide()/dispose() fire no callback.
 * Include assets/styles/race-pause-menu.css in the host document.
 */
export function createRacePauseMenu({
  document: doc = globalThis.document,
  vehicleEvents = globalThis, getVehicleId,
  onResume = () => {}, onRestart = () => {}, onSettings = () => {}, onReturnToWorkshop = () => {},
} = {}) {
  if (!doc?.body) throw new TypeError('A document with a body is required.');
  const id = `an-race-pause-${++instanceCount}`;
  const overlay = doc.createElement('section');
  overlay.id = id; overlay.className = 'an-race-pause'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', `${id}-title`);
  overlay.setAttribute('aria-describedby', `${id}-session`);
  overlay.innerHTML = `<div class="an-pause-shell">
    <header class="an-pause-brand"><img class="an-pause-brand-logo" src="${new URL('../../assets/brand/asfalto-nacional-v7.webp', import.meta.url).href}" alt="Asfalto Nacional" width="540" height="180"><small data-selected-vehicle-label>Vehículo seleccionado</small></header>
    <div class="an-pause-card">
      <div class="an-pause-heading"><p class="an-pause-kicker">Sesión en pausa</p><h1 id="${id}-title">Pausa</h1><p id="${id}-session" class="an-pause-session"></p><p class="an-pause-detail" hidden></p></div>
      <nav class="an-pause-actions" aria-label="Opciones de pausa">
        <button type="button" class="an-pause-button an-pause-primary" data-pause-action="resume"><span class="an-pause-symbol" aria-hidden="true">▷</span><span>Continuar</span><kbd>ESC</kbd></button>
        <button type="button" class="an-pause-button" data-pause-action="restart"><span class="an-pause-symbol" aria-hidden="true">↻</span><span>Reiniciar carrera</span></button>
        <button type="button" class="an-pause-button" data-pause-action="settings"><span class="an-pause-symbol" aria-hidden="true">⚙</span><span>Ajustes</span></button>
        <button type="button" class="an-pause-button" data-pause-action="workshop"><span class="an-pause-symbol" aria-hidden="true">↶</span><span>Volver al taller</span></button>
      </nav>
      <section class="an-pause-confirm" hidden>
        <h2 id="${id}-confirm-title">¿Reiniciar la carrera?</h2><p>Vas a comenzar esta sesión de nuevo desde la salida.</p>
        <div><button type="button" class="an-pause-button an-pause-primary" data-pause-action="confirm-restart">Reiniciar carrera</button><button type="button" class="an-pause-button" data-pause-action="cancel">Seguir en pausa</button></div>
      </section>
      <footer class="an-pause-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Elegir</span><span><kbd>↵</kbd> Seleccionar</span></footer>
    </div>
    <p class="an-pause-motto">La recta te llama. La curva te mide.</p>
  </div>`;
  doc.body.append(overlay);
  const vehicleLabels = bindSelectedVehicleLabels({ root: overlay, events: vehicleEvents, getVehicleId });
  const heading = overlay.querySelector(`#${id}-title`);
  const session = overlay.querySelector(`#${id}-session`);
  const detail = overlay.querySelector('.an-pause-detail');
  const menu = overlay.querySelector('.an-pause-actions');
  const confirmation = overlay.querySelector('.an-pause-confirm');
  const buttons = [...overlay.querySelectorAll('[data-pause-action]')];
  const button = action => buttons.find(node => node.dataset.pauseAction === action);
  const callbacks = { resume:onResume, restart:onRestart, settings:onSettings, workshop:onReturnToWorkshop };
  let view = 'closed', disposed = false, previousFocus = null, background = [], focusReturnTarget = null;
  let bodyHadPauseClass = false;

  function focusDefault() { (view === 'confirm-restart' ? button('cancel') : button('resume')).focus({ preventScroll:true }); }
  function renderView() {
    const confirming = view === 'confirm-restart';
    menu.hidden = confirming; confirmation.hidden = !confirming;
    overlay.dataset.pauseView = view;
    overlay.setAttribute('aria-labelledby', confirming ? `${id}-confirm-title` : `${id}-title`);
    focusDefault();
  }
  function hide({ restoreFocus = true } = {}) {
    if (view === 'closed') return false;
    view = 'closed'; overlay.hidden = true; overlay.dataset.pauseView = 'closed';
    for (const [element, inert] of background) element.inert = inert;
    background = [];
    if (!bodyHadPauseClass) doc.body.classList.remove('an-race-pause-open');
    const target = focusReturnTarget || previousFocus;
    if (restoreFocus && target?.isConnected && !target.inert) target.focus?.({ preventScroll:true });
    previousFocus = null; focusReturnTarget = null;
    return true;
  }
  function activate(event) {
    if (disposed) return;
    const next = reduceRacePauseState(view, event);
    if (next.view === view && !next.action) return;
    if (next.view === 'closed') hide({ restoreFocus:next.action === 'resume' });
    else { view = next.view; renderView(); }
    if (next.action) callbacks[next.action]();
  }
  function show({ title = 'Pausa', sessionLabel = 'Sesión en curso', detail: copy = '', returnFocus = null } = {}) {
    if (disposed) return false;
    if (view === 'closed') {
      previousFocus = doc.activeElement;
      focusReturnTarget = returnFocus;
      bodyHadPauseClass = doc.body.classList.contains('an-race-pause-open');
      background = [...doc.body.children].filter(element => element !== overlay).map(element => [element, element.inert]);
      for (const [element] of background) element.inert = true;
      doc.body.classList.add('an-race-pause-open');
    }
    vehicleLabels.refresh();
    heading.textContent = String(title || 'Pausa');
    session.textContent = String(sessionLabel || 'Sesión en curso');
    detail.textContent = String(copy || ''); detail.hidden = !copy;
    view = 'menu'; overlay.hidden = false; renderView();
    return true;
  }
  function onClick(event) {
    const control = event.target.closest?.('[data-pause-action]');
    if (control && overlay.contains(control)) activate(control.dataset.pauseAction);
  }
  function onKeyDown(event) {
    if (view === 'closed') return;
    // Block race shortcuts while preserving native Enter/Space button activation.
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); activate('escape'); return; }
    const visible = (view === 'confirm-restart' ? [button('confirm-restart'), button('cancel')] : [...overlay.querySelectorAll('button,input,select,summary')]).filter(node => !node.disabled && !node.hidden && node.getClientRects().length > 0);
    if (event.key !== 'Tab' && event.target.closest?.('.an-v7-preferences')) return;
    if (['Tab','ArrowUp','ArrowDown','Home','End'].includes(event.key)) {
      event.preventDefault();
      let index = visible.indexOf(doc.activeElement);
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = visible.length - 1;
      else index = (index + (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1) + visible.length) % visible.length;
      visible[index]?.focus({ preventScroll:true });
    }
  }
  function onKeyUp(event) { if (view !== 'closed') event.stopImmediatePropagation(); }
  function onFocusIn(event) { if (view !== 'closed' && !overlay.contains(event.target)) focusDefault(); }
  overlay.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('keyup', onKeyUp, true);
  doc.addEventListener('focusin', onFocusIn, true);
  return {
    show, hide, isOpen:() => view !== 'closed',
    dispose() {
      if (disposed) return;
      hide(); disposed = true;
      vehicleLabels.dispose();
      overlay.removeEventListener('click', onClick);
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('keyup', onKeyUp, true);
      doc.removeEventListener('focusin', onFocusIn, true);
      overlay.remove();
    },
  };
}

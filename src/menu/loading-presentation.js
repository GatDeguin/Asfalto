/* Shared DOM loading presentation. Stages describe real work; the animation
 * intentionally carries no fabricated percentage or remaining-time estimate. */
(() => {
  const markup = (title, statusId = '') => `<div class="an-loading-card"><span class="an-loading-kicker">ASFALTO NACIONAL / 1973</span><div class="an-loading-gauge" aria-hidden="true"><span class="an-loading-needle"></span><b>RPM</b></div><h2>${title}</h2><p ${statusId ? `id="${statusId}"` : ''} class="an-loading-stage" role="status" aria-live="polite">Preparando…</p><div class="an-loading-road" aria-hidden="true"><i></i></div><span class="an-loading-caption">La próxima curva te espera.</span></div>`;
  let overlay, previousFocus, background = [];
  const pending = new Map();
  document.addEventListener('keydown', event => {
    if (pending.size) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  function sync() {
    const latest = [...pending.values()].at(-1);
    if (latest) {
      overlay.querySelector('h2').textContent = latest.title;
      overlay.querySelector('.an-loading-stage').textContent = latest.stage;
      overlay.querySelector('.an-loading-caption').textContent = latest.tip || [...pending.values()].find(v=>v.tip)?.tip || 'La próxima curva te espera.';
    }
  }
  function begin(title = 'Preparando la salida', stage = 'Cargando circuito…', options = {}) {
    if (!overlay) {
      overlay = document.createElement('section'); overlay.id = 'an-session-loading'; overlay.hidden = true;
      overlay.tabIndex = -1; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-label','Preparando carrera');
      overlay.innerHTML = markup('Preparando la salida'); document.body.append(overlay);
      overlay.addEventListener('keydown', event => { event.preventDefault(); event.stopImmediatePropagation(); });
    }
    if (!pending.size) {
      previousFocus = document.activeElement;
      background = [...document.body.children].filter(el => el !== overlay && el instanceof HTMLElement).map(el => [el, el.inert]);
      for (const [el] of background) el.inert = true;
      overlay.hidden = false; overlay.setAttribute('aria-busy','true'); overlay.focus({preventScroll:true});
      document.body.classList.add('an-loading-open');
    }
    const key = {}; pending.set(key,{title,stage,tip:options.tip}); sync();
    return {
      stage(text) { const task = pending.get(key); if (task) { task.stage = text; sync(); } },
      end() {
        if (!pending.delete(key)) return;
        if (pending.size) { sync(); return; }
        overlay.hidden = true; overlay.setAttribute('aria-busy','false'); document.body.classList.remove('an-loading-open');
        for (const [el,inert] of background) el.inert = inert; background = [];
        if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      },
    };
  }
  function workshop(element) {
    element.innerHTML = markup('Abriendo el taller') + '<div class="v6-progress" aria-hidden="true"><i></i></div>';
    element.setAttribute('aria-busy','true');
    return text => { element.querySelector('.an-loading-stage').textContent = text; };
  }
  globalThis.__asfaltoLoading = Object.freeze({begin,workshop});
})();

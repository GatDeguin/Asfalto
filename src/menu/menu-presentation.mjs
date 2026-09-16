import { bindSelectedVehicleLabels } from './selected-vehicle-labels.mjs?v=vehicles-r1-20260916';
import { initialMenuState, reduceMenu } from './menu-state.mjs';
import { createIntroSession } from './intro-player.mjs';
import { mountMenuSections } from './menu-sections.mjs?v=vehicles-r1-20260916';
import { mountMenuRefinements } from './menu-refinements.mjs';
import { mountWorkshopService } from './workshop-service.mjs';
import { fitMenuCar } from './menu-refinement-state.mjs';

const ICONS = {
  drive: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M3 10h6m6 0h6m-9 4v7"/>',
  tests: '<circle cx="12" cy="14" r="7"/><path d="M9 2h6m-3 0v5m0 7 3-4m3-5 2 2"/>',
  competition: '<path d="m5 22 2-19m0 1c5-5 8 5 14 0l-1 11c-6 5-9-5-14 0m7-10-1 8m-5-5c5-5 8 5 14 0"/>',
  workshop: '<path d="m4 21 8-8a7 7 0 0 0 8-9l-4 4-4-1-1-4a7 7 0 0 0-3 10l-7 7z"/>',
  collection: '<path d="M4 5h16v16H4zM8 5V2h8v3m-5 5h5m-5 4h5m-5 4h5M7 10h.1M7 14h.1M7 18h.1"/>',
  settings: '<path d="m10 2 4 0 1 3 3 2 3 0 1 4-2 2-1 3 1 3-4 2-3-2-3 0-3 2-3-3 1-3-1-3-2-2 2-4 3 0 2-2z"/><circle cx="12" cy="12" r="3"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

function mount() {
  const game = globalThis.__chevyV6Complete;
  const root = document.querySelector('#v6-main-menu');
  if (!game || !root || globalThis.__asfaltoMenuPresentation) return;
  const content = root.querySelector('#v6-menu-content');
  const brand = root.querySelector('.v6-brand');
  const nav = [...root.querySelectorAll('.v6-nav-btn')];
  let state = initialMenuState();
  let session = null;
  let introRequest = 0;
  let introManifest = null;
  let introFetch = null;
  let focusBeforeIntro = null;
  let wasWorkshopActive = false;
  let introBackground = [];
  let sectionStep = 'modes';
  let sections = null;

  root.classList.add('an-cinematic-menu');
  root.setAttribute('aria-label', 'Menú principal de Asfalto Nacional');
  brand.innerHTML = '<div class="an-brand-bars" aria-hidden="true"><i></i><i></i></div><div><h1>Asfalto<br>Nacional</h1><p class="an-brand-caption" data-selected-vehicle-label>Vehículo seleccionado</p></div><p class="an-brand-tagline">La recta te llama. La curva te mide.</p>';
  nav.forEach(button => {
    const label = document.createElement('span'); label.textContent = button.textContent;
    button.innerHTML = svg(button.dataset.v6Panel); button.append(label);
    button.setAttribute('aria-expanded', 'false');
  });
  const homePlate = document.createElement('aside');
  homePlate.className = 'an-vehicle-plate'; homePlate.setAttribute('aria-label', 'Vehículo seleccionado');
  homePlate.innerHTML = '<div class="an-plate-engine"><strong data-selected-vehicle-label>Vehículo seleccionado</strong><span>Listo para tu próxima salida</span></div><p>Cada ruta, una historia.<br>Prepará el auto y salí a conducir.</p><b><svg viewBox="0 0 90 34" aria-hidden="true"><path d="M32 4h26v8h23l-5 12H58v7H32v-7H9l5-12h18z" fill="none" stroke="currentColor" stroke-width="3"/></svg></b>';
  root.append(homePlate);
  const vehicleLabels = bindSelectedVehicleLabels({ root, getVehicleId: () => game.workshop?.vehicleId });
  const footer = document.createElement('footer'); footer.className = 'an-menu-footer';
  footer.innerHTML = '<p class="an-controls-hint"><kbd>↵</kbd> Seleccionar <kbd>ESC</kbd> Volver</p><button type="button" class="an-replay">Ver animática <span aria-hidden="true">▷</span></button>';
  root.append(footer);
  const replay = footer.querySelector('button');
  const quickDrive=document.createElement('button');quickDrive.type='button';quickDrive.className='an-v7-quick-drive';quickDrive.textContent='Salir a la ruta →';quickDrive.setAttribute('aria-label','Conducir con la ruta y el vehículo seleccionados');footer.append(quickDrive);
  quickDrive.addEventListener('click',async()=>{if(quickDrive.disabled)return;quickDrive.disabled=true;quickDrive.textContent='Preparando la salida…';try{await game.startDrive(game.profile().selectedDrive||'free');}catch(error){globalThis.__asfaltoV7Experience?.announce('No se pudo preparar la salida. Podés reintentar.');console.error('Salida rápida',error);}finally{quickDrive.disabled=false;quickDrive.textContent='Salir a la ruta →';}});
  const back = document.createElement('button'); back.type = 'button'; back.className = 'an-panel-back';
  back.innerHTML = '<span aria-hidden="true">←</span><span class="an-back-label">Volver al menú</span>';
  content.prepend(back);
  for (const heading of content.querySelectorAll('.v6-panel h2')) heading.tabIndex = -1;
  for (const panel of root.querySelectorAll('.v6-panel')) {
    const copy = panel.querySelector('.v6-panel-head p'); if (copy) copy.classList.add('an-section-description');
  }
  const intro = document.createElement('section'); intro.id = 'an-intro'; intro.hidden = true;
  intro.setAttribute('role', 'dialog'); intro.setAttribute('aria-modal', 'true'); intro.setAttribute('aria-label', 'Presentación de Asfalto Nacional');
  intro.innerHTML = '<video playsinline preload="none"></video><div class="an-intro-top"><span class="an-intro-kind">Asfalto Nacional · Animática</span><button type="button" class="an-intro-skip">Saltar <kbd>ESC</kbd></button></div><button type="button" class="an-intro-resume" hidden>Reproducir con sonido ▷</button><p class="an-intro-status" role="status">Preparando presentación…</p>';
  const introBrand=new Image();introBrand.src=new URL('../../assets/brand/asfalto-nacional-v7.webp',import.meta.url).href;introBrand.alt='Asfalto Nacional';introBrand.className='an-intro-brand';intro.querySelector('.an-intro-top').prepend(introBrand);
  document.body.append(intro);
  const video = intro.querySelector('video');
  const skip = intro.querySelector('.an-intro-skip');
  const resume = intro.querySelector('.an-intro-resume');
  const notice = intro.querySelector('.an-intro-status');
  const report = root.querySelector('#v6-a11y-live') || document.querySelector('#v6-a11y-live');
  sections = mountMenuSections({ root, game, svg, selectMode(panel) {
    if (panel === 'drive') {
      sectionStep = 'prepare'; sync();
      root.querySelector('#v6-drive-panel h2').focus({ preventScroll:true });
    } else nav.find(button => button.dataset.v6Panel === panel)?.click();
  } });

  const service = mountWorkshopService({root,game});
  const refinements = mountMenuRefinements({root,game});
  function sync() {
    vehicleLabels.refresh();
    root.dataset.anView = state.view;
    root.dataset.anPanel = state.panel;
    const section = state.view === 'section';
    const modes = section && state.panel === 'drive' && sectionStep === 'modes';
    root.dataset.anStep = modes ? 'modes' : 'prepare';
    sections?.setModes(modes);
    const photo = section && state.panel === 'workshop' && !!root.querySelector('[data-workshop-tab="photo"][aria-selected="true"]');
    root.dataset.anPhoto = String(photo);
    root.dataset.anInspection=String(section&&state.panel==='workshop'&&!!root.querySelector('[data-workshop-tab=chassis][aria-selected=true],[data-workshop-tab=mechanics][aria-selected=true],[data-workshop-tab=condition][aria-selected=true],[data-workshop-tab=tuning][aria-selected=true]')); 
    root.dataset.anAppearance = String(section && state.panel === 'workshop' && !!root.querySelector('[data-workshop-tab="appearance"][aria-selected="true"]'));
    refinements.refresh();
    service.refresh();
    back.querySelector('.an-back-label').textContent = photo ? (game.workshop.collectionInspectionReturn?'Volver a Colección':'Volver al taller') : section && state.panel === 'drive' && !modes ? 'Volver a modos' : 'Volver al menú';
    content.hidden = !section;
    content.inert = !section;
    homePlate.hidden = section && !modes;
    nav.forEach(button => button.setAttribute('aria-expanded', String(section && button.dataset.v6Panel === state.panel)));
    // The existing renderer remains the only workshop scene.
    requestAnimationFrame(() => game.workshop.resize());
  }
  function dispatch(event) { state = reduceMenu(state, event); sync(); }
  function onBack() {
    if (!intro.hidden) { closeIntro('skip'); return; }
    if (root.dataset.anPhoto === 'true') {
      if(game.workshop.collectionInspectionReturn&&game.closeCollectionInspection?.())return;
      root.querySelector('[data-workshop-tab="appearance"]').click();
      root.querySelector('[data-workshop-tab="photo"]').focus({ preventScroll: true });
      return;
    }
    if (state.view === 'section' && state.panel === 'drive' && sectionStep === 'prepare') {
      sectionStep = 'modes'; sync(); sections.focusModes(); return;
    }
    if (state.view === 'section') {
      dispatch({ type: 'back' });
      nav.find(button => button.dataset.v6Panel === state.panel)?.focus({ preventScroll: true });
      game.workshop.focus('general');
    }
  }
  function onPanel(panel) {
    if(panel==='workshop')root.querySelector('[data-workshop-tab=condition]')?.click();
    sectionStep = 'modes';
    sections?.refresh();
    if (panel === 'tests') sections?.ensureTestSelected();
    dispatch({ type: 'panel', panel });
    content.scrollTop = 0;
    requestAnimationFrame(() => {
      if (root.dataset.anStep === 'modes') sections.focusModes();
      else (root.dataset.anPhoto === 'true' ? root.querySelector('#v6-photo-focus') : content.querySelector('.v6-active h2'))?.focus({ preventScroll: true });
    });
  }
  function onWorkshopTab() {
    sync(); content.scrollTop = 0;
    if (root.dataset.anPhoto === 'true') requestAnimationFrame(() => root.querySelector('#v6-photo-focus')?.focus({ preventScroll: true }));
  }
  function onMenu(open) {
    if (!open) closeIntro('menu-close');
    dispatch({ type: open ? 'open' : 'close' });
    if (open) game.workshop.focus('general');
  }
  function frameWorkshop(workshop, instant=false) {
    if (!workshop?.camera || !workshop.car) return;
    if(workshop.collectionFocusActive){workshop.camera.clearViewOffset();return;}
    const camera=workshop.camera, rect=workshop.canvas.getBoundingClientRect();
    const appearance=root.dataset.anAppearance==='true', modes=root.dataset.anStep==='modes' && state.view==='section';
    if(state.view!=='home' && !appearance && !modes){camera.clearViewOffset();return;}
    camera.fov=rect.width/rect.height<1.5?54:46;
    const reservedLeftPx=appearance ? content.getBoundingClientRect().right-rect.left+Math.max(24,rect.width*.02) : undefined;
    const pose=fitMenuCar(workshop.T,workshop.car,camera,{width:rect.width,height:rect.height,view:appearance?'appearance':modes?'modes':'home',yaw:!workshop.deviceProfile?.phone&&['belair_1957','pickup_3100'].includes(workshop.vehicleId)?-.9:-.82,pitch:.13,reservedLeftPx});
    // Keep the PC overview in the clear aisle before the foreground posts.
    if(!workshop.deviceProfile?.phone&&['belair_1957','pickup_3100'].includes(workshop.vehicleId)){pose.radius=Math.min(pose.radius,8.75);pose.target=[0,1.05,0];}
    camera.setViewOffset(rect.width,rect.height,...pose.offset,rect.width,rect.height);
    workshop.hotspots.general=pose;
    const reduced=(document.body.classList.contains('v6-reduce-motion') || document.body.classList.contains('an-v7-reduce-motion')) || matchMedia('(prefers-reduced-motion: reduce)').matches;
    workshop.focus('general',instant||reduced);
  }
  function configureWorkshop(workshop) {
    const portrait = innerWidth <= 720 && innerHeight > innerWidth;
    workshop.hotspots.general = { yaw: .5, pitch: .12, radius: portrait ? 8.1 : 6.6, target: [0, 1.05, 0] };
    workshop.focus('general', true);
    if (!workshop.renderer) return;
    workshop.renderer.shadowMap.enabled = true;
    workshop.renderer.shadowMap.type = workshop.T.PCFSoftShadowMap;
    workshop.key.castShadow = true;
    workshop.key.shadow.mapSize.set(1024, 1024);
    Object.assign(workshop.key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 40 });
    workshop.key.shadow.camera.updateProjectionMatrix();
    workshop.key.shadow.bias = -.00015;
    workshop.key.shadow.normalBias = .025;
    workshop.presentation?.configure();
    frameWorkshop(workshop,true);
  }
  function closeIntro(reason = 'skip') {
    introRequest++;
    const previous = session;
    session = null;
    previous?.stop(reason);
    if (intro.hidden) return;
    intro.hidden = true;
    document.body.classList.remove('an-intro-open');
    for (const [element, inert] of introBackground) element.inert = inert;
    introBackground = [];
    if (document.body.classList.contains('v6-menu-open')) {
      game.workshop.setActive(wasWorkshopActive);
      game.setMenuAudioActive?.(true);
      (focusBeforeIntro?.isConnected ? focusBeforeIntro : replay).focus({ preventScroll: true });
    }
    if (['error', 'timeout'].includes(reason) && report) report.textContent = 'No se pudo reproducir la presentación. Podés seguir desde el menú.';
  }
  async function getIntroManifest() {
    if (introManifest) return introManifest;
    if (!introFetch) {
      const url = new URL('../../assets/intro/manifest.json', import.meta.url);
      introFetch = fetch(url).then(response => { if (!response.ok) throw new Error('Intro no disponible'); return response.json(); })
        .then(manifest => {
          if (!manifest.src || !['animatic','final'].includes(manifest.kind)) throw new Error('Manifiesto de intro inválido');
          introManifest = { ...manifest, src: new URL(manifest.src, url).href, poster: manifest.poster ? new URL(manifest.poster, url).href : '' };
          replay.firstChild.textContent = manifest.finalVideoAvailable ? 'Ver intro ' : 'Ver animática ';
          return introManifest;
        }).finally(() => { introFetch = null; });
    }
    return introFetch;
  }
  async function playIntro({ automatic = false } = {}) {
    if (automatic && (globalThis.__asfaltoV7Experience?.preferences?.().reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    if (state.view === 'closed' || !intro.hidden || document.hidden) return;
    const request = ++introRequest;
    focusBeforeIntro = document.activeElement;
    wasWorkshopActive = game.workshop.active;
    introBackground = [...document.body.children].filter(element => element !== intro && element instanceof HTMLElement).map(element => [element, element.inert]);
    for (const [element] of introBackground) element.inert = true;
    game.workshop.setActive(false);
    game.setMenuAudioActive?.(false);
    intro.hidden = false;
    document.body.classList.add('an-intro-open');
    resume.hidden = true;
    notice.hidden = false;
    notice.textContent = 'Preparando presentación…';
    skip.focus();
    const loadTimer = setTimeout(() => { if (request === introRequest) closeIntro('timeout'); }, 12000);
    try {
      const manifest = await getIntroManifest();
      if (request !== introRequest) return;
      clearTimeout(loadTimer);
      video.poster = manifest.poster;
      video.volume = .7;
      intro.querySelector('.an-intro-kind').textContent = manifest.finalVideoAvailable ? 'Asfalto Nacional' : 'Asfalto Nacional · Animática';
      session = createIntroSession({ video, automatic, onFinish: reason => closeIntro(reason), onBlocked: ({ muted }) => {
        resume.textContent = muted ? 'Activar sonido' : 'Reproducir con sonido ▷';
        resume.hidden = false; notice.hidden = true; resume.focus();
      } });
      const current = session;
      const started = current.start(manifest.src);
      if (document.hidden) current.suspend();
      await started;
    } catch { if (request === introRequest) closeIntro('error'); }
    finally { clearTimeout(loadTimer); }
  }
  function onIntroPlaying() {
    if (intro.hidden) return;
    notice.hidden = true; resume.hidden = !video.muted;
    if (video.muted) resume.textContent = 'Activar sonido';
    else if (document.activeElement === resume) skip.focus({ preventScroll: true });
  }
  video.addEventListener('playing', onIntroPlaying);
  video.addEventListener('waiting', () => {
    if (intro.hidden) return;
    notice.textContent = 'Cargando el siguiente tramo…'; notice.hidden = false;
  });
  replay.addEventListener('click', () => playIntro());
  skip.addEventListener('click', () => closeIntro('skip'));
  resume.addEventListener('click', async () => {
    const current = session;
    if (await current?.resume({ unmute: true }) && current === session) onIntroPlaying();
  });
  back.addEventListener('click', onBack);
  document.addEventListener('keydown', event => {
    if (intro.hidden) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeIntro('skip'); }
    else if (event.key === 'Tab') {
      const controls = [skip, ...(!resume.hidden ? [resume] : [])];
      const index = controls.indexOf(document.activeElement);
      event.preventDefault(); controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length].focus();
    }
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (intro.hidden) return;
    if (document.hidden) session?.suspend();
    else void session?.resume();
  });

  const api = { onPanel, onWorkshopTab, onMenu, onBack, playIntro, configureWorkshop, frameWorkshop, getState: () => ({ ...state }), get introPlaying() { return !intro.hidden; }, dispose() { vehicleLabels.dispose(); sections?.dispose(); refinements.dispose(); service.dispose(); } };
  globalThis.__asfaltoMenuPresentation = api;
  configureWorkshop(game.workshop);
  window.addEventListener('resize', () => { if (state.view === 'home') configureWorkshop(game.workshop); });
  sync();
  loadComponents(root);
  // QA keeps entry deterministic; every ordinary load starts the presentation.
  getIntroManifest().catch(() => {});
  if (document.body.classList.contains('v6-menu-open')) nav[0].focus({ preventScroll: true });
  if (new URLSearchParams(globalThis.location?.search || '').get('qa') !== '1') void playIntro({ automatic: true });
}

async function loadComponents(root) {
  const url = new URL('../../assets/menu/manifest.json', import.meta.url);
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const { components } = await response.json();
    for (const [id, component] of Object.entries(components || {})) {
      if (!component.image || !['action-plate','vehicle-plate','ignition','card-frame','brand'].includes(id)) continue;
      const image = new Image();
      image.src = new URL(component.image, url).href;
      await image.decode();
      root.style.setProperty(`--an-${id}`, `url("${image.src}")`);
      if (id === 'brand') {
        image.alt = ''; image.className = 'an-brand-render';
        const brand = root.querySelector('.v6-brand');
        brand.prepend(image); brand.classList.add('an-brand-modeled');
      }
    }
    root.dataset.anAssets = 'ready';
  } catch { root.dataset.anAssets = 'fallback'; }
}

globalThis.addEventListener('asfalto-menu-ready', mount, { once: true });
if (globalThis.__chevyV6Complete?.initialized) mount();

import { bindSelectedVehicleLabels } from './selected-vehicle-labels.mjs?v=photo-r1-20260916';
import { summarizeRoadTestRecords } from './roadtest-records.mjs';
import { testPresentationState } from './menu-refinement-state.mjs';

const scene = name => new URL(`../../assets/menu/game-captures/${name === 'competencia' ? 'viaje-v7.webp' : `${name}.jpg`}`, import.meta.url).href;
const TEST_ORDER = ['accel100', 'm500', 'm1000', 'brake100', 'vmax', 'recovery', 'accel160', 'slalom', 'turn', 'wet', 'speedo', 'consumption'];
const TEST_KIND = { accel100:'Aceleración', accel160:'Aceleración', m500:'Aceleración', m1000:'Aceleración', brake100:'Frenado', vmax:'Velocidad', recovery:'En cuarta', slalom:'Precisión', turn:'Maniobra', wet:'Adherencia', speedo:'Instrumental', consumption:'Consumo' };
const recordLabel = result => {
  if (!result) return 'Sin marca';
  if (/^\d+:/.test(String(result.main))) {
    const [minutes, seconds] = String(result.main).split(':').map(Number);
    return `${(minutes * 60 + seconds).toFixed(2)} s`;
  }
  return `${result.main} ${result.testId === 'vmax' || result.testId === 'speedo' ? 'km/h' : result.testId === 'slalom' ? 'cambios' : result.testId === 'consumption' ? 'L/100 km' : 'm'}`;
};

// Reparent the original controls so their listeners and the V6 event contract survive.
export function mountMenuSections({ root, game, svg, selectMode, vehicleEvents = globalThis }) {
  const content = root.querySelector('#v6-menu-content');
  const drive = root.querySelector('#v6-drive-panel');
  const tests = root.querySelector('#v6-roadtest-panel');
  const testCards = root.querySelector('#v6-test-cards');
  const competitions = root.querySelector('#v6-competition-cards');
  const text = (selector, value) => { const node = root.querySelector(selector); if (node) node.textContent = value; };
  text('#v6-drive-sky-note', 'Elegí la luz del día para tu salida.');
  text('#v6-comp-sky-note', 'Elegí la luz del día para la competencia.');
  text('#v6-drive-panel .v6-panel-head h2', 'Prepará tu salida');
  text('#v6-drive-panel .v6-panel-head p', 'Elegí una sesión, una ruta y el momento de salir.');
  text('#v6-roadtest-panel .v6-kicker', 'Medí, compará, superá');
  tests.querySelector('.v6-panel-head h2').innerHTML = 'Pruebas <span>/ Road Test</span>';
  text('#v6-roadtest-panel .v6-panel-head p', 'Elegí una prueba y buscá tu mejor marca.');

  const modes = document.createElement('section');
  modes.className = 'an-mode-selection'; modes.hidden = true;
  modes.setAttribute('aria-label', 'Elegí tu modo');
  modes.innerHTML = '<header class="an-mode-heading"><h2 tabindex="-1">Elegí tu modo</h2><p>Tres formas de vivir la pasión por el asfalto.</p></header><div class="an-mode-grid"></div>';
  const modeDefinitions = [
    { id:'drive', title:'Conducción', image:'conduccion', copy:'Manejá libremente y disfrutá del camino.', first:'A tu ritmo', second:`${root.querySelector('#v6-drive-route')?.options.length || 5} rutas`, last:'Libre · Viaje · Práctica' },
    { id:'tests', title:'Pruebas', image:'instrumental', copy:'Poné a prueba al auto y superá tus marcas.', first:'2–8 min por prueba', second:'12 pruebas', last:'Aceleración · Frenado · Precisión' },
    { id:'competition', title:'Competencia', image:'competencia', copy:'Compartí la ruta con rivales y contra el reloj.', first:'Según el evento', second:'7 formatos', last:'Club · Contrarreloj · Resistencia' },
  ];
  for (const mode of modeDefinitions) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'an-mode-card'; button.dataset.anMode = mode.id;
    button.innerHTML = `<img src="${scene(mode.image)}" alt="" decoding="async"><span class="an-mode-icon">${svg(mode.id)}</span><span class="an-mode-card-body"><strong>${mode.title}</strong><span class="an-mode-copy">${mode.copy}</span><span class="an-mode-facts"><span><small>Duración</small>${mode.first}</span><span><small>Para elegir</small>${mode.second}</span><span>${mode.last}</span></span><span class="an-mode-enter">Elegir <b aria-hidden="true">→</b></span></span>`;
    button.addEventListener('click', () => selectMode(mode.id));
    modes.querySelector('.an-mode-grid').append(button);
  }
  content.append(modes);

  const driveCards = root.querySelector('#v6-drive-cards');
  for (const card of driveCards.children) {
    const name = { free:'conduccion', journey:'competencia', practice:'instrumental' }[card.dataset.driveMode];
    const image = document.createElement('img'); image.src = scene(name); image.alt = ''; image.decoding = 'async'; image.className = 'an-session-image';
    card.prepend(image); card.classList.add('an-session-card');
  }
  const preparation = document.createElement('div'); preparation.className = 'an-drive-preparation';
  drive.append(preparation);
  preparation.append(drive.querySelector('.v6-tech-plate'), drive.querySelector('.v6-button-row'));

  const layout = document.createElement('div'); layout.className = 'an-roadtest-layout';
  tests.append(layout); layout.append(testCards);
  const detail = document.createElement('section'); detail.className = 'an-test-detail'; detail.setAttribute('aria-label', 'Detalle de la prueba');
  detail.innerHTML = '<header class="an-test-vehicle"><div><strong data-selected-vehicle-label>Vehículo seleccionado</strong><span>Auto seleccionado para esta prueba</span></div></header><figure class="an-test-preview"><img alt="Vista del cockpit capturada en el juego" decoding="async"><figcaption>Captura del juego</figcaption></figure><div class="an-test-info"><section class="an-test-objective"><span class="an-detail-label">Objetivo</span><h3 id="an-test-title"></h3><p id="an-test-objective"></p></section><section class="an-test-record"><span class="an-detail-label">Mejor marca</span><strong id="an-test-record">Sin marca</strong><span id="an-test-attempts"></span></section><section><span class="an-detail-label">Condiciones</span><p id="an-test-conditions"></p></section><section><span class="an-detail-label">Progreso</span><p id="an-test-progress"></p></section></div>';
  detail.querySelector('img').src = scene('pruebas');
  const vehicleLabels = bindSelectedVehicleLabels({ root: detail, events: vehicleEvents, getVehicleId: () => game.workshop?.vehicleId });
  let disposed = false;
  const protocol = document.createElement('details'); protocol.className = 'an-test-protocol';
  protocol.innerHTML = '<summary>Preparación y validez de la prueba</summary>';
  protocol.append(root.querySelector('#v6-test-protocol'));
  detail.append(protocol);
  const actions = tests.querySelector('.v6-button-row'); actions.classList.add('an-test-actions'); detail.append(actions);
  layout.append(detail);
  for (const title of tests.querySelectorAll(':scope > .v6-section-title')) title.hidden = true;
  root.querySelector('#v6-test-start').setAttribute('aria-describedby', 'an-test-objective');

  function vehicleClass(profile) {
    return Object.values(profile.parts || {}).includes('restomod') || ['restomod','modern'].includes(profile.appearance?.wheel) || profile.appearance?.tire === 'modern' ? 'Restomod' : 'Histórica';
  }
  function decorateTests() {
    const ordered = [...testCards.children].sort((a, b) => TEST_ORDER.indexOf(a.dataset.testId) - TEST_ORDER.indexOf(b.dataset.testId));
    ordered.forEach((card, index) => { if (testCards.children[index] !== card) testCards.insertBefore(card, testCards.children[index]); });
    for (const card of testCards.children) {
      if (card.querySelector('.an-test-row-icon')) continue;
      const icon = document.createElement('span'); icon.className = 'an-test-row-icon'; icon.innerHTML = svg('tests');
      const kind = document.createElement('span'); kind.className = 'an-test-kind'; kind.textContent = TEST_KIND[card.dataset.testId] || 'Road Test';
      const record = document.createElement('span'); record.className = 'an-test-row-record'; record.innerHTML = '<small>Mejor marca</small><b>Sin marca</b>';
      const status=document.createElement('span');status.className='an-test-status';kind.append(status);
      card.prepend(icon); card.append(kind, record);
    }
  }
  function decorateCompetitions() {
    for (const card of competitions.children) {
      if (card.querySelector('.an-session-image')) continue;
      const image = document.createElement('img'); image.src = scene(card.dataset.compId === 'drag' ? 'instrumental' : card.dataset.compId === 'timetrial' ? 'conduccion' : 'competencia'); image.alt = ''; image.decoding = 'async'; image.className = 'an-session-image';
      card.prepend(image); card.classList.add('an-session-card');
    }
  }
  function refresh() {
    if (disposed) return;
    vehicleLabels.refresh();
    decorateTests(); decorateCompetitions();
    const profile = game.profile();
    const currentClass = vehicleClass(profile);
    text('#v6-test-config', currentClass);
    text('#v6-test-warmup', 'Calentá motor y neumáticos');
    text('#v6-test-validity', 'Evitá choques y atajos');
    const availableCards = [...testCards.children];
    for (const card of availableCards) {
      const result = testPresentationState({sheets:profile.sheets,testId:card.dataset.testId,vehicleClass:currentClass,locked:card.classList.contains('v6-locked'),selected:card.getAttribute('aria-selected')==='true'});
      card.dataset.testProgress=result.progress;card.dataset.testAvailable=String(result.available);
      card.querySelector('.an-test-status').textContent=result.label;
      card.querySelector('.an-test-row-record b').textContent = recordLabel(result.best);
      card.querySelector('.an-test-row-record').classList.toggle('an-no-record', !result.best);
      card.querySelector('.an-test-row-record small').textContent = card.classList.contains('v6-locked') ? card.querySelector('.v6-reward').textContent : 'Mejor marca';
      card.setAttribute('aria-pressed', String(card.getAttribute('aria-selected') === 'true'));
      card.setAttribute('aria-disabled', String(card.classList.contains('v6-locked')));
    }
    const selected = availableCards.find(card => card.dataset.testId === profile.selectedTest && !card.classList.contains('v6-locked'));
    const display = selected || availableCards.find(card => card.dataset.testId === 'accel100') || availableCards[0];
    if (!display) return;
    const result = summarizeRoadTestRecords(profile.sheets, display.dataset.testId, currentClass);
    text('#an-test-title', display.querySelector('h3').textContent);
    text('#an-test-objective', display.querySelector('p').textContent);
    text('#an-test-record', recordLabel(result.best));
    text('#an-test-attempts', `${currentClass} · ${result.attempts ? `${result.validAttempts} válidas de ${result.attempts} intentos` : 'Todavía sin intentos'}`);
    const chips = [...display.querySelectorAll('.v6-chip')].map(chip => chip.textContent);
    const route = root.querySelector('#v6-drive-route').selectedOptions[0]?.textContent || 'Dos Lagos';
    text('#an-test-conditions', `${route} · ${chips[2] || 'Seca'} · ${chips[0] || ''}`);
    const completed = new Set((profile.sheets || []).filter(sheet => sheet.valid === true && sheet.class === currentClass && availableCards.some(card => card.dataset.testId === sheet.testId)).map(sheet => sheet.testId)).size;
    text('#an-test-progress', `${completed} / ${availableCards.length} pruebas con ficha válida`);
    for (const card of driveCards.children) card.setAttribute('aria-selected', String(card.dataset.driveMode === profile.selectedDrive));
  }
  // Delegation survives renderAll() replacing the legacy card nodes on imports/results.
  function onChoice(event) { if (event.target.closest('[data-test-id],[data-comp-id],[data-drive-mode]')) refresh(); }
  root.addEventListener('click', onChoice);
  root.addEventListener('change', refresh);
  const observer = new MutationObserver(refresh);
  observer.observe(testCards, { childList:true }); observer.observe(competitions, { childList:true });
  refresh();
  return {
    refresh,
    setModes(visible) { modes.hidden = !visible; },
    focusModes() { modes.querySelector('h2').focus({ preventScroll:true }); },
    ensureTestSelected() {
      if (!testCards.querySelector('[aria-selected="true"]:not(.v6-locked)')) (testCards.querySelector('[data-test-id="accel100"]:not(.v6-locked)') || testCards.querySelector('.v6-card:not(.v6-locked)'))?.click();
      refresh();
    },
    dispose() { if (disposed) return; disposed = true; vehicleLabels.dispose(); observer.disconnect(); root.removeEventListener('click', onChoice); root.removeEventListener('change', refresh); },
  };
}

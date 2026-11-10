const ROUTE_NOTES = {
  dos_lagos: {
    region: 'Patagonia · Lagos Villarino y Falkner',
    terrain: 'Bosque andino y riberas',
    description: 'El camino bordea los lagos y atraviesa barrancas y lomas de coihues.',
  },
  aconcagua_horcones: {
    region: 'Mendoza · Corredor de Horcones',
    terrain: 'Alta montaña andina',
    description: 'La ruta asciende entre quebradas, pendientes largas y laderas de piedra suelta.',
  },
  cuesta_lipan: {
    region: 'Jujuy · Quebrada y Puna',
    terrain: 'Ruta de cornisa',
    description: 'Horquillas encadenadas y cambios de altura entre laderas estratificadas.',
  },
  paso_garibaldi: {
    region: 'Tierra del Fuego · Lago Escondido',
    terrain: 'Asfalto frío y bosque fueguino',
    description: 'El paso alterna curvas de montaña, bosque de lenga y vistas al lago.',
  },
  cataratas_iguazu: {
    region: 'Misiones · Selva de Iguazú',
    terrain: 'Asfalto húmedo y banquinas de laterita',
    description: 'Recorrido inspirado en Iguazú, con cataratas, selva cerrada y paredones de basalto.',
  },
};

const averageSpeedKmh = 60;
const kilometers = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatDistance = meters => `${kilometers.format(meters / 1000)} km`;

export function mountDriveRouteSheet(preview) {
  const sheet = preview.ownerDocument.createElement('section');
  sheet.className = 'an-drive-route-sheet';
  sheet.hidden = true;
  sheet.setAttribute('aria-labelledby', 'an-drive-route-title');
  sheet.innerHTML = `
    <header>
      <p class="an-drive-route-kicker">Ficha técnica del circuito</p>
      <h3 id="an-drive-route-title"></h3>
      <p class="an-drive-route-region"></p>
    </header>
    <dl class="an-drive-route-facts">
      <div><dt>Distancia de salida a meta</dt><dd></dd></div>
      <div><dt>Tiempo estimado</dt><dd></dd></div>
    </dl>
    <p class="an-drive-route-note"></p>
    <p class="an-drive-route-description"><strong></strong> <span></span></p>`;
  preview.before(sheet);

  const title = sheet.querySelector('h3');
  const region = sheet.querySelector('.an-drive-route-region');
  const [distance, time] = sheet.querySelectorAll('dd');
  const estimateNote = sheet.querySelector('.an-drive-route-note');
  const terrain = sheet.querySelector('.an-drive-route-description strong');
  const description = sheet.querySelector('.an-drive-route-description span');
  let currentId, currentEntry;

  return (id, label, entry) => {
    if (currentId === id && currentEntry === entry) return;
    currentId = id;
    currentEntry = entry;
    const notes = ROUTE_NOTES[id];
    sheet.hidden = !notes;
    if (sheet.hidden) return;

    const lengthM = entry?.lengthM;
    const hasDistance = Number.isFinite(lengthM) && lengthM > 0;
    title.textContent = label;
    region.textContent = notes.region;
    distance.textContent = hasDistance ? formatDistance(lengthM) : '—';
    time.textContent = hasDistance ? `${Math.round(lengthM / 1000 * 60 / averageSpeedKmh)} min` : '—';
    estimateNote.textContent = hasDistance
      ? `Una pasada a ${averageSpeedKmh} km/h de promedio, sin paradas.`
      : 'Distancia y tiempo no disponibles.';
    terrain.textContent = `${notes.terrain}.`;
    description.textContent = notes.description;
  };
}

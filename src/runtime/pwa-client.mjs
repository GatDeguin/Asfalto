const MB = bytes => `${(bytes / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
const rootUrl = new URL('../../', import.meta.url);
let registration = null, registrationPromise = null, installPrompt = null, downloadBusy = false;
const PAUSED_FOR_DRIVING = 'Descarga pausada al salir a conducir. Podés continuar al volver al taller';
export function pwaActivityAllowsDownload(body) {
  const classes = body?.classList, phase = body?.dataset?.v7Phase;
  return Boolean(classes?.contains('v6-menu-open'))
    && !['v6-driving', 'an-loading-open', 'an-race-opening-active', 'an-intro-open'].some(name => classes.contains(name))
    && !['loading', 'opening', 'driving', 'paused', 'closed'].includes(phase);
}
export function createPwaProgressAnnouncer(announce, { now = () => performance.now(), intervalMs = 1000 } = {}) {
  let last = -Infinity;
  return (value, { final = false } = {}) => {
    const at = now();
    if (!final && at - last < intervalMs) return false;
    last = at; announce(value); return true;
  };
}
function workerRequest(type, onProgress, payload = {}) {
  return new Promise((resolve, reject) => {
    const worker = navigator.serviceWorker.controller || registration?.active;
    if (!worker) { reject(new Error('La aplicación todavía se está preparando. Reintentá en unos momentos.')); return; }
    const channel = new MessageChannel();
    let timer;
    const close = () => { clearTimeout(timer); channel.port1.close(); };
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { close(); reject(new Error('La descarga se interrumpió. Podés reintentar para continuar los archivos pendientes.')); }, type === 'DOWNLOAD' ? 600_000 : 30_000); };
    channel.port1.onmessage = ({ data }) => {
      if (data.kind === 'progress') { arm(); onProgress?.(data); return; }
      close();
      if (data.kind === 'result') resolve(data.value);
      else { const error = new Error(data.message); error.name = data.name; reject(error); }
    };
    arm(); worker.postMessage({ type, ...payload }, [channel.port2]);
  });
}
async function register() {
  if (registrationPromise) return registrationPromise;
  registrationPromise = navigator.serviceWorker.register(new URL('sw.js', rootUrl), { scope: rootUrl.href, updateViaCache: 'none' }).catch(async error => {
    const existing = await navigator.serviceWorker.getRegistration(rootUrl.href);
    if (existing?.active) return existing;
    throw error;
  }).then(async value => {
    registration = value;
    if (!value.active) await new Promise((resolve, reject) => {
      const worker = value.installing || value.waiting;
      if (!worker) { reject(new Error('No se pudo preparar la aplicación. Reintentá con conexión.')); return; }
      const changed = () => {
        if (worker.state === 'activated') { worker.removeEventListener('statechange', changed); resolve(); }
        if (worker.state === 'redundant') { worker.removeEventListener('statechange', changed); reject(new Error('No se pudo completar la aplicación. Revisá la conexión y el espacio disponible.')); }
      };
      worker.addEventListener('statechange', changed); changed();
    });
    return value;
  }).catch(error => { registrationPromise = null; throw error; });
  return registrationPromise;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function mountPwaControls() {
  const panel = document.querySelector('#v6-settings-panel');
  if (!panel || document.querySelector('#an-pwa-controls') || globalThis.asfaltoDesktop?.distribution === 'windows' || !['http:', 'https:'].includes(location.protocol)) return;
  const section = element('section', '', 'v6-setting-group'); section.id = 'an-pwa-controls';
  const heading = element('h3', 'Aplicación y juego sin conexión');
  const message = element('p', 'Podés instalar la aplicación desde el menú del navegador. La descarga completa para jugar sin conexión es opcional.');
  const state = element('p', 'Preparando la aplicación…'); state.setAttribute('role', 'status'); state.setAttribute('aria-live', 'polite');
  const progress = document.createElement('progress'); progress.hidden = true; progress.max = 1; progress.value = 0; progress.setAttribute('aria-label', 'Descarga para jugar sin conexión'); progress.style.width = '100%';
  const row = element('div', '', 'v6-button-row');
  const button = text => { const node = element('button', text, 'v6-btn'); node.type = 'button'; row.append(node); return node; };
  const install = button('Instalar aplicación'), download = button('Descargar juego sin conexión'), cancel = button('Cancelar descarga'), remove = button('Quitar descarga'), update = button('Buscar actualización');
  install.hidden = true; cancel.hidden = true; download.disabled = true; remove.disabled = true;
  section.append(heading, message, state, progress, row, element('p', 'Tu partida se guarda en este dispositivo. Exportá una copia desde Taller → Documentación y oficio para llevarla a otro navegador o a Windows.'));
  panel.append(section);
  if (!isSecureContext || !('serviceWorker' in navigator)) {
    state.textContent = 'Este navegador no permite preparar el juego sin conexión en esta dirección.';
    update.disabled = true; return;
  }
  const showInstall = () => { install.hidden = !installPrompt || matchMedia('(display-mode: standalone)').matches; };
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; showInstall(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; showInstall(); });
  install.addEventListener('click', async () => { if (installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; showInstall(); } });
  let lastStatus = null, noticeDismissed = false, pauseRequested = false, remoteRefreshTimer = null;
  let activitySafe = pwaActivityAllowsDownload(document.body), remoteActivityBlocked = false, remoteDownloading = false, remoteUnresponsive = 0;
  const syncDownloadButton = () => { download.disabled = downloadBusy || !activitySafe || remoteActivityBlocked || remoteDownloading; };
  const publishActivity = () => {
    if (navigator.serviceWorker.controller || registration?.active) void workerRequest('ACTIVITY', null, { safe: activitySafe }).catch(() => {});
  };
  const syncActivity = () => {
    const safe = pwaActivityAllowsDownload(document.body);
    if (safe === activitySafe) return;
    activitySafe = safe;
    if (!safe && downloadBusy) { pauseRequested = true; state.textContent = PAUSED_FOR_DRIVING; }
    syncDownloadButton(); publishActivity();
  };
  // One observer covers the actual session state and the departure/loading overlay before v6-driving starts.
  const activityObserver = new MutationObserver(syncActivity);
  activityObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-v7-phase'] });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'ASFALTO_PWA_ACTIVITY_QUERY') {
      event.ports?.[0]?.postMessage({ safe: pwaActivityAllowsDownload(document.body) }); event.ports?.[0]?.close();
    } else if (event.data?.type === 'ASFALTO_PWA_ACTIVITY_CHANGED') {
      remoteActivityBlocked = event.data.activityBlocked === true;
      remoteDownloading = event.data.downloading === true;
      remoteUnresponsive = Number(event.data.unresponsiveClients) || 0;
      syncDownloadButton();
      if (!downloadBusy && remoteDownloading) state.textContent = 'Hay una descarga en curso en otra ventana del juego.';
      else if (!downloadBusy && remoteUnresponsive) state.textContent = 'Otra ventana del juego no respondió. Volvé a esa ventana o cerrala antes de continuar la descarga.';
      else if (!downloadBusy && remoteActivityBlocked && !pauseRequested) state.textContent = 'La descarga está disponible cuando todas las ventanas del juego están en el taller.';
      scheduleRemoteRefresh();
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', publishActivity);
  const notice = element('aside'); notice.hidden = true; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
  notice.style.cssText = 'position:fixed;right:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:20020;max-width:min(420px,calc(100vw - 32px));padding:16px;border:1px solid #c39358;border-radius:8px;background:#202326;color:#eee9dd;font:15px/1.5 system-ui;box-shadow:0 6px 24px #0008;';
  notice.append(element('p', 'Sin conexión. Todavía falta descargar parte del juego. Conectate para completar la descarga en Ajustes.'));
  const dismiss = element('button', 'Entendido', 'v6-btn'); dismiss.type = 'button'; dismiss.addEventListener('click', () => { noticeDismissed = true; notice.hidden = true; }); notice.append(dismiss); document.body.append(notice);
  const offlineState = () => {
    notice.hidden = navigator.onLine || !lastStatus || lastStatus.complete || noticeDismissed;
    if (!navigator.onLine && lastStatus && !lastStatus.complete && !downloadBusy) state.textContent = 'Sin conexión. La descarga está incompleta; conectate para continuar los archivos pendientes.';
  };
  window.addEventListener('offline', () => { noticeDismissed = false; offlineState(); });
  window.addEventListener('online', () => { noticeDismissed = false; offlineState(); if (lastStatus && !downloadBusy) paint(lastStatus); });
  const paint = value => {
    lastStatus = value;
    remoteActivityBlocked = value.activityBlocked === true; remoteDownloading = value.downloading === true; remoteUnresponsive = Number(value.unresponsiveClients) || 0;
    const remaining = Math.max(0, value.totalBytes - value.storedBytes);
    message.textContent = `Juego completo: ${MB(value.totalBytes)}. Pendiente en este dispositivo: ${MB(remaining)}.`;
    state.textContent = value.complete ? 'Descarga completa. El juego está disponible sin conexión.' : 'La descarga incluye las rutas, los vehículos y la música. Podés cancelarla y continuar más tarde.';
    download.textContent = value.complete ? 'Comprobar disponibilidad' : value.storedBytes > value.shellBytes ? 'Continuar descarga' : 'Descargar juego sin conexión';
    syncDownloadButton(); remove.disabled = downloadBusy || value.storedBytes <= value.shellBytes;
    if (remoteDownloading && !downloadBusy) state.textContent = 'Hay una descarga en curso en otra ventana del juego.';
    else if (remoteUnresponsive) state.textContent = 'Otra ventana del juego no respondió. Volvé a esa ventana o cerrala antes de continuar la descarga.';
    else if (remoteActivityBlocked) state.textContent = 'La descarga está disponible cuando todas las ventanas del juego están en el taller.';
    offlineState();
  };
  let refreshing = null;
  const refresh = () => {
    if (!refreshing) refreshing = (async () => {
      paint(await workerRequest('STATUS'));
      if (pauseRequested && !lastStatus.complete && !lastStatus.activityBlocked && !lastStatus.downloading) state.textContent = PAUSED_FOR_DRIVING;
      else if (registration?.waiting && !lastStatus.activityBlocked && !lastStatus.downloading) state.textContent = 'Hay una nueva versión preparada. Cerrá todas las ventanas del juego y abrilo otra vez para aplicarla.';
    })().finally(() => { refreshing = null; });
    return refreshing;
  };
  function scheduleRemoteRefresh() {
    clearTimeout(remoteRefreshTimer);
    // Closing another tab can race the visibility event. Retry only while this visible workshop is remotely blocked.
    if (!document.hidden && activitySafe && !downloadBusy && registration?.active && (remoteActivityBlocked || remoteDownloading)) remoteRefreshTimer = setTimeout(refreshWhenVisible, 2000);
  }
  const refreshWhenVisible = () => {
    if (!document.hidden && !downloadBusy && registration?.active) void refresh().catch(() => {}).finally(scheduleRemoteRefresh);
  };
  window.addEventListener('focus', refreshWhenVisible);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  const watch = value => {
    const found = () => value.installing?.addEventListener('statechange', () => { if (value.waiting) state.textContent = 'Hay una nueva versión preparada. Cerrá todas las ventanas del juego y abrilo otra vez para aplicarla.'; });
    value.addEventListener('updatefound', found); found();
  };
  const prepare = async () => { try { const value = await register(); watch(value); publishActivity(); await refresh(); } catch (error) { state.textContent = error.message; syncDownloadButton(); download.textContent = 'Reintentar preparación'; } };
  download.addEventListener('click', async () => {
    if (downloadBusy) return;
    syncActivity();
    if (!activitySafe || remoteActivityBlocked || remoteDownloading) { state.textContent = 'La descarga está disponible cuando todas las ventanas del juego están en el taller y no hay otra descarga en curso.'; return; }
    if (!lastStatus) { await prepare(); return; }
    pauseRequested = false;
    downloadBusy = true; download.disabled = true; remove.disabled = true; update.disabled = true;
    try {
      await register();
      const value = await workerRequest('STATUS');
      if (value.complete) { paint(value); return; }
      if (value.unresponsiveClients) throw new Error('Otra ventana del juego no respondió. Volvé a esa ventana o cerrala antes de continuar la descarga.');
      if (value.downloading || value.activityBlocked) throw new Error('Otra ventana del juego está conduciendo o descargando. Podés continuar cuando vuelva al taller.');
      const estimate = await navigator.storage?.estimate?.();
      const remaining = Math.max(0, value.totalBytes - value.storedBytes);
      if (remaining > 0 && estimate?.quota && estimate.quota - (estimate.usage || 0) < remaining * 1.1 + 32_000_000) throw new Error(`No alcanza el espacio disponible. Se necesitan aproximadamente ${MB(remaining * 1.1 + 32_000_000)} adicionales. Liberá espacio y reintentá.`);
      const persistent = await navigator.storage?.persist?.().catch(() => false);
      if (pauseRequested || !pwaActivityAllowsDownload(document.body)) throw new DOMException(PAUSED_FOR_DRIVING, 'AbortError');
      progress.hidden = false; cancel.hidden = false;
      const announceProgress = createPwaProgressAnnouncer(value => { state.textContent = `Descargando: ${MB(value.storedBytes)} de ${MB(value.totalBytes)} · ${value.filesDone} de ${value.files} archivos.`; });
      const result = await workerRequest('DOWNLOAD', value => {
        progress.max = value.totalBytes; progress.value = value.storedBytes;
        if (!pauseRequested) announceProgress(value);
      });
      paint(result);
      if (!persistent) state.textContent += ' El navegador puede liberar esta descarga si necesita espacio.';
    } catch (error) {
      if (error.name === 'AbortError' && (pauseRequested || error.message === PAUSED_FOR_DRIVING)) { pauseRequested = true; state.textContent = PAUSED_FOR_DRIVING; }
      else state.textContent = error.name === 'AbortError' ? 'Descarga cancelada. Los archivos verificados se conservan para continuar después.' : error.message;
      download.textContent = pauseRequested ? 'Continuar descarga' : 'Reintentar descarga';
    } finally {
      downloadBusy = false; syncDownloadButton(); remove.disabled = false; update.disabled = false; cancel.hidden = true; progress.hidden = true;
    }
  });
  cancel.addEventListener('click', () => { state.textContent = 'Cancelando descarga…'; workerRequest('CANCEL').catch(error => { state.textContent = error.message; }); });
  remove.addEventListener('click', async () => {
    try { paint(await workerRequest('REMOVE_DOWNLOADS')); state.textContent = 'Se quitaron los archivos descargados del juego. Tu partida y tu álbum se conservan.'; } catch (error) { state.textContent = error.message; }
  });
  update.addEventListener('click', async () => {
    try { const value = await register(); await value.update(); await refresh(); } catch (error) { state.textContent = `No se pudo buscar la actualización. ${error.message}`; }
  });
  Object.defineProperty(globalThis, '__asfaltoPwa', { configurable: true, value: Object.freeze({ status: () => workerRequest('STATUS'), registration: () => registration }) });
  // Registration is a background enhancement. Defer it past initial game/menu work and never await it from startup.
  const idle = () => {
    if (document.hidden || !pwaActivityAllowsDownload(document.body)) { setTimeout(idle, 5000); return; }
    const ready = () => { if (document.hidden || !pwaActivityAllowsDownload(document.body)) setTimeout(idle, 5000); else void prepare(); };
    if ('requestIdleCallback' in window) requestIdleCallback(ready, { timeout: 5000 }); else ready();
  };
  if (document.readyState === 'complete') setTimeout(idle, 5000); else window.addEventListener('load', () => setTimeout(idle, 5000), { once: true });
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPwaControls, { once: true });
  else mountPwaControls();
}

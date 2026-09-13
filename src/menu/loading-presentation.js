/* Cinematic loading surfaces. Readiness belongs to the game, never to a movie.
 * Videos are local, muted and decoded only for the foremost visible surface.
 * The original status nodes remain live for assistive technology and diagnostics. */
(() => {
  const assetRoot = new URL('../../assets/loading/', document.currentScript.src);
  const scenes = Object.freeze({
    boot: {film:'workshop',title:'Todo empieza\nen el taller',region:'ARGENTINA / 1973',line:'Hay historias que se escriben en la ruta.',chapter:'PRÓLOGO'},
    workshop: {film:'workshop',title:'El taller',region:'MECÁNICA NACIONAL / 1973',line:'Cada detalle prepara la próxima salida.',chapter:'EL ORIGEN'},
    vehicle: {film:'ignition',title:'Carácter propio',region:'COLECCIÓN / 1973',line:'Una nueva máquina. La misma pasión.',chapter:'MECÁNICA'},
    return: {film:'return',title:'De vuelta\na casa',region:'EL TALLER / 1973',line:'Toda ruta deja una historia.',chapter:'ENTRE RUTAS'},
    separator: {film:'separator',title:'La próxima curva',region:'ASFALTO NACIONAL / 1973',line:'El camino sigue.',chapter:'EN RUTA'},
    dos_lagos: {film:'dos-lagos',title:'Dos Lagos',region:'PATAGONIA ARGENTINA',line:'Entre el bosque y el agua, la ruta encuentra su ritmo.',chapter:'01 / DESTINOS'},
    aconcagua_horcones: {film:'aconcagua',title:'Aconcagua',region:'HORCONES / MENDOZA',line:'El silencio de la montaña. La voz del motor.',chapter:'02 / DESTINOS'},
    cuesta_lipan: {film:'lipan',title:'Cuesta de Lipán',region:'QUEBRADA / JUJUY',line:'Una curva. Otra altura. Un nuevo horizonte.',chapter:'03 / DESTINOS'},
    paso_garibaldi: {film:'garibaldi',title:'Paso Garibaldi',region:'TIERRA DEL FUEGO',line:'Donde el bosque se encuentra con el fin del mundo.',chapter:'04 / DESTINOS'},
    cataratas_iguazu: {film:'ignition',title:'Cataratas\ndel Iguazú',region:'SELVA ATLÁNTICA / MISIONES',line:'La selva espera. El viaje empieza al girar la llave.',chapter:'05 / DESTINOS'},
  });
  const surfaces = new Set(), pending = new Map();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motion.matches || (document.body?.classList.contains('v6-reduce-motion') || document.body?.classList.contains('an-v7-reduce-motion'));
  const stillOnly = () => reduced() || navigator.connection?.saveData;
  let overlay, sessionSurface, previousFocus, background = [], exitTimer, exitResolve, exiting = false;
  const url = (film,ext) => new URL(film+'.'+ext,assetRoot).href;
  const visible = el => el.isConnected && !el.hidden && !el.classList.contains('hidden') &&
    !el.classList.contains('v6-hidden') && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
  function createSurface(host, kind, statusId = '') {
    const preserved = statusId && document.getElementById(statusId);
    host.classList.add('an-cinema-loading');
    host.innerHTML = '<div class="an-cinema-image" aria-hidden="true"></div><div class="an-cinema-film" aria-hidden="true"><video muted playsinline preload="none" disablepictureinpicture></video><video muted playsinline preload="none" disablepictureinpicture></video></div><div class="an-cinema-shade" aria-hidden="true"></div><div class="an-cinema-masthead" aria-hidden="true"><span class="an-cinema-mark"><i></i><i></i></span><span>ASFALTO<br>NACIONAL</span><b>1973</b></div><div class="an-loading-card"><p class="an-loading-kicker"></p><h2 class="an-loading-title"></h2><p class="an-loading-caption"></p></div><div class="an-cinema-footer"><span class="an-cinema-chapter"></span><span class="an-cinema-rule" aria-hidden="true"></span><p class="an-loading-stage" role="status" aria-live="polite">Preparando…</p></div><div class="v6-progress" aria-hidden="true"><i></i></div>';
    const brandImage=document.createElement('img');brandImage.src=new URL('../brand/asfalto-nacional-v7.webp',assetRoot).href;brandImage.alt='Asfalto Nacional';brandImage.width=2172;brandImage.height=724;host.querySelector('.an-cinema-masthead').replaceChildren(brandImage);
    if (preserved) {
      host.querySelector('.an-loading-stage').replaceWith(preserved);
      preserved.className = 'an-loading-stage';
    } else if (statusId) host.querySelector('.an-loading-stage').id = statusId;
    const videos = [...host.querySelectorAll('video')];
    const backdrop = host.querySelector('.an-cinema-image');
    let scene, active = 0, running = false, swapTimer = null, stalledTimer = null, longTimer = null, epoch = 0, crossfading = false;
    function clearSwap() { clearTimeout(swapTimer); swapTimer = null; crossfading = false; }
    function release() {
      epoch++; running=false; clearSwap(); clearTimeout(stalledTimer);
      for (const video of videos) { video.pause(); video.classList.remove('is-playing'); if(video.hasAttribute('src')) { video.removeAttribute('src'); video.load(); } }
    }
    function fallback() { release(); host.dataset.media = 'poster'; }
    async function play(index, version) {
      const video=videos[index];
      try {
        await video.play();
        if(version!==epoch || !running) { if(!running) video.pause(); return false; }
        if(video.readyState>=2) { video.classList.add('is-playing'); host.dataset.media='video'; }
        return true;
      } catch { if(version===epoch) fallback(); return false; }
    }
    function start() {
      // Boot immediately hands off to workshop; its poster avoids fetching the same movie twice.
      if(kind==='boot' || running || !scene || stillOnly())return;
      running=true; active=0; const version=++epoch;
      videos[0].src=url(scene.film,'mp4'); videos[0].muted=true;
      // A second decoder is opened only when the first loop is nearly complete.
      void play(0,version);
      stalledTimer=setTimeout(()=>{if(running && !videos.some(v=>v.readyState>=2 && !v.paused)) fallback();},7000);
    }
    function swap() {
      if(!running || crossfading)return;
      const outgoing=active, incoming=1-active, version=epoch;
      crossfading=true;
      const next=videos[incoming];
      if(!next.hasAttribute('src')) next.src=url(scene.film,'mp4');
      next.muted=true; next.currentTime=0;
      void play(incoming,version).then(ok=>{
        if(!ok || version!==epoch)return;
        videos[outgoing].classList.remove('is-playing');
        active=incoming;
        swapTimer=setTimeout(()=>{
          if(version!==epoch)return;
          videos[outgoing].pause(); videos[outgoing].currentTime=0;
          crossfading=false;
        },700);
      });
    }
    videos.forEach((video,index)=>{
      video.muted=true;
      video.addEventListener('timeupdate',()=>{
        if(index===active && running && Number.isFinite(video.duration) && video.duration-video.currentTime<.85) swap();
      });
      video.addEventListener('ended',()=>{if(index===active)swap();});
      video.addEventListener('playing',()=>{
        if(!running) {video.pause();return;}
        clearTimeout(stalledTimer);video.classList.add('is-playing');host.dataset.media='video';
      });
      video.addEventListener('error',()=>{if(running)fallback();});
    });
    const surface = {
      host,kind,
      set(key) {
        const next=scenes[key] || scenes.separator;
        host.querySelector('.an-loading-kicker').textContent=next.region;
        host.querySelector('.an-loading-title').textContent=next.title;
        host.querySelector('.an-loading-caption').textContent=next.line;
        host.querySelector('.an-cinema-chapter').textContent=next.chapter;
        if(scene===next)return;
        release();scene=next;host.dataset.scene=key;host.dataset.media='poster';
        backdrop.style.backgroundImage='url("'+url(next.film,'jpg')+'")';
        clearTimeout(longTimer);delete host.dataset.longWait;
        longTimer=setTimeout(()=>{host.dataset.longWait='true';},18000);
        reconcile();
      },
      stage(text) { const node=host.querySelector('.an-loading-stage');if(node)node.textContent=text; },
      activate(value) { if(value && !stillOnly())start(); else if(running)release(); },
      stop() { release();clearTimeout(longTimer);delete host.dataset.longWait; },
      dispose() { this.stop();surfaces.delete(this); },
    };
    surfaces.add(surface);
    return surface;
  }
  function reconcile() {
    const candidates=[...surfaces].filter(s=>visible(s.host) && !(s.kind==='workshop' && s.host.getAttribute('aria-busy')==='false'));
    let top=null;
    if(!document.hidden && !document.body.classList.contains('an-intro-open')) {
      top=candidates.find(s=>s.kind==='session') || candidates.find(s=>s.kind==='workshop') || candidates[0];
    }
    for(const surface of surfaces) surface.activate(surface===top);
  }
  function sync() {
    const values=[...pending.values()],latest=values.at(-1);
    if(!latest)return;
    const scene=[...values].reverse().find(v=>v.scene)?.scene || 'separator';
    sessionSurface.set(scene); sessionSurface.stage(latest.stage);
    overlay.setAttribute('aria-label',latest.title);
  }
  function cancelExit() {
    clearTimeout(exitTimer);
    if(exitResolve)exitResolve();
    exitResolve=null;exiting=false;
    overlay?.classList.remove('an-cinema-exit');
  }
  function restore() {
    overlay.hidden=true;overlay.setAttribute('aria-busy','false');
    sessionSurface.stop();document.body.classList.remove('an-loading-open');
    for(const [el,inert] of background)if(el.isConnected)el.inert=inert;
    background=[];exiting=false;overlay.classList.remove('an-cinema-exit');
    if(previousFocus?.isConnected && !previousFocus.inert && getComputedStyle(previousFocus).visibility!=='hidden') previousFocus.focus({preventScroll:true});
    reconcile();
  }
  function begin(title='Preparando la salida',stage='Preparando la ruta…',options={}) {
    if(!overlay) {
      overlay=document.createElement('section');overlay.id='an-session-loading';overlay.hidden=true;
      overlay.tabIndex=-1;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
      document.body.append(overlay);sessionSurface=createSurface(overlay,'session');
    }
    const wasExiting=exiting;cancelExit();
    if(!pending.size && !wasExiting) {
      previousFocus=document.activeElement;
      background=[...document.body.children].filter(el=>el!==overlay && el instanceof HTMLElement).map(el=>[el,el.inert]);
      for(const [el] of background)el.inert=true;
      document.body.classList.add('an-loading-open');
    }
    overlay.hidden=false;overlay.setAttribute('aria-busy','true');overlay.focus({preventScroll:true});
    const key={};pending.set(key,{title,stage,scene:options.track||options.scene});sync();reconcile();
    // Yield two paint opportunities before the caller starts expensive scene work.
    const painted=new Promise(resolve=>{
      let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};
      const timer=setTimeout(finish,100);
      requestAnimationFrame(()=>requestAnimationFrame(finish));
    });
    return {
      painted,
      stage(text) {const task=pending.get(key);if(task){task.stage=text;sync();}},
      end() {
        if(!pending.delete(key))return Promise.resolve();
        if(pending.size){sync();return Promise.resolve();}
        exiting=true;overlay.classList.add('an-cinema-exit');
        return new Promise(resolve=>{
          exitResolve=resolve;
          exitTimer=setTimeout(()=>{exitResolve=null;restore();resolve();},reduced()?0:360);
        });
      },
    };
  }
  function workshop(element) {
    for(const s of surfaces)if(s.host===element)s.dispose();
    const surface=createSurface(element,'workshop');surface.set('workshop');
    element.setAttribute('aria-busy','true');
    const observer=new MutationObserver(()=>{
      if(element.getAttribute('aria-busy')==='false')surface.stop();
      reconcile();
    });
    observer.observe(element,{attributes:true,attributeFilter:['class','aria-busy']});
    const update=text=>surface.stage(text);
    update.dispose=()=>{observer.disconnect();surface.dispose();};
    return update;
  }
  function completeBoot({menuReady=false,workshopReady=false,technicalFallback=false}={}) {
    if(!menuReady||(!workshopReady&&!technicalFallback))return false;
    const element=document.getElementById('loading');if(element){element.hidden=true;element.classList.add('hidden');element.setAttribute('aria-busy','false');}
    for(const surface of [...surfaces])if(surface.kind==='boot')surface.dispose();
    reconcile();return true;
  }
  function boot() {
    const element=document.getElementById('loading');
    if(element) {
      const surface=createSurface(element,'boot','loading-text');surface.set('boot');
      const observer=new MutationObserver(()=>{
        if(!visible(element)){surface.dispose();observer.disconnect();}
        reconcile();
      });
      observer.observe(element,{attributes:true,attributeFilter:['class','hidden','style']});
    }
    const observer=new MutationObserver(reconcile);
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    reconcile();
  }
  document.addEventListener('keydown',event=>{
    if((pending.size||exiting) && !document.body.classList.contains('an-intro-open')) {
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  document.addEventListener('visibilitychange',reconcile);
  motion.addEventListener('change',reconcile);
  window.addEventListener('pagehide',()=>{for(const s of surfaces)s.stop();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  globalThis.__asfaltoLoading=Object.freeze({begin,workshop,completeBoot,scenes,
    diagnostics:()=>({pending:pending.size,exiting,surfaces:[...surfaces].map(s=>({kind:s.kind,scene:s.host.dataset.scene,media:s.host.dataset.media,visible:visible(s.host)}))}),
  });
})();


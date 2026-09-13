import { createRoutePreviewLoader } from './route-preview-loader.mjs';
import { selectRoutePhoto } from './v7-route-catalog.mjs';
import { routePreviewKey, testCollectionSummary } from './menu-refinement-state.mjs';

export function mountMenuRefinements({root,game}) {
  let catalog=null, disposed=false;
  const catalogRequest=new AbortController();
  const views=[];
  const asset = name => new URL(`../../assets/menu/game-captures/${name}`, import.meta.url).href;
  const title = select => select?.selectedOptions?.[0]?.textContent || '';
  for(const [panelId,trackId,skyId,weatherId] of [
    ['#v6-drive-panel','#v6-drive-route','#v6-drive-sky','#v6-drive-weather'],
    ['#v6-competition-panel','#v6-comp-track','#v6-comp-sky','#v6-comp-weather']]) {
    const panel=root.querySelector(panelId), node=document.createElement('figure');
    node.className='an-route-preview';
    node.innerHTML='<img alt="" hidden decoding="async"><div class="an-route-placeholder" aria-hidden="true">Vista de la ruta</div><div class="an-route-miniature"></div><figcaption><strong></strong><span role="status"></span></figcaption>';
    panel.querySelector('.v6-button-row').before(node);
    const view={node,panel,track:root.querySelector(trackId),sky:root.querySelector(skyId),weather:root.querySelector(weatherId)};
    view.loader=createRoutePreviewLoader({onState(state){
      const img=node.querySelector('img');img.hidden=state.status!=='ready';node.dataset.photoMatch=state.status==='ready'?'exact':state.status;
      node.setAttribute('aria-busy',String(state.status==='loading'));node.querySelector('.an-route-placeholder').hidden=state.status==='ready';
      if(state.source){img.src=state.source;img.dataset.key=state.key;}else{img.removeAttribute('src');delete img.dataset.key;}
      const selection=`${title(view.sky)} · ${title(view.weather)}`;
      img.alt=`${title(view.track)} · ${selection}`;
      node.querySelector('figcaption span').textContent=state.status==='ready'?selection:state.status==='loading'?`Cargando vista · ${selection}`:state.status==='error'?'No se pudo cargar la vista de esta selección.':`${selection} · Vista no disponible`;
    }});views.push(view);
  }
  const appearance=root.querySelector('[data-workshop-page="appearance"]');
  const fold=document.createElement('button'); fold.type='button';fold.className='an-appearance-fold';fold.textContent='Ocultar ajustes · ver el auto';fold.setAttribute('aria-expanded','true');
  appearance.prepend(fold);
  fold.addEventListener('click',()=>{const collapsed=root.dataset.anAppearanceFolded!=='true';root.dataset.anAppearanceFolded=String(collapsed);fold.setAttribute('aria-expanded',String(!collapsed));fold.textContent=collapsed?'Mostrar ajustes de apariencia':'Ocultar ajustes · ver el auto';});

  const book=document.createElement('details');book.className='an-test-collection';
  book.innerHTML='<summary>Cuaderno de pruebas <span></span></summary><div><p class="an-book-kicker">ASFALTO NACIONAL / ROAD TEST</p><h3></h3><p class="an-book-stats"></p><progress max="12" value="0" aria-label="Pruebas con ficha válida"></progress><ol></ol></div>';
  root.querySelector('#v6-roadtest-panel').append(book);
  function refresh() {
    for (const {node,panel,track,sky,weather,loader} of views) {
      const visible=root.dataset.anView==='section'&&panel.classList.contains('v6-active')&&!(panel.id==='v6-drive-panel'&&root.dataset.anStep==='modes')&&!document.hidden;
      if(!visible){loader.suspend();continue;}
      const key=routePreviewKey(track.value,sky.value,weather.value),photo=selectRoutePhoto(catalog,track.value,sky.value,weather.value);
      node.querySelector('strong').textContent=title(track);
      void loader.select(key,photo?asset(photo.record.file):null);
      const map=node.querySelector('.an-route-miniature'), route=catalog?.routes?.[track.value];
      if(route&&map.dataset.track!==track.value) {
        map.dataset.track=track.value;map.replaceChildren();
        const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 240 140');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Tramo de referencia y salida de ${title(track)}. ${route.caveat||'Trazado adaptado del juego; no es un mapa GPS.'}`);
        const line=document.createElementNS(ns,'polyline');line.setAttribute('points',route.mapPoints.map(p=>p.join(',')).join(' '));svg.append(line);
        const start=route.mapPoints[0],dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',start[0]);dot.setAttribute('cy',start[1]);dot.setAttribute('r','4');svg.append(dot);
        const label=document.createElementNS(ns,'text');label.setAttribute('x','12');label.setAttribute('y','130');label.textContent='● SALIDA';svg.append(label);map.append(svg);const caveat=document.createElement('small');caveat.className='an-route-map-note';caveat.textContent='Tramo original · trazado adaptado';caveat.title=route.caveat||'No es un mapa GPS';map.append(caveat);
      }
    }
    const profile=game.profile(), ids=[...root.querySelectorAll('#v6-test-cards [data-test-id]')].map(c=>c.dataset.testId);
    const vehicleClass=Object.values(profile.parts||{}).includes('restomod')||['restomod','modern'].includes(profile.appearance?.wheel)||profile.appearance?.tire==='modern'?'Restomod':'Histórica';
    const summary=testCollectionSummary(profile.sheets,ids,vehicleClass);
    book.dataset.complete=String(summary.finished);book.querySelector('summary span').textContent=`${summary.completed} / ${summary.total}`;
    book.querySelector('h3').textContent=summary.finished?'Cuaderno completo. Dejaste tu marca.':'Cada ficha cuenta una historia.';
    book.querySelector('.an-book-stats').textContent=`${vehicleClass} · ${summary.attempts} intentos · ${summary.validAttempts} fichas válidas`;
    Object.assign(book.querySelector('progress'),{max:summary.total||1,value:summary.completed});
    const list=book.querySelector('ol');list.replaceChildren();
    for(const entry of summary.entries){const li=document.createElement('li'),card=root.querySelector(`[data-test-id="${entry.testId}"]`);li.textContent=`${entry.best?'✓':'○'} ${card?.querySelector('h3')?.textContent||entry.testId}`;list.append(li);}
  }
  const observer=new MutationObserver(refresh);observer.observe(root.querySelector('#v6-test-cards'),{childList:true});
  root.addEventListener('change',refresh);root.addEventListener('click',refresh);document.addEventListener('visibilitychange',refresh);
  fetch(asset('index.json'),{signal:catalogRequest.signal}).then(r=>{if(!r.ok)throw new Error('No se pudo cargar la vista de rutas');return r.json();}).then(data=>{if(!disposed){catalog=data;refresh();}}).catch(error=>{if(!disposed)for(const v of views)v.node.querySelector('figcaption span').textContent=error.message;});
  refresh();
  return {refresh,dispose(){disposed=true;catalogRequest.abort();for(const view of views)view.loader.dispose();document.removeEventListener('visibilitychange',refresh);observer.disconnect();root.removeEventListener('change',refresh);root.removeEventListener('click',refresh);}};
}

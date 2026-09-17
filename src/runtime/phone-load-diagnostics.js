/* Runs before the module graph so an interrupted load can be reported after a process restart. */
(()=>{
 const phone=/iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent)||((navigator.maxTouchPoints||0)>0&&Math.min(screen.width,screen.height)<600);
 if(!phone)return;
 const key='asfalto-phone-load-r2',build='body-r3-20260916';let current=null,previous=null,sequence=0;
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&['loading','failed'].includes(saved.status))previous=saved;}catch{}
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(current));}catch{}};
 const api={
  begin(){const token=++sequence;current={build,token,status:'loading',stage:'Preparando la salida',at:new Date().toISOString(),history:[]};persist();return token;},
  stage(label,token=current?.token){if(current?.status!=='loading'||token!==current.token)return;const text=String(label).slice(0,180);if(current.stage!==text){current.stage=text;current.history.push(text);current.history=current.history.slice(-12);}persist();},
  finish(success,token=current?.token){if(!current||token!==current.token)return;current.status=success?'ready':'failed';persist();},
  snapshot(){return JSON.parse(JSON.stringify({build,current,previous}));}
 };
 globalThis.__asfaltoPhoneLoad=Object.freeze(api);
 addEventListener('error',()=>api.stage('Error del navegador durante: '+(current?.stage||'carga')));
 addEventListener('unhandledrejection',()=>api.stage('Promesa rechazada durante: '+(current?.stage||'carga')));
 function showPrevious(){
  if(!previous)return;
  const panel=document.createElement('aside');panel.id='an-phone-load-recovery';panel.setAttribute('role','status');
  panel.style.cssText='position:fixed;z-index:2147483647;left:12px;right:12px;top:max(12px,env(safe-area-inset-top));max-width:560px;margin:auto;padding:16px;background:#171b20;color:#fff;border:1px solid #d6a963;border-radius:12px;font:14px/1.4 system-ui;box-shadow:0 8px 35px #0009';
  const title=document.createElement('strong');title.textContent='La carga anterior quedó incompleta';
  const text=document.createElement('p');text.textContent='Última etapa: '+String(previous.stage||'inicio').slice(0,180)+'. Código: '+String(previous.build||'anterior').slice(0,40)+'.';
  const copy=document.createElement('button');copy.textContent='Copiar diagnóstico';copy.style.cssText='min-height:44px;margin-right:8px';
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify({build,previous}));copy.textContent='Copiado';}catch{copy.textContent='Copiá la última etapa indicada arriba';}};
  const dismiss=document.createElement('button');dismiss.textContent='Cerrar';dismiss.style.minHeight='44px';dismiss.onclick=()=>panel.remove();
  panel.append(title,text,copy,dismiss);document.body.append(panel);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showPrevious,{once:true});else showPrevious();
})();

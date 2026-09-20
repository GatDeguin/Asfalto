(()=>{
 const held=new Map();
 globalThis.__asfaltoModalInert={acquire(elements){
  const owned=[...elements];for(const element of owned){const state=held.get(element)||{count:0,inert:element.inert};state.count++;held.set(element,state);element.inert=true;}
  let released=false;return()=>{if(released)return;released=true;for(const element of owned){const state=held.get(element);if(!state)continue;if(--state.count===0){element.inert=state.inert;held.delete(element);}}};
 }};
})();

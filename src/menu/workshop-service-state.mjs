const finish = new Set(['body','paint','dirt']);
const actions = {fuel:'Repostar',oil:'Cambiar aceite',tires:'Cambiar neumáticos',dirt:'Lavar',paint:'Repintar',body:'Reparar chapa'};
export function workshopServicePresentation(state,{busy=false}={}) {
  return {
    vehicleId:state?.vehicleId||null,available:!!state,canDrive:state?.canDrive===true,
    faults:(state?.faults||[]).map(fault=>fault.label),
    services:(state?.services||[]).map(service=>{
      const value=Math.round(Math.max(0,Math.min(100,Number(service.condition)||0)));
      return {...service,value,group:finish.has(service.id)?'finish':'mechanical',
        severity:value<50?'bad':value<78?'warn':'ok',
        disabled:busy||!service.available,
        action:actions[service.id]||'Reparar',
        costLabel:service.cost===0?(service.id==='dirt'?'Sin cargo':'Asistencia sin cargo'):`${service.cost} ${service.cost===1?'ficha':'fichas'}`};
    }),
  };
}

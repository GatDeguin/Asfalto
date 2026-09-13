import test from 'node:test';import assert from 'node:assert/strict';
import * as service from '../src/menu/workshop-service-state.mjs';
test('diagnosis presents authoritative terminal faults and makes assistance actionable',()=>{
 assert.equal(typeof service.workshopServicePresentation,'function');
 const state=service.workshopServicePresentation({vehicleId:'chevy',canDrive:false,faults:[{id:'fuel',label:'Sin combustible'}],condition:{fuel:0},services:[{id:'fuel',label:'Combustible',condition:0,cost:0,available:true}]});
 assert.equal(state.canDrive,false);assert.equal(state.faults[0],'Sin combustible');assert.equal(state.services[0].disabled,false);assert.equal(state.services[0].costLabel,'Asistencia sin cargo');
});
test('wash meter uses service cleanliness and never changes body diagnostics',()=>{
 const input={vehicleId:'chevy',canDrive:true,condition:{body:30,dirt:80},faults:[],services:[{id:'body',label:'Chapa',condition:30,cost:2,available:true},{id:'dirt',label:'Lavado',condition:20,cost:0,available:true}]};
 const view=service.workshopServicePresentation(input);
 assert.equal(view.services.find(s=>s.id==='body').value,30);assert.equal(view.services.find(s=>s.id==='dirt').value,20);
 assert.equal(input.condition.body,30);assert.equal(view.services.find(s=>s.id==='dirt').group,'finish');
});
test('busy or unaffordable services cannot submit, while unsupported service data is not invented',()=>{
 const data={canDrive:true,services:[{id:'engine',label:'Motor',condition:40,cost:2,available:false}],faults:[]};
 assert.equal(service.workshopServicePresentation(data).services[0].disabled,true);
 assert.equal(service.workshopServicePresentation({...data,services:[{...data.services[0],available:true}]},{busy:true}).services[0].disabled,true);
 assert.deepEqual(service.workshopServicePresentation(null).services,[]);
});

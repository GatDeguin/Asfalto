import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('race startup snapshots typed contact storage as independent immutable arrays', () => {
  const source=fs.readFileSync(new URL('../src/legacy/asfalto-v6-integration-runtime.js?v=36c7b7d2619c02c2',import.meta.url),'utf8');
  const start=source.indexOf('    const initialWheelContacts = Object.freeze(');
  const end=source.indexOf('    const falconSpawn =',start);
  assert.ok(start>=0&&end>start,'actual browser-stack startup boundary exists');
  const buffer=new Float64Array(24);
  const contacts=Array.from({length:4},(_,i)=>{
    const point=buffer.subarray(i*6,i*6+3),normal=buffer.subarray(i*6+3,i*6+6);
    point.set([i,2,3]);normal.set([0,1,0]);return {point,normal};
  });
  const lanes={contact:new Uint8Array([1,0,1,0]),compressionM:new Float64Array([.12,0,.08,0])};
  const session={wheels:[{id:'frontLeft'},{id:'frontRight'},{id:'rearLeft'},{id:'rearRight'}],scratch:{contactData:lanes},_collectContacts(){return {contacts};}};
  const snapshot=vm.runInNewContext(source.slice(start,end)+'\ninitialWheelContacts;', {physicsSession:session});
  assert.ok(Object.isFrozen(snapshot));
  for(let i=0;i<4;i++){
    const row=snapshot[i];
    assert.equal(row.contact,lanes.contact[i]!==0);
    assert.equal(row.compressionM,lanes.compressionM[i]);
    assert.ok(Array.isArray(row.point));assert.ok(Array.isArray(row.normal));
    assert.ok(Object.isFrozen(row));assert.ok(Object.isFrozen(row.point));assert.ok(Object.isFrozen(row.normal));
    assert.equal(row.point[0],i);assert.equal(row.normal[1],1);
  }
  buffer.fill(9);lanes.compressionM.fill(0);lanes.contact.fill(0);
  assert.equal(snapshot[0].point[0],0);assert.equal(snapshot[0].normal[1],1);
  assert.equal(snapshot[0].compressionM,.12);assert.equal(snapshot[0].contact,true);
});


test('circuit selection preserves the original failure for the retry dialog', async () => {
  const source=fs.readFileSync(new URL('../src/legacy/v6-complete-runtime.js?v=83c61639e40554d5',import.meta.url),'utf8');
  const start=source.indexOf('async function configureExistingGameReady('),end=source.indexOf('\nfunction persistPlayableRoute',start);
  assert.ok(start>=0&&end>start);
  const error=new Error('physics contact initialization failed');
  const cockpit={raceGetState:()=>({track:{id:'dos_lagos'}}),raceSelectCircuit:async()=>{throw error;}};
  const context={profile:{lastSky:'clear'},workshop:{},DOMException,
    waitForExistingGameReady:async()=>cockpit,persistedTrack:id=>id,normalizeTrack:id=>id,
    reflectValue(){},toast(){}};
  const configure=vm.runInNewContext(source.slice(start,end)+'\nconfigureExistingGameReady;',context);
  const tx={isCurrent:()=>true,stage(){},wait:promise=>promise,signal:new AbortController().signal};
  await assert.rejects(configure({track:'cuesta_lipan',weather:'clear',mode:'practice',laps:1,difficulty:'normal'},tx),failure=>failure===error);
});


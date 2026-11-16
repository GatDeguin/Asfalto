import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChampionshipClassificationLedger } from '../src/game/championship-classification.mjs';
import { buildActivityReceipt, createActivityRewardStore, getActivityRouteAwards } from '../src/menu/activity-rewards.mjs?v=7736130247585143';
import { getEarnedDisplayItems } from '../src/menu/v7-earned-collection.mjs?v=7838748e05ba9177';

const session = { resultId: 'activity-1', sessionSequence: 17, type: 'journey', trackId: 'dos_lagos', vehicleId: 'chevy', class: 'Histórica', startedAt: '2026-11-10T10:00:00.000Z' };
const observation = { qa: false, sessionSequence: 17 };
const race = { status: 'FINISHED', finishReason: 'completed', completedLaps: 1, raceProgress: 1200, totalTime: 24, track: { id: 'dos_lagos', length: 1200 } };
const context = { observation, race, finishedAt: '2026-11-10T10:01:00.000Z', maxSpeed: 92 };
const testRace = { length: 1200, checkpoints: [1200], widthAt: () => 10, shoulder: 1, closed: false };
function finalClassification({playerWins}) {
  const ledger = createChampionshipClassificationLedger({ track: testRace, laps: 1 });
  const movement = { previous: { raceProgress: 1199, lateral: 0, headingError: 0 }, current: { raceProgress: 1200, lateral: 0, headingError: 0 } };
  const winner = playerWins ? 'player' : 'falcon';
  const runnerUp = playerWins ? 'falcon' : 'player';
  ledger.advance({ [winner]: movement });
  ledger.advance({ [runnerUp]: movement });
  return ledger.getFinalClassification();
}

function storeFixture() {
  let current = { xp: 0, level: 1, workshopTokens: 100, axes: {}, unlocked: [] };
  let disk = JSON.stringify(current), failAfterWrite = false;
  const storage = {
    getItemPersistent: () => disk,
    setItemPersistent(_key, value) { disk = value; if (failAfterWrite) throw new Error('uncertain write'); },
  };
  const create = () => createActivityRewardStore({ storage, getProfile: () => current, replaceProfile: value => { current = value; }, withLock: fn => Promise.resolve().then(fn) });
  return { create, current: () => current, reload: () => { current = JSON.parse(disk); }, fail: value => { failAfterWrite = value; } };
}

test('a finished journey awards fichas and records its route once across retries and reload', async () => {
  const receipt = buildActivityReceipt(session, context);
  const f = storeFixture(), store = f.create();
  const [saved, duplicate] = await Promise.all([store.accept(receipt), store.accept(receipt)]);
  assert.equal(saved.tokensAwarded, 3);
  assert.equal(duplicate.changed, false);
  f.reload();
  assert.equal((await f.create().accept(receipt)).changed, false);
  assert.equal(f.current().workshopTokens, 103);
  assert.equal(f.current().journey.km, 1.2);
  assert.equal(f.current().journey.routes.length, 1);
});

test('only an authoritative win grants race fichas and a visible route trophy', async () => {
  const f = storeFixture(), store = f.create();
  const sprint = { ...session, type: 'competition', competitionId: 'sprint', mode: 'race' };
  const lost = buildActivityReceipt(sprint, { ...context, final: finalClassification({playerWins:false}) });
  assert.equal((await store.accept(lost)).tokensAwarded, 0);
  assert.deepEqual(getActivityRouteAwards(f.current()), []);
  const won = buildActivityReceipt({ ...sprint, resultId: 'activity-2', sessionSequence: 18 }, { ...context, observation: { ...observation, sessionSequence: 18 }, final: finalClassification({playerWins:true}) });
  assert.equal((await store.accept(won)).tokensAwarded, 5);
  assert.equal(f.current().championship.wins, 1);
  assert.deepEqual(getActivityRouteAwards(f.current()).map(award => award.id), ['route:dos_lagos']);
  assert.deepEqual(getEarnedDisplayItems(f.current()).map(award => award.id), ['route:dos_lagos']);
});

test('QA, stale sessions, incomplete journeys and unclassified races cannot yield a receipt', () => {
  assert.equal(buildActivityReceipt(session, { ...context, observation: { ...observation, qa: true } }), null);
  assert.equal(buildActivityReceipt(session, { ...context, observation: { ...observation, sessionSequence: 18 } }), null);
  assert.equal(buildActivityReceipt(session, { ...context, race: { ...race, completedLaps: 0, raceProgress: 1199 } }), null);
  assert.equal(buildActivityReceipt({ ...session, type:'competition', competitionId:'sprint', mode:'race' }, context), null);
});

test('an uncertain write recovers its original result without adding more fichas', async () => {
  const receipt = buildActivityReceipt(session, context), f = storeFixture(), store = f.create();
  f.fail(true);
  await assert.rejects(store.accept(receipt), /uncertain write/);
  assert.equal(f.current().workshopTokens, 100);
  f.fail(false);
  const recovered = await store.accept(receipt);
  assert.equal(recovered.changed, false);
  assert.equal(recovered.tokensAwarded, 3);
  assert.equal(f.current().workshopTokens, 103);
});

test('a speed trap archives the measured speed and solo rewards without a podium', async () => {
  const f = storeFixture();
  const drag = { ...session, type: 'competition', competitionId: 'drag', mode: 'speedTrap' };
  assert.equal(buildActivityReceipt(drag, context), null);
  const measured = { ...race, status: 'RUNNING', finishReason: null, raceProgress: 525, speedTrap: { attempts: 1, bestKmh: 91 } };
  const receipt = buildActivityReceipt(drag, { ...context, race: measured });
  assert.equal((await f.create().accept(receipt)).tokensAwarded, 2);
  assert.equal(f.current().championship.wins, 0);
  assert.match(f.current().history[0].copy, /91\.0 km\/h/);
  assert.deepEqual(getActivityRouteAwards(f.current()), []);
});

test('a timed sector archives the measured sector time instead of the total session time', async () => {
  const f = storeFixture();
  const club = { ...session, type: 'competition', competitionId: 'club', mode: 'sectors' };
  const measured = { ...race, status: 'RUNNING', finishReason: null, raceProgress: 100, sectorPractice: { completed: 1, lastTime: 12.625 } };
  const receipt = buildActivityReceipt(club, { ...context, race: measured });
  await f.create().accept(receipt);
  assert.match(f.current().history[0].copy, /12\.625 s/);
  assert.doesNotMatch(f.current().history[0].copy, /24\.000 s/);
});

const offers = [
  ['sprint','race'], ['regularity','timeTrial'], ['circuit','race'], ['timetrial','timeTrial'],
  ['drag','speedTrap'], ['endurance','race'], ['club','sectors'],
];
for (const [competitionId,mode] of offers) {
  for (const vehicleClass of ['Histórica','Restomod']) test(`${competitionId} in ${vehicleClass} archives just the completed, eligible objective`, async () => {
    const f=storeFixture(),store=f.create(),isDuel=mode==='race';
    const entry={...session,type:'competition',competitionId,mode,class:vehicleClass};
    const measured=mode==='speedTrap'?{...race,status:'RUNNING',speedTrap:{attempts:1,bestKmh:111.4}}
      :mode==='sectors'?{...race,status:'RUNNING',sectorPractice:{completed:1,lastTime:9.75}}:race;
    const eligible={...context,race:measured,final:isDuel?finalClassification({playerWins:true}):null};
    const receipt=buildActivityReceipt(entry,eligible);
    assert.equal(receipt.class,vehicleClass);
    assert.equal((await store.accept(receipt)).tokensAwarded,isDuel?5:2);
    assert.equal((await store.accept(receipt)).changed,false);
    assert.equal(f.current().championship.events,1);
    assert.deepEqual(getActivityRouteAwards(f.current()).map(award=>award.id),isDuel?['route:dos_lagos']:[]);
    assert.equal(buildActivityReceipt(entry,{...eligible,valid:false}),null);
    assert.equal(buildActivityReceipt(entry,{...eligible,qaMode:true}),null);
    assert.equal(buildActivityReceipt(entry,{...eligible,race:{...race,status:'RUNNING',finishReason:null,completedLaps:0,raceProgress:100}}),null);
  });
}

test('routes without authored trap bounds still register a physical speed pass', () => {
  const source = readFileSync(new URL('../src/legacy/module-02.mjs?v=e807578253162ca5', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('    _updateSpeedTrap('), source.indexOf('    _recordGhost('));
  const update = new Function(`return ({${method}})._updateSpeedTrap;`)();
  const trap = { active: false, peakMps: 0, attempts: 0, bestKmh: 0 };
  const rules = { settings: { mode: 'speedTrap' }, track: { length: 6000, closed: false, speedTrap: {} }, state: { speedTrap: trap }, _event() {} };
  update.call(rules, 399, 401, 20);
  update.call(rules, 499, 501, 25);
  assert.equal(trap.attempts, 1);
  assert.equal(trap.bestKmh, 90);
});

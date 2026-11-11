import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BakeWorkerClient} from '../src/tracks/visuals/bake-worker-client.mjs?v=54c0901e0a5b221d';

test('a superseded bake cannot publish or clear the current bake', async () => {
  const jobs = [];
  const pool = {run(kind, {id}, {signal}) {
    assert.equal(kind, 'bake');
    return new Promise(resolve => jobs.push({id, signal, resolve}));
  }};
  const client = new BakeWorkerClient({pool});
  const first = client.load('dos_lagos');
  const second = client.load('cuesta_lipan');
  const response = id => ({payload: {id, entries: []}, stats: {}, sentAt: performance.timeOrigin + performance.now()});
  assert.equal(jobs[0].signal.aborted, true);
  jobs[0].resolve(response('dos_lagos'));
  await assert.rejects(first, {name: 'AbortError'});
  assert.ok(client.active);
  jobs[1].resolve(response('cuesta_lipan'));
  assert.equal((await second).payload.id, 'cuesta_lipan');
  assert.equal(client.active, null);
});

test('abort and worker failure clear the client; malformed responses never install', async () => {
  const abort = new AbortController();
  const error = new Error('worker failed');
  const client = new BakeWorkerClient({pool: {run: async () => { throw error; }}});
  abort.abort();
  await assert.rejects(client.load('dos_lagos', abort.signal), {name: 'AbortError'});
  await assert.rejects(client.load('dos_lagos'), error);
  assert.equal(client.active, null);
  client.pool = {run: async () => ({payload: {id: 'cuesta_lipan', entries: []}})};
  await assert.rejects(client.load('dos_lagos'), /response schema/);
  assert.equal(client.active, null);
});

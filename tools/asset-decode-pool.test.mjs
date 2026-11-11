import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gzipSync} from 'node:zlib';
import {AssetDecodePool, AssetWorkerError} from '../src/runtime/asset-decode-pool.mjs?v=1be266bf7b1e2d93';
import {GZIP_PAYLOAD_OFFSET} from '../src/runtime/gzip-kernel.mjs?v=7cef6073fc46cbf3';

class TestWorker {
  static workers = [];

  constructor() {
    TestWorker.workers.push(this);
  }

  postMessage(message, transfers) {
    this.message = message;
    this.transfers = transfers;
  }

  terminate() { this.terminated = true; }

  respond(result = {}) {
    this.onmessage?.({data: {requestId: this.message.requestId, ok: true, result}});
  }
}

const bytes = Uint8Array.from(gzipSync('asfalto'));
const gzip = {bytes, size: 7};

test('two workers run independently and a queued route bake precedes decorative bytes', async () => {
  const pool = new AssetDecodePool({WorkerClass: TestWorker, maxWorkers: 2, shared: false});
  try {
    const first = pool.run('gzip', gzip);
    const second = pool.run('gzip', gzip);
    const pendingArt = pool.run('gzip', gzip);
    const route = pool.run('bake', {id: 'dos_lagos'});
    const [left, right] = TestWorker.workers.slice(-2);
    assert.equal(pool.diagnostics().active, 2);
    assert.equal(pool.diagnostics().queued, 2);
    assert.equal(left.message.kind, 'gzip');
    assert.equal(left.transfers[0], left.message.data.buffer);
    assert.notEqual(left.message.data.buffer, bytes.buffer);
    assert.equal(left.message.control, null);
    left.respond({value: 'left'});
    assert.deepEqual(await first, {value: 'left'});
    assert.equal(left.message.kind, 'bake');
    left.respond({value: 'bake'});
    assert.deepEqual(await route, {value: 'bake'});
    assert.equal(left.message.kind, 'gzip');
    left.respond();
    right.respond();
    await Promise.all([pendingArt, second]);
    assert.equal(pool.diagnostics().peakActive, 2);
    assert.equal(pool.diagnostics().queued, 0);
  } finally { pool.close(); }
});

test('abort invalidates shared work and a late result cannot settle its replacement', async () => {
  const pool = new AssetDecodePool({WorkerClass: TestWorker, maxWorkers: 1, shared: true});
  try {
    const controller = new AbortController();
    const first = pool.run('gzip', gzip, {signal: controller.signal});
    const old = TestWorker.workers.at(-1);
    const stale = old.onmessage, staleId = old.message.requestId;
    const {memory, length} = old.message.data;
    assert.ok(memory.buffer instanceof SharedArrayBuffer);
    assert.deepEqual(new Uint8Array(memory.buffer, GZIP_PAYLOAD_OFFSET, length), bytes);
    assert.equal(old.transfers.length, 0);
    const queuedAbort = new AbortController();
    const queued = pool.run('bake', {id: 'never'}, {signal: queuedAbort.signal});
    const next = pool.run('bake', {id: 'next'});
    queuedAbort.abort();
    controller.abort();
    await assert.rejects(queued, {name: 'AbortError'});
    await assert.rejects(first, {name: 'AbortError'});
    assert.equal(Atomics.load(old.message.control, 0), 1);
    assert.equal(old.terminated, true);
    stale({data: {requestId: staleId, ok: true, result: {invalid: true}}});
    const replacement = TestWorker.workers.at(-1);
    assert.notEqual(replacement, old);
    assert.equal(replacement.message.data.id, 'next');
    replacement.respond({id: 'next'});
    assert.deepEqual(await next, {id: 'next'});
    assert.equal(pool.diagnostics().cancelled, 2);
  } finally { pool.close(); }
});

test('worker startup failure, timeout and close settle all jobs', async () => {
  class Broken { constructor() { throw new Error('start denied'); } }
  const denied = new AssetDecodePool({WorkerClass: Broken});
  await assert.rejects(denied.run('gzip', gzip), AssetWorkerError);
  denied.close();
  const pool = new AssetDecodePool({WorkerClass: TestWorker, maxWorkers: 1, timeoutMs: 12});
  await assert.rejects(pool.run('gzip', gzip), /timeout/);
  assert.equal(TestWorker.workers.at(-1).terminated, true);
  const active = pool.run('bake', {id: 'a'});
  const queued = pool.run('bake', {id: 'b'});
  pool.close();
  await assert.rejects(active, {name: 'AbortError'});
  await assert.rejects(queued, {name: 'AbortError'});
  assert.equal(pool.diagnostics().workers, 0);
});

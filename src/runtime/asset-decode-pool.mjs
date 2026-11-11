import {createGzipMemory, GZIP_PAYLOAD_OFFSET} from './gzip-kernel.mjs?v=7cef6073fc46cbf3';

const abortError = () => new DOMException('Carga de recursos cancelada.', 'AbortError');
const lowMemoryDevice = () => (globalThis.navigator?.hardwareConcurrency ?? 4) < 4
  || (globalThis.navigator?.deviceMemory ?? 8) <= 4;

export class AssetWorkerError extends Error {}

export class AssetDecodePool {
  #queue = [];
  #lanes;
  #sequence = 0;
  #closed = false;
  #stats = {started: 0, completed: 0, cancelled: 0, failed: 0, peakActive: 0, workerStarts: 0};
  #recent = [];

  constructor({WorkerClass = globalThis.Worker, maxWorkers = lowMemoryDevice() ? 1 : 2,
    shared = globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer === 'function',
    timeoutMs = 60_000, idleMs = 1500,
    url = new URL('./asset-decode-worker.mjs?v=57e75c926697a5ec', import.meta.url)} = {}) {
    this.WorkerClass = WorkerClass;
    this.shared = shared;
    this.timeoutMs = timeoutMs;
    this.idleMs = idleMs;
    this.url = url;
    this.#lanes = Array.from({length: maxWorkers}, (_, id) => ({id, worker: null, job: null, idle: null}));
  }

  run(kind, data, {signal, transfers = []} = {}) {
    if (signal?.aborted || this.#closed) return Promise.reject(signal?.reason ?? abortError());
    if (typeof this.WorkerClass !== 'function') return Promise.reject(new AssetWorkerError('Asset worker unavailable.'));
    if (this.#queue.length >= 32) return Promise.reject(new Error('Cola de recursos llena.'));
    return new Promise((resolve, reject) => {
      const job = {requestId: ++this.#sequence, kind, data, signal, transfers, resolve, reject};
      job.abort = () => this.#settle(job, signal?.reason ?? abortError(), null, true, true);
      signal?.addEventListener('abort', job.abort, {once: true});
      job.timer = setTimeout(() => this.#settle(job, new Error('Asset worker timeout.'), null, true), this.timeoutMs);
      this.#queue.push(job);
      this.#dispatch();
    });
  }

  diagnostics() {
    return {...this.#stats, queued: this.#queue.length, limit: this.#lanes.length, shared: this.shared,
      active: this.#lanes.filter(lane => lane.job).length, workers: this.#lanes.filter(lane => lane.worker).length,
      recent: this.#recent.map(job => ({...job}))};
  }

  close() {
    this.#closed = true;
    const jobs = [...this.#queue, ...this.#lanes.flatMap(lane => lane.job ? [lane.job] : [])];
    for (const job of jobs) job.abort();
    for (const lane of this.#lanes) this.#terminate(lane);
  }

  #terminate(lane) {
    clearTimeout(lane.idle);
    lane.idle = null;
    if (!lane.worker) return;
    lane.worker.onmessage = lane.worker.onerror = lane.worker.onmessageerror = null;
    lane.worker.terminate();
    lane.worker = null;
  }

  #worker(lane) {
    if (lane.worker) return lane.worker;
    const worker = new this.WorkerClass(this.url, {type: 'module', name: 'asfalto-asset-' + lane.id});
    lane.worker = worker;
    this.#stats.workerStarts++;
    worker.onmessage = ({data}) => {
      const job = lane.job;
      if (lane.worker !== worker || !job || data?.requestId !== job.requestId) return;
      const error = data.ok ? null : new Error(data.error || 'No se pudo decodificar el recurso.');
      this.#settle(job, error, data.result);
    };
    const fail = message => {
      if (lane.worker !== worker) return;
      if (lane.job) this.#settle(lane.job, new AssetWorkerError(message), null, true);
      else this.#terminate(lane);
    };
    worker.onerror = event => { event.preventDefault?.(); fail(event.message || 'Falló el worker de recursos.'); };
    worker.onmessageerror = () => fail('Respuesta del worker ilegible.');
    return worker;
  }

  #post(worker, job) {
    const {requestId, kind, control, data} = job;
    if (kind !== 'gzip') {
      worker.postMessage({requestId, kind, control, data}, job.transfers);
      return;
    }
    const {bytes, size} = data;
    if (this.shared) {
      try {
        const memory = createGzipMemory(bytes.byteLength, size, true);
        new Uint8Array(memory.buffer, GZIP_PAYLOAD_OFFSET, bytes.byteLength).set(bytes);
        worker.postMessage({requestId, kind, control, data: {memory, length: bytes.byteLength, size}}, []);
        return;
      } catch (error) {
        if (!(error instanceof RangeError) && error?.name !== 'DataCloneError') throw error;
      }
    }
    const buffer = new Uint8Array(bytes).buffer;
    worker.postMessage({requestId, kind, control, data: {buffer, size}}, [buffer]);
  }

  #dispatch() {
    if (this.#closed) return;
    for (const lane of this.#lanes) {
      if (lane.job || this.#queue.length === 0) continue;
      const priority = this.#queue.findIndex(job => job.kind !== 'gzip');
      const [job] = this.#queue.splice(Math.max(0, priority), 1);
      clearTimeout(lane.idle);
      lane.job = job;
      job.lane = lane;
      this.#stats.started++;
      this.#stats.peakActive = Math.max(this.#stats.peakActive, this.#lanes.filter(item => item.job).length);
      try {
        job.control = this.shared ? new Int32Array(new SharedArrayBuffer(4)) : null;
        this.#post(this.#worker(lane), job);
      } catch (error) {
        this.#settle(job, new AssetWorkerError(error?.message || 'No se pudo iniciar el worker.', {cause: error}), null, true);
      }
    }
  }

  #settle(job, error, result, discard = false, cancelled = false) {
    if (job.done) return;
    job.done = true;
    clearTimeout(job.timer);
    job.signal?.removeEventListener('abort', job.abort);
    if (discard && job.control) Atomics.store(job.control, 0, 1);
    const lane = job.lane;
    if (lane) {
      lane.job = null;
      if (discard) this.#terminate(lane);
      else lane.idle = setTimeout(() => this.#terminate(lane), this.idleMs);
    } else {
      const index = this.#queue.indexOf(job);
      if (index !== -1) this.#queue.splice(index, 1);
    }
    if (result?.stats) {
      this.#recent.push({kind: job.kind, lane: lane?.id, ...result.stats});
      if (this.#recent.length > 16) this.#recent.shift();
    }
    if (cancelled) this.#stats.cancelled++;
    else if (error) this.#stats.failed++;
    else this.#stats.completed++;
    if (error) job.reject(error);
    else job.resolve(result);
    // Schedule before promise continuations while avoiding nested dispatch on startup errors.
    if (discard) queueMicrotask(() => this.#dispatch());
    else this.#dispatch();
  }
}

export const assetDecodePool = new AssetDecodePool();
if (typeof document !== 'undefined') {
  globalThis.addEventListener?.('pagehide', event => { if (!event.persisted) assetDecodePool.close(); });
}

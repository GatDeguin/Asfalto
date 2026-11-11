import {assetDecodePool} from '../../runtime/asset-decode-pool.mjs?v=1be266bf7b1e2d93';

export class BakeWorkerClient {
  constructor({pool = assetDecodePool} = {}) {
    this.pool = pool;
    this.active = null;
  }

  cancel() {
    this.active?.abort();
  }

  async load(id, signal) {
    this.cancel();
    signal?.throwIfAborted();
    const request = new AbortController();
    const forwardAbort = () => request.abort(signal.reason);
    signal?.addEventListener('abort', forwardAbort, {once: true});
    this.active = request;
    try {
      const result = await this.pool.run('bake', {id}, {signal: request.signal});
      request.signal.throwIfAborted();
      if (result?.payload?.id !== id || !Array.isArray(result.payload.entries)) throw new Error('bake worker response schema');
      result.stats = {...result.stats, transferMs: Math.max(0, performance.timeOrigin + performance.now() - result.sentAt)};
      return result;
    } finally {
      signal?.removeEventListener('abort', forwardAbort);
      if (this.active === request) this.active = null;
    }
  }
}

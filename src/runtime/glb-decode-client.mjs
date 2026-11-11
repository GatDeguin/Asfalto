import {assetDecodePool, AssetWorkerError} from './asset-decode-pool.mjs?v=1be266bf7b1e2d93';

/** Transfers the input only when a worker accepts it. A null result leaves it with the caller. */
export async function decodeGlbInWorker(buffer, {signal, label = 'GLB', pool = assetDecodePool} = {}) {
  signal?.throwIfAborted();
  let result;
  try {
    result = await pool.run('glb', {buffer, label}, {signal, transfers: [buffer]});
  } catch (error) {
    if (error instanceof AssetWorkerError && buffer.byteLength > 0) return null;
    throw error;
  }
  signal?.throwIfAborted();
  if (!result?.json || !(result.bin instanceof Uint8Array)) throw new Error('Respuesta GLB inválida.');
  return {json: result.json, bin: result.bin};
}

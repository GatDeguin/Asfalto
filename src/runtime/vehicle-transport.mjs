import {assetDecodePool, AssetWorkerError} from './asset-decode-pool.mjs?v=1be266bf7b1e2d93';
import {inflateBrowserGzip, MAX_GZIP_INPUT, MAX_GZIP_OUTPUT, readGzipSize} from './gzip-kernel.mjs?v=7cef6073fc46cbf3';

/** Lossless delivery for optional detailed vehicles and scenery. */
export async function decodeVehicleTransport(bytes, signal) {
  signal?.throwIfAborted();
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const size = readGzipSize(bytes);
  if (bytes.byteLength > MAX_GZIP_INPUT || size > MAX_GZIP_OUTPUT) throw new RangeError('El GLB comprimido supera el límite.');
  let buffer;
  try {
    ({buffer} = await assetDecodePool.run('gzip', {bytes, size}, {signal}));
  } catch (error) {
    if (!(error instanceof AssetWorkerError)) throw error;
    buffer = await inflateBrowserGzip(bytes, size, signal);
  }
  signal?.throwIfAborted();
  const decoded = new Uint8Array(buffer);
  if (decoded[0] !== 0x67 || decoded[1] !== 0x6c || decoded[2] !== 0x54 || decoded[3] !== 0x46) {
    throw new Error('El recurso comprimido no contiene un GLB válido.');
  }
  return decoded;
}

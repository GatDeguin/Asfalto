import {decodeVehicleTransport} from '../../runtime/vehicle-transport.mjs?v=f15233fd0976636d';

/** Load an optional, locked regional GLB. Validate before attaching shared scene state. */
export async function loadRegionalBlenderArt({root, releaseRoot, asset, label, signal}, {
  fetchBytes, loadGlb, attach, dispose,
}) {
  if (!root?.isObject3D) return null;
  const url = new URL(asset.path, releaseRoot);
  url.searchParams.set('v', asset.sha256.slice(0, 16));
  let art;
  try {
    signal?.throwIfAborted();
    const payload = await fetchBytes(url.href, {signal});
    const bytes = ArrayBuffer.isView(payload)
      ? new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
      : new Uint8Array(payload);
    if (bytes.byteLength !== asset.bytes) throw new Error('Tamaño inesperado del recurso.');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (sha256 !== asset.sha256) throw new Error('El recurso no coincide con su huella.');
    const glb = await decodeVehicleTransport(bytes, signal);
    art = await loadGlb(glb, label, {signal});
    signal?.throwIfAborted();
    return await attach(root, art);
  } catch (error) {
    if (art) {
      art.removeFromParent?.();
      dispose(art);
    }
    signal?.throwIfAborted();
    if (error.name === 'AbortError') throw error;
    console.warn('[' + label + '] Se usa la escenografía original:', error.message);
    return null;
  }
}

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function readExternalPayload(element, fetchImpl = fetch) {
  const url = element?.dataset?.externalUrl;
  if (!url) throw new TypeError('external payload URL required');
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('payload HTTP ' + response.status + ': ' + url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== Number(element.dataset.bytes)) throw new Error('payload length mismatch: ' + url);
  if (await sha256Hex(bytes) !== element.dataset.sha256) throw new Error('payload hash mismatch: ' + url);
  return bytes;
}

const api = Object.freeze({ readExternalPayload });
if (typeof globalThis !== 'undefined') globalThis.AsfaltoV6AssetCore = api;
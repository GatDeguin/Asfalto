/** Lossless delivery for optional detailed vehicles; ordinary GLB bytes stay untouched. */
export async function decodeVehicleTransport(bytes,signal){
 signal?.throwIfAborted();
 if(bytes[0]!==0x1f||bytes[1]!==0x8b)return bytes;
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 const decoded=new Uint8Array(await new Response(stream).arrayBuffer());
 signal?.throwIfAborted();
 if(decoded[0]!==0x67||decoded[1]!==0x6c||decoded[2]!==0x54||decoded[3]!==0x46)throw new Error('El vehículo comprimido no contiene un GLB válido.');
 return decoded;
}

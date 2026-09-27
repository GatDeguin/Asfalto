import {MeshoptDecoder} from '../../assets/vendor/meshopt/meshopt_decoder.module.js?v=01e7383c646e4326';
import '../legacy/asfalto-v5-glb-runtime.js?v=44b2d5747e61fac7';

/** Binary container parsing and Meshopt decoding never touch Three or the DOM. */
export function parseGlbContainer(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20) throw new Error('GLB header missing');
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw new Error('Invalid GLB 2.0 header');
  if(view.getUint32(8,true)!==buffer.byteLength)throw new Error('GLB declared length mismatch');
  let offset=12,json=null,bin=null;
  while(offset<buffer.byteLength){
    if(offset+8>buffer.byteLength)throw new Error('Truncated GLB chunk');
    const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
    if(length%4||offset+length>buffer.byteLength)throw new Error('Invalid GLB chunk bounds');
    const bytes=new Uint8Array(buffer,offset,length);offset+=length;
    if(type===0x4e4f534a){if(json)throw new Error('Duplicate JSON chunk');json=JSON.parse(new TextDecoder().decode(bytes).replace(/\u0000+$/g,'').trimEnd());}
    else if(type===0x004e4942){if(bin)throw new Error('Duplicate BIN chunk');bin=bytes;}
  }
  if(!json||!bin)throw new Error('GLB requires JSON and BIN chunks');
  return {json,bin};
}
export async function decodeGlbDocument(buffer){
  const source=parseGlbContainer(buffer);
  return globalThis.AsfaltoV5GlbCore.decodeMeshoptDocument(source.json,source.bin,MeshoptDecoder,'Rival GLB');
}
if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope){
  globalThis.onmessage=async({data})=>{
    try{
      const document=await decodeGlbDocument(data.buffer);
      globalThis.postMessage({ok:true,json:document.json,bin:document.bin},[document.bin.buffer]);
    }catch(error){globalThis.postMessage({ok:false,error:String(error?.message||error)});}
  };
}


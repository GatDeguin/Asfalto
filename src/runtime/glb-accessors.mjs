import {attributeStorage} from './phone-resource-memory.mjs?v=3776132bc04e6acf';

const components={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5124:Int32Array,5125:Uint32Array,5126:Float32Array};
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};

export function makeGlbAttribute(T,json,bin,index,phone=false){
 const accessor=json.accessors[index],view=json.bufferViews[accessor.bufferView];
 const Ctor=components[accessor.componentType],width=widths[accessor.type];
 if(!Ctor||!width)throw new Error(`Tipo de accessor GLB no soportado: ${accessor.componentType}/${accessor.type}`);
 const bytes=Ctor.BYTES_PER_ELEMENT,strideBytes=view.byteStride||width*bytes;
 const stride=strideBytes/bytes,offset=accessor.byteOffset||0;
 const viewStart=bin.byteOffset+(view.byteOffset||0),start=viewStart+offset;
 const count=accessor.count,normalized=!!accessor.normalized;
 const readElements=(count-1)*stride+width;
 if(count<1||offset+readElements*bytes>view.byteLength)throw new RangeError(`Accessor GLB ${index} fuera de su bufferView`);
 if(stride===width){
  const array=new Ctor(bin.buffer,start,count*width);
  return new T.BufferAttribute(attributeStorage(array,phone),width,normalized);
 }

 const field=offset%strideBytes,firstRecord=offset-field;
 if(firstRecord+count*strideBytes<=view.byteLength){
  const array=new Ctor(bin.buffer,viewStart+firstRecord,count*stride);
  const data=new T.InterleavedBuffer(attributeStorage(array,phone),stride);
  return new T.InterleavedBufferAttribute(data,width,field/bytes,normalized);
 }

 // glTF permits the view to end at the last component, before the rest of the
 // final stride. Three needs complete records for an InterleavedBuffer.
 const source=new Ctor(bin.buffer,start,readElements),packed=new Ctor(count*width);
 for(let row=0;row<count;row++)packed.set(source.subarray(row*stride,row*stride+width),row*width);
 return new T.BufferAttribute(packed,width,normalized);
}

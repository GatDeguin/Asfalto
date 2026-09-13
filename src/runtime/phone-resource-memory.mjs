const ownedRanges=new WeakMap();
export function attributeStorage(array,phone){
 if(!phone)return array;
 let ranges=ownedRanges.get(array.buffer);if(!ranges){ranges=new Map();ownedRanges.set(array.buffer,ranges);}
 const key=array.constructor.name+':'+array.byteOffset+':'+array.length;
 if(!ranges.has(key))ranges.set(key,array.slice());
 return ranges.get(key);
}
/** Rejection does not poison subsequent decodes; completed results are not retained by the queue. */
export function createSerialTextureQueue(){let tail=Promise.resolve();return task=>{const result=tail.then(task);tail=result.then(()=>undefined,()=>undefined);return result;};}

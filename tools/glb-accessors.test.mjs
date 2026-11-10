import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs?v=fe90186fbef5807f';

const payload=JSON.parse(readFileSync(new URL('../assets/manifests/cockpit-payload.json',import.meta.url),'utf8'));
const T=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64'));
const points=attribute=>Array.from({length:attribute.count},(_,i)=>[attribute.getX(i),attribute.getY(i),attribute.getZ(i)]);

test('a GLB accessor consumes the declared number of vertices from a shared view',()=>{
 const data=new Uint8Array(72),rows=new Int16Array(data.buffer);
 rows.set([2,3,4],14);rows.set([5,6,7],20);
 const json={bufferViews:[{byteLength:data.byteLength,byteStride:12}],accessors:[{bufferView:0,byteOffset:28,count:2,componentType:5122,type:'VEC3'}]};
 const attribute=makeGlbAttribute(T,json,data,0);
 assert.equal(attribute.count,2);
 assert.deepEqual(points(attribute),[[2,3,4],[5,6,7]]);
 assert.equal(attribute.data.array.buffer,data.buffer);
 const mobile=makeGlbAttribute(T,json,data,0,true);
 assert.notEqual(mobile.data.array.buffer,data.buffer);
 assert.deepEqual(points(mobile),points(attribute));
});

test('the final GLB record can end immediately after the last component',()=>{
 const data=new Uint8Array(22),rows=new Int16Array(data.buffer);
 rows.set([0,32767,0],0);rows.set([0,0,-32767],4);rows.set([32767,0,0],8);
 const json={bufferViews:[{byteLength:data.byteLength,byteStride:8}],accessors:[{bufferView:0,count:3,componentType:5122,type:'VEC3',normalized:true}]};
 const attribute=makeGlbAttribute(T,json,data,0);
 assert.equal(attribute.count,3);
 assert.deepEqual(points(attribute),[[0,1,0],[0,0,-1],[1,0,0]]);
 const geometry=new T.BufferGeometry().setAttribute('position',attribute).setIndex([0,1,2]);
 geometry.computeBoundingBox();
 assert.deepEqual(geometry.boundingBox.max.toArray(),[1,1,0]);
});

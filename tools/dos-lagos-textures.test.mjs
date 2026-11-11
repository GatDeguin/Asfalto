import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareReturnScenery} from '../src/tracks/visuals/reference-landscape.mjs?v=62f7607723a931ca';

test('Dos Lagos return borrows its source maps without taking ownership on a failed load',async t=>{
 const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{value:{},configurable:true});
 t.after(()=>originalDocument?Object.defineProperty(globalThis,'document',originalDocument):delete globalThis.document);
 const missingModel=new Error('Roadside model unavailable');
 t.mock.method(globalThis,'fetch',async()=>{throw missingModel;});
 let textureRequests=0,disposals=0;
 const texture={dispose(){disposals++;}};
 const THREE={TextureLoader:class{
  async loadAsync(){textureRequests++;return texture;}
 }};
 const owner={asfaltoSurfaceTextures:{detailBark:texture}};
 const root={isObject3D:true};
 const sourceRoot={getObjectByName(name){assert.equal(name,'ASFALTO_VISUAL_RESOURCE_OWNER');return owner;}};

 await assert.rejects(prepareReturnScenery(root,{id:'dos_lagos',sourceRoot,THREE}),missingModel);
 assert.equal(textureRequests,0);
 assert.equal(disposals,0);
});

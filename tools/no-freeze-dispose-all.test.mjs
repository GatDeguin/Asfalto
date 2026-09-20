import test from 'node:test';import assert from 'node:assert/strict';import {disposeAll,disposeAllSync} from '../src/runtime/dispose-all.mjs?v=f303ef6bb4ac5e2b';
test('a failing disposer never skips later GPU and audio owners',async()=>{const calls=[];await assert.rejects(disposeAll([()=>{calls.push('scene');throw Error('scene');},async()=>{calls.push('renderer');},()=>calls.push('audio')]),error=>error instanceof AggregateError&&error.errors.length===1);assert.deepEqual(calls,['scene','renderer','audio']);});

test('synchronous scene retirement continues after a failed feature',()=>{const calls=[];assert.throws(()=>disposeAllSync([()=>{throw Error('feature');},()=>calls.push('renderer'),()=>calls.push('images')]),AggregateError);assert.deepEqual(calls,['renderer','images']);});

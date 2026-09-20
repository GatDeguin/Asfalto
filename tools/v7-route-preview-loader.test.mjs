import test from 'node:test';
import assert from 'node:assert/strict';
import * as preview from '../src/menu/route-preview-loader.mjs?v=6e39a6240f2b3fa2';

test('late earlier image cannot replace newest selection and object URLs are released', async () => {
  assert.equal(typeof preview.createRoutePreviewLoader, 'function');
  const pending = new Map(), visible = [], released = [];
  const loader = preview.createRoutePreviewLoader({load: (source, signal) => new Promise(resolve => pending.set(source, {resolve, signal})), release: source => released.push(source), onState: state => visible.push(state)});
  const a = loader.select('a', 'a.jpg'), b = loader.select('b', 'b.jpg');
  assert.equal(pending.get('a.jpg').signal.aborted, true);
  pending.get('b.jpg').resolve('blob:b'); await b;
  pending.get('a.jpg').resolve('blob:a'); await a;
  assert.deepEqual(visible.filter(s => s.status === 'ready').map(s => s.key), ['b']);
  assert.deepEqual(released, ['blob:a']);
  loader.dispose(); assert.deepEqual(released, ['blob:a', 'blob:b']);
});
test('missing exact combination clears previous photograph', async () => {
  const states = [], released = [];
  const loader = preview.createRoutePreviewLoader({load: async () => 'blob:clear', release: s => released.push(s), onState: s => states.push(s)});
  await loader.select('clear', 'clear.jpg'); await loader.select('storm', null);
  assert.equal(states.at(-1).status, 'missing'); assert.deepEqual(released, ['blob:clear']); loader.dispose();
});
test('same selection refresh does not download or publish again', async () => {
  let count = 0; const states = [];
  const loader = preview.createRoutePreviewLoader({load: async () => { count++; return 'blob:x'; }, release() {}, onState: s => states.push(s)});
  await loader.select('x', 'x.jpg'); await loader.select('x', 'x.jpg');
  assert.equal(count, 1); assert.equal(states.filter(s => s.status === 'ready').length, 1); loader.dispose();
});
test('suspending a hidden preview repeatedly releases once and makes no extra UI work', async () => {
  const states=[],released=[];
  const loader=preview.createRoutePreviewLoader({load:async()=> 'blob:a',release:source=>released.push(source),onState:state=>states.push(state)});
  await loader.select('a','a.jpg');loader.suspend();loader.suspend();
  assert.deepEqual(released,['blob:a']);assert.equal(states.filter(state=>state.status==='idle').length,1);loader.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createImagePreloader } from '../src/preload.js';

function setup() {
  const created = [];
  const prepare = createImagePreloader(() => {
    const image = { decode: () => Promise.resolve() };
    created.push(image);
    return image;
  });
  return { prepare, created };
}

test('preload is limited to the current image and one ahead, with current image prioritized', () => {
  const { prepare, created } = setup();
  assert.equal(prepare(['a.webp', 'b.webp', 'c.webp']), created[0]);
  assert.equal(created.length, 2);
  assert.deepEqual(created.map(i => [i.src, i.fetchPriority]), [['a.webp', 'high'], ['b.webp', 'low']]);
});
test('reveal and retry reuse the same image; advancing promotes the prepared next image', () => {
  const { prepare, created } = setup();
  const current = prepare(['a.webp', 'b.webp']);
  assert.equal(prepare(['a.webp', 'b.webp']), current);
  assert.equal(created.length, 2);
  const next = created[1];
  assert.equal(prepare(['b.webp', 'c.webp']), next);
  assert.equal(next.fetchPriority, 'high');
  assert.equal(created.length, 3);
  assert.equal(created[2].src, 'c.webp');
});
test('shared illustrations and the end of a pass do not load extra images; leaving releases the pool', () => {
  const { prepare, created } = setup();
  const image = prepare(['a.webp', 'a.webp']);
  assert.equal(created.length, 1);
  assert.equal(prepare(['a.webp', undefined]), image);
  assert.equal(prepare([]), null);
  assert.notEqual(prepare(['a.webp']), image);
});
test('a failed preload can retry without an unhandled rejection or blocking practice', async () => {
  let attempts = 0;
  const prepare = createImagePreloader(() => {
    attempts++;
    return { complete: true, naturalWidth: 0, decode: () => Promise.reject(new Error('offline')) };
  });
  assert.ok(prepare(['a.webp']));
  await Promise.resolve();
  assert.ok(prepare(['a.webp']));
  assert.equal(attempts, 2);
  await Promise.resolve();
});

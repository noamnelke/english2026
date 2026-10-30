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

test('answer thumbnails keep only the current four and next four, promoting the prepared next set', () => {
  const created = [];
  const prepare = createImagePreloader(() => {
    const image = { decode: () => Promise.resolve() };
    created.push(image);
    return image;
  }, { limit: 8 });
  prepare(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'unused'], 4);
  assert.equal(created.length, 8);
  assert.deepEqual(created.map(i => i.fetchPriority), ['high', 'high', 'high', 'high', 'low', 'low', 'low', 'low']);
  const next = created.slice(4);
  prepare(['e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], 4);
  assert.equal(created.length, 12, 'advancing fetches only the new lookahead set');
  assert.ok(next.every(i => i.fetchPriority === 'high'));
  prepare(['e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], 4);
  assert.equal(created.length, 12, 'retry/reveal does not refetch the answer set');
});

test('two meanings sharing one illustration keep separate DOM images, and both survive a reveal', () => {
  const { prepare, created } = setup();
  const requests = [{ key: 'dog', src: 'dog.webp' }, { key: 'pet', src: 'dog.webp' }];
  prepare(requests, 2);
  assert.equal(created.length, 2);
  assert.notEqual(prepare.get('dog'), prepare.get('pet'), 'one button must not steal another button image');
  const dog = prepare.get('dog'), pet = prepare.get('pet');
  prepare(requests, 2);
  assert.equal(prepare.get('dog'), dog);
  assert.equal(prepare.get('pet'), pet);
  assert.equal(created.length, 2);
});

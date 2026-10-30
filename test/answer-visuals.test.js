import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { visualsForAnswers, COLOR_SWATCHES, planAnswerWindow } from '../src/answer-visuals.js';
import { choicesFor } from '../src/engine.js';
const topics = JSON.parse(readFileSync(new URL('../src/data.json', import.meta.url)));

test('all nine color meanings receive the matching swatch, including visible white', () => {
  const t = topics.find(t => t.id === 'topic-04');
  const visuals = visualsForAnswers(t.items[0], t.items.map(q => q.meaning), t, topics);
  assert.equal(visuals.length, 9);
  t.items.forEach((q, i) => assert.deepEqual(visuals[i], { type: 'color', color: COLOR_SWATCHES[q.word] }));
});
test('each concrete answer uses its own meaning, not the current question illustration', () => {
  const t = topics.find(t => t.id === 'topic-07');
  assert.deepEqual(visualsForAnswers(t.items[0], ['חתול', 'כלב', 'ברווז', 'פיל'], t, topics), [
    { type: 'image', asset: 'cat' }, { type: 'image', asset: 'dog' },
    { type: 'image', asset: 'duck' }, { type: 'image', asset: 'elephant' },
  ]);
  const actions = topics.find(t => t.id === 'topic-12');
  const guitar = actions.items.find(q => q.meaning === 'לנגן');
  assert.deepEqual(visualsForAnswers(guitar, ['לנגן', 'לשחק'], actions, topics), [
    { type: 'image', asset: 'guitar' }, { type: 'image', asset: 'play' },
  ]);
});
test('literal answers have real small assets; grammar and phrases do not get misleading noun pictures', () => {
  for (const topic of topics) for (const q of topic.items) {
    const choices = choicesFor(q, topic, topics);
    const visuals = visualsForAnswers(q, choices, topic, topics);
    assert.equal(visuals.length, 4);
    if (topic.kind === 'phrases' || ['topic-15', 'topic-16'].includes(topic.id)) {
      assert.ok(visuals.every(v => v === null));
    } else {
      assert.ok(visuals.every(Boolean));
      for (const visual of visuals) if (visual.type === 'image') {
        assert.ok(existsSync(new URL(`../public/thumbnails/${visual.asset}.webp`, import.meta.url)), visual.asset);
      }
    }
  }
});

test('the next question keeps its prefetched choices and visuals across reveal and advancement', () => {
  const topic = topics.find(t => t.id === 'topic-07');
  const ids = topic.items.map(q => q.id);
  let randomCalls = 0;
  const random = () => { randomCalls++; return .7; };
  const first = planAnswerWindow(ids, topic, topics, undefined, random);
  assert.equal(first.size, 2, 'never plan the whole topic');
  const preparedNext = first.get(ids[1]);
  const calls = randomCalls;
  const revealed = planAnswerWindow(ids, topic, topics, first, random);
  assert.equal(randomCalls, calls, 'revealing an answer must not reshuffle choices');
  assert.equal(revealed.get(ids[0]), first.get(ids[0]));
  const advanced = planAnswerWindow(ids.slice(1), topic, topics, revealed, random);
  assert.equal(advanced.get(ids[1]), preparedNext);
  assert.equal(advanced.size, 2);
  assert.equal(advanced.has(ids[0]), false);
  assert.deepEqual(preparedNext.visuals, visualsForAnswers(topic.items[1], preparedNext.choices, topic, topics));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { blankProgress, sanitizeProgress, topicStats, startSession, answerQuestion, advanceSession, choicesFor } from '../src/engine.js';
const topics = JSON.parse(readFileSync(new URL('../src/data.json', import.meta.url)));
const tiny = { id: 'test', items: [
  { id: 'a', word: 'cat', meaning: 'חתול' },
  { id: 'b', word: 'dog', meaning: 'כלב' },
] };
const fixed = () => .9999;

test('every booklet card has a unique ID and a real illustration', () => {
  const cards = topics.flatMap(t => t.items);
  assert.equal(topics.length, 21); assert.equal(cards.length, 223);
  assert.equal(new Set(cards.map(q => q.id)).size, 223);
  assert.equal(new Set(cards.map(q => q.asset)).size, 171);
  for (const q of cards) {
    assert.ok(existsSync(new URL(`../public/images/${q.asset}.webp`, import.meta.url)), q.asset);
    assert.ok(q.word && q.meaning);
    for (const focus of q.focus) assert.ok(q.example.toLowerCase().includes(focus.toLowerCase()), `${q.word}: ${focus}`);
  }
});
test('images are hidden first; one correct answer earns exactly one star', () => {
  const p = blankProgress(), s = startSession(tiny, p, fixed);
  assert.equal(s.reveal, false);
  answerQuestion(s, p, tiny.items[0], 'חתול');
  assert.equal(s.reveal, true); assert.equal(s.done, true); assert.equal(p.stars, 1);
  assert.equal(p.items.a.debt, false); assert.equal(s.firstCorrect, 1);
  assert.equal(answerQuestion(s, p, tiny.items[0], 'חתול'), false);
  assert.equal(p.stars, 1);
});
test('first mistake marks the prompt as answered, leaves a retry, and creates cleanup debt; second success earns a star but no cleanup credit', () => {
  const p = blankProgress(), s = startSession(tiny, p, fixed), q = tiny.items[0];
  answerQuestion(s, p, q, 'כלב');
  assert.equal(s.reveal, true); assert.equal(s.done, false); assert.equal(s.result, 'retry');
  assert.equal(p.items.a.debt, true); assert.equal(p.stars, 0);
  assert.equal(answerQuestion(s, p, q, 'כלב'), false); assert.equal(s.attempts, 1);
  answerQuestion(s, p, q, 'חתול');
  assert.equal(s.result, 'second'); assert.equal(s.done, true); assert.equal(p.stars, 1);
  assert.equal(p.items.a.streak, 0); assert.equal(p.items.a.debt, true);
});
test('two different mistakes reveal answer, award no star and block further selection', () => {
  const p = blankProgress(), s = startSession(tiny, p, fixed), q = tiny.items[0];
  answerQuestion(s, p, q, 'כלב'); answerQuestion(s, p, q, 'תפוח');
  assert.equal(s.done, true); assert.equal(s.result, 'revealed'); assert.equal(p.stars, 0);
  assert.equal(s.answered, 1); assert.deepEqual(s.missed, ['a']);
  assert.equal(answerQuestion(s, p, q, 'חתול'), false);
});
test('reentry contains only mistakes, even if some words were never attempted', () => {
  const p = blankProgress(); p.items.a = { seen: true, debt: true, streak: 1 };
  const s = startSession(tiny, p, fixed);
  assert.equal(s.mode, 'review'); assert.deepEqual(s.queue, ['a']);
});
test('cleanup credit persists across visits; a mistake resets it without starting another pass', () => {
  let p = blankProgress(); p.items.a = { seen: true, debt: true, streak: 0 };
  for (let streak = 1; streak <= 2; streak++) {
    const s = startSession(tiny, p, fixed);
    answerQuestion(s, p, tiny.items[0], 'חתול');
    advanceSession(s);
    assert.equal(s.finished, true);
    assert.equal(s.answered, 1);
    assert.equal(p.items.a.streak, streak);
    assert.equal(p.items.a.debt, true);
    p = sanitizeProgress(JSON.parse(JSON.stringify(p)), [tiny]);
  }
  let s = startSession(tiny, p, fixed);
  answerQuestion(s, p, tiny.items[0], 'כלב');
  assert.equal(p.items.a.streak, 0);
  answerQuestion(s, p, tiny.items[0], 'חתול'); advanceSession(s);
  assert.equal(s.finished, true); assert.equal(p.items.a.streak, 0);
  for (let n = 0; n < 3; n++) {
    s = startSession(tiny, p, fixed);
    answerQuestion(s, p, tiny.items[0], 'חתול'); advanceSession(s);
    assert.equal(s.finished, true);
  }
  assert.equal(p.items.a.debt, false);
  assert.equal(topicStats(tiny, p).complete, false, 'unseen words still prevent completion');
  s = startSession(tiny, p, fixed); assert.equal(s.mode, 'learn'); assert.deepEqual(s.queue, ['b']);
});
test('a review pass asks each pending question once, then ends even when both still need cleanup', () => {
  const p = blankProgress();
  p.items.a = { seen: true, debt: true, streak: 0 };
  p.items.b = { seen: true, debt: true, streak: 0 };
  const s = startSession(tiny, p, fixed);
  answerQuestion(s, p, tiny.items[0], 'כלב'); answerQuestion(s, p, tiny.items[0], 'חתול');
  advanceSession(s);
  assert.equal(s.queue[s.index], 'b'); assert.equal(s.finished, false);
  answerQuestion(s, p, tiny.items[1], 'כלב'); advanceSession(s);
  assert.equal(s.finished, true); assert.equal(s.answered, 2); assert.equal(s.index, 2);
  assert.deepEqual(s.queue, ['a', 'b']); assert.equal(p.stars, 2);
  assert.equal(p.items.a.streak, 0); assert.equal(p.items.b.streak, 1);
  assert.equal(topicStats(tiny, p).pending.length, 2);
  advanceSession(s); assert.equal(s.index, 2, 'finished passes cannot advance or restart');
  assert.deepEqual(startSession(tiny, p, fixed).queue, ['a', 'b']);
});
test('learning ends at summary even with mistakes; a review can clear its last debt', () => {
  const p = blankProgress(), s = startSession(tiny, p, fixed);
  answerQuestion(s, p, tiny.items[0], 'כלב'); answerQuestion(s, p, tiny.items[0], 'חתול');
  advanceSession(s, tiny, p, fixed); assert.equal(s.queue[s.index], 'b');
  answerQuestion(s, p, tiny.items[1], 'כלב'); advanceSession(s, tiny, p, fixed);
  assert.equal(s.finished, true); assert.equal(topicStats(tiny, p).complete, false);
  p.items.a.streak = 2;
  const review = startSession(tiny, p, fixed); answerQuestion(review, p, tiny.items[0], 'חתול'); advanceSession(review, tiny, p, fixed);
  assert.equal(review.finished, true); assert.equal(topicStats(tiny, p).complete, true);
});
test('all-first-try learning completes topic; reopening a completed topic allows replay', () => {
  const p = blankProgress(), s = startSession(tiny, p, fixed);
  for (const q of tiny.items) { answerQuestion(s, p, q, q.meaning); advanceSession(s, tiny, p, fixed); }
  assert.equal(s.finished, true); assert.equal(topicStats(tiny, p).complete, true);
  assert.equal(p.stars, 2); assert.deepEqual(startSession(tiny, p, fixed).queue, ['a', 'b']);
});
test('progress survives JSON round trip and invalid fields are sanitized', () => {
  const p = blankProgress(); p.items.a = { seen: true, debt: true, streak: 2 }; p.stars = 19;
  assert.deepEqual(sanitizeProgress(JSON.parse(JSON.stringify(p)), [tiny]), p);
  const clean = sanitizeProgress({version:1, stars:-9, items:{a:{seen:true,debt:true,streak:100},unknown:{}}}, [tiny]);
  assert.equal(clean.stars, 0); assert.equal(clean.items.a.streak, 2); assert.equal(clean.items.unknown, undefined);
  for (const bad of [null, 'broken', {}, {version:1,items:null}]) assert.deepEqual(sanitizeProgress(bad, [tiny]), blankProgress());
});
test('every question has four unique choices and exactly one correct answer, including the two-word weather topic', () => {
  for (const t of topics) for (const q of t.items) for (let n = 0; n < 4; n++) {
    const choices = choicesFor(q, t, topics);
    assert.equal(choices.length, 4); assert.equal(new Set(choices).size, 4);
    assert.equal(choices.filter(x => x === q.meaning).length, 1);
  }
  const plays = topics.flatMap(t => t.items).filter(q => q.word === 'play');
  assert.equal(plays.length, 2); assert.notEqual(plays[0].example, plays[1].example);
});

test('all 223 cards can complete learning and cleanup without skipping words or retaining debt', () => {
  const p = blankProgress(); let expectedStars = 0;
  for (const topic of topics) {
    let s = startSession(topic, p, fixed);
    while (!s.finished) {
      const q = topic.items.find(q => q.id === s.queue[s.index]);
      if (s.index % 4 === 0) answerQuestion(s, p, q, 'deliberately incorrect test answer');
      answerQuestion(s, p, q, q.meaning); expectedStars++;
      advanceSession(s, topic, p, fixed);
    }
    assert.ok(topicStats(topic, p).pending.length);
    for (let visit = 0; visit < 3; visit++) {
      const pendingCount = topicStats(topic, p).pending.length;
      s = startSession(topic, p, fixed);
      let presentations = 0;
      while (!s.finished) {
        const q = topic.items.find(q => q.id === s.queue[s.index]);
        answerQuestion(s, p, q, q.meaning); expectedStars++; presentations++;
        advanceSession(s);
      }
      assert.equal(presentations, pendingCount, 'each visit reviews every pending question exactly once');
      if (visit < 2) assert.equal(topicStats(topic, p).complete, false);
    }
    assert.equal(topicStats(topic, p).complete, true);
    assert.equal(topicStats(topic, p).pending.length, 0);
  }
  assert.equal(p.stars, expectedStars);
  assert.equal(Object.values(p.items).filter(p => p.seen && !p.debt).length, 223);
});

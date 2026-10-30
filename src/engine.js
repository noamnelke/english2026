export const STORAGE_KEY = 'english2026-progress-v1';
export const blankProgress = () => ({ version: 1, stars: 0, items: {} });
export const itemProgress = (progress, id) => progress.items[id] || { seen: false, debt: false, streak: 0 };

export function sanitizeProgress(value, topics) {
  const clean = blankProgress();
  if (!value || value.version !== 1 || typeof value.items !== 'object' || !value.items) return clean;
  clean.stars = Number.isSafeInteger(value.stars) && value.stars >= 0 ? value.stars : 0;
  for (const topic of topics) for (const q of topic.items) {
    const p = value.items[q.id];
    if (!p || typeof p !== 'object') continue;
    const debt = p.debt === true;
    clean.items[q.id] = { seen: p.seen === true, debt, streak: debt ? Math.max(0, Math.min(2, Number.isInteger(p.streak) ? p.streak : 0)) : 0 };
  }
  return clean;
}

export function topicStats(topic, progress) {
  const seen = topic.items.filter(q => itemProgress(progress, q.id).seen).length;
  const pending = topic.items.filter(q => itemProgress(progress, q.id).debt);
  const mastered = topic.items.filter(q => { const p = itemProgress(progress, q.id); return p.seen && !p.debt; }).length;
  return { seen, pending, mastered, complete: seen === topic.items.length && pending.length === 0 };
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

export function startSession(topic, progress, random = Math.random) {
  const { pending } = topicStats(topic, progress);
  const unseen = topic.items.filter(q => !itemProgress(progress, q.id).seen);
  const mode = pending.length ? 'review' : 'learn';
  const candidates = pending.length ? pending : unseen.length ? unseen : topic.items;
  return { topicId: topic.id, mode, queue: shuffle(candidates.map(q => q.id), random), index: 0, round: 1, attempts: 0, wrong: [], done: false, reveal: false, result: null, stars: 0, firstCorrect: 0, answered: 0, missed: [], initialCount: candidates.length, finished: false };
}

export function answerQuestion(session, progress, question, selectedMeaning) {
  if (session.done || session.finished || session.wrong.includes(selectedMeaning)) return false;
  const p = { ...itemProgress(progress, question.id), seen: true };
  const correct = selectedMeaning === question.meaning;
  session.attempts++;
  session.reveal = true;
  if (correct) {
    session.done = true;
    session.result = session.attempts === 1 ? 'correct' : 'second';
    progress.stars++;
    session.stars++;
    session.answered++;
    if (session.attempts === 1) {
      session.firstCorrect++;
      if (p.debt) { p.streak++; if (p.streak >= 3) { p.debt = false; p.streak = 0; } }
    }
  } else {
    p.debt = true;
    p.streak = 0;
    session.wrong.push(selectedMeaning);
    if (!session.missed.includes(question.id)) session.missed.push(question.id);
    session.result = session.attempts === 1 ? 'retry' : 'revealed';
    if (session.attempts === 2) { session.done = true; session.answered++; }
  }
  progress.items[question.id] = p;
  return true;
}

export function advanceSession(session, topic, progress, random = Math.random) {
  if (!session.done) return;
  session.index++;
  if (session.index === session.queue.length) {
    const pending = topicStats(topic, progress).pending;
    if (session.mode === 'review' && pending.length) {
      session.queue = shuffle(pending.map(q => q.id), random);
      session.index = 0;
      session.round++;
    } else { session.finished = true; return; }
  }
  session.attempts = 0; session.wrong = []; session.done = false; session.reveal = false; session.result = null;
}

// Distractors are distinct meanings, so synonyms and repeated English labels never create two correct choices.
export function choicesFor(question, topic, topics, random = Math.random) {
  const sameTopic = shuffle(topic.items.filter(q => q.meaning !== question.meaning), random);
  const others = shuffle(topics.flatMap(t => t.items).filter(q => q.meaning !== question.meaning), random);
  const meanings = [...new Set([...sameTopic, ...others].map(q => q.meaning))].slice(0, 3);
  return shuffle([question.meaning, ...meanings], random);
}

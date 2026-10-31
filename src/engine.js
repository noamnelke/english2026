export const STORAGE_KEY = 'english2026-progress-v1';
export const STAR_FIELDS = ['learningFirst', 'learningSecond', 'reviewFirst', 'reviewSecond'];
export const blankProgress = () => ({ version: 2, stars: 0, items: {}, starBreakdown: {}, combo: { current: 0, best: 0 } });
export const itemProgress = (progress, id) => progress.items[id] || { seen: false, debt: false, streak: 0 };

export function sanitizeProgress(value, topics) {
  const clean = blankProgress();
  if (!value || ![1, 2].includes(value.version) || typeof value.items !== 'object' || !value.items) return clean;
  clean.stars = Number.isSafeInteger(value.stars) && value.stars >= 0 ? value.stars : 0;
  for (const topic of topics) for (const q of topic.items) {
    const p = value.items[q.id];
    if (!p || typeof p !== 'object') continue;
    const debt = p.debt === true;
    clean.items[q.id] = { seen: p.seen === true, debt, streak: debt ? Math.max(0, Math.min(2, Number.isInteger(p.streak) ? p.streak : 0)) : 0 };
  }
  let remaining = clean.stars;
  if (value.version === 2) {
    for (const topic of topics) {
      const raw = value.starBreakdown?.[topic.id];
      if (!raw || typeof raw !== 'object') continue;
      const bucket = {};
      for (const field of STAR_FIELDS) {
        const count = Number.isSafeInteger(raw[field]) && raw[field] >= 0 ? raw[field] : 0;
        bucket[field] = Math.min(count, remaining);
        remaining -= bucket[field];
      }
      if (STAR_FIELDS.some(field => bucket[field] > 0)) clean.starBreakdown[topic.id] = bucket;
    }
    const count = n => Number.isSafeInteger(n) && n >= 0 ? Math.min(n, clean.stars) : 0;
    clean.combo.current = count(value.combo?.current);
    clean.combo.best = Math.max(clean.combo.current, count(value.combo?.best));
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
    const bucket = progress.starBreakdown[session.topicId] ||= Object.fromEntries(STAR_FIELDS.map(field => [field, 0]));
    const field = (session.mode === 'review' ? 'review' : 'learning') + (session.attempts === 1 ? 'First' : 'Second');
    bucket[field]++;
    progress.combo.current++;
    progress.combo.best = Math.max(progress.combo.best, progress.combo.current);
    session.stars++;
    session.answered++;
    if (session.attempts === 1) {
      session.firstCorrect++;
      if (p.debt) { p.streak++; if (p.streak >= 3) { p.debt = false; p.streak = 0; } }
    }
  } else {
    progress.combo.current = 0;
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

export function advanceSession(session) {
  if (!session.done || session.finished) return;
  session.index++;
  if (session.index === session.queue.length) {
    session.finished = true;
    return;
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

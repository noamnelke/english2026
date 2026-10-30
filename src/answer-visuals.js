import { choicesFor } from './engine.js';

export const COLOR_SWATCHES = {
  black: '#252b35', white: '#ffffff', gray: '#929aa5', red: '#ee5054',
  blue: '#4086ec', green: '#36a56c', yellow: '#ffd34d', orange: '#ff963d', brown: '#9b6847',
};

// These two word topics contain grammar rather than literal pictured meanings.
const grammarTopics = new Set(['topic-15', 'topic-16']);
const isLiteral = topic => topic.kind === 'words' && !grammarTopics.has(topic.id);

export function visualsForAnswers(question, meanings, topic, topics) {
  if (!isLiteral(topic)) return meanings.map(() => null);
  const candidates = [question, ...topic.items, ...topics.filter(isLiteral).flatMap(t => t.items)];
  return meanings.map(meaning => {
    const item = candidates.find(item => item.meaning === meaning);
    if (!item) return null;
    return COLOR_SWATCHES[item.asset]
      ? { type: 'color', color: COLOR_SWATCHES[item.asset] }
      : { type: 'image', asset: item.asset };
  });
}

// Plan one question ahead once, so prefetched thumbnails match the choices shown later.
export function planAnswerWindow(ids, topic, topics, previous = new Map(), random = Math.random) {
  return new Map(ids.slice(0, 2).map(id => {
    if (previous.has(id)) return [id, previous.get(id)];
    const question = topic.items.find(q => q.id === id);
    const choices = choicesFor(question, topic, topics, random);
    return [id, { choices, visuals: visualsForAnswers(question, choices, topic, topics) }];
  }));
}

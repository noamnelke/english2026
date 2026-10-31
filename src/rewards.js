import { topicStats } from './engine.js';

export function rewardSummary(progress, topics) {
  const rows = topics.map(topic => {
    const b = progress.starBreakdown[topic.id] || {};
    const first = (b.learningFirst || 0) + (b.reviewFirst || 0);
    const second = (b.learningSecond || 0) + (b.reviewSecond || 0);
    return { id: topic.id, name: topic.he, total: first + second, first, second, review: (b.reviewFirst || 0) + (b.reviewSecond || 0) };
  });
  const sum = key => rows.reduce((total, row) => total + row[key], 0);
  const classified = sum('total');
  return {
    total: progress.stars, classified, previous: Math.max(0, progress.stars - classified),
    first: sum('first'), second: sum('second'), review: sum('review'), rows,
    currentStreak: progress.combo.current, bestStreak: progress.combo.best,
    completed: topics.filter(t => topicStats(t, progress).complete).length,
  };
}

export function progressShareText(progress, topics) {
  const s = rewardSummary(progress, topics);
  const lines = [
    '⭐ ההתקדמות שלי במסע המילים',
    `צברתי ${s.total} ${s.total === 1 ? 'כוכב' : 'כוכבים'}!`,
    ...(s.previous ? [`כוכבים קודמים הכלולים בסכום: ${s.previous} (ללא פירוט).`, `כוכבים חדשים עם פירוט: ${s.classified}`] : []),
    `בניסיון הראשון: ${s.first} | בניסיון השני: ${s.second}`,
    `מתוכם בסבבי חיזוק: ${s.review}`,
    `🔥 שיא הרצף: ${s.bestStreak} ${s.bestStreak === 1 ? 'תשובה נכונה' : 'תשובות נכונות'}`,
    `השלמתי ${s.completed} מתוך ${topics.length} נושאים.`,
  ];
  const earned = s.rows.filter(row => row.total > 0);
  if (earned.length) lines.push('', 'הכוכבים שלי לפי נושא:', ...earned.map(row => `• ${row.name}: ${row.total}`));
  lines.push('', 'https://english2026-practice.glossysnow66.chatgpt.site/');
  return lines.join('\n');
}

export const whatsappShareUrl = (progress, topics) => `https://wa.me/?text=${encodeURIComponent(progressShareText(progress, topics))}`;

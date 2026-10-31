import { createPronunciationPlayer, showQuestionImage, pronunciationSource } from './audio.js';
import { rewardSummary, whatsappShareUrl, streakLevel } from './rewards.js';
import { planAnswerWindow } from './answer-visuals.js';
import { createImagePreloader } from './preload.js';
import { STORAGE_KEY, blankProgress, sanitizeProgress, topicStats, itemProgress, startSession, answerQuestion, advanceSession } from './engine.js';

const app = document.querySelector('#app');
const prepareImages = createImagePreloader();
const prepareAnswerImages = createImagePreloader(undefined, { limit: 8 });
let audioState = 'idle';
const pronunciation = createPronunciationPlayer(undefined, state => { audioState = state; updateAudioControls(); });
let answerPlans = new Map();
let showingRewards = false, rewardsReturnScroll = 0;
let topics, progress, session = null, choices = [], filter = 'all', saveFailed = false;
const icons = {
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  book: '<path d="M12 6C9 3 5 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-2-9 1zm0 0v14"/>',
  question: '<path d="M9 8a3 3 0 1 1 5 2c-1 1-2 1-2 4m0 3v.1"/><circle cx="12" cy="12" r="10"/>',
  flame: '<path d="M12 2c1 5-5 7-5 12a5 5 0 0 0 10 0c0-3-2-5-3-6 0 3-2 4-2 6-2-3 1-5 0-12Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
  speaker: '<path d="M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const asset = key => `./images/${encodeURIComponent(key)}.webp`;
const thumbnail = key => `./thumbnails/${encodeURIComponent(key)}.webp`;
const topic = () => topics.find(t => t.id === session.topicId);
const current = () => topic().items.find(q => q.id === session.queue[session.index]);

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); saveFailed = false; }
  catch { saveFailed = true; }
}
function saveNotice() { return saveFailed ? '<p class="save-warning" role="alert">הדפדפן לא מאפשר לשמור התקדמות. אפשר לתרגל, אבל ההתקדמות תישמר רק כל עוד העמוד פתוח.</p>' : ''; }
function header(inPractice = false, inRewards = false) {
  const action = inRewards ? `<button class="text-button stats-back" aria-label="${session ? 'בחזרה לתרגול' : 'בחזרה לרשימת הנושאים'}">בחזרה ${icon('arrow')}</button>` : inPractice ? '<button class="text-button leave">שומרים ויוצאים ' + icon('arrow') + '</button>' : '<button class="text-button help-button">איך משחקים? ' + icon('question') + '</button>';
  return `<header class="site-header ${inRewards ? 'rewards-header' : ''}"><a href="#" class="brand" aria-label="מסע המילים, למסך הראשי"><span class="brand-icon">${icon('book')}</span><span>מסע המילים<small lang="en" dir="ltr">ENGLISH 2026</small></span></a><div class="header-end">${action}<button type="button" class="star-counter" aria-label="פירוט ${progress.stars} הכוכבים שלי" title="פירוט הכוכבים שלי">${icon('star')}<b>${progress.stars}</b></button></div></header>`;
}
function bindHeader() {
  app.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); goHome(); });
  app.querySelector('.leave')?.addEventListener('click', goHome);
  app.querySelector('.help-button')?.addEventListener('click', showHelp);
  app.querySelector('.star-counter').addEventListener('click', openRewards);
  app.querySelectorAll('.stats-back').forEach(button => button.addEventListener('click', closeRewards));
}
function goHome() { pronunciation.stop(); showingRewards = false; session = null; save(); renderHome(); window.scrollTo(0, 0); }

function renderHome() {
  pronunciation.prepare([]);
  prepareImages([]);
  prepareAnswerImages([]);
  answerPlans.clear();
  const stats = topics.map(t => topicStats(t, progress));
  const completed = stats.filter(s => s.complete).length;
  const pending = stats.reduce((sum, s) => sum + s.pending.length, 0);
  const mastered = stats.reduce((sum, s) => sum + s.mastered, 0);
  const total = topics.reduce((sum, t) => sum + t.items.length, 0);
  const visible = topics.filter((t, i) => filter === 'all' || (filter === 'pending' ? stats[i].pending.length : stats[i].complete));
  app.innerHTML = `${header()}<main id="main" class="home" tabindex="-1">${saveNotice()}
    <section class="hero"><div class="hero-copy"><span class="eyebrow">קצת תרגול. עוד כוכב. הרבה ביטחון.</span><h1>מילה קטנה,<br>הצלחה <span>גדולה.</span></h1><p>בוחרים נושא, מגלים מילים חדשות<br class="desktop-break"> ואוספים כוכבים בדרך לאנגלית מצוינת.</p><div class="hero-note"><span class="mini-check">${icon('check')}</span> אפשר לטעות. ככה לומדים!</div></div><div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><span class="floating-star star-one">${icon('star')}</span><span class="floating-star star-two">${icon('star')}</span><img class="hero-character" src="${asset('happy')}" alt=""><span class="art-caption">כל ניסיון הוא התקדמות</span></div></section>
    <section class="journey-stats" aria-label="ההתקדמות שלי"><div><span class="stat-symbol blue">${icon('book')}</span><span><b>${completed}<small> / ${topics.length}</small></b><span>נושאים שהושלמו</span></span></div><div><span class="stat-symbol gold">${icon('star')}</span><span><b>${progress.stars}</b><span>כוכבים שאספתי</span></span></div><div><span class="stat-symbol mint">${icon('check')}</span><span><b>${mastered}<small> / ${total}</small></b><span>מילים וביטויים שלמדתי</span></span></div></section>
    <section class="topics-section"><div class="section-heading"><div><span class="eyebrow">המסע שלי</span><h2>מה נתרגל היום?</h2></div><span class="section-count">${topics.length} נושאים · ${total} מילים וביטויים</span></div><div class="topic-tabs" role="group" aria-label="סינון נושאים"><button data-filter="all" class="${filter === 'all' ? 'active' : ''}" aria-pressed="${filter === 'all'}">כל הנושאים</button><button data-filter="pending" class="${filter === 'pending' ? 'active' : ''}" aria-pressed="${filter === 'pending'}">${icon('refresh')} מחכים לניקוי${pending ? ` <span>${pending}</span>` : ''}</button><button data-filter="complete" class="${filter === 'complete' ? 'active' : ''}" aria-pressed="${filter === 'complete'}">${icon('check')} הושלמו</button></div>
    <div class="topics-grid">${visible.length ? visible.map(t => topicCard(t)).join('') : `<div class="empty-state">${icon(filter === 'pending' ? 'check' : 'book')}<h3>${filter === 'pending' ? 'אין שאלות שמחכות לניקוי' : 'ההצלחה הראשונה כבר בדרך'}</h3><p>${filter === 'pending' ? 'אפשר לבחור נושא ולהמשיך לגלות מילים.' : 'בוחרים נושא, מתרגלים ומקבלים כאן וי.'}</p><button class="button secondary all-topics">לכל הנושאים</button></div>`}</div></section>
    <footer>נוצר באהבה ללימוד אנגלית · המילים והאיורים מהחוברת · הקריינות נוצרה ב־AI<br><span>ההתקדמות נשמרת בדפדפן הזה, במכשיר הזה.</span></footer></main>`;
  bindHeader();
  app.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => begin(button.dataset.topic)));
  app.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderHome(); }));
  app.querySelector('.all-topics')?.addEventListener('click', () => { filter = 'all'; renderHome(); });
}
function topicCard(t) {
  const s = topicStats(t, progress), index = topics.indexOf(t);
  const representative = t.items.find(q => ['family', 'house', 'hand', 'red', 'apple', 'num_3', 'dog', 'tree', 'bag', 'ball', 'gift', 'jump', 'happy', 'big'].includes(q.asset)) || t.items[0];
  const status = s.pending.length ? `<span class="status pending">${icon('refresh')} ${s.pending.length} לניקוי</span>` : s.complete ? `<span class="status completed">${icon('check')} הושלם!</span>` : `<span class="status neutral">${s.seen ? 'ממשיכים ללמוד' : 'יוצאים לדרך'}</span>`;
  return `<button class="topic-card color-${index % 5}" data-topic="${t.id}"><div class="card-top"><span class="topic-number">${String(index + 1).padStart(2, '0')}</span>${status}</div><div class="topic-art"><img loading="lazy" src="${asset(representative.asset)}" alt=""></div><h3>${esc(t.he)}</h3><p lang="en" dir="ltr">${esc(t.en)}</p><div class="topic-meter" aria-hidden="true"><span style="width:${s.mastered / t.items.length * 100}%"></span></div><div class="card-bottom"><span>${s.pending.length ? 'ממשיכים עם הטעויות בלבד' : `${s.mastered} מתוך ${t.items.length} נלמדו`}</span><span class="card-arrow">${icon('arrow')}</span></div></button>`;
}
function begin(id) {
  pronunciation.stop();
  session = startSession(topics.find(t => t.id === id), progress);
  answerPlans.clear();
  renderQuestion(); window.scrollTo(0, 0);
}
function highlightedExample(q) {
  if (!q.example) return '';
  const focus = [...q.focus].sort((a, b) => b.length - a.length);
  if (!focus.length) return esc(q.example);
  const regex = new RegExp('\\b(' + focus.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
  let result = '', cursor = 0;
  for (const match of q.example.matchAll(regex)) { result += esc(q.example.slice(cursor, match.index)) + `<mark>${esc(match[0])}</mark>`; cursor = match.index + match[0].length; }
  return result + esc(q.example.slice(cursor));
}
function renderQuestion(focusHeading = false) {
  const q = current(), t = topic(), p = itemProgress(progress, q.id);
  const review = session.mode === 'review';
  const nextQuestion = t.items.find(item => item.id === session.queue[session.index + 1]);
  pronunciation.prepare([pronunciationSource(q), nextQuestion && pronunciationSource(nextQuestion)]);
  const showImage = showQuestionImage(session.result);
  const illustration = prepareImages([asset(q.asset), nextQuestion && asset(nextQuestion.asset)]);
  answerPlans = planAnswerWindow(session.queue.slice(session.index, session.index + 2), t, topics, answerPlans);
  const plan = answerPlans.get(q.id);
  choices = plan.choices;
  const answerVisuals = plan.visuals;
  const thumbnailRequests = plan => plan.visuals.map((v, i) => v?.type === 'image' ? {
    key: JSON.stringify([thumbnail(v.asset), plan.choices[i]]), src: thumbnail(v.asset),
  } : null);
  const currentThumbnails = thumbnailRequests(plan);
  const nextThumbnails = nextQuestion ? thumbnailRequests(answerPlans.get(nextQuestion.id)) : [];
  prepareAnswerImages([...currentThumbnails, ...nextThumbnails], currentThumbnails.filter(Boolean).length);
  const progressPercent = review ? t.items.filter(x => itemProgress(progress, x.id).seen && !itemProgress(progress, x.id).debt).length / t.items.length * 100 : session.index / session.queue.length * 100;
  app.innerHTML = `${header(true)}<main id="main" class="practice" tabindex="-1">${saveNotice()}<div class="practice-heading"><div><span class="eyebrow">${review ? 'מחזקים את מה שעוד קשה' : 'לומדים ומגלים'}</span><h1>${esc(t.he)}</h1></div><span class="round-label">${review ? `סבב חיזוק · ${session.index + 1} מתוך ${session.queue.length}` : `שאלה ${session.index + 1} מתוך ${session.queue.length}`}</span></div><div class="session-progress" role="progressbar" aria-label="התקדמות בנושא" aria-valuenow="${Math.round(progressPercent)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progressPercent}%"></span></div>
  <div class="question-layout"><section class="question-panel" aria-labelledby="question-word"><div class="question-label">${q.word === 'play' ? 'מה פירוש המילה המודגשת במשפט?' : 'מה הפירוש בעברית?'}</div><h2 id="question-word" tabindex="-1" lang="en" dir="ltr">${esc(q.word)}</h2>${q.example ? `<p class="example" lang="en" dir="ltr">${highlightedExample(q)}</p>` : ''}<div class="mastery-slot">${p.debt ? `<div class="mastery"><span>מנקים את השאלה</span><div class="mastery-dots" aria-label="${p.streak} מתוך 3 תשובות נכונות בניסיון הראשון">${[1, 2, 3].map(n => `<span class="${p.streak >= n ? 'filled' : ''}">${p.streak >= n ? icon('check') : n}</span>`).join('')}</div><small>3 הצלחות בניסיון הראשון · טעות מתחילה מחדש</small></div>` : review && session.done ? `<div class="cleaned">${icon('check')} השאלה נקייה! כל הכבוד</div>` : ''}</div>
  <div class="answers" aria-label="תשובות אפשריות">${choices.map((meaning, i) => {
    const wrong = session.wrong.includes(meaning), right = session.done && meaning === q.meaning;
    const visual = answerVisuals[i];
    const key = `<span class="answer-key">${right ? icon('check') : wrong ? icon('close') : i + 1}</span>`;
    const leading = visual ? `<span class="answer-leading">${visual.type === 'color' ? `<span class="answer-swatch" style="--answer-color:${visual.color}" aria-hidden="true"></span>` : `<span data-answer-image="${i}"></span>`}${key}</span>` : key;
    return `<button class="answer ${visual ? 'has-visual' : ''} ${wrong ? 'wrong' : ''} ${right ? 'right' : ''}" data-answer="${i}" ${session.done || wrong ? 'disabled' : ''}>${leading}<span class="answer-label">${esc(meaning)}</span></button>`;
  }).join('')}</div><div class="feedback ${session.result || ''}" role="status" aria-live="polite">${feedback(q)}</div><div class="question-actions">${session.done ? `<button class="button primary next">${nextLabel()} ${icon('arrow')}</button>` : '<span class="keyboard-hint">בוחרים תשובה אחת · אפשר גם במקשים 1–4</span>'}${sessionRewardBadge()}</div></section>
  <aside class="illustration-panel ${showImage ? 'revealed' : session.reveal ? 'audio-hint' : ''}" aria-label="${showImage ? 'איור המילה' : 'הגיית המילה'}">${showImage ? `<span class="illustration-label">עכשיו גם רואים את זה</span><span data-question-image></span><div class="image-caption"><strong lang="en" dir="ltr">${esc(q.word)}</strong><span>${esc(q.meaning)}</span></div>${replayControl(true)}` : session.reveal ? `<div class="listening-art"><span class="listening-rings" aria-hidden="true"></span>${replayControl()}<p>מקשיבים למילה באנגלית</p><span class="audio-status" role="status" aria-live="polite"></span></div>` : `<div class="hidden-art">${icon('question')}<h3>קודם חושבים,<br>אחר כך מקשיבים.</h3><p>בחרו תשובה<br>ושמעו את המילה באנגלית.</p><span class="secret-spark">✦</span></div>`}</aside></div><div class="practice-footnote">${review ? `${topicStats(t, progress).pending.length} שאלות עדיין מחכות לניקוי · אפשר לשמור ולצאת בכל רגע` : 'טעות היא הזדמנות ללמוד. יש שני ניסיונות בכל שאלה.'}</div></main>`;
  bindHeader();
  if (showImage) {
    illustration.className = 'question-image';
    illustration.alt = `איור של ${q.word}`;
    app.querySelector('[data-question-image]').replaceWith(illustration);
  }
  currentThumbnails.forEach((request, index) => {
    if (!request) return;
    const image = prepareAnswerImages.get(request.key);
    image.className = 'answer-thumbnail';
    image.alt = '';
    image.width = image.height = 104;
    app.querySelector(`[data-answer-image="${index}"]`).replaceWith(image);
  });
  app.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => choose(Number(button.dataset.answer))));
  app.querySelector('.next')?.addEventListener('click', next);
  app.querySelector('.replay-word')?.addEventListener('click', () => { void pronunciation.play(pronunciationSource(current())); });
  updateAudioControls();
  if (focusHeading) app.querySelector('#question-word').focus({ preventScroll: true });
}
function replayControl(compact = false) {
  return `<button type="button" class="replay-word ${compact ? 'compact' : ''}" aria-label="השמיעו שוב את המילה באנגלית">${icon('speaker')}<span>לשמוע שוב</span></button>${compact ? '<span class="audio-status compact-audio-status" role="status" aria-live="polite"></span>' : ''}`;
}
function updateAudioControls() {
  const button = app.querySelector('.replay-word');
  if (!button) return;
  button.classList.toggle('is-playing', audioState === 'playing');
  button.classList.toggle('is-loading', audioState === 'loading');
  const status = app.querySelector('.audio-status');
  if (status) status.textContent = audioState === 'error' ? 'לא הצלחנו להשמיע. לחצו כדי לנסות שוב.' : audioState === 'loading' ? 'טוענים את ההקלטה…' : '';
  button.title = audioState === 'error' ? 'נסו להשמיע שוב' : 'השמיעו שוב את המילה באנגלית';
}
function sessionRewardBadge() {
  const streak = progress.combo.current;
  if (streak < 2) return `<span class="session-stars">${icon('star')} ${session.stars} כוכבים בתרגול</span>`;
  const level = streakLevel(streak);
  const sparkCount = (level - 1) * 2;
  const count = streak < 1000 ? streak : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(streak);
  return `<div class="combo-badge" data-combo-level="${level}" role="status" aria-label="${streak} תשובות נכונות ברצף"><span class="combo-sparks" aria-hidden="true">${Array.from({ length: sparkCount }, (_, i) => 8 + i * 84 / Math.max(1, sparkCount - 1)).map((x, i) => `<span class="combo-spark" style="--spark-x:${x}%;--spark-delay:-${i * .31}s">${icon('star')}</span>`).join('')}</span><span class="combo-flame">${icon('flame')}</span><strong>${count}</strong><span class="combo-label">ברצף!</span></div>`;
}
function openRewards() {
  pronunciation.stop();
  if (!showingRewards) rewardsReturnScroll = window.scrollY;
  showingRewards = true;
  renderRewards();
  window.scrollTo(0, 0);
  app.querySelector('#rewards-heading').focus({ preventScroll: true });
}
function closeRewards() {
  showingRewards = false;
  if (!session) renderHome();
  else if (session.finished) renderSummary();
  else renderQuestion(true);
  app.querySelector('.star-counter').focus({ preventScroll: true });
  window.scrollTo(0, rewardsReturnScroll);
}
function renderRewards() {
  const s = rewardSummary(progress, topics);
  const orderedRows = [...s.rows].sort((a, b) => b.total - a.total);
  const n = value => value.toLocaleString('he-IL');
  app.innerHTML = `${header(false, true)}<main id="main" class="rewards-page" tabindex="-1">${saveNotice()}<div class="rewards-heading"><span class="eyebrow">כל תשובה נכונה היא הצלחה</span><h1 id="rewards-heading" tabindex="-1">הכוכבים שלי</h1><p>הנה כל מה שהצלחתם לצבור בדרך.</p></div>
  <section class="rewards-hero" aria-label="ההישגים שלי"><div class="rewards-total">${icon('star')}<span><strong>${n(s.total)}</strong><span>כוכבים בסך הכול</span></span></div><div class="rewards-record"><span class="record-icon">${icon('flame')}</span><span><b>${n(s.bestStreak)}</b><span>שיא הרצף שלי</span></span></div><div class="rewards-record"><span class="record-icon blue">${icon('check')}</span><span><b>${s.completed}<small> / ${topics.length}</small></b><span>נושאים שהושלמו</span></span></div></section>
  <section class="rewards-metrics" aria-label="כוכבים לפי סוג תשובה"><div>${icon('check')}<strong>${n(s.first)}</strong><span>בניסיון הראשון</span></div><div>${icon('star')}<strong>${n(s.second)}</strong><span>בניסיון השני</span></div><div>${icon('refresh')}<strong>${n(s.review)}</strong><span>מתוכם בסבבי חיזוק</span></div></section><p class="rewards-explainer">כוכבי החיזוק כלולים גם בספירת הניסיון הראשון והשני.</p>
  ${s.previous ? `<aside class="previous-stars">${icon('star')}<div><strong>הכוכבים הקודמים נשמרו: ${n(s.previous)}</strong><p>הפירוט לפי נושא וסוג תשובה מתחיל מהעדכון הזה. כוכבים חדשים עם פירוט: ${n(s.classified)}.</p></div></aside>` : ''}
  <div class="rewards-actions"><a class="button whatsapp-share" href="${esc(whatsappShareUrl(progress, topics))}" target="_blank" rel="noopener noreferrer" aria-label="שתפו את ההתקדמות בווטסאפ">${icon('share')} שתפו בווטסאפ</a><button class="button secondary stats-back icon-only" aria-label="${session ? 'בחזרה לתרגול' : 'בחזרה לרשימת הנושאים'}">${icon('arrow')}</button></div>
  <div class="rewards-section-heading"><h2>הכוכבים בכל נושא</h2><span>${topics.length} נושאים במסע</span></div><section class="rewards-topics" aria-label="פירוט לפי נושא">${orderedRows.map(row => `<article class="rewards-topic ${row.total ? 'earned' : 'zero'}"><div class="rewards-topic-heading"><h3>${esc(row.name)}</h3><span class="topic-stars">${icon('star')}<b>${n(row.total)}</b></span></div><dl><div><dt>ניסיון ראשון</dt><dd>${n(row.first)}</dd></div><div><dt>ניסיון שני</dt><dd>${n(row.second)}</dd></div><div><dt>מתוכם חיזוק</dt><dd>${n(row.review)}</dd></div></dl></article>`).join('')}</section><p class="quiet-note rewards-footnote">ההתקדמות נשמרת בדפדפן ובמכשיר הזה.</p></main>`;
  bindHeader();
}
function nextLabel() {
  if (session.index + 1 < session.queue.length) return 'לשאלה הבאה';
  return 'לסיכום התרגול';
}
function feedback(q) {
  if (session.result === 'correct') return `${icon('star')} מצוין! תשובה נכונה וכוכב נוסף`;
  if (session.result === 'second') return `${icon('star')} הצלחת בניסיון השני! קיבלת כוכב. נחזק את המילה בהמשך.`;
  if (session.result === 'retry') return 'עוד לא, אבל יש עוד ניסיון! הקשיבו למילה ובחרו שוב.';
  if (session.result === 'revealed') return `לומדים וממשיכים. התשובה הנכונה: <strong>${esc(q.meaning)}</strong>`;
  return '';
}
function choose(index) {
  if (!session || session.finished || !choices[index]) return;
  if (answerQuestion(session, progress, current(), choices[index])) { void pronunciation.play(pronunciationSource(current())); save(); renderQuestion(); if (session.done) app.querySelector('.next').focus({ preventScroll: true }); }
}
function next() {
  if (!session?.done) return;
  pronunciation.stop();
  advanceSession(session);
  save();
  if (session.finished) renderSummary();
  else { renderQuestion(true); window.scrollTo(0, 0); }
}
function renderSummary() {
  pronunciation.stop();
  pronunciation.prepare([]);
  prepareAnswerImages([]);
  answerPlans.clear();
  const t = topic(), s = topicStats(t, progress), review = session.mode === 'review';
  const needsReview = !review && s.pending.length > 0;
  const following = topics[topics.indexOf(t) + 1];
  const heading = review && s.pending.length ? 'סיימנו את סבב החיזוק!' : s.complete ? 'הנושא הזה בכיס שלכם!' : needsReview ? 'כל תרגול עושה אותנו טובים יותר.' : 'עוד צעד נהדר במסע!';
  const intro = needsReview ? 'עכשיו נעשה סבב חיזוק אחד למילים שהיו קצת יותר קשות.' : review && s.pending.length ? 'כל שאלה הופיעה פעם אחת. מה שעדיין צריך חיזוק נשמר לפעם הבאה, ואפשר להמשיך לנושא אחר.' : 'כל הכבוד על ההתמדה. אפשר לבחור נושא אחר ולהמשיך במסע.';
  app.innerHTML = `${header(true)}<main id="main" class="summary" tabindex="-1">${saveNotice()}<div class="summary-emblem ${s.pending.length ? '' : 'finished'}">${icon(s.pending.length ? 'star' : 'check')}</div><span class="eyebrow">${esc(t.he)} · ${review ? 'סיכום סבב החיזוק' : 'סיכום התרגול'}</span><h1 tabindex="-1">${heading}</h1><p class="summary-intro">${intro}</p><div class="summary-stats"><div>${icon('star')}<b>${session.stars}</b><span>כוכבים חדשים</span></div><div>${icon('check')}<b>${session.firstCorrect}<small> / ${session.answered}</small></b><span>הצלחות בניסיון הראשון</span></div><div>${icon(s.pending.length ? 'refresh' : 'check')}<b>${s.pending.length}</b><span>שאלות לניקוי</span></div></div>
  ${s.pending.length ? `<div class="review-explanation"><h2>${needsReview ? 'עכשיו: סבב חיזוק אחד' : 'שומרים את החיזוק להמשך'}</h2><p>${needsReview ? 'כל שאלה שטעינו בה תופיע פעם אחת בסבב. ' : 'אפשר לתרגל נושא אחר ולחזור לכאן מאוחר יותר. '}כל שאלה מתנקה אחרי <strong>3 תשובות נכונות בניסיון הראשון</strong>, גם בביקורים שונים. טעות נוספת מתחילה את הספירה שלה מחדש.</p><div class="pending-words">${s.pending.map(q => `<span lang="en" dir="ltr">${esc(q.word)} <small>${itemProgress(progress, q.id).streak}/3</small></span>`).join('')}</div></div>` : `<div class="completion-note">${icon('check')} ${s.complete ? 'כל המילים בנושא נלמדו, ואין שאלות שמחכות לניקוי.' : 'הטעויות נוקו! בכניסה הבאה לנושא נמשיך במילים שעוד לא תרגלנו.'}</div>`}
  ${needsReview ? `<button class="button primary review-start">לסבב חיזוק אחד ${icon('refresh')}</button><button class="text-button summary-home">שומרים להמשך וחוזרים לנושאים</button>` : `<div class="summary-actions">${following ? `<button class="button primary next-topic">לנושא הבא: ${esc(following.he)} ${icon('arrow')}</button>` : ''}<button class="button ${following ? 'secondary' : 'primary'} summary-home">בחזרה לכל הנושאים ${icon('book')}</button></div>`}
  ${review && !s.pending.length ? '<p class="quiet-note">התמדתם, תרגלתם וניקיתם את כל הטעויות. זה בדיוק איך שמתקדמים.</p>' : ''}</main>`;
  bindHeader();
  app.querySelector('.summary-home').addEventListener('click', goHome);
  app.querySelector('.review-start')?.addEventListener('click', () => begin(t.id));
  app.querySelector('.next-topic')?.addEventListener('click', () => begin(following.id));
  window.scrollTo(0, 0); app.querySelector('.summary h1').focus({ preventScroll: true });
}
function showHelp() {
  const dialog = document.createElement('dialog');
  dialog.className = 'help-dialog';
  dialog.innerHTML = `<form method="dialog"><button class="close-dialog" aria-label="סגירה">${icon('close')}</button></form><span class="eyebrow">פשוט מתחילים</span><h2>כך משחקים במסע המילים</h2><ol><li>בוחרים נושא וקוראים את המילה או הביטוי באנגלית.</li><li>בוחרים פירוש בעברית ושומעים את המילה באנגלית.</li><li>טעיתם? במקום איור מופיע כפתור להשמעה חוזרת ויש ניסיון נוסף. אחרי שתי טעויות מתגלה התשובה.</li><li>כל תשובה נכונה מזכה בכוכב, גם בניסיון השני.</li><li>שאלה שטעינו בה צריכה 3 הצלחות בניסיון הראשון כדי להתנקות. טעות נוספת מאפסת את הספירה שלה.</li></ol><p>אחרי נושא עושים לכל היותר סבב חיזוק אחד, ובו כל שאלה מופיעה פעם אחת. אחר כך בוחרים נושא אחר או חוזרים לרשימה. ההצלחות לניקוי מצטברות בין ביקורים. בנושא עם טעויות מתרגלים רק אותן. סימן חזרה מציין שאלות לניקוי; וי מציין נושא שנלמד ונוקה לגמרי.</p><p class="quiet-note">הקריינות נוצרה ב־AI בקולות Marin ו־Cedar. ההתקדמות נשמרת בדפדפן ובמכשיר הזה. אפשר לצאת באמצע; נמשיך מהמקום המתאים כשנחזור.</p><form method="dialog"><button class="button primary">מוכנים, מתחילים!</button></form>`;
  document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove()); dialog.showModal();
}
document.addEventListener('keydown', event => {
  if (showingRewards || !session || session.finished || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return;
  if (/^[1-4]$/.test(event.key) && !session.done) { event.preventDefault(); choose(Number(event.key) - 1); }
});
try {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error('Vocabulary could not be loaded');
  topics = await response.json();
  try { progress = sanitizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)), topics); }
  catch { progress = blankProgress(); }
  // A harmless write detects disabled/full storage before any answers are lost.
  save(); renderHome();
} catch {
  app.innerHTML = '<main class="load-error"><h1>לא הצלחנו לטעון את המילים</h1><p>בדקו את החיבור ונסו לרענן את העמוד.</p><button class="button primary" onclick="location.reload()">ננסה שוב</button></main>';
}

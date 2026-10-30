import { STORAGE_KEY, blankProgress, sanitizeProgress, topicStats, itemProgress, startSession, answerQuestion, advanceSession, choicesFor } from './engine.js';

const app = document.querySelector('#app');
let topics, progress, session = null, choices = [], filter = 'all', saveFailed = false;
const icons = {
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  book: '<path d="M12 6C9 3 5 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-2-9 1zm0 0v14"/>',
  question: '<path d="M9 8a3 3 0 1 1 5 2c-1 1-2 1-2 4m0 3v.1"/><circle cx="12" cy="12" r="10"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const asset = key => `./images/${encodeURIComponent(key)}.webp`;
const topic = () => topics.find(t => t.id === session.topicId);
const current = () => topic().items.find(q => q.id === session.queue[session.index]);

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); saveFailed = false; }
  catch { saveFailed = true; }
}
function saveNotice() { return saveFailed ? '<p class="save-warning" role="alert">הדפדפן לא מאפשר לשמור התקדמות. אפשר לתרגל, אבל ההתקדמות תישמר רק כל עוד העמוד פתוח.</p>' : ''; }
function header(inPractice = false) {
  return `<header class="site-header"><a href="#" class="brand" aria-label="מסע המילים, למסך הראשי"><span class="brand-icon">${icon('book')}</span><span>מסע המילים<small lang="en" dir="ltr">ENGLISH 2026</small></span></a><div class="header-end">${inPractice ? '<button class="text-button leave">שומרים ויוצאים ' + icon('arrow') + '</button>' : '<button class="text-button help-button">איך משחקים? ' + icon('question') + '</button>'}<span class="star-counter" aria-label="${progress.stars} כוכבים בסך הכול">${icon('star')}<b>${progress.stars}</b></span></div></header>`;
}
function bindHeader() {
  app.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); goHome(); });
  app.querySelector('.leave')?.addEventListener('click', goHome);
  app.querySelector('.help-button')?.addEventListener('click', showHelp);
}
function goHome() { session = null; save(); renderHome(); window.scrollTo(0, 0); }

function renderHome() {
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
    <footer>נוצר באהבה ללימוד אנגלית · המילים והאיורים מהחוברת<br><span>ההתקדמות נשמרת בדפדפן הזה, במכשיר הזה.</span></footer></main>`;
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
  session = startSession(topics.find(t => t.id === id), progress);
  choices = choicesFor(current(), topic(), topics);
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
  const progressPercent = review ? t.items.filter(x => itemProgress(progress, x.id).seen && !itemProgress(progress, x.id).debt).length / t.items.length * 100 : session.index / session.queue.length * 100;
  app.innerHTML = `${header(true)}<main id="main" class="practice" tabindex="-1">${saveNotice()}<div class="practice-heading"><div><span class="eyebrow">${review ? 'מחזקים את מה שעוד קשה' : 'לומדים ומגלים'}</span><h1>${esc(t.he)}</h1></div><span class="round-label">${review ? `סבב חיזוק ${session.round}` : `שאלה ${session.index + 1} מתוך ${session.queue.length}`}</span></div><div class="session-progress" role="progressbar" aria-label="התקדמות בנושא" aria-valuenow="${Math.round(progressPercent)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progressPercent}%"></span></div>
  <div class="question-layout"><section class="question-panel" aria-labelledby="question-word"><div class="question-label">${q.word === 'play' ? 'מה פירוש המילה המודגשת במשפט?' : 'מה הפירוש בעברית?'}</div><h2 id="question-word" tabindex="-1" lang="en" dir="ltr">${esc(q.word)}</h2>${q.example ? `<p class="example" lang="en" dir="ltr">${highlightedExample(q)}</p>` : ''}<div class="mastery-slot">${p.debt ? `<div class="mastery"><span>מנקים את השאלה</span><div class="mastery-dots" aria-label="${p.streak} מתוך 3 תשובות נכונות בניסיון הראשון">${[1, 2, 3].map(n => `<span class="${p.streak >= n ? 'filled' : ''}">${p.streak >= n ? icon('check') : n}</span>`).join('')}</div><small>3 הצלחות בניסיון הראשון · טעות מתחילה מחדש</small></div>` : review && session.done ? `<div class="cleaned">${icon('check')} השאלה נקייה! כל הכבוד</div>` : ''}</div>
  <div class="answers" aria-label="תשובות אפשריות">${choices.map((meaning, i) => {
    const wrong = session.wrong.includes(meaning), right = session.done && meaning === q.meaning;
    return `<button class="answer ${wrong ? 'wrong' : ''} ${right ? 'right' : ''}" data-answer="${i}" ${session.done || wrong ? 'disabled' : ''}><span class="answer-key">${right ? icon('check') : wrong ? icon('close') : i + 1}</span><span>${esc(meaning)}</span></button>`;
  }).join('')}</div><div class="feedback ${session.result || ''}" role="status" aria-live="polite">${feedback(q)}</div><div class="question-actions">${session.done ? `<button class="button primary next">${nextLabel()} ${icon('arrow')}</button>` : '<span class="keyboard-hint">בוחרים תשובה אחת · אפשר גם במקשים 1–4</span>'}<span class="session-stars">${icon('star')} ${session.stars} כוכבים בתרגול</span></div></section>
  <aside class="illustration-panel ${session.reveal ? 'revealed' : ''}" aria-label="איור המילה">${session.reveal ? `<span class="illustration-label">עכשיו גם רואים את זה</span><img class="question-image" src="${asset(q.asset)}" alt="איור של ${esc(q.word)}"><div class="image-caption">${session.done ? `<strong lang="en" dir="ltr">${esc(q.word)}</strong><span>${esc(q.meaning)}</span>` : 'התמונה יכולה לעזור. עוד ניסיון?'}</div>` : `<div class="hidden-art">${icon('question')}<h3>קודם חושבים,<br>אחר כך מגלים.</h3><p>האיור יופיע אחרי<br>שתבחרו תשובה.</p><span class="secret-spark">✦</span></div>`}</aside></div><div class="practice-footnote">${review ? `${topicStats(t, progress).pending.length} שאלות עדיין מחכות לניקוי · אפשר לשמור ולצאת בכל רגע` : 'טעות היא הזדמנות ללמוד. יש שני ניסיונות בכל שאלה.'}</div></main>`;
  bindHeader();
  app.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => choose(Number(button.dataset.answer))));
  app.querySelector('.next')?.addEventListener('click', next);
  if (focusHeading) app.querySelector('#question-word').focus({ preventScroll: true });
}
function nextLabel() {
  if (session.index + 1 < session.queue.length) return 'לשאלה הבאה';
  if (session.mode === 'review' && topicStats(topic(), progress).pending.length) return 'לסבב החיזוק הבא';
  return 'לסיכום התרגול';
}
function feedback(q) {
  if (session.result === 'correct') return `${icon('star')} מצוין! תשובה נכונה וכוכב נוסף`;
  if (session.result === 'second') return `${icon('star')} הצלחת בניסיון השני! קיבלת כוכב. נחזק את המילה בהמשך.`;
  if (session.result === 'retry') return 'עוד לא, אבל יש עוד ניסיון! היעזרו בתמונה ובחרו שוב.';
  if (session.result === 'revealed') return `לומדים וממשיכים. התשובה הנכונה: <strong>${esc(q.meaning)}</strong>`;
  return '';
}
function choose(index) {
  if (!session || session.finished || !choices[index]) return;
  if (answerQuestion(session, progress, current(), choices[index])) { save(); renderQuestion(); if (session.done) app.querySelector('.next').focus({ preventScroll: true }); }
}
function next() {
  if (!session?.done) return;
  advanceSession(session, topic(), progress);
  save();
  if (session.finished) renderSummary();
  else { choices = choicesFor(current(), topic(), topics); renderQuestion(true); window.scrollTo(0, 0); }
}
function renderSummary() {
  const t = topic(), s = topicStats(t, progress), review = session.mode === 'review';
  app.innerHTML = `${header(true)}<main id="main" class="summary" tabindex="-1">${saveNotice()}<div class="summary-emblem ${s.pending.length ? '' : 'finished'}">${icon(s.pending.length ? 'star' : 'check')}</div><span class="eyebrow">${esc(t.he)} · סיכום התרגול</span><h1 tabindex="-1">${s.pending.length ? 'כל תרגול עושה אותנו טובים יותר.' : s.complete ? 'הנושא הזה בכיס שלכם!' : 'עוד צעד נהדר במסע!'}</h1><p class="summary-intro">${s.pending.length ? 'אספנו כוכבים, ועכשיו נחזק יחד את המילים שהיו קצת יותר קשות.' : 'כל הכבוד על ההתמדה. אפשר לחזור לנושאים ולהמשיך במסע.'}</p><div class="summary-stats"><div>${icon('star')}<b>${session.stars}</b><span>כוכבים חדשים</span></div><div>${icon('check')}<b>${session.firstCorrect}<small> / ${session.answered}</small></b><span>הצלחות בניסיון הראשון</span></div><div>${icon(s.pending.length ? 'refresh' : 'check')}<b>${s.pending.length}</b><span>שאלות לניקוי</span></div></div>
  ${s.pending.length ? `<div class="review-explanation"><h2>עכשיו: סיבוב חיזוק</h2><p>מתרגלים רק את השאלות שטעינו בהן. כל שאלה מתנקה אחרי <strong>3 תשובות נכונות בניסיון הראשון</strong>. טעות נוספת מתחילה את הספירה שלה מחדש.</p><div class="pending-words">${s.pending.map(q => `<span lang="en" dir="ltr">${esc(q.word)} <small>${itemProgress(progress, q.id).streak}/3</small></span>`).join('')}</div></div><button class="button primary review-start">בואו ננקה את השאלות ${icon('refresh')}</button><button class="text-button summary-home">שומרים להמשך וחוזרים לנושאים</button>` : `<div class="completion-note">${icon('check')} ${s.complete ? 'כל המילים בנושא נלמדו, ואין שאלות שמחכות לניקוי.' : 'הטעויות נוקו! בכניסה הבאה לנושא נמשיך במילים שעוד לא תרגלנו.'}</div><button class="button primary summary-home">בחזרה לכל הנושאים ${icon('arrow')}</button>`}
  ${review && !s.pending.length ? '<p class="quiet-note">התמדתם, תרגלתם וניקיתם את כל הטעויות. זה בדיוק איך שמתקדמים.</p>' : ''}</main>`;
  bindHeader();
  app.querySelector('.summary-home').addEventListener('click', goHome);
  app.querySelector('.review-start')?.addEventListener('click', () => begin(t.id));
  window.scrollTo(0, 0); app.querySelector('.summary h1').focus({ preventScroll: true });
}
function showHelp() {
  const dialog = document.createElement('dialog');
  dialog.className = 'help-dialog';
  dialog.innerHTML = `<form method="dialog"><button class="close-dialog" aria-label="סגירה">${icon('close')}</button></form><span class="eyebrow">פשוט מתחילים</span><h2>כך משחקים במסע המילים</h2><ol><li>בוחרים נושא וקוראים את המילה או הביטוי באנגלית.</li><li>בוחרים פירוש בעברית. אחרי הבחירה האיור מתגלה.</li><li>טעיתם? יש ניסיון נוסף. אחרי שתי טעויות מתגלה התשובה.</li><li>כל תשובה נכונה מזכה בכוכב, גם בניסיון השני.</li><li>שאלה שטעינו בה צריכה 3 הצלחות בניסיון הראשון כדי להתנקות. טעות נוספת מאפסת את הספירה שלה.</li></ol><p>בנושא עם טעויות מתרגלים רק אותן. סימן חזרה מציין שאלות לניקוי; וי מציין נושא שנלמד ונוקה לגמרי.</p><p class="quiet-note">ההתקדמות נשמרת בדפדפן ובמכשיר הזה. אפשר לצאת באמצע; נמשיך מהמקום המתאים כשנחזור.</p><form method="dialog"><button class="button primary">מוכנים, מתחילים!</button></form>`;
  document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove()); dialog.showModal();
}
document.addEventListener('keydown', event => {
  if (!session || session.finished || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return;
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

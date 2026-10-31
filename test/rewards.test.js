import test from 'node:test';
import assert from 'node:assert/strict';
import { blankProgress, sanitizeProgress, startSession, answerQuestion, advanceSession, STAR_FIELDS } from '../src/engine.js';
import { rewardSummary, progressShareText, whatsappShareUrl } from '../src/rewards.js';
const t = { id: 'test', he: 'בעלי חיים', items: [{id:'a',word:'cat',meaning:'חתול'},{id:'b',word:'dog',meaning:'כלב'}] };
const fixed = () => .9999;

test('streak crosses questions and topics, resets immediately on a mistake, and a retry starts at one', () => {
  const p = blankProgress(); let s = startSession(t, p, fixed);
  answerQuestion(s,p,t.items[0],'חתול'); advanceSession(s);
  assert.equal(p.combo.current,1);
  answerQuestion(s,p,t.items[1],'כלב');
  assert.deepEqual(p.combo,{current:2,best:2});
  assert.equal(answerQuestion(s,p,t.items[1],'כלב'),false);
  const another = {...t,id:'another'}; s=startSession(another,p,fixed);
  answerQuestion(s,p,t.items[0],'חתול'); assert.equal(p.combo.current,3);
  advanceSession(s); answerQuestion(s,p,t.items[1],'טעות');
  assert.deepEqual(p.combo,{current:0,best:3});
  answerQuestion(s,p,t.items[1],'כלב');
  assert.deepEqual(p.combo,{current:1,best:3});
  const restored=sanitizeProgress(JSON.parse(JSON.stringify(p)),[t,another]);
  assert.deepEqual(restored.combo,p.combo);
});
test('first/second totals include review stars without double counting them', () => {
  const p=blankProgress(); let s=startSession(t,p,fixed);
  answerQuestion(s,p,t.items[0],'חתול'); advanceSession(s);
  answerQuestion(s,p,t.items[1],'טעות'); answerQuestion(s,p,t.items[1],'כלב');
  p.items.a={seen:true,debt:true,streak:0}; s=startSession(t,p,fixed);
  answerQuestion(s,p,t.items[0],'חתול'); advanceSession(s);
  answerQuestion(s,p,t.items[1],'טעות'); answerQuestion(s,p,t.items[1],'כלב');
  assert.deepEqual(p.starBreakdown.test,{learningFirst:1,learningSecond:1,reviewFirst:1,reviewSecond:1});
  const stats=rewardSummary(p,[t]);
  assert.equal(stats.total,4); assert.equal(stats.first,2); assert.equal(stats.second,2); assert.equal(stats.review,2);
  assert.equal(stats.previous,0); assert.equal(stats.rows[0].total,4);
  assert.equal(stats.first+stats.second,stats.classified);
});
test('old progress preserves every star and cleanup count without inventing a historical breakdown', () => {
  const p=sanitizeProgress({version:1,stars:37,items:{a:{seen:true,debt:true,streak:2}}},[t]);
  assert.equal(p.version,2); assert.equal(p.stars,37); assert.equal(p.items.a.streak,2);
  assert.equal(rewardSummary(p,[t]).previous,37);
  const s=startSession(t,p,fixed); answerQuestion(s,p,t.items[0],'חתול');
  const stats=rewardSummary(p,[t]);
  assert.equal(stats.total,38); assert.equal(stats.previous,37); assert.equal(stats.review,1);
  assert.equal(p.items.a.debt,false);
  assert.ok(progressShareText(p,[t]).includes('כוכבים קודמים הכלולים בסכום: 37'));
  assert.ok(progressShareText(p,[t]).includes('כוכבים חדשים עם פירוט: 1'));
  assert.deepEqual(sanitizeProgress(JSON.parse(JSON.stringify(p)),[t]),p);
});
test('malformed counters cannot exceed the saved total or remove existing stars', () => {
  const p=sanitizeProgress({version:2,stars:5,items:{},starBreakdown:{test:{learningFirst:3,learningSecond:9,reviewFirst:-1,reviewSecond:2.5},unknown:{learningFirst:40}},combo:{current:900,best:-1}},[t]);
  assert.equal(p.stars,5);
  assert.equal(STAR_FIELDS.reduce((sum,f)=>sum+(p.starBreakdown.test?.[f]||0),0),5);
  assert.deepEqual(p.combo,{current:5,best:5});
  assert.equal(p.starBreakdown.unknown,undefined);
});
test('WhatsApp prepares a readable draft with totals, category breakdown and a correct encoded Hebrew URL', () => {
  const p=blankProgress(),s=startSession(t,p,fixed);answerQuestion(s,p,t.items[0],'חתול');
  const text=progressShareText(p,[t]),url=new URL(whatsappShareUrl(p,[t]));
  assert.equal(url.hostname,'wa.me'); assert.equal(url.searchParams.get('text'),text);
  assert.ok(text.includes('צברתי 1 כוכב')); assert.ok(text.includes('בעלי חיים: 1'));
  assert.ok(text.includes('מתוכם בסבבי חיזוק: 0'));
  assert.ok(text.endsWith('https://english2026-practice.glossysnow66.chatgpt.site/'));
});

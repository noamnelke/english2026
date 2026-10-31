import test from 'node:test';
import assert from 'node:assert/strict';
import { createPronunciationPlayer, showQuestionImage, pronunciationSource } from '../src/audio.js';
import { voiceForTopic, spokenText } from '../src/pronunciation.js';
function fixture() {
  const clips = [], states = [];
  const player = createPronunciationPlayer(() => {
    const handlers = {};
    const clip = {
      currentTime: 0, plays: 0, pauses: 0, loads: 0,
      addEventListener: (name, fn) => { handlers[name] = fn; },
      emit: name => handlers[name](),
      load() { this.loads++; }, pause() { this.pauses++; },
      play() { this.plays++; return this.result ?? Promise.resolve(); },
      removeAttribute(name) { delete this[name]; },
    };
    clips.push(clip); return clip;
  }, state => states.push(state));
  return { player, clips, states };
}
test('pronunciation preloads just current and next, reuses the next clip and never plays before an answer', () => {
  const {player,clips}=fixture(); player.prepare(['a.mp3','b.mp3','c.mp3']);
  assert.equal(clips.length,2); assert.deepEqual(clips.map(c=>c.preload),['auto','auto']);
  assert.equal(clips.reduce((n,c)=>n+c.plays,0),0);
  player.prepare(['a.mp3','b.mp3']); assert.equal(clips.length,2);
  player.prepare(['b.mp3','c.mp3']); assert.equal(clips.length,3);
  assert.equal(clips[0].src,undefined); assert.equal(clips[1].loads,1);
});
test('answer/replay starts synchronously in the user gesture and restarts the same recording without overlap', async () => {
  const {player,clips,states}=fixture();player.prepare(['a.mp3','b.mp3']);
  const playback=player.play('a.mp3');assert.equal(clips[0].plays,1);assert.equal(states.at(-1),'loading');
  await playback;assert.equal(states.at(-1),'playing');clips[0].currentTime=.5;
  await player.play('a.mp3');assert.equal(clips[0].currentTime,0);assert.equal(clips[0].plays,2);assert.ok(clips[0].pauses);
  await player.play('b.mp3');assert.equal(clips[1].plays,1);assert.equal(clips[0].currentTime,0);
  clips[0].emit('ended');assert.equal(states.at(-1),'playing');
  clips[1].emit('ended');assert.equal(states.at(-1),'idle');
});
test('leaving or advancing cancels delayed playback status and releases unused audio', async () => {
  const {player,clips,states}=fixture(); player.prepare(['a.mp3','b.mp3']);let resolve;
  clips[0].result=new Promise(r=>{resolve=r;});const playback=player.play('a.mp3');
  player.stop();resolve();assert.equal(await playback,false);assert.equal(states.at(-1),'idle');
  player.prepare([]);assert.ok(clips.every(c=>c.src===undefined));
});
test('network or browser playback failures remain retryable without unhandled errors', async () => {
  const {player,clips,states}=fixture();player.prepare(['a.mp3']);
  clips[0].result=Promise.reject(new Error('blocked'));assert.equal(await player.play('a.mp3'),false);assert.equal(states.at(-1),'error');
  clips[0].error={code:2};clips[0].result=Promise.resolve();await player.play('a.mp3');assert.equal(clips[0].loads,2);assert.equal(states.at(-1),'playing');
});
test('neither first nor second mistake reveals the central picture; a correct retry does', () => {
  for(const result of [undefined,null,'retry','revealed'])assert.equal(showQuestionImage(result),false);
  for(const result of ['correct','second'])assert.equal(showQuestionImage(result),true);
});
test('each topic has one stable selected voice and spoken prompts omit capitalization alternatives and placeholders', () => {
  assert.equal(voiceForTopic('topic-01'),'marin');assert.equal(voiceForTopic('topic-02'),'cedar');assert.equal(voiceForTopic('topic-21'),'marin');
  assert.equal(spokenText('The / the'),'The');assert.equal(spokenText('And / and'),'And');
  assert.equal(spokenText("Let's go (to) ..."),"Let's go to");assert.equal(spokenText("What's in the ...?"),"What's in the?");
  assert.equal(pronunciationSource({id:'topic-18-05'}),'./audio/topic-18-05.mp3');
});

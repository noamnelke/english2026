import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { voiceForTopic, spokenText } from '../src/pronunciation.js';
const topics = JSON.parse(await readFile(new URL('../src/data.json', import.meta.url)));
test('all 223 prompts have a real recorded MP3 with the correct topic voice and spoken text', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/audio/catalog.json', import.meta.url)));
  const clips = new Map(catalog.clips.map(c=>[c.id,c]));
  assert.equal(clips.size,223);
  const voices=new Map();
  for (const topic of topics) {
    for (const question of topic.items) {
      const clip=clips.get(question.id);
      assert.ok(clip,question.id);assert.equal(clip.voice,voiceForTopic(topic.id));assert.equal(clip.text,spokenText(question.word));
      voices.set(topic.id,clip.voice);
      assert.ok((await stat(new URL(`../public/audio/${question.id}.mp3`, import.meta.url))).size>1000);
    }
  }
  assert.equal([...voices.values()].filter(v=>v==='marin').length,11);
  assert.equal([...voices.values()].filter(v=>v==='cedar').length,10);
});

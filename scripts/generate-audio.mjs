import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { voiceForTopic, spokenText } from '../src/pronunciation.js';

const topics = JSON.parse(await readFile(new URL('../src/data.json', import.meta.url)));
const instructions = 'Read the English vocabulary item exactly once, naturally and clearly, as a friendly teacher. Use a General American accent, an even speaking pace, and a clean neutral tone. Start speaking immediately. Say only the script, then finish after the final word.';
const model = 'gpt-4o-mini-tts-2025-12-15';
const directory = new URL('../public/audio/', import.meta.url);
const plan = topics.flatMap(topic => topic.items.map(question => ({
  id: question.id, topic: topic.id, voice: voiceForTopic(topic.id), text: spokenText(question.word), file: `${question.id}.mp3`,
})));
const only = process.argv.find(value => value.startsWith('--only='))?.slice(7).split(',');
const jobs = only ? plan.filter(job => only.includes(job.id)) : plan;
const force = process.argv.includes('--force');
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ model, recordings: jobs.length, topics: topics.map(t => ({ id: t.id, voice: voiceForTopic(t.id) })) }, null, 2));
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in the local environment before generating recordings.');
await mkdir(directory, { recursive: true });
const catalogPath = new URL('catalog.json', directory);
let previous;
try { previous = JSON.parse(await readFile(catalogPath)); } catch { previous = { clips: [] }; }
const complete = new Map(previous.clips.map(clip => [clip.id, clip]));
const persist = () => writeFile(catalogPath, JSON.stringify({ model, instructions, clips: [...complete.values()].sort((a,b) => a.id.localeCompare(b.id)) }, null, 2) + '\n');
for (const job of jobs) {
  const saved = complete.get(job.id);
  let exists = false;
  try { exists = (await stat(new URL(job.file, directory))).size > 1000; } catch {}
  if (!force && exists && saved?.voice === job.voice && saved?.text === job.text) continue;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, voice: job.voice, input: job.text, instructions, response_format: 'mp3' }),
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const seconds = Math.min(30, Math.max(2 ** (attempt + 1), Number(response.headers.get('retry-after')) || 0));
      await response.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Speech generation failed for ${job.id}: HTTP ${response.status}. No credentials were written to output.`); }
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 1000) throw new Error(`Unexpected empty recording for ${job.id}`);
    await writeFile(new URL(job.file, directory), audio);
    complete.set(job.id, job); await persist();
    console.log(`Recorded ${job.id} (${job.voice}); ${complete.size} clips available`);
    break;
  }
}
console.log(`Ready: ${complete.size} recorded pronunciations. The API is used only during generation, never in the browser.`);

// Offline cleanup: retain natural consonant onsets, remove waiting time and match peak levels.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../public/audio/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', root)));
const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg';
const results=[];
const from = process.argv.find(value => value.startsWith('--from='))?.slice(7);
const only = process.argv.find(value => value.startsWith('--only='))?.slice(7).split(',');
for (const clip of catalog.clips) {
  if ((from && clip.id < from) || (only && !only.includes(clip.id))) continue;
  const file=fileURLToPath(new URL(clip.file,root));
  const pcm=execFileSync(ffmpeg,['-v','error','-i',file,'-ac','1','-ar','24000','-f','f32le','pipe:1'],{maxBuffer:8*1024*1024});
  const samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.byteLength/4);
  let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
  if (peak < .03) throw new Error(`Silent or inaudible recording: ${clip.id}`);
  const threshold=Math.max(.003,peak*.015);
  let first=0,last=samples.length-1;
  while(first<samples.length && Math.abs(samples[first])<threshold)first++;
  while(last>first && Math.abs(samples[last])<threshold)last--;
  // Single words and known repeated short phrases need just the first utterance.
  if (!clip.text.includes(' ') || ['topic-17-04','topic-19-10','topic-20-02'].includes(clip.id)) {
    let lastSound=first;
    for(let i=first;i<=last;i++) if(Math.abs(samples[i])>=threshold) {
      if(i-lastSound>24000*.3) { last=lastSound; break; }
      lastSound=i;
    }
  }
  const start=Math.max(0,first/24000-.08),end=Math.min(samples.length/24000,last/24000+.14);
  if(end-start<.12)throw new Error(`Speech too short: ${clip.id}`);
  const gain=Math.min(3,.78/peak);
  const temporary=file+'.processed.mp3';
  execFileSync(ffmpeg,['-v','error','-y','-i',file,'-af',`atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,volume=${gain},asetnsamples=n=1152:p=1`,'-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','128k',temporary]);
  await rename(temporary,file);
  results.push({id:clip.id,trimmedStart:+start.toFixed(3),trimmedEnd:+(samples.length/24000-end).toFixed(3),duration:+(end-start).toFixed(3)});
}
catalog.processing={silencePaddingBeforeSeconds:.08,silencePaddingAfterSeconds:.14,peakTarget:.78};
await writeFile(new URL('catalog.json',root),JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({processed:results.length,maximumSpeechDuration:Math.max(...results.map(r=>r.duration)),totalSilenceRemoved:+results.reduce((n,r)=>n+r.trimmedStart+r.trimmedEnd,0).toFixed(2)}));

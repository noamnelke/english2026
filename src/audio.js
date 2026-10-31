// Keep only the current pronunciation and the next one; never play on preload.
export function createPronunciationPlayer(makeAudio = () => new Audio(), onState = () => {}) {
  const clips = new Map();
  let active = null, revision = 0;
  const notify = state => onState(state);
  function stop() {
    revision++;
    const previous = active;
    active = null;
    if (previous) { previous.pause(); previous.currentTime = 0; }
    notify('idle');
  }
  function get(src) {
    let clip = clips.get(src);
    if (clip) return clip;
    clip = makeAudio();
    clip.preload = 'auto';
    for (const [event, state] of [['playing', 'playing'], ['waiting', 'loading'], ['ended', 'idle'], ['error', 'error']]) {
      clip.addEventListener(event, () => { if (active === clip) notify(state); });
    }
    clip.src = src;
    clips.set(src, clip);
    clip.load();
    return clip;
  }
  function prepare(sources) {
    const window = [...new Set(sources.filter(Boolean))].slice(0, 2);
    for (const [src, clip] of clips) if (!window.includes(src)) {
      if (clip === active) stop();
      clip.pause(); clip.removeAttribute('src'); clip.load(); clips.delete(src);
    }
    window.forEach(get);
  }
  function play(src) {
    stop();
    if (!clips.has(src)) prepare([src]);
    const clip = get(src), attempt = revision;
    active = clip;
    if (clip.error) clip.load();
    notify('loading');
    // Called synchronously from the answer/replay gesture, including on iOS.
    try {
      return Promise.resolve(clip.play()).then(() => {
        if (attempt === revision && active === clip) notify('playing');
        return attempt === revision;
      }).catch(() => { if (attempt === revision) notify('error'); return false; });
    } catch {
      notify('error');
      return Promise.resolve(false);
    }
  }
  return { prepare, play, stop };
}

export const showQuestionImage = result => result === 'correct' || result === 'second';
export const pronunciationSource = question => `./audio/${encodeURIComponent(question.id)}.mp3`;

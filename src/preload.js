// Each pool keeps a bounded window of decoded images for the current and next question.
export function createImagePreloader(makeImage = () => new Image(), { limit = 2 } = {}) {
  const images = new Map();
  function prepare(requests, highPriorityCount = 1) {
    const entries = requests.filter(Boolean).map(request => typeof request === 'string' ? { key: request, src: request } : request);
    const window = [...new Map(entries.map(entry => [entry.key, entry])).values()].slice(0, limit);
    const keys = new Set(window.map(entry => entry.key));
    for (const key of images.keys()) if (!keys.has(key)) images.delete(key);
    window.forEach(({ key, src }, index) => {
      let image = images.get(key);
      if (image) {
        image.fetchPriority = index < highPriorityCount ? 'high' : 'low';
        return;
      }
      image = makeImage();
      image.decoding = 'async';
      image.fetchPriority = index < highPriorityCount ? 'high' : 'low';
      images.set(key, image);
      image.src = src;
      // Decode without delaying the question or the answer controls. Failed preloads
      // may retry on reveal; a network/decode failure must never interrupt practice.
      image.decode().catch(() => {
        if (image.complete && image.naturalWidth === 0 && images.get(key) === image) images.delete(key);
      });
    });
    return images.get(window[0]?.key) || null;
  }
  prepare.get = key => images.get(key) || null;
  return prepare;
}

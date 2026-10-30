// Keep only the current illustration and one question ahead in the decoded-image pool.
export function createImagePreloader(makeImage = () => new Image()) {
  const images = new Map();
  return function prepare(urls) {
    const window = [...new Set(urls.filter(Boolean))].slice(0, 2);
    for (const url of images.keys()) if (!window.includes(url)) images.delete(url);
    window.forEach((url, index) => {
      let image = images.get(url);
      if (image) {
        image.fetchPriority = index === 0 ? 'high' : 'low';
        return;
      }
      image = makeImage();
      image.decoding = 'async';
      image.fetchPriority = index === 0 ? 'high' : 'low';
      images.set(url, image);
      image.src = url;
      // Decode without delaying the question or the answer controls. Failed preloads
      // may retry on reveal; a network/decode failure must never interrupt practice.
      image.decode().catch(() => {
        if (image.complete && image.naturalWidth === 0 && images.get(url) === image) images.delete(url);
      });
    });
    return images.get(window[0]) || null;
  };
}

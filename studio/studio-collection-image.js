import { drawInputImage, inputDisplayKey, waitForInput } from './studio-input-display.js';

const thumbnails = new Map();

export async function createCollectionThumbnail(input, signal) {
  signal?.throwIfAborted();
  const key = inputDisplayKey(input);
  if (!thumbnails.has(key)) {
    const pending = drawInputImage(input, 512).then(({ canvas, ...metadata }) => ({
      ...metadata, url: canvas.toDataURL('image/png'),
      source: metadata.src, displaySource: metadata.displaySrc,
      width: canvas.width, height: canvas.height
    })).catch(error => {
      if (thumbnails.get(key) === pending) thumbnails.delete(key);
      throw error;
    });
    thumbnails.set(key, pending);
  }
  return waitForInput(thumbnails.get(key), signal);
}

const sources = new Map();
export const INPUT_BACKGROUND = '#c7c2ae';
export const INPUT_OCCUPANCY = .8;

function displaySource(input) {
  const source = input?.foreground || input;
  if (!input?.src || !source?.src || !Number.isInteger(source.width) || source.width <= 0
    || !Number.isInteger(source.height) || source.height <= 0 || !Array.isArray(source.bounds)
    || source.bounds.length !== 4 || !source.bounds.every(Number.isFinite)
    || source.bounds[2] <= 0 || source.bounds[3] <= 0) {
    throw new Error('The input foreground is missing.');
  }
  return source;
}

export function inputDisplayKey(input) {
  const source = displaySource(input);
  return JSON.stringify([input.src, source.src, source.width, source.height,
    source.bounds, source.hasAlpha, source.background?.type]);
}

// An aborted consumer must not cancel an image another view is still using.
export function waitForInput(pending, signal) {
  if (!signal) return pending;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

// Remove connected exact-black regions, including handle openings, while
// preserving every non-black RGB pixel and tiny black texture details.
function clearBlackBackground(ctx, width, height) {
  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data, count = width * height;
  const seen = new Uint8Array(count), queue = new Int32Array(count);
  const isBlack = index => {
    const offset = index * 4;
    return data[offset] === 0 && data[offset + 1] === 0 && data[offset + 2] === 0;
  };
  let removed = 0;
  for (let start = 0; start < count; start++) {
    if (seen[start] || !isBlack(start)) continue;
    let head = 0, tail = 1, touchesEdge = false;
    queue[0] = start; seen[start] = 1;
    const visit = index => {
      if (!seen[index] && isBlack(index)) {
        seen[index] = 1;
        queue[tail++] = index;
      }
    };
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }
    if (touchesEdge || tail >= 16) {
      for (let i = 0; i < tail; i++) data[queue[i] * 4 + 3] = 0;
      removed += tail;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return removed;
}

async function loadSource(source) {
  const response = await fetch(source.src);
  if (!response.ok) throw new Error(`Unable to load input image: ${source.src}`);
  const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'from-image' });
  try {
    if (bitmap.width !== source.width || bitmap.height !== source.height) {
      throw new Error(`Input image dimensions changed: ${source.src}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const removeBlack = !source.hasAlpha && source.background?.type === 'opaque-black';
    const ctx = canvas.getContext('2d', { willReadFrequently: removeBlack });
    ctx.drawImage(bitmap, 0, 0);
    const removedBackgroundPixels = removeBlack
      ? clearBlackBackground(ctx, bitmap.width, bitmap.height) : 0;
    return { canvas, removedBackgroundPixels };
  } finally { bitmap.close(); }
}

function cachedSource(source) {
  const key = JSON.stringify([source.src, source.width, source.height, source.hasAlpha, source.background?.type]);
  if (!sources.has(key)) {
    const pending = loadSource(source).catch(error => {
      if (sources.get(key) === pending) sources.delete(key);
      throw error;
    });
    sources.set(key, pending);
  }
  return sources.get(key);
}

export async function drawInputImage(input, size, signal) {
  signal?.throwIfAborted();
  const source = displaySource(input);
  const prepared = await waitForInput(cachedSource(source), signal);
  signal?.throwIfAborted();
  const [bx, by, bw, bh] = source.bounds;
  const scale = INPUT_OCCUPANCY / Math.max(bw, bh);
  const objectX = (1 - bw * scale) / 2, objectY = (1 - bh * scale) / 2;
  const x = objectX - bx * scale, y = objectY - by * scale;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = INPUT_BACKGROUND; ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(prepared.canvas, x * size, y * size, source.width * scale * size, source.height * scale * size);
  return {
    canvas, src: input.src, displaySrc: source.src,
    occupancy: INPUT_OCCUPANCY, background: INPUT_BACKGROUND,
    sourceSize: [source.width, source.height],
    objectBounds: [objectX, objectY, bw * scale, bh * scale],
    imageBounds: [x, y, source.width * scale, source.height * scale],
    removedBackgroundPixels: prepared.removedBackgroundPixels
  };
}

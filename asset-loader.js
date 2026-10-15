/* Large 3D payloads live on HF; all other assets remain beside the page. */
(() => {
  'use strict';
  const callbacks = new Set([
    'SupraPayload', 'SupraControlPayload',
    'SupraGalleryPayload', 'SupraCompetitionPayload'
  ]);
  const remoteTimeout = 300000;
  const pageRoot = new URL('.', document.baseURI);
  const source = new URLSearchParams(location.search).get('assetSource');
  const isLocal = location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
    location.hostname.endsWith('.localhost');

  function remoteAsset(script) {
    if (source === 'local' || (isLocal && source !== 'remote')) return null;
    const hosting = window.SupraAssetHosting;
    if (!hosting?.baseUrl || !hosting.paths) return null;
    const url = new URL(script.src, pageRoot);
    if (url.origin !== pageRoot.origin || !url.pathname.startsWith(pageRoot.pathname)) return null;
    const path = url.pathname.slice(pageRoot.pathname.length);
    if (!Object.prototype.hasOwnProperty.call(hosting.paths, path)) return null;
    return {
      ...hosting.paths[path],
      url: new URL(path.replace(/\.js$/, '.json'), hosting.baseUrl).href
    };
  }

  function append(script) {
    const asset = remoteAsset(script);
    if (!asset) {
      document.head.append(script);
      return script;
    }

    // Keep the viewers' existing remove()/error/load lifecycle. A removed model
    // request also stops its remote download, including dialog cancellation.
    const controller = new AbortController();
    const remove = script.remove.bind(script);
    let cancelled = false;
    let delivered = false;
    let timer;
    script.remove = () => {
      if (!delivered) {
        cancelled = true;
        controller.abort();
      }
      clearTimeout(timer);
      remove();
    };
    const fail = error => {
      if (cancelled) return;
      clearTimeout(timer);
      console.error('Could not load the 3D asset:', asset.url, error);
      script.dispatchEvent(new Event('error'));
    };
    timer = setTimeout(() => {
      controller.abort();
    }, remoteTimeout);

    fetch(asset.url, { mode: 'cors', credentials: 'omit', signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Asset download returned HTTP ${response.status}`);
        return response.json();
      })
      .then(payload => {
        if (cancelled) return;
        if (!payload || !callbacks.has(asset.callback) ||
            payload.callback !== asset.callback || payload.id !== asset.id ||
            typeof payload.data !== 'string' || !payload.data.startsWith('H4s') ||
            typeof window[asset.callback] !== 'function') {
          throw new Error('The downloaded asset does not match its registered model.');
        }
        delivered = true;
        clearTimeout(timer);
        // HF files are data only. Never evaluate them as remote JavaScript.
        window[asset.callback](asset.id, payload.data);
        script.dispatchEvent(new Event('load'));
      })
      .catch(fail);
    return script;
  }

  // Shared decoded-byte cache. GPU objects still belong to each viewer and are
  // released by that viewer; this cache never retains textures or scene graphs.
  const cache = new Map(), pending = new Map();
  const cacheBudget = 192 * 1024 * 1024;
  let cacheBytes = 0, downloads = 0, cacheHits = 0;
  const abortError = () => new DOMException('Model request cancelled', 'AbortError');
  function describe(path) {
    const url = new URL(path, pageRoot);
    const relative = url.pathname.slice(pageRoot.pathname.length);
    if (url.origin !== pageRoot.origin || !url.pathname.startsWith(pageRoot.pathname)) throw new Error('Unknown model path.');
    const hosting = window.SupraAssetHosting;
    const model = hosting?.paths?.[relative];
    if (!model) throw new Error('Unregistered model path.');
    const binaries = window.SupraAssetBinaries;
    const binary = binaries?.paths?.[relative];
    if (isLocal && source !== 'remote' && binary) {
      return { ...binary, ...model, format: 'gzip', url: new URL(binary.path, pageRoot).href };
    }
    if (isLocal && source !== 'remote') return { ...model, format: 'script', url: url.href };
    if (binary && binaries.localOnly === false) {
      return { ...binary, ...model, format: 'gzip', url: new URL(binary.path, hosting.baseUrl).href };
    }
    return { ...model, format: 'json', url: new URL(relative.replace(/\.js$/, '.json'), hosting.baseUrl).href };
  }
  function remember(key, buffer) {
    if (buffer.byteLength > cacheBudget) return;
    while (cacheBytes + buffer.byteLength > cacheBudget && cache.size) {
      const oldest = cache.keys().next().value;
      cacheBytes -= cache.get(oldest).byteLength;cache.delete(oldest);
    }
    cache.set(key, buffer);cacheBytes += buffer.byteLength;
  }
  async function download(asset, signal) {
    downloads++;
    const response = await fetch(asset.url, { mode: 'cors', credentials: 'omit', signal });
    if (!response.ok) throw new Error(`Asset download returned HTTP ${response.status}`);
    let stream;
    if (asset.format === 'gzip') stream = response.body;
    else {
      let payload;
      if (asset.format === 'json') payload = await response.json();
      else {
        // Local legacy fallback is parsed as data, never evaluated as code.
        const text = (await response.text()).trim(), prefix = `window.${asset.callback}(`;
        if (!text.startsWith(prefix) || !text.endsWith(');')) throw new Error('Invalid model wrapper.');
        const args = JSON.parse('[' + text.slice(prefix.length, -2) + ']');
        payload = { callback: asset.callback, id: args[0], data: args[1] };
      }
      if (payload.callback !== asset.callback || payload.id !== asset.id || typeof payload.data !== 'string' || !payload.data.startsWith('H4s')) throw new Error('The downloaded asset does not match its registered model.');
      const compressed = await fetch(`data:application/gzip;base64,${payload.data}`, { signal });
      stream = compressed.body;
    }
    const buffer = await new Response(stream.pipeThrough(new DecompressionStream('gzip'), { signal })).arrayBuffer();
    if (signal.aborted) throw abortError();
    if (asset.decodedBytes && buffer.byteLength !== asset.decodedBytes) throw new Error('Incomplete 3D model. Please retry.');
    if (buffer.byteLength < 12 || new DataView(buffer).getUint32(0, true) !== 0x46546c67) throw new Error('Invalid 3D model.');
    return buffer;
  }
  function acquire(path) {
    const asset = describe(path), key = asset.url;
    if (cache.has(key)) {
      cacheHits++;
      const buffer = cache.get(key);cache.delete(key);cache.set(key, buffer);
      let cancelled = false;
      return { promise: Promise.resolve().then(() => { if (cancelled) throw abortError();return buffer; }), cancel() { cancelled = true; } };
    }
    let request = pending.get(key);
    if (!request) {
      request = { controller: new AbortController(), subscribers: new Set() };
      pending.set(key, request);
      request.timer = setTimeout(() => request.controller.abort(), remoteTimeout);
      download(asset, request.controller.signal).then(buffer => {
        if (request.controller.signal.aborted) throw abortError();
        remember(key, buffer);
        if (pending.get(key) === request) pending.delete(key);
        for (const subscriber of request.subscribers) subscriber.resolve(buffer);
      }).catch(error => {
        if (pending.get(key) === request) pending.delete(key);
        for (const subscriber of request.subscribers) subscriber.reject(error);
      }).finally(() => {
        clearTimeout(request.timer);request.subscribers.clear();
        if (pending.get(key) === request) pending.delete(key);
      });
    }
    let subscriber;
    const promise = new Promise((resolve, reject) => { subscriber = { resolve, reject };request.subscribers.add(subscriber); });
    return { promise, cancel() {
      if (!request.subscribers.delete(subscriber)) return;
      subscriber.reject(abortError());
      if (!request.subscribers.size) {
        request.controller.abort();clearTimeout(request.timer);
        if (pending.get(key) === request) pending.delete(key);
      }
    } };
  }

  window.SupraAssetLoader = Object.freeze({
    append, acquire,
    cacheState: () => ({ bytes: cacheBytes, budget: cacheBudget, entries: cache.size, pending: pending.size, downloads, hits: cacheHits }),
    timeout: (script, localMs) => remoteAsset(script) ? remoteTimeout : localMs
  });
})();

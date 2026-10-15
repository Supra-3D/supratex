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

  window.SupraAssetLoader = Object.freeze({
    append,
    timeout: (script, localMs) => remoteAsset(script) ? remoteTimeout : localMs
  });
})();

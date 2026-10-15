'use strict';
(() => {
  const hero = document.querySelector('.hero-video-only');
  const video = document.getElementById('hero-film');
  if (!hero || !video) return;

  const stage = hero.querySelector('.emergence-stage');
  const frame = hero.querySelector('.hero-film-frame');
  const progress = document.getElementById('hero-story-progress');
  const fill = progress?.querySelector('.scene-track i');
  const chapters = [...hero.querySelectorAll('[data-story]')];
  const phaseLabel = document.getElementById('scene-phase');
  const replay = document.getElementById('replay-hero');
  const playPrompt = document.getElementById('hero-play-prompt');
  const motionButton = document.getElementById('motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 22, comparisonStart = 3.6, returnStart = 19;
  const sources = {
    hq: 'assets/hero-story-99-hq.mp4',
    hd: 'assets/hero-story-99-hd.mp4'
  };
  const poster = 'assets/hero-story-99-poster.webp';
  const startPoster = 'assets/hero-story-99-start.webp';
  const labels = {
    flight: 'Take flight',
    comparison: 'Compare with Meshy 7.1',
    return: 'Return to image'
  };
  const hasFrameClock = typeof video.requestVideoFrameCallback === 'function';
  let paused = document.body.classList.contains('motion-paused') || reduced.matches;
  let onScreen = isInitiallyVisible(), pageHidden = false, galleryOpen = false;
  let quality = chooseQuality(), pendingSeek = paused ? 6.6 : 0;
  let playBlocked = false, failed = false, playPending = false, playToken = 0;
  let lastPlayError = '', frameRequest = 0, frameEpoch = 0;
  let lastPhase = '', lastAriaTime = -1, lastFrameTime = 0, cycles = 0;

  function isInitiallyVisible() {
    const r = (stage || hero).getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }
  function chooseQuality() {
    if (navigator.connection?.saveData) return 'hd';
    const r = (frame || stage || hero).getBoundingClientRect();
    const width = Math.min(r.width, r.height > 0 ? r.height * 16 / 9 : r.width);
    return width * (devicePixelRatio || 1) > 1440 ? 'hq' : 'hd';
  }
  function phaseAt(time) {
    return time < comparisonStart ? 'flight' : time < returnStart ? 'comparison' : 'return';
  }
  function mediaTime() {
    return Math.max(0, Math.min(duration, Number.isFinite(video.currentTime) ? video.currentTime : 0));
  }
  function modalOpen() {
    return galleryOpen || !!document.querySelector('dialog[open]');
  }
  function mayPlay() {
    return !paused && !document.body.classList.contains('motion-paused') && onScreen &&
      !document.hidden && !pageHidden && !modalOpen() && !failed;
  }
  function update(time) {
    if (playPrompt) {
      const hidePrompt = !(paused || playBlocked || failed);
      if (hidePrompt && !playPrompt.hidden && document.activeElement === playPrompt) {
        motionButton?.focus({preventScroll:true});
      }
      playPrompt.hidden = hidePrompt;
    }
    hero.classList.toggle('play-blocked', playBlocked);
    hero.dataset.videoState = failed ? 'unavailable' : video.readyState >= 2 ? 'ready' : 'loading';
    // During playback the presented frame owns progress. Media events and
    // readiness / visibility callbacks may lead that frame by a few milliseconds.
    if (time === undefined && hasFrameClock && !video.paused && !video.seeking) return;
    time = Math.max(0, Math.min(duration, time ?? mediaTime()));
    const phase = phaseAt(time);
    if (fill) fill.style.transform = `scaleX(${time / duration})`;
    if (phase !== lastPhase) {
      lastPhase = phase;
      hero.dataset.storyPhase = phase;
      chapters.forEach(chapter => {
        const active = chapter.dataset.story === phase;
        chapter.classList.toggle('active', active);
        if (active) chapter.setAttribute('aria-current', 'step');
        else chapter.removeAttribute('aria-current');
      });
      if (phaseLabel) phaseLabel.textContent = labels[phase];
    }
    // Keep assistive metadata useful without writing it on every decoded frame.
    const ariaTime = Math.round(time * 10) / 10;
    if (progress && ariaTime !== lastAriaTime) {
      lastAriaTime = ariaTime;
      progress.setAttribute('aria-valuenow', String(ariaTime));
      progress.setAttribute('aria-valuetext', `${labels[phase]}, ${ariaTime.toFixed(1)} of ${duration} seconds`);
    }
    // Native looping may emit seeking/timeupdate before seeked. Keep the last
    // stable tail time until seeked can count that wrap; explicit seeks reset it.
    if (!video.seeking) {
      if (lastFrameTime > duration - .5 && time < .5) cycles++;
      lastFrameTime = time;
    }
  }
  function stopFrameClock() {
    frameEpoch++;
    if (!frameRequest) return;
    if (hasFrameClock) video.cancelVideoFrameCallback(frameRequest);
    else cancelAnimationFrame(frameRequest);
    frameRequest = 0;
  }
  function startFrameClock() {
    if (frameRequest || video.paused || !mayPlay()) return;
    const epoch = frameEpoch;
    const tick = (_now, metadata) => {
      if (epoch !== frameEpoch) return;
      frameRequest = 0;
      if (!mayPlay() || video.paused) return;
      update(metadata && Number.isFinite(metadata.mediaTime) ? metadata.mediaTime : mediaTime());
      startFrameClock();
    };
    frameRequest = hasFrameClock ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  }
  function stop() {
    ++playToken;
    playPending = false;
    video.pause();
    stopFrameClock();
    update();
  }
  function start(userActivation = false) {
    if (!mayPlay()) { stop(); return; }
    if (userActivation) { playBlocked = false; lastPlayError = ''; }
    if (playBlocked || playPending) { update(); return; }
    if (!video.paused) { startFrameClock(); update(); return; }
    const token = ++playToken;
    playPending = true;
    // This call remains inside a Replay / Play click when activation is needed.
    let request;
    try { request = video.play(); }
    catch (error) { request = Promise.reject(error); }
    Promise.resolve(request).then(() => {
      if (token !== playToken) return;
      playPending = false;
      if (!mayPlay()) { stop(); return; }
      playBlocked = false;
      lastPlayError = '';
      startFrameClock();
      update();
    }).catch(error => {
      if (token !== playToken) return;
      playPending = false;
      if (mayPlay() && error?.name !== 'AbortError') {
        playBlocked = true;
        lastPlayError = error?.name || 'PlaybackError';
      }
      stopFrameClock();
      update();
    });
  }
  function syncPlayback() {
    if (mayPlay()) start();
    else stop();
  }
  function applyPendingSeek() {
    if (pendingSeek === null || video.readyState < 1) return;
    const target = pendingSeek;
    try {
      video.currentTime = Math.min(target, Number.isFinite(video.duration) ? Math.max(0, video.duration - .001) : duration);
      pendingSeek = null;
      lastFrameTime = target;
    } catch (_) { /* Retain the intent until metadata / data can accept it. */ }
  }
  function seek(time) {
    pendingSeek = Math.max(0, Math.min(duration, time));
    applyPendingSeek();
    update();
  }
  function loadSource(next) {
    stop();
    quality = next;
    failed = false;
    playBlocked = false;
    lastPlayError = '';
    video.poster = pendingSeek !== null && pendingSeek >= comparisonStart ? poster : startPoster;
    video.src = sources[quality];
    video.load();
    syncPlayback();
  }
  function userPlay(restart) {
    if (restart) { cycles = 0; seek(0); }
    if (failed) {
      pendingSeek = restart ? 0 : pendingSeek ?? mediaTime();
      loadSource(quality);
    }
    // experience.js owns the one global Motion toggle and its reduced-motion override.
    if (paused || document.body.classList.contains('motion-paused')) motionButton?.click();
    start(true);
  }
  function returnToFlight() {
    seek(returnStart);
    if (!paused && !document.body.classList.contains('motion-paused')) {
      playBlocked = false;
      lastPlayError = '';
    }
    syncPlayback();
    // Accepted also before metadata; applyPendingSeek preserves the requested entry.
    return Promise.resolve(true);
  }

  video.autoplay = false; // Playback permission is governed by the shared Motion state.
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'auto';
  if (progress) {
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', String(duration));
    progress.setAttribute('aria-label', 'Aircraft story progress');
  }
  replay?.addEventListener('click', () => userPlay(true));
  playPrompt?.addEventListener('click', () => userPlay(false));
  window.addEventListener('supra:motion', event => {
    paused = !!event.detail?.paused;
    if (!paused) { playBlocked = false; lastPlayError = ''; }
    syncPlayback();
  });
  window.addEventListener('supra:gallery', event => {
    galleryOpen = !!event.detail?.open;
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  window.addEventListener('pagehide', () => { pageHidden = true; stop(); });
  window.addEventListener('pageshow', () => { pageHidden = false; syncPlayback(); });
  new IntersectionObserver(entries => {
    onScreen = entries[0].isIntersecting;
    syncPlayback();
  }, { threshold: .12 }).observe(stage || hero);
  // Native dialogs (including the collection film) pause the film before the next paint.
  new MutationObserver(syncPlayback).observe(document.body, {
    attributes: true, attributeFilter: ['open'], subtree: true
  });
  ['loadedmetadata', 'loadeddata', 'canplay'].forEach(event => video.addEventListener(event, () => {
    applyPendingSeek();
    update();
    syncPlayback();
  }));
  ['timeupdate', 'durationchange'].forEach(event => video.addEventListener(event, () => update()));
  video.addEventListener('seeking', () => { stopFrameClock(); update(mediaTime()); });
  video.addEventListener('seeked', () => { update(mediaTime()); startFrameClock(); });
  video.addEventListener('playing', () => {
    if (!mayPlay()) { stop(); return; }
    playBlocked = false;
    update();
    startFrameClock();
  });
  video.addEventListener('pause', () => { stopFrameClock(); update(); });
  video.addEventListener('error', () => {
    // A smaller stream is the only automatic fallback; preserve story position.
    pendingSeek = pendingSeek ?? mediaTime();
    if (quality === 'hq') { loadSource('hd'); return; }
    failed = true;
    lastPlayError = `MediaError:${video.error?.code || 'unknown'}`;
    video.poster = poster;
    stop();
  });
  window.SupraHeroPlayback = Object.freeze({
    returnToFlight,
    state() {
      const time = mediaTime();
      return {
        backend: 'video', phase: phaseAt(time), progress: time / duration,
        ready: video.readyState >= 2, videoTime: time, duration,
        comparisonStart, returnStart, onScreen, paused, videoPaused: video.paused,
        hidden: document.hidden || pageHidden, modal: modalOpen(), quality,
        pendingSeek, seeking: video.seeking, playBlocked, playPending, failed, lastPlayError,
        reducedMotion: reduced.matches, cycles, videoSize: [video.videoWidth, video.videoHeight],
        frameClock: hasFrameClock ? 'presented-frame' : 'media-time', source: sources[quality]
      };
    }
  });
  loadSource(quality);
})();

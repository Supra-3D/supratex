(() => {
  'use strict';
  const video = document.getElementById('embodied-film');
  if (!video) return;
  const section = document.getElementById('embodied');
  const player = section.querySelector('[data-embodied-player]');
  const playButton = section.querySelector('[data-embodied-play]');
  const seek = section.querySelector('[data-embodied-seek]');
  const current = section.querySelector('[data-embodied-current]');
  const duration = section.querySelector('[data-embodied-duration]');
  const chapters = [...section.querySelectorAll('[data-embodied-chapter]')];
  const phase = section.querySelector('[data-embodied-phase]');
  const fullscreen = section.querySelector('[data-embodied-fullscreen]');
  const status = section.querySelector('[data-embodied-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, intent = null, pendingSeek = null, playPending = false;
  let frameRequest = null, activeChapter = null;
  let motionPaused = reduced.matches || document.body.classList.contains('motion-paused');
  const time = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  function load() {
    if (!video.getAttribute('src')) { video.src = video.dataset.src; video.load(); }
  }
  function sync() {
    const allowed = visible && !document.hidden && !document.querySelector('dialog[open]') &&
      (intent === true || (intent === null && !motionPaused));
    if (!allowed) { video.pause(); return; }
    load();
    if (video.paused && !playPending) {
      playPending = true;
      video.play().catch(() => {}).finally(() => { playPending = false; });
    }
  }
  function update() {
    const total = Number.isFinite(video.duration) ? video.duration : 45.542;
    const position = video.currentTime;
    seek.max = String(total);
    seek.value = String(position);
    seek.style.setProperty('--played', `${position / total * 100}%`);
    seek.setAttribute('aria-valuetext', `${Math.floor(position / 60)} minutes ${Math.floor(position % 60)} seconds`);
    current.textContent = time(position);
    duration.textContent = time(total);
    const active = chapters.filter(button => Number(button.dataset.embodiedChapter) <= position).at(-1) || chapters[0];
    const index = chapters.indexOf(active);
    if (active !== activeChapter) {
      activeChapter = active;
      chapters.forEach(button => {
        if (button === active) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      phase.textContent = `${String(index + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}`;
    }
    const start = Number(active.dataset.embodiedChapter);
    const end = Number(chapters[index + 1]?.dataset.embodiedChapter ?? total);
    active.style.setProperty('--chapter-progress', String(Math.max(0, Math.min(1, (position - start) / (end - start)))));
    player.classList.toggle('is-playing', !video.paused);
    playButton.setAttribute('aria-label', video.ended ? 'Replay scene demonstration' : video.paused ? 'Play scene demonstration' : 'Pause scene demonstration');
  }
  function moveTo(value) {
    load();
    pendingSeek = value;
    if (video.readyState >= 1) { video.currentTime = pendingSeek; pendingSeek = null; update(); }
  }
  // Follow rendered frames, including the wrap back to zero on each loop.
  // Media events remain the fallback for paused seeks and background playback.
  function stopFrames() {
    if (frameRequest === null) return;
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameRequest);
    else cancelAnimationFrame(frameRequest);
    frameRequest = null;
  }
  function trackFrames() {
    if (frameRequest !== null || video.paused || document.hidden) return;
    const tick = () => { frameRequest = null; update(); trackFrames(); };
    frameRequest = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  }
  playButton.addEventListener('click', () => {
    intent = video.paused;
    if (intent && video.ended) moveTo(0);
    sync();
  });
  seek.addEventListener('input', () => moveTo(Number(seek.value)));
  seek.addEventListener('keydown', event => {
    const total = Number.isFinite(video.duration) ? video.duration : 45.542;
    const targets = { ArrowLeft: video.currentTime - 5, ArrowRight: video.currentTime + 5, Home: 0, End: total };
    if (!(event.key in targets)) return;
    event.preventDefault();
    moveTo(Math.max(0, Math.min(total, targets[event.key])));
  });
  chapters.forEach(button => button.addEventListener('click', () => {
    moveTo(Number(button.dataset.embodiedChapter));
    intent = true;
    sync();
  }));
  video.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null) { video.currentTime = pendingSeek; pendingSeek = null; }
    update();
  });
  ['timeupdate', 'play', 'pause', 'seeking', 'seeked', 'ended'].forEach(event => video.addEventListener(event, update));
  video.addEventListener('playing', trackFrames);
  video.addEventListener('pause', stopFrames);
  video.addEventListener('error', () => {
    status.textContent = 'The video could not load. Refresh the page to try again.';
    status.hidden = false;
  });
  fullscreen.hidden = !document.fullscreenEnabled;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === player) await document.exitFullscreen();
      else await player.requestFullscreen();
    } catch (_) { /* Inline playback remains available if fullscreen is unavailable. */ }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.querySelector('[data-fullscreen-label]').textContent = document.fullscreenElement === player ? 'Exit full screen' : 'Full screen';
    fullscreen.setAttribute('aria-label', document.fullscreenElement === player ? 'Exit fullscreen' : 'Watch scene demonstration fullscreen');
  });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .25;
    sync();
  }, { threshold: [0, .25] }).observe(video);
  window.addEventListener('supra:motion', event => {
    motionPaused = event.detail.paused;
    if (motionPaused) intent = null;
    sync();
  });
  reduced.addEventListener('change', () => {
    motionPaused = reduced.matches || document.body.classList.contains('motion-paused');
    if (motionPaused) intent = null;
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  const dialogs = new MutationObserver(sync);
  document.querySelectorAll('dialog').forEach(dialog => dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  video.controls = false;
  section.querySelector('[data-embodied-controls]').hidden = false;
  update();
})();

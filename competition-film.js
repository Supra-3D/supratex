(() => {
  'use strict';
  const video = document.getElementById('comp-film');
  if (!video) return;
  const section = document.querySelector('.competition-film');
  const dialog = document.getElementById('comparison-film-dialog');
  const trigger = document.getElementById('hero-see-more');
  if (!section || !dialog || !trigger) return;
  const player = section.querySelector('[data-comp-film-player]');
  const playButton = section.querySelector('[data-comp-film-play]');
  const seek = section.querySelector('[data-comp-film-seek]');
  const current = section.querySelector('[data-comp-film-current]');
  const duration = section.querySelector('[data-comp-film-duration]');
  const chapters = [...section.querySelectorAll('[data-comp-film-chapter]')];
  const phase = section.querySelector('[data-comp-film-phase]');
  const fullscreen = section.querySelector('[data-comp-film-fullscreen]');
  const explore = section.querySelector('[data-comp-film-explore]');
  const status = section.querySelector('[data-comp-film-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let intent = false, pendingSeek = null, playPending = false, playToken = 0;
  let frameRequest = null, activeChapter = null;
  const time = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  function load() {
    if (!video.getAttribute('src')) { video.src = video.dataset.src; video.load(); }
  }
  function mayPlay() {
    return dialog.open && !document.hidden && intent &&
      ![...document.querySelectorAll('dialog[open]')].some(other => other !== dialog);
  }
  function stop() {
    ++playToken;
    playPending = false;
    video.pause();
    stopFrames();
    update();
  }
  function sync() {
    if (!mayPlay()) { stop(); return; }
    load();
    if (video.paused && !playPending) {
      const token = ++playToken;
      playPending = true;
      video.play().then(() => {
        if (token !== playToken) return;
        playPending = false;
        if (!mayPlay()) { stop(); return; }
        status.hidden = true;
        update();
        trackFrames();
      }).catch(error => {
        if (token !== playToken) return;
        playPending = false;
        if (mayPlay() && error.name !== 'AbortError') {
          status.textContent = 'Press play to start the comparison.';
          status.hidden = false;
        }
        update();
      });
    }
  }
  function update() {
    const total = Number.isFinite(video.duration) ? video.duration : 36.666667;
    const position = video.currentTime;
    seek.max = String(total);
    seek.value = String(position);
    seek.style.setProperty('--played', `${position / total * 100}%`);
    seek.setAttribute('aria-valuetext', `${Math.floor(position / 60)} minutes ${Math.floor(position % 60)} seconds`);
    current.textContent = time(position);
    duration.textContent = time(total);
    const active = chapters.filter(button => Number(button.dataset.compFilmChapter) <= position).at(-1) || chapters[0];
    const index = chapters.indexOf(active);
    if (active !== activeChapter) {
      activeChapter = active;
      section.querySelector('[data-comp-film-method]').textContent=active.dataset.methodName;
      explore.setAttribute('aria-label',`Explore the ${active.dataset.methodName} fighter comparison in 3D`);
      chapters.forEach(button => {
        if (button === active) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      phase.textContent = `${String(index + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}`;
    }
    const start = Number(active.dataset.compFilmChapter);
    const end = Number(chapters[index + 1]?.dataset.compFilmChapter ?? total);
    active.style.setProperty('--chapter-progress', String(Math.max(0, Math.min(1, (position - start) / (end - start)))));
    player.classList.toggle('is-playing', !video.paused);
    playButton.setAttribute('aria-label', video.ended ? 'Replay commercial comparison' : video.paused ? 'Play commercial comparison' : 'Pause commercial comparison');
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
    if (frameRequest !== null || video.paused || !mayPlay()) return;
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
    const total = Number.isFinite(video.duration) ? video.duration : 36.666667;
    const targets = { ArrowLeft: video.currentTime - 5, ArrowRight: video.currentTime + 5, Home: 0, End: total };
    if (!(event.key in targets)) return;
    event.preventDefault();
    moveTo(Math.max(0, Math.min(total, targets[event.key])));
  });
  chapters.forEach(button => button.addEventListener('click', () => {
    moveTo(Number(button.dataset.compFilmChapter));
    intent = true;
    sync();
  }));
  video.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null) { video.currentTime = pendingSeek; pendingSeek = null; }
    update();
  });
  ['timeupdate', 'play', 'pause', 'seeking', 'seeked', 'ended'].forEach(event => video.addEventListener(event, update));
  video.addEventListener('playing', () => { if (mayPlay()) trackFrames(); else stop(); });
  video.addEventListener('pause', stopFrames);
  video.addEventListener('error', () => {
    status.textContent = 'The video could not load. Refresh the page to try again.';
    status.hidden = false;
  });
  fullscreen.hidden = !document.fullscreenEnabled;
  explore.addEventListener('click', async () => {
    const position=pendingSeek ?? video.currentTime;
    const chapter=chapters.filter(button=>Number(button.dataset.compFilmChapter)<=position).at(-1)||chapters[0];
    intent=false;stop();
    if(document.fullscreenElement===player){try{await document.exitFullscreen();}catch(_){}}
    closeFilm('explore');
    await window.SupraCompetition?.open({caseId:'fighter',method:chapter.dataset.filmMethod,source:'film'});
  });
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === player) await document.exitFullscreen();
      else await player.requestFullscreen();
    } catch (_) { /* Inline playback remains available if fullscreen is unavailable. */ }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.querySelector('[data-fullscreen-label]').textContent = document.fullscreenElement === player ? 'Exit full screen' : 'Full screen';
    fullscreen.setAttribute('aria-label', document.fullscreenElement === player ? 'Exit fullscreen' : 'Watch commercial comparison fullscreen');
  });
  function closeFilm(reason = 'dismiss') {
    intent = false;
    stop();
    dialog.close(reason);
    document.body.classList.remove('comparison-film-open');
  }
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    if (video.error) { video.removeAttribute('src'); video.load(); }
    dialog.returnValue = '';
    dialog.showModal();
    document.body.classList.add('comparison-film-open');
    moveTo(0);
    // Explicitly requested playback is independent of the background Motion setting.
    intent = true;
    sync();
  });
  dialog.querySelector('[data-comp-film-close]').addEventListener('click', () => closeFilm());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeFilm();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeFilm(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const scope = document.fullscreenElement || dialog;
    const controls = [...scope.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')]
      .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus({preventScroll:true});
    }
  });
  dialog.addEventListener('close', () => {
    // A previous close event may arrive after the user has already reopened it.
    if (dialog.open) return;
    intent = false;
    stop();
    document.body.classList.remove('comparison-film-open');
    if (dialog.returnValue !== 'explore') trigger.focus({preventScroll:true});
  });
  window.addEventListener('supra:motion', event => {
    if (event.detail.paused) intent = false;
    sync();
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) intent = false;
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', stop);
  const dialogs = new MutationObserver(sync);
  document.querySelectorAll('dialog').forEach(dialog => dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  video.controls = false;
  section.querySelector('[data-comp-film-controls]').hidden = false;
  update();
})();

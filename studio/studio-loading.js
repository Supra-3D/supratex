const content = document.getElementById('studio-content');
const overlay = document.getElementById('studio-loading');
const progress = document.getElementById('studio-loading-progress');
let current = 0;
let previousFocus;

export function beginLoading() {
  if (overlay.hidden) previousFocus = document.activeElement;
  content.inert = true;
  content.setAttribute('aria-busy', 'true');
  overlay.hidden = false;
  current = 0;
  setLoadingProgress(0, 'Preparing the collection…');
  overlay.focus({ preventScroll: true });
}

export function setLoadingProgress(percent, message) {
  current = Math.max(current, Math.min(100, percent));
  const value = Math.floor(current);
  progress.setAttribute('aria-valuenow', String(value));
  progress.firstElementChild.style.width = `${current}%`;
  document.getElementById('studio-loading-percent').textContent = `${value}%`;
  if (message) document.getElementById('studio-loading-status').textContent = message;
}

export function finishLoading() {
  setLoadingProgress(100, 'Studio ready');
  const restoreFocus = overlay.contains(document.activeElement);
  overlay.hidden = true;
  content.inert = false;
  content.setAttribute('aria-busy', 'false');
  if (restoreFocus) {
    const target = previousFocus?.isConnected && previousFocus !== document.body
      ? previousFocus : document.querySelector('#viewport canvas');
    target?.focus({ preventScroll: true });
  }
}

export function loadingFailed(error) {
  console.error(error);
  document.getElementById('fatal-message').textContent = 'Unable to load the studio. Please check your connection and try again.';
  document.getElementById('fatal-error').hidden = false;
  finishLoading();
  document.querySelector('#fatal-error button').focus({ preventScroll: true });
}

beginLoading();

(() => {
  'use strict';
  const button = document.querySelector('[data-copy-citation]');
  const code = document.getElementById('citation-code');
  const status = document.querySelector('[data-citation-status]');
  if (!button || !code || !status) return;
  const label = button.querySelector('span');
  let reset, copying = false;
  button.hidden = false;

  button.addEventListener('click', async () => {
    if (copying) return;
    copying = true;
    clearTimeout(reset);
    button.setAttribute('aria-busy', 'true');
    status.textContent = '';
    status.classList.remove('is-error');
    try {
      await navigator.clipboard.writeText(code.textContent.trim());
      label.textContent = 'Copied';
      status.textContent = 'BibTeX citation copied.';
      reset = setTimeout(() => { label.textContent = 'Copy BibTeX'; }, 2200);
    } catch (_) {
      // Keep the citation usable when clipboard access is unavailable or denied.
      code.closest('pre').focus({preventScroll: true});
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      label.textContent = 'Copy BibTeX';
      status.textContent = 'Citation selected. Press Ctrl+C or Command+C to copy.';
      status.classList.add('is-error');
    } finally {
      copying = false;
      button.removeAttribute('aria-busy');
    }
  });
})();

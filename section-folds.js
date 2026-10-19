(() => {
  const folds = new Map();

  function setExpanded(fold, expanded) {
    if (expanded === !fold.body.hidden) return;
    if (!expanded) {
      fold.body.querySelectorAll('video').forEach(video => video.pause());
      if (fold.body.contains(document.activeElement)) fold.button.focus({preventScroll: true});
    }
    fold.body.hidden = !expanded;
    fold.section.classList.toggle('is-expanded', expanded);
    fold.button.setAttribute('aria-expanded', String(expanded));
    fold.button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${fold.name}`);
    fold.label.textContent = expanded ? 'Collapse' : 'Explore';
  }

  document.querySelectorAll('section[data-section-fold]').forEach(section => {
    const heading = section.querySelector('.chapter-heading');
    const index = section.querySelector('.section-index');
    if (!heading || !index) return;
    const body = document.createElement('div');
    body.id = `${section.id}-content`;
    body.className = 'section-fold-body';
    // Keep modal dialogs outside the hidden body so their top-layer lifecycle is unchanged.
    [...section.children].forEach(child => {
      if (child !== heading && child !== index && child.tagName !== 'DIALOG') body.append(child);
    });
    section.append(body);
    heading.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'section-fold-toggle';
    button.setAttribute('aria-controls', body.id);
    const label = document.createElement('span');
    const icon = document.createElement('span');
    icon.className = 'section-fold-icon';
    icon.setAttribute('aria-hidden', 'true');
    button.append(label, icon);
    heading.append(button);
    const fold = {section, body, button, label, name: section.dataset.sectionFold};
    folds.set(section, fold);
    section.classList.add('section-fold');
    setExpanded(fold, false);
    button.addEventListener('click', () => setExpanded(fold, body.hidden));
  });

  // Call before focus/scroll when another viewer navigates to content in a folded section.
  function reveal(target) {
    const fold = folds.get(target?.closest('section[data-section-fold]'));
    if (!fold) return false;
    const changed = fold.body.hidden;
    setExpanded(fold, true);
    return changed;
  }
  window.SupraSections = {reveal};

  function hashTarget(hash) {
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
  }
  function revealHash() {
    const target = hashTarget(window.location.hash);
    if (reveal(target)) requestAnimationFrame(() => target.scrollIntoView({block: 'start', behavior: 'instant'}));
  }
  // Capture before the browser's anchor scroll, including a repeated click on the current hash.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) reveal(hashTarget(url.hash));
  }, true);
  window.addEventListener('hashchange', revealHash);
  revealHash();
})();

'use strict';
(() => {
  // A visible provenance link opens the exact explanation before navigating.
  document.querySelectorAll('[data-open-demo-notes]').forEach(link => link.addEventListener('click', () => {
    const notes = document.getElementById('demo-notes');
    if (notes) notes.open = true;
  }));
  // Decoded image transitions are coordinated with the selection in control.js.
})();

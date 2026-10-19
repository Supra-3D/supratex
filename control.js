'use strict';
(() => {
  let viewerBundle = null, liveViewer = null;
  function loadViewerBundle() {
    if (window.SupraControl3D) return Promise.resolve();
    if (viewerBundle) return viewerBundle;
    viewerBundle = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'control-viewer.bundle.js?v=110';
      script.onload = () => { script.remove(); window.SupraControl3D ? resolve() : reject(new Error('Viewer unavailable')); };
      script.onerror = () => { script.remove(); reject(new Error('Viewer unavailable')); };
      document.head.append(script);
    }).catch(error => { viewerBundle = null; throw error; });
    return viewerBundle;
  }
  const designs = {
    base: { label: 'Base design' },
    crane: { label: 'Crane & peonies' },
    geometric: { label: 'Geometric' },
    koi: { label: 'Koi & waves' }
  };
  const angles = { back: 'Back view', 'back-left': 'Back-left view', 'back-right': 'Back-right view' };
  const source = (design, angle) => `assets/editing/${design}-${angle}.webp`;
  function loadImage(url) {
    return window.SupraTransitions.decode(url);
  }
  function warmDesign(design) {
    return Promise.all(Object.keys(angles).map(angle => loadImage(source(design, angle))));
  }
  function enableArrowNavigation(buttons, attribute, select) {
    buttons.forEach(button => button.addEventListener('keydown', event => {
      const current = buttons.indexOf(button);
      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % buttons.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current + buttons.length - 1) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault();
      buttons[next].focus();
      select(buttons[next].getAttribute(attribute));
    }));
  }
  function init(root = document) {
    root.querySelectorAll('[data-editing-demo]').forEach(section => {
      if (section.dataset.controlReady) return;
      const tabs = [...section.querySelectorAll('[data-control-design]')];
      const angleButtons = [...section.querySelectorAll('[data-control-angle]')];
      const panel = section.querySelector('.control-output');
      const main = section.querySelector('[data-control-main]');
      const thumbs = [...section.querySelectorAll('[data-control-thumb]')];
      const name = section.querySelector('[data-control-design-label]');
      const view = section.querySelector('[data-control-view-label]');
      const status = section.querySelector('[data-control-status]');
      if (!panel || !main || !status || tabs.length !== 4 || angleButtons.length !== 3) return;
      section.dataset.controlReady = 'true';
      let activeDesign = 'crane', activeAngle = 'back';
      let requestedDesign = activeDesign, requestedAngle = activeAngle, request = 0;
      async function show(design = requestedDesign, angle = requestedAngle) {
        if (!designs[design] || !angles[angle]) return;
        if (design === requestedDesign && angle === requestedAngle) return;
        requestedDesign = design;
        requestedAngle = angle;
        const token = ++request;
        if (design === activeDesign && angle === activeAngle) {
          panel.removeAttribute('aria-busy');
          return;
        }
        panel.setAttribute('aria-busy', 'true');
        status.classList.remove('is-error');
        try {
          await warmDesign(design);
          if (token !== request) return;
          const designChanged = design !== activeDesign, angleChanged = angle !== activeAngle;
          activeDesign = design;
          activeAngle = angle;
          main.src = source(design, angle);
          main.alt = `${designs[design].label} on the generated porcelain plate, ${angles[angle].toLowerCase()}`;
          thumbs.forEach(image => { image.src = source(design, image.dataset.controlThumb); });
          tabs.forEach(button => {
            const selected = button.dataset.controlDesign === design;
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
          });
          angleButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.controlAngle === angle)));
          panel.setAttribute('aria-labelledby', `control-design-${design}`);
          name.textContent = designs[design].label;
          view.textContent = angles[angle];
          status.textContent = `${designs[design].label}. ${angles[angle]}.`;
          section.dataset.controlDesign = design;
          section.dataset.controlAngle = angle;
          window.SupraTransitions.reveal([main, ...(designChanged ? thumbs : [])], {opacity: .45, shift: 0});
          if (designChanged) window.SupraTransitions.reveal(name);
          if (angleChanged) window.SupraTransitions.reveal(view);
        } catch (_) {
          if (token !== request) return;
          requestedDesign = activeDesign;
          requestedAngle = activeAngle;
          status.textContent = 'This view could not be loaded. The previous result is still shown; please try again.';
          status.classList.add('is-error');
        } finally {
          if (token === request) panel.removeAttribute('aria-busy');
        }
      }
      tabs.forEach(button => {
        button.addEventListener('click', () => show(button.dataset.controlDesign));
        const preload = () => warmDesign(button.dataset.controlDesign).catch(() => {});
        button.addEventListener('pointerenter', preload, { passive: true });
        button.addEventListener('focus', preload);
      });
      angleButtons.forEach(button => button.addEventListener('click', () => show(requestedDesign, button.dataset.controlAngle)));
      enableArrowNavigation(tabs, 'data-control-design', design => show(design));
      enableArrowNavigation(angleButtons, 'data-control-angle', angle => show(requestedDesign, angle));
      section.dataset.controlDesign = activeDesign;
      section.dataset.controlAngle = activeAngle;
      const dialog = section.querySelector('[data-control-dialog]');
      const openButton = section.querySelector('[data-control-open]');
      if (dialog && openButton) {
        const mount = dialog.querySelector('[data-control-3d-mount]');
        const message = dialog.querySelector('[data-control-3d-status]');
        const title = dialog.querySelector('[data-control-3d-title]');
        const designButtons = [...dialog.querySelectorAll('[data-control-3d-design]')];
        let epoch = 0, lastTrigger = null, selection = 0, pendingDesign = activeDesign, loadingDesign = null;
        function report(text, error = false, busy = false) {
          message.textContent = text; message.classList.toggle('is-error', error);
          mount.setAttribute('aria-busy', String(busy)); dialog.dataset.loading = String(busy);
        }
        async function selectModel(design) {
          if (!dialog.open) return;
          pendingDesign = design;
          if (!liveViewer) {
            designButtons.forEach(button => button.setAttribute('aria-pressed', String(button.getAttribute('data-control-3d-design') === design)));
            title.textContent = designs[design].label;
            report(`Opening ${designs[design].label} in 3D…`, false, true);
            return;
          }
          const state = liveViewer.state();
          if (loadingDesign === design || (loadingDesign === null && state.design === design && !state.busy && !message.classList.contains('is-error'))) return;
          const instance = liveViewer, token = ++selection;
          loadingDesign = design;
          try {
            const ready = await instance.load(design);
            if (!ready || !dialog.open || instance !== liveViewer || token !== selection) return;
            designButtons.forEach(button => button.setAttribute('aria-pressed', String(button.getAttribute('data-control-3d-design') === design)));
            title.textContent = designs[design].label;
            show(design);
          } catch (_) {
            if (dialog.open && instance === liveViewer && token === selection) report('This 3D asset could not be loaded. Choose another design or try again.', true, false);
          } finally {
            if (instance === liveViewer && token === selection) loadingDesign = null;
          }
        }
        async function openViewer(event) {
          if (dialog.open) return;
          lastTrigger = event.currentTarget; const token = ++epoch;
          pendingDesign = activeDesign;
          title.textContent = designs[activeDesign].label;
          designButtons.forEach(button => button.setAttribute('aria-pressed', String(button.getAttribute('data-control-3d-design') === activeDesign)));
          dialog.showModal(); document.body.classList.add('control-dialog-open');
          window.dispatchEvent(new CustomEvent('supra:gallery', {detail: {open: true, source: 'control'}}));
          dialog.querySelector('[data-control-close]').focus();
          report('Opening the 3D viewer…', false, true);
          try {
            await loadViewerBundle();
            if (!dialog.open || token !== epoch) return;
            liveViewer = window.SupraControl3D.create(mount, {onStatus: (text, error, busy) => {
              if (dialog.open && token === epoch) report(text, error, busy);
            }});
            await selectModel(pendingDesign);
          } catch (_) {
            if (dialog.open && token === epoch) report('3D is unavailable in this browser. The rendered views remain available on the page.', true, false);
          }
        }
        openButton.addEventListener('click', openViewer);
        dialog.querySelector('[data-control-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
          if (event.target !== dialog) return;
          const r = dialog.getBoundingClientRect();
          if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
        });
        dialog.addEventListener('close', () => {
          ++epoch; ++selection; liveViewer?.dispose(); liveViewer = null; loadingDesign = null;
          mount.replaceChildren(); report('', false, false);
          document.body.classList.remove('control-dialog-open');
          window.dispatchEvent(new CustomEvent('supra:gallery', {detail: {open: false, source: 'control'}}));
          if (lastTrigger?.isConnected) lastTrigger.focus({preventScroll: true});
        });
        designButtons.forEach(button => button.addEventListener('click', () => selectModel(button.getAttribute('data-control-3d-design'))));
        dialog.querySelectorAll('[data-control-3d-view]').forEach(button => button.addEventListener('click', () => liveViewer?.setView(button.getAttribute('data-control-3d-view'))));
        dialog.querySelector('[data-control-3d-reset]').addEventListener('click', () => liveViewer?.reset());
        dialog.querySelectorAll('[data-control-3d-zoom]').forEach(button => button.addEventListener('click', () => liveViewer?.zoom(Number(button.getAttribute('data-control-3d-zoom')))));
        window.addEventListener('pagehide', () => {liveViewer?.dispose(); liveViewer = null;}, {once: true});
      }
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            warmDesign(activeDesign).catch(() => {});
            observer.disconnect();
          }
        }, { rootMargin: '300px' });
        observer.observe(panel);
      }
    });
  }
  window.SupraControl = { init, state: () => liveViewer?.state() || {disposed: true, initialized: false} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  else init();
})();

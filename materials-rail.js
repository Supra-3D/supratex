(() => {
  const shell = document.querySelector('#materials .asset-rail-shell');
  if (!shell) return;
  const rail = shell.querySelector('.asset-rail');
  const navigation = shell.querySelector('.asset-rail-navigation');
  const previous = shell.querySelector('.asset-rail-previous');
  const next = shell.querySelector('.asset-rail-next');
  const desktop = matchMedia('(min-width: 960px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;

  function update() {
    frame = 0;
    const overflow = desktop.matches && rail.scrollWidth > rail.clientWidth + 2;
    shell.classList.toggle('has-overflow', overflow);
    navigation.hidden = !overflow;
    previous.disabled = rail.scrollLeft <= 1;
    next.disabled = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1;
  }

  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function scrollCases(direction) {
    rail.scrollBy({
      left: direction * rail.clientWidth * .8,
      behavior: reducedMotion.matches ? 'instant' : 'smooth'
    });
    scheduleUpdate();
  }

  previous.addEventListener('click', () => scrollCases(-1));
  next.addEventListener('click', () => scrollCases(1));
  rail.addEventListener('scroll', scheduleUpdate, { passive: true });
  desktop.addEventListener('change', scheduleUpdate);
  const observer = new ResizeObserver(scheduleUpdate);
  observer.observe(shell);
  observer.observe(rail);
  update();
})();

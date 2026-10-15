'use strict';
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const body = document.body;
  const hero = document.querySelector('.hero');
  const specimen = document.querySelector('.hero-specimen');
  const heroFilm = document.getElementById('hero-film');
  const materialFilm = document.getElementById('material-video');
  const ambientFilms = [materialFilm].filter(Boolean);
  const motionButton = document.getElementById('motion-toggle');
  // The hero now leads into the shared two-model comparison. Capture prevents
  // the legacy materials module from opening its separate hero-only viewer.
  const heroExplore = document.getElementById('hero-explore');
  function syncHeroExplore(){
    if(heroExplore.disabled)heroExplore.disabled=false;
    if(!heroExplore.textContent.includes('Explore in 3D'))heroExplore.innerHTML='Explore in 3D <span aria-hidden="true">↗</span>';
  }
  // Materials can still report its own renderer failure through the legacy
  // shared button helper. Keep that unrelated state out of this navigation.
  new MutationObserver(syncHeroExplore).observe(heroExplore,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true});
  syncHeroExplore();
  heroExplore.addEventListener('click', event => {
    event.preventDefault();event.stopImmediatePropagation();
    syncHeroExplore();
    window.SupraCompetition?.open({caseId:'fighter',method:'meshy',source:'hero'});
  }, true);
  const header = document.querySelector('.site-header');
  const progress = document.querySelector('.reading-progress');
  const cinema = document.querySelector('.cinema');
  const method = document.querySelector('.method-visual');
  const steps = [...document.querySelectorAll('.method-steps article')];
  const frames = [...document.querySelectorAll('.method-frame')];
  const timeline = [...document.querySelectorAll('.method-timeline span')];
  const titles = ['01 / ESTIMATE','02 / ALIGN','03 / COMPLETE'];
  const captions = ['Estimate material maps from the reference.', 'Project reliable material observations onto the mesh.', 'Complete the texture in 3D using the aligned observations.'];
  const videoVisibility = new Map();
  const manuallyPaused = new WeakSet(), requestedPauses = new WeakSet(), requestedPlays = new WeakSet();
  let paused = reduced.matches, activeStep = -1, framePending = false, scanTimer;
  let pointer = {x:0,y:0};
  function pauseVideo(video) {
    if(!video)return;
    if (!video.paused) {requestedPauses.add(video);video.pause();}
  }
  function updateVideo(video) {
    if(!video)return;
    if (paused || document.hidden || document.getElementById('film-dialog').open || !videoVisibility.get(video)) pauseVideo(video);
    else if (!manuallyPaused.has(video) && video.paused) {requestedPlays.add(video);video.play().catch(() => requestedPlays.delete(video));}
  }
  ambientFilms.forEach(video => {
    video.addEventListener('pause', () => {if (requestedPauses.has(video)) requestedPauses.delete(video);else if (video===materialFilm) manuallyPaused.add(video);});
    video.addEventListener('play', () => {if (requestedPlays.has(video)) requestedPlays.delete(video);else manuallyPaused.delete(video);});
  });
  const videoObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {videoVisibility.set(entry.target, entry.isIntersecting);updateVideo(entry.target);}
  }, {threshold:.25});
  ambientFilms.forEach(video => videoObserver.observe(video));
  function syncMotion() {
    body.classList.toggle('motion-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Resume visual motion' : 'Pause visual motion');
    motionButton.innerHTML = reduced.matches && paused ? '<span aria-hidden="true">▷</span> PLAY MOTION' : paused ? '<span aria-hidden="true">▷</span> MOTION OFF' : '<span aria-hidden="true">Ⅱ</span> MOTION ON';
    motionButton.disabled = false;
    ambientFilms.forEach(updateVideo);
    window.dispatchEvent(new CustomEvent('supra:motion',{detail:{paused}}));
    schedule();
  }
  motionButton.addEventListener('click', () => {paused = !paused;syncMotion();});
  reduced.addEventListener('change', () => {paused = reduced.matches;syncMotion();});
  document.addEventListener('visibilitychange', () => ambientFilms.forEach(updateVideo));
  document.getElementById('film-dialog').addEventListener('close', () => ambientFilms.forEach(updateVideo));
  document.querySelectorAll('[data-film]').forEach(button => button.addEventListener('click', () => {pauseVideo(materialFilm);},true));
  hero.addEventListener('pointermove', event => {
    if (paused || !finePointer.matches) return;
    const r = hero.getBoundingClientRect();
    pointer = {x:(event.clientX-r.left)/r.width-.5,y:(event.clientY-r.top)/r.height-.5};
    schedule();
  });
  hero.addEventListener('pointerleave', () => {pointer = {x:0,y:0};schedule();});
  function selectStep(index) {
    if (index === activeStep) return;
    activeStep=index;
    steps.forEach((step,i) => step.classList.toggle('active',i===index));
    frames.forEach((frame,i) => frame.classList.toggle('active',i===index));
    timeline.forEach((dot,i) => dot.classList.toggle('active',i===index));
    method.querySelector('.method-state').textContent=titles[index];
    method.querySelector('.method-visual-caption').textContent=captions[index];
    method.classList.remove('transitioning');
    clearTimeout(scanTimer);
    if (!paused) requestAnimationFrame(() => {method.classList.add('transitioning');scanTimer=setTimeout(()=>method.classList.remove('transitioning'),1300);});
  }
  function updateScroll() {
    framePending=false;
    const vh=window.innerHeight, y=window.scrollY;
    progress.style.transform=`scaleX(${y/Math.max(1,document.documentElement.scrollHeight-vh)})`;
    header.classList.toggle('scrolled',y>45);
    syncNavigation();
    if (specimen && !paused && finePointer.matches) {
      specimen.style.setProperty('--specimen-x',`${pointer.x*17}px`);
      specimen.style.setProperty('--specimen-y',`${pointer.y*13+Math.min(y,1000)*.045}px`);
    } else if (specimen) {specimen.style.setProperty('--specimen-x','0px');specimen.style.setProperty('--specimen-y','0px');}
    if(cinema){const cr=cinema.getBoundingClientRect();
    cinema.style.setProperty('--cinema-tilt',`${paused?0:Math.max(0,Math.min(5,(cr.top-vh*.3)/vh*7))}deg`);}
    let nearest=0,distance=Infinity;
    steps.forEach((step,i)=>{const sr=step.getBoundingClientRect();const d=Math.abs(sr.top+sr.height*.5-vh*.52);if(d<distance){distance=d;nearest=i;}});
    selectStep(nearest);
  }
  function schedule(){if(!framePending){framePending=true;requestAnimationFrame(updateScroll);}}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  const navLinks=[...document.querySelectorAll('.site-header nav a')];
  const navSections=[...document.querySelectorAll('main > section,#human-preference,#citation')];
  const sectionNavigation={gallery:'#gallery',competition:'#competition','human-preference':'#human-preference',materials:'#materials',control:'#materials',texturing:'#texturing',embodied:'#embodied',method:'#method',evaluation:'#method',release:'#citation',citation:'#citation'};
  function syncNavigation(){
    // Read the current section on every scroll, including sections without a nav link.
    // This clears stale highlights when returning home or reaching the release.
    const readingLine=Math.min(window.innerHeight*.4,header.getBoundingClientRect().bottom+48);
    let current=null;
    for(const section of navSections){
      if(section.getBoundingClientRect().top<=readingLine)current=section.id;
      else break;
    }
    if(window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2)current=navSections.at(-1)?.id;
    const href=sectionNavigation[current];
    navLinks.forEach(link=>{
      const active=link.getAttribute('href')===href;
      link.classList.toggle('active',active);
      if(active)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange',schedule);
  window.addEventListener('load',schedule,{once:true});
  document.fonts?.ready.then(schedule);
  const navLayoutObserver=new ResizeObserver(schedule);
  navLayoutObserver.observe(document.querySelector('main'));
  schedule();
  // Research measurements remain exact from first paint; never count through
  // intermediate values that could be mistaken for a reported measurement.
  const comparison=document.getElementById('case-panel'), range=document.getElementById('compare-range');
  let comparisonTouched=false;
  ['pointerdown','keydown','input'].forEach(event=>range.addEventListener(event,()=>{comparisonTouched=true;}));
  const compareObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;compareObserver.unobserve(entry.target);if(paused||comparisonTouched)return;const start=performance.now();const tick=now=>{if(paused||comparisonTouched)return;const p=Math.min(1,(now-start)/1900);const value=50+24*Math.sin(p*Math.PI*2)*Math.sin(p*Math.PI);range.value=String(Math.round(value));document.getElementById('compare-stage').style.setProperty('--split',`${range.value}%`);range.setAttribute('aria-valuetext',`${100-Number(range.value)} percent SUPRA-Tex`);if(p<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);}}, {threshold:.4});
  compareObserver.observe(comparison);
  document.querySelectorAll('[data-case],#detail-toggle').forEach(button=>button.addEventListener('click',()=>{comparisonTouched=true;}));
  // Prepare these detail pairs only when the reader approaches their section.
  const detailPreload=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;detailPreload.disconnect();for(const id of ['D6','D5','D4','D7'])for(const kind of ['input','result'])for(const view of ['detail','aligned']){const image=new Image();image.src=`assets/gallery/${id}-${kind}-${view}.webp`;}},{rootMargin:'400px'});
  detailPreload.observe(comparison);
  syncMotion();
})();

(() => {
  'use strict';
  const root = document.querySelector('#competition');
  if (!root || root.dataset.competitionReady) return;
  root.dataset.competitionReady = 'true';
  const methods = {hunyuan:'Hunyuan3D 3.1',rodin:'Rodin 2.5',tripo:'Tripo H3.1',meshy:'Meshy 7.1',hi3d:'Hi3D 3.0'};
  // Reported SUPRA-Tex preference shares. Each denominator excludes tied votes.
  // The opposite share is 100 minus this value, not an inferred tie percentage.
  const scores = {
    quality:{label:'visual quality',values:{hunyuan:84.8,rodin:75.5,tripo:67.8,meshy:57.6,hi3d:51.1},note:'Preferred for visual quality in our five comparisons.'},
    alignment:{label:'input alignment',values:{hunyuan:84.7,rodin:75.8,tripo:71.6,meshy:60.8,hi3d:51.1},note:'Preferred for input alignment in our five comparisons.'},
    pbr:{label:'PBR plausibility',values:{hunyuan:85.1,rodin:72.3,tripo:62.9,meshy:54.7,hi3d:44.9},note:'Preferred for PBR plausibility over four of five systems.'}
  };
  let selectedMetric = 'quality', selectedPreference = 'hunyuan';
  const all = selector => [...root.querySelectorAll(selector)];
  const one = selector => root.querySelector(selector);
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const textMotion = new Map();
  let preferenceReady = false;
  const canAnimatePreference = () => preferenceReady && !motionPreference.matches && !document.body.classList.contains('motion-paused');
  // Keep every number exact. Only its presentation fades; no invented interim scores.
  function revealText(element, update) {
    const before = element.textContent;
    update();
    if (element.textContent === before) return;
    const previous = textMotion.get(element);
    const current = previous ? getComputedStyle(element) : null;
    const from = previous ? {opacity:current.opacity,transform:current.transform} : {opacity:.4,transform:'translateY(2px)'};
    previous?.cancel();
    textMotion.delete(element);
    if (!canAnimatePreference() || !element.animate) return;
    const animation = element.animate([from,{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.22,.68,.12,1)'});
    textMotion.set(element,animation);
    animation.onfinish = () => {if (textMotion.get(element) === animation) textMotion.delete(element);};
  }
  function settleText() {
    textMotion.forEach(animation => animation.cancel());
    textMotion.clear();
  }
  window.addEventListener('supra:motion',event => {if(event.detail.paused) settleText();});
  motionPreference.addEventListener('change',() => {if(motionPreference.matches) settleText();});

  const metricRail = one('.comp-metric-tabs'), preferenceList = one('.preference-list');
  const metricMarker = document.createElement('span'), selectionMarker = document.createElement('li');
  metricMarker.className='preference-metric-marker';selectionMarker.className='preference-selection';
  metricMarker.setAttribute('aria-hidden','true');selectionMarker.setAttribute('aria-hidden','true');
  selectionMarker.setAttribute('role','presentation');
  metricRail.append(metricMarker);preferenceList.append(selectionMarker);
  one('.comp-study').classList.add('preference-enhanced');
  function positionIndicators(animate = canAnimatePreference()) {
    const metric = one('button[data-competition-metric][aria-selected="true"]');
    const selected = one('[data-preference-method][aria-pressed="true"]');
    if (!metric || !selected) return;
    const metricBox=metric.getBoundingClientRect(),railBox=metricRail.getBoundingClientRect();
    const selectedBox=selected.getBoundingClientRect(),listBox=preferenceList.getBoundingClientRect();
    if (!animate) {metricMarker.style.transition='none';selectionMarker.style.transition='none';}
    metricMarker.style.width=`${metricBox.width}px`;
    metricMarker.style.transform=`translateX(${metricBox.left-railBox.left+metricRail.scrollLeft}px)`;
    selectionMarker.style.height=`${selectedBox.height}px`;
    selectionMarker.style.transform=`translateY(${selectedBox.top-listBox.top}px)`;
    if (!animate) {
      metricMarker.getBoundingClientRect();selectionMarker.getBoundingClientRect();
      metricMarker.style.removeProperty('transition');selectionMarker.style.removeProperty('transition');
    }
  }
  const preferenceResize = new ResizeObserver(() => positionIndicators(false));
  preferenceResize.observe(metricRail);preferenceResize.observe(preferenceList);
  document.fonts?.ready.then(() => positionIndicators(false));
  one('.comp-study-link').addEventListener('click',() => {
    const tab=document.getElementById('evidence-tab-human');
    tab?.click();tab?.focus({preventScroll:true});
  });

  function renderMetric() {
    const metric = scores[selectedMetric];
    root.dataset.competitionMetric = selectedMetric;
    all('button[data-competition-metric]').forEach(button => {
      const active = button.dataset.competitionMetric === selectedMetric;
      button.setAttribute('aria-selected',String(active));button.tabIndex = active ? 0 : -1;
    });
    one('.comp-chart').setAttribute('aria-labelledby',`competition-metric-${selectedMetric}`);
    all('[data-preference-method]').forEach(button => {
      const method = button.dataset.preferenceMethod, value = metric.values[method];
      button.style.setProperty('--comp-score',`${value}%`);
      const number = button.querySelector('.comp-supra-value');
      const rival = 100 - value, rivalNumber = button.querySelector('.comp-rival-value');
      revealText(number,() => {number.textContent = `${value.toFixed(1)}%`;});
      revealText(rivalNumber,() => {rivalNumber.textContent = `${rival.toFixed(1)}%`;});
      button.setAttribute('aria-label',`Non-tied ${metric.label} votes: ${value.toFixed(1)}% preferred SUPRA-Tex; ${rival.toFixed(1)}% preferred ${methods[method]}.`);
    });
    renderPreference();
    const note = one('[data-competition-chart-note]');
    revealText(note,() => {note.textContent = metric.note;});
  }
  function renderPreference() {
    const metric = scores[selectedMetric], value = metric.values[selectedPreference], rival = 100 - value;
    all('[data-preference-method]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.preferenceMethod === selectedPreference)));
    const number = one('[data-preference-value]');
    revealText(number,() => {number.textContent = `${value.toFixed(1)}%`;});
    revealText(one('.preference-dial figcaption'),() => {
      one('[data-preference-rival-value]').textContent = `${rival.toFixed(1)}%`;
      one('[data-preference-rival]').textContent = methods[selectedPreference];
    });
    one('.preference-arc').style.strokeDasharray = `${value} 100`;
    one('#preference-dial').setAttribute('aria-label',`${metric.label}, non-tied votes: ${value.toFixed(1)}% preferred SUPRA-Tex; ${rival.toFixed(1)}% preferred ${methods[selectedPreference]}.`);
    positionIndicators();
  }
  const preferenceButtons = all('[data-preference-method]');
  preferenceButtons.forEach((button,index) => {
    button.addEventListener('click',() => {if(selectedPreference===button.dataset.preferenceMethod)return;selectedPreference=button.dataset.preferenceMethod;renderPreference();});
    button.addEventListener('keydown',event => {
      let next;
      if(event.key === 'ArrowDown' || event.key === 'ArrowRight') next=(index+1)%preferenceButtons.length;
      if(event.key === 'ArrowUp' || event.key === 'ArrowLeft') next=(index+preferenceButtons.length-1)%preferenceButtons.length;
      if(event.key === 'Home') next=0;
      if(event.key === 'End') next=preferenceButtons.length-1;
      if(next!==undefined){event.preventDefault();preferenceButtons[next].click();preferenceButtons[next].focus({preventScroll:true});}
    });
  });
  function keyboardTabs(buttons, select) {
    buttons.forEach((button,index) => button.addEventListener('keydown',event => {
      let next;
      if(event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if(event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
      if(event.key === 'Home') next = 0;
      if(event.key === 'End') next = buttons.length - 1;
      if(next !== undefined){event.preventDefault();select(buttons[next]);buttons[next].focus();buttons[next].scrollIntoView({block:'nearest',inline:'nearest'});}
    }));
  }
  const metricButtons = all('button[data-competition-metric]');
  const selectMetric = button => {if(selectedMetric===button.dataset.competitionMetric)return;selectedMetric = button.dataset.competitionMetric;renderMetric();};
  metricButtons.forEach(button => button.addEventListener('click',() => selectMetric(button)));
  keyboardTabs(metricButtons,selectMetric);

  renderMetric();preferenceReady=true;
})();

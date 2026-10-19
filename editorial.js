(() => {
  const tabs=[...document.querySelectorAll('[data-evidence-tab]')];
  let active=tabs.find(tab=>tab.getAttribute('aria-selected')==='true');
  function select(tab,focus){
    if(focus)tab.focus();
    if(tab===active)return;
    active=tab;
    tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1});
    document.querySelectorAll('[data-evidence-panel]').forEach(panel=>{
      panel.hidden=panel.dataset.evidencePanel!==tab.dataset.evidenceTab;
      if(!panel.hidden)window.SupraTransitions.reveal(panel);
    });
  }
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',event=>{
    let next;if(event.key==='ArrowRight')next=(i+1)%tabs.length;if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();select(tabs[next],true);}
  });});
  const benchmarkTab=tabs.find(tab=>tab.dataset.evidenceTab==='benchmarks');
  function revealTarget(target){
    window.SupraSections?.reveal(target);
    target.focus({preventScroll:true});
    target.scrollIntoView({block:'start',behavior:window.SupraTransitions.enabled()?'smooth':'instant'});
  }
  document.querySelectorAll('[data-evidence-open]').forEach(button=>{
    button.addEventListener('click',()=>{
      const details=document.getElementById(`evidence-results-${button.dataset.evidenceOpen}`);
      if(!benchmarkTab||!details)return;
      select(benchmarkTab);
      details.open=true;
      revealTarget(details.querySelector('summary'));
    });
  });
  // Links from the commercial comparison must activate the requested evidence tab.
  function selectLinkedTab(){
    const tab=tabs.find(item=>`#${item.id}`===window.location.hash);
    if(!tab)return;
    select(tab);
    revealTarget(tab);
  }
  window.addEventListener('hashchange',selectLinkedTab);
  // A study link may be clicked again after switching tabs without changing the hash.
  document.querySelectorAll('a[href^="#evidence-tab-"]').forEach(link=>{
    link.addEventListener('click',event=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const tab=tabs.find(item=>`#${item.id}`===link.getAttribute('href'));
      if(tab){select(tab);revealTarget(tab);}
    });
  });
  selectLinkedTab();
  // Add a visual scale to preference scores while keeping the exact values readable.
  document.querySelectorAll('#evidence-panel-human tbody td').forEach(cell=>{
    const value=parseFloat(cell.textContent);cell.style.setProperty('--score',`${value}%`);cell.classList.add('preference-cell');
  });
})();

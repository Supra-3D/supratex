(() => {
  'use strict';
  const root=document.querySelector('#competition');if(!root||root.dataset.workbenchReady)return;root.dataset.workbenchReady='true';
  const one=s=>root.querySelector(s),all=s=>[...root.querySelectorAll(s)];
  const base=new URL('assets/competition/aligned/',document.currentScript.src),bundle=new URL('competition-viewer.bundle.js?v=hosting-108',document.currentScript.src).href;
  const methods={hunyuan:'Hunyuan3D 3.1',rodin:'Rodin 2.5',tripo:'Tripo H3.1',meshy:'Meshy 7.1',hi3d:'Hi3D 3.0'};
  const cases={fighter:{name:'Fighter',focus:'Lettering, insignia and surface detail. From one image.'},guanyu:{name:'Guan Yu',focus:'Armor motifs, cloth folds and metal edges.'},suitcase:{name:'Vintage suitcase',focus:'Label placement, worn leather and brass.'},cinema:{name:'Cinema signage',focus:'Letter shapes, sign placement and wall texture.'},tonic:{name:'Bottle label',focus:'Label typography, botanical detail and glass.'}};
  const transition=window.SupraTransitions,bench=one('[data-comp-workbench]'),pair=one('[data-comp-pair]'),leftMount=one('[data-competition-3d-mount]'),rightMount=one('[data-competition-3d-comparator-mount]');
  const methodButtons=all('[data-comp-method]'),lightSelect=one('[data-comp-light-select]'),surfaceSelect=one('[data-comp-surface-select]'),dialog=one('[data-comp-reference-dialog]'),inputDetails=one('.comp-input-details');
  const initialMethod=methodButtons.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.compMethod||'hunyuan';
  const initialCase=one('button[data-competition-case][aria-pressed="true"]')?.dataset.competitionCase||'cinema';
  const presentation='3d';
  let selectedCase=initialCase,selectedMethod=initialMethod,displayedCase=initialCase,displayedMethod=initialMethod,version=0,viewerEpoch=0,lightEpoch=0,liveViewer=null,bundlePromise=null;
  let recoveryAttempts=0,recoveryTimer=0,contextRecoveries=0;
  let materialMode='pbr',lightingBusy=false;
  let split=.5,inView=false,suspendedState=null,retireTimer=0,navigation=0,navigating=false,referencePrimed=false;
  const splitHandle=one('[data-comp-split-handle]');
  const mobileViewport=matchMedia('(max-width:959.98px)');
  let mobileInteracting=false;
  const touchBar=document.createElement('div');touchBar.className='comp-touch-bar';
  const touchHint=document.createElement('p');touchHint.id='comp-touch-hint';
  const touchToggle=document.createElement('button');touchToggle.type='button';touchToggle.className='comp-touch-toggle';
  touchToggle.setAttribute('aria-controls',pair.id);touchToggle.setAttribute('aria-describedby',touchHint.id);
  touchBar.append(touchHint,touchToggle);pair.before(touchBar);
  const loadReveal=window.SupraComparisonReveal.stage(pair,{enabled:()=>transition.enabled(),onChange:()=>{syncToolAvailability();syncMobileInteraction();}});
  const referenceReveal=window.SupraComparisonReveal.reference(one('[data-comp-reference-thumb]'),{enabled:()=>transition.enabled()});
  const loadingLabel=()=>`Preparing ${cases[selectedCase].name} · ${methods[selectedMethod]}`;
  function settleReveals(){loadReveal.settle();referenceReveal.settle();}
  const revealMotion=matchMedia('(prefers-reduced-motion: reduce)');
  revealMotion.addEventListener('change',()=>{if(revealMotion.matches)settleReveals();});
  window.addEventListener('supra:motion',event=>{if(event.detail.paused)settleReveals();});
  // A held picture is deliberately inert: rotating it would move only the
  // invisible new scene. Case/method selectors and error recovery stay usable.
  function gatePendingReveal(event){
    if(event.target.closest('.comp-stage-status'))return;
    if(loadReveal.busy)event.stopImmediatePropagation();
    else loadReveal.settle();
  }
  pair.addEventListener('pointerdown',gatePendingReveal,true);
  pair.addEventListener('wheel',gatePendingReveal,{capture:true,passive:true});
  pair.addEventListener('keydown',gatePendingReveal,true);
  function syncMobileInteraction(){
    const mobile=mobileViewport.matches,locked=mobile&&!mobileInteracting;
    touchBar.hidden=!mobile;pair.classList.toggle('comp-mobile-browse',locked);
    splitHandle.disabled=locked||loadReveal.busy;
    const statuses=['left','right'].map(side=>one(`[data-comp-pane="${side}"]`).dataset.status);
    const ready=statuses.every(status=>status==='ready')&&!loadReveal.busy,failed=statuses.includes('error'),unavailable=failed||statuses.includes('pending');
    touchToggle.disabled=!mobileInteracting&&!ready;
    touchToggle.textContent=mobileInteracting?'Done':ready?'Interact in 3D':unavailable?'3D unavailable':'Loading 3D…';
    touchToggle.setAttribute('aria-pressed',String(mobileInteracting));
    touchHint.textContent=failed?'Use Try again in the view.':unavailable?'3D is unavailable for this comparison.':mobileInteracting?'Drag to rotate · Pinch to zoom':'Swipe to browse the page.';
    for(const [side,mount] of [['left',leftMount],['right',rightMount]])mount.inert=locked||loadReveal.busy||one(`[data-comp-pane="${side}"]`).dataset.status!=='ready';
  }
  function endMobileInteraction(){mobileInteracting=false;syncMobileInteraction();}
  touchToggle.addEventListener('click',()=>{mobileInteracting=!mobileInteracting;syncMobileInteraction();});
  // OrbitControls listens on the pair itself. The mobile gate runs first and
  // leaves native scrolling untouched until the user explicitly activates 3D.
  function gateMobilePointer(event){
    if(mobileViewport.matches&&!mobileInteracting&&!event.target.closest('.comp-stage-status'))event.stopImmediatePropagation();
  }
  pair.addEventListener('pointerdown',gateMobilePointer,true);
  pair.addEventListener('wheel',gateMobilePointer,{capture:true,passive:true});
  bench.addEventListener('keydown',event=>{
    if(!mobileViewport.matches||event.key!=='Escape'||!mobileInteracting||dialog.open||inputDetails.open)return;
    event.preventDefault();event.stopImmediatePropagation();endMobileInteraction();touchToggle.focus({preventScroll:true});
  },true);
  function revealMobileSelection(button){
    if(!mobileViewport.matches||!button)return;
    const rail=button.parentElement,box=button.getBoundingClientRect(),bounds=rail.getBoundingClientRect();
    if(box.left<bounds.left+10||box.right>bounds.right-10)rail.scrollTo({left:Math.max(0,rail.scrollLeft+box.left-bounds.left-(rail.clientWidth-box.width)/2),behavior:'auto'});
  }
  function mobileViewportChanged(){
    endMobileInteraction();
    requestAnimationFrame(()=>{revealMobileSelection(methodButtons.find(b=>b.getAttribute('aria-pressed')==='true'));revealMobileSelection(one('[data-competition-case][aria-pressed="true"]'));layoutLeaders();});
  }
  mobileViewport.addEventListener('change',mobileViewportChanged);
  const touchVisibility=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&mobileInteracting)endMobileInteraction();});touchVisibility.observe(pair);
  function layoutLeaders(){
    const w=pair.clientWidth,h=pair.clientHeight;if(!w||!h)return;
    const lean=.08*Math.sin(Math.PI*split),top=split-lean,bottom=split+lean;
    const labels=[one('.comp-stage-label.is-supra'),one('.comp-stage-label.is-commercial')];
    const paths=all('[data-comp-leader]');
    labels.forEach((label,i)=>{
      const y=label.offsetTop+label.offsetHeight/2,edge=(top+(bottom-top)*y/h)*w;
      const end=i?label.offsetLeft-10:label.offsetLeft+label.offsetWidth+10;
      const visible=i?edge+12<end:edge-12>end;
      paths[i].setAttribute('d',visible?`M${end/w*100} ${y/h*100} H${edge/w*100}`:'');
    });
  }
  function setSplit(value){
    split=Math.max(0,Math.min(1,value));const lean=.08*Math.sin(Math.PI*split),top=(split-lean)*100,bottom=(split+lean)*100;
    pair.style.setProperty('--split-top',`${top}%`);pair.style.setProperty('--split-bottom',`${bottom}%`);
    pair.style.setProperty('--split-center',`${split*100}%`);pair.dataset.reveal=split===0?'right':split===1?'left':'both';
    const line=one('[data-comp-split-line]');line.setAttribute('x1',top);line.setAttribute('x2',bottom);
    splitHandle.setAttribute('aria-valuenow',String(Math.round(split*100)));splitHandle.setAttribute('aria-valuetext',`${Math.round(split*100)} percent SUPRA-Tex; ${100-Math.round(split*100)} percent ${methods[displayedMethod]}`);
    layoutLeaders();
    liveViewer?.setSplit(split);
  }
  function feedback(message=''){const p=one('[data-comp-feedback]');p.textContent=message;p.hidden=!message;}
  function syncSelection(){
    all('[data-competition-case]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.competitionCase===displayedCase)));methodButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compMethod===displayedMethod)));
    all('[data-comp-method-name]').forEach(e=>e.textContent=methods[displayedMethod]);
    bench.dataset.compCase=displayedCase;
    const single=displayedCase==='fighter',method=methods[displayedMethod];
    one('[data-comp-input-label]').textContent=single?'Inputs: 1 image per method':`Inputs: SUPRA-Tex 2 · ${method.split(' ')[0]} 1`;
    one('[data-comp-input-description]').textContent=single?'Each method uses the same single reference image and generates its own geometry.':`SUPRA-Tex uses the reference plus a synthesized back view; ${method} uses the reference only. Each method generates its own geometry.`;
    inputDetails.open=false;
    one('[data-comp-back-flight]').hidden=displayedCase!=='fighter';setSplit(split);
    requestAnimationFrame(()=>{revealMobileSelection(methodButtons.find(b=>b.dataset.compMethod===displayedMethod));revealMobileSelection(one(`[data-competition-case="${displayedCase}"]`));});
  }
  function syncToolAvailability(){
    const ready=['left','right'].every(side=>one(`[data-comp-pane="${side}"]`).dataset.status==='ready')&&!loadReveal.busy;
    all('[data-comp-tools] button,[data-comp-tools] select').forEach(c=>c.disabled=!ready);
    lightSelect.disabled=!ready||materialMode==='albedo'||lightingBusy;
    lightSelect.closest('label').classList.toggle('is-disabled',materialMode==='albedo');
    lightSelect.title=materialMode==='albedo'?'Lighting is available with the Material surface.':'';
  }
  function updateLight(light){lightSelect.value=light;}
  function updateMaterial(mode){materialMode=mode;surfaceSelect.value=mode;syncToolAvailability();}
  function updateView(){const view=liveViewer?.state().view||'front';all('[data-comp-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compView===view)));}
  function slotStatus(side,status,error=''){
    const pane=one(`[data-comp-pane="${side}"]`),message=one(`[data-comp-status="${side}"]`),mount=side==='left'?leftMount:rightMount;
    pane.dataset.status=status;mount.inert=status!=='ready';mount.setAttribute('aria-busy',String(status==='loading'));
    message.hidden=presentation!=='3d'||status==='ready'||status==='idle';
    message.querySelector('p').textContent=status==='error'?'3D could not be loaded.':status==='pending'?'3D asset unavailable.':'Loading 3D…';
    message.querySelector('button').hidden=status!=='error';message.title=error;
    if(side==='left')syncToolAvailability();
    syncMobileInteraction();
    const states=['left','right'].map(key=>one(`[data-comp-pane="${key}"]`).dataset.status);
    if(states.every(value=>value==='ready'))loadReveal.ready();
    else if(states.includes('error')||states.includes('pending'))loadReveal.failed();
  }
  function loadBundle(){
    if(window.SupraCompetition3D)return Promise.resolve();if(bundlePromise)return bundlePromise;
    bundlePromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=bundle;s.onload=()=>{s.remove();window.SupraCompetition3D?resolve():reject(Error('Viewer unavailable'));};s.onerror=()=>{s.remove();reject(Error('Viewer unavailable'));};document.head.append(s);}).catch(e=>{bundlePromise=null;throw e;});return bundlePromise;
  }
  async function start3D(restore=null){
    if(loadReveal.state!=='waiting')loadReveal.begin(loadingLabel());
    const epoch=++viewerEpoch;++lightEpoch;lightingBusy=false;slotStatus('left','loading');slotStatus('right','loading');updateMaterial('pbr');
    let restoring=!!restore;
    try{
      await loadBundle();if(presentation!=='3d'||epoch!==viewerEpoch)return;
      if(!liveViewer){
        const viewer=window.SupraCompetition3D.create(leftMount,{rightMount,container:pair,layout:'diagonal',viewportHeightScale:1.12,
          onStatus:(text,error,busy)=>{if(liveViewer!==viewer||presentation!=='3d'||(restoring&&!error&&!busy))return;slotStatus('left',error?'error':busy?'loading':'ready',error?text:'');},
          onComparatorStatus:s=>{if(liveViewer===viewer&&presentation==='3d'&&!(restoring&&s.status==='ready'))slotStatus('right',s.status,s.error);},
          onLighting:s=>{if(liveViewer===viewer&&presentation==='3d')updateLight(s.light);},
          onContextLost:s=>{
            if(liveViewer!==viewer||presentation!=='3d')return;
            if(recoveryAttempts>=1){slotStatus('left','error','The 3D view was interrupted. Please retry.');slotStatus('right','error','The 3D view was interrupted. Please retry.');return;}
            recoveryAttempts++;contextRecoveries++;clearTimeout(recoveryTimer);
            recoveryTimer=setTimeout(()=>{
              if(liveViewer!==viewer||presentation!=='3d')return;
              viewer.dispose();liveViewer=null;start3D(s);
            },0);
          }
        });liveViewer=viewer;viewer.setSplit(split);
      }
      const ready=await liveViewer.load(displayedCase,displayedMethod);if(epoch!==viewerEpoch||presentation!=='3d')return;
      if(!ready)slotStatus('left','error');
      else if(restore){
        await liveViewer.restoreState(restore);if(epoch!==viewerEpoch||presentation!=='3d')return;
        restoring=false;const s=liveViewer.state();setSplit(s.split);updateMaterial(s.mode);slotStatus('left',s.left.status,s.left.error);slotStatus('right',s.right.status,s.right.error);
      }
      updateView();
    }catch(error){if(epoch===viewerEpoch&&presentation==='3d'){slotStatus('left','error',error.message);slotStatus('right','error',error.message);}}
  }
  function stop3D(){++viewerEpoch;++lightEpoch;lightingBusy=false;clearTimeout(recoveryTimer);loadReveal.clear();liveViewer?.dispose();liveViewer=null;leftMount.replaceChildren();rightMount.replaceChildren();slotStatus('left','idle');slotStatus('right','idle');endMobileInteraction();}
  async function selectComparison(){
    const token=++version,id=selectedCase,method=selectedMethod;root.setAttribute('aria-busy','true');feedback();
    const reference={url:new URL(`${id}-reference.webp`,base).href,alt:`Original reference image: ${cases[id].name}`};
    referenceReveal.pending(id!==displayedCase||!referencePrimed);
    try{
      if(id!==displayedCase||!referencePrimed)await transition.decode(reference.url);
      if(token!==version)return false;
      const changedCase=id!==displayedCase,changedMethod=method!==displayedMethod;
      if((changedCase||changedMethod)&&(liveViewer||inView))loadReveal.begin(`Preparing ${cases[id].name} · ${methods[method]}`);
      if(changedCase||changedMethod)recoveryAttempts=0;
      const image=one('[data-comp-reference-image]');image.src=reference.url;image.alt=reference.alt;referencePrimed=true;
      if(changedCase)referenceReveal.replace(reference.url,reference.alt);
      displayedCase=id;displayedMethod=method;syncSelection();
      one('#comp-reference-title').textContent=cases[id].name;
      one('[data-comp-reference-open]').setAttribute('aria-label','Enlarge original reference: '+cases[id].name);
      root.dataset.competitionCase=id;root.dataset.competitionMethod=method;pair.setAttribute('aria-label',`${cases[id].name}: SUPRA-Tex and ${methods[method]}, shared view and lighting`);
      if(!navigating){
        // The shared 4K ceiling bounds allocation size. Reuse the shared
        // renderer and unchanged left asset when only the method changes.
        if(changedCase){suspendedState=null;if(liveViewer||inView)start3D();}
        else if(changedMethod){suspendedState=null;liveViewer?.setComparator(displayedMethod).catch(()=>{});}
      }
      return true;
    }catch(_){if(token===version){selectedCase=displayedCase;selectedMethod=displayedMethod;syncSelection();feedback('This comparison could not be loaded. The previous result is still shown; try again.');}return false;}
    finally{if(token===version){root.setAttribute('aria-busy','false');referenceReveal.pending(false);}}
  }
  function keyboardTabs(buttons){buttons.forEach((b,i)=>b.addEventListener('keydown',e=>{const next=['ArrowRight','ArrowDown'].includes(e.key)?(i+1)%buttons.length:['ArrowLeft','ArrowUp'].includes(e.key)?(i+buttons.length-1)%buttons.length:e.key==='Home'?0:e.key==='End'?buttons.length-1:null;if(next!==null){e.preventDefault();buttons[next].click();buttons[next].focus({preventScroll:true});}}));}
  function cancelNavigation(){if(navigating){++version;selectedCase=displayedCase;selectedMethod=displayedMethod;root.setAttribute('aria-busy','false');}++navigation;navigating=false;}
  const caseButtons=all('[data-competition-case]');caseButtons.forEach(b=>b.addEventListener('click',()=>{cancelNavigation();if(selectedCase===b.dataset.competitionCase)return;selectedCase=b.dataset.competitionCase;selectComparison();}));keyboardTabs(caseButtons);
  methodButtons.forEach(b=>b.addEventListener('click',()=>{cancelNavigation();if(selectedMethod===b.dataset.compMethod)return;selectedMethod=b.dataset.compMethod;selectComparison();}));keyboardTabs(methodButtons);
  let drag=null;
  splitHandle.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.button!==0||!e.isPrimary)return;e.preventDefault();splitHandle.focus({preventScroll:true});drag={pointer:e.pointerId,x:e.clientX,split,width:pair.clientWidth};splitHandle.setPointerCapture(e.pointerId);pair.classList.add('is-splitting');});
  splitHandle.addEventListener('pointermove',e=>{e.stopPropagation();if(drag?.pointer===e.pointerId)setSplit(drag.split+(e.clientX-drag.x)/drag.width);});
  function endDrag(e){e.stopPropagation();if(drag?.pointer!==e.pointerId)return;drag=null;pair.classList.remove('is-splitting');if(splitHandle.hasPointerCapture(e.pointerId))splitHandle.releasePointerCapture(e.pointerId);}
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>splitHandle.addEventListener(type,endDrag));
  splitHandle.addEventListener('wheel',e=>{e.stopPropagation();e.preventDefault();},{passive:false});
  splitHandle.addEventListener('keydown',e=>{
    e.stopPropagation();const step=e.shiftKey ? .1 : .02;
    const target={ArrowLeft:split-step,ArrowDown:split-step,ArrowRight:split+step,ArrowUp:split+step,Home:0,End:1,PageDown:split-.1,PageUp:split+.1}[e.key];
    if(target!==undefined){e.preventDefault();setSplit(target);}
  });
  const splitResize=new ResizeObserver(layoutLeaders);splitResize.observe(pair);
  surfaceSelect.addEventListener('change',()=>{liveViewer?.setMode(surfaceSelect.value);updateMaterial(surfaceSelect.value);});
  all('[data-comp-view]').forEach(b=>b.addEventListener('click',()=>{liveViewer?.setView(b.dataset.compView);updateView();}));
  all('[data-comp-zoom]').forEach(b=>b.addEventListener('click',()=>{liveViewer?.zoom(Number(b.dataset.compZoom));updateView();}));
  one('[data-comp-reset]').addEventListener('click',()=>{liveViewer?.reset();updateMaterial('pbr');updateView();});
  for(const mount of [leftMount,rightMount])for(const event of ['pointerup','wheel','keydown'])mount.addEventListener(event,()=>requestAnimationFrame(updateView),{passive:true});
  lightSelect.addEventListener('change',async()=>{
    const viewer=liveViewer,epoch=viewerEpoch,light=++lightEpoch;if(!viewer)return;feedback();
    const requested=lightSelect.value;lightingBusy=true;syncToolAvailability();
    try{await viewer.setLighting(requested);}catch(_){if(viewer===liveViewer&&epoch===viewerEpoch&&light===lightEpoch){updateLight(viewer.state().lighting?.light||'hall');feedback('The lighting could not be loaded. The previous light is still active.');}}
    finally{if(viewer===liveViewer&&epoch===viewerEpoch&&light===lightEpoch){lightingBusy=false;syncToolAvailability();}}
  });
  inputDetails.addEventListener('keydown',event=>{if(event.key==='Escape'&&inputDetails.open){event.preventDefault();event.stopPropagation();inputDetails.open=false;inputDetails.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',event=>{if(inputDetails.open&&!inputDetails.contains(event.target))inputDetails.open=false;});
  function retry3D(side){
    loadReveal.begin(loadingLabel());
    if(!liveViewer||liveViewer.state().contextLost){const saved=liveViewer?.state();stop3D();recoveryAttempts=0;start3D(saved);}
    else if(side==='left')start3D();else liveViewer.setComparator(displayedMethod,{retry:true});
  }
  one('[data-comp-retry="left"]').addEventListener('click',()=>retry3D('left'));one('[data-comp-retry="right"]').addEventListener('click',()=>retry3D('right'));
  one('[data-comp-reference-open]').addEventListener('click',()=>{dialog.showModal();transition.reveal(dialog,{opacity:.8,shift:3});});one('[data-comp-reference-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>one('[data-comp-reference-open]').focus({preventScroll:true}));
  function syncVisibility(){
    clearTimeout(retireTimer);
    if(document.hidden&&mobileInteracting)endMobileInteraction();
    if(navigating)return;
    if(inView&&!document.hidden){
      if(!referencePrimed)selectComparison();
      if(!liveViewer){const restore=suspendedState;suspendedState=null;start3D(restore);}
    }else if(liveViewer){
      retireTimer=setTimeout(()=>{if((!inView||document.hidden)&&liveViewer){suspendedState=liveViewer.state();stop3D();}},1200);
    }
  }
  const visibilityObserver=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncVisibility();},{rootMargin:'100px 0px'});visibilityObserver.observe(bench);
  document.addEventListener('visibilitychange',syncVisibility);
  window.addEventListener('pagehide',()=>{visibilityObserver.disconnect();touchVisibility.disconnect();splitResize.disconnect();mobileViewport.removeEventListener('change',mobileViewportChanged);clearTimeout(retireTimer);referenceReveal.clear();stop3D();},{once:true});
  const smoothScroll=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('motion-paused')?'auto':'smooth';
  async function openComparison({caseId='fighter',method='meshy',source='direct'}={}){
    if(!cases[caseId]||!methods[method])return false;
    const request=++navigation;navigating=true;clearTimeout(retireTimer);
    suspendedState=null;selectedCase=caseId;selectedMethod=method;
    const committed=await selectComparison();if(request!==navigation)return false;navigating=false;
    const heading=one('#comparison-3d');heading.scrollIntoView({behavior:smoothScroll(),block:'start'});heading.focus({preventScroll:true});
    if(!committed){syncVisibility();return false;}
    bench.dataset.entry=source;setSplit(.5);recoveryAttempts=0;start3D();
    history.replaceState(null,'','#comparison-3d');return true;
  }
  one('[data-comp-back-flight]').addEventListener('click',()=>{
    cancelNavigation();if(liveViewer)suspendedState=liveViewer.state();stop3D();
    window.SupraHeroPlayback?.returnToFlight();
    document.querySelector('#top').scrollIntoView({behavior:smoothScroll(),block:'start'});
    document.querySelector('#hero-explore').focus({preventScroll:true});history.replaceState(null,'','#top');
  });
  window.SupraCompetition={open:openComparison,state:()=>({caseId:displayedCase,method:displayedMethod,view:liveViewer?.state().view||'front',presentation,split,inView,navigating,suspended:!!suspendedState,contextRecoveries,mobileInteraction:{enabled:mobileViewport.matches,active:mobileInteracting},inspection:{open:!!liveViewer,method:displayedMethod,competitorAsset:liveViewer?.state().right.status||'idle',linked:true},viewer:liveViewer?.state()||{disposed:true,initialized:false}})};
  syncSelection();setSplit(.5);mobileViewportChanged();
  // Load only the live pair when this section approaches the viewport.
})();

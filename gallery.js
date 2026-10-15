'use strict';
(() => {
  const cases = [
    {id:'G1',title:'Pitcher plant',name:'猪笼草',kind:'Botanical detail',detail:'Leaf veins, rim color & fine edges',featured:true,scenic:true,orbit:false},
    {id:'G2',title:'Spiny whelk shell',name:'棘刺海螺',kind:'Natural structure',detail:'Spines, ridges & a pearly interior',featured:true,scenic:true,orbit:false},
    {id:'G3',title:'Ficus bonsai',name:'榕树盆景',kind:'Botanical detail',detail:'Leaf clusters, roots & textured bark'},
    {id:'G4',title:'Potted orchid',name:'蝴蝶兰盆栽',kind:'Botanical detail',detail:'Petal markings & delicate stems'},
    {id:'G5',title:'Motocross helmet',name:'越野摩托头盔',kind:'Manufactured surfaces',detail:'Painted graphics, vents & trim'},
    {id:'G6',title:'Compact excavator',name:'紧凑型挖掘机',kind:'Manufactured surfaces',detail:'Cab, tracks & worn yellow paint'},
    {id:'G7',title:'Celadon lion',name:'韩国风格青瓷卧狮镇纸',kind:'Craft & ornament',detail:'Carved curls beneath a celadon glaze'},
    {id:'G8',title:'Kingfisher specimen',name:'翠鸟标本',kind:'Natural structure',detail:'Blue feathers & an orange breast'},
    {id:'G9',title:'Vintage gramophone',name:'复古留声机',kind:'Craft & ornament',detail:'Brass horn, wood grain & fine fittings'},
    {id:'G10',title:'Red oni mask',name:'赤鬼面具',kind:'Craft & ornament',detail:'Painted grooves, horns & teeth'},
    {id:'G11',title:'Urban gardener',name:'城市园丁肖像',kind:'Portrait',detail:'Skin, hair & the folds of a work jacket'},
    {id:'G12',title:'Curled pangolin',name:'蜷曲穿山甲',kind:'Natural structure',detail:'Overlapping scales along a curled body'},
    {id:'G13',title:'Tortoise',name:'写实陆龟',kind:'Natural structure',detail:'Shell plates, creases & skin texture'},
    {id:'G14',title:'Polynesian-style ebony figure',name:'波利尼西亚风格黑檀坐像',kind:'Craft & ornament',detail:'Carved patterns & polished dark wood'}
  ];
  cases.forEach(item=>{item.aligned=true;item.interactive=true;item.views=1;if(!item.featured){item.arc=24;item.poster=`${item.id}-poster.webp`;}});
  const base='assets/gallery/';
  function init(){
    const grid=document.querySelector('[data-gallery-grid]'), dialog=document.getElementById('gallery-dialog');
    if(!grid||!dialog||grid.dataset.ready)return;
    grid.dataset.ready='true';
    const $=s=>dialog.querySelector(s);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'), fine=matchMedia('(hover: hover) and (pointer: fine)');
    let paused=reduced.matches||document.body.classList.contains('motion-paused'),hovered=null,playing=null,current=null,mode='compare',view='both',opener=null,savedScroll=0,bodyStyles=null;
    let videoIntent=false,playVersion=0,renderVersion=0,shownMode=null,shownView=null,mediaTransition=null,orbitPreparation=null;
    const visibility=new WeakMap(), cards=new Map();
    const modalVideo=$('[data-gallery-video]');
    const main=$('.gallery-dialog-main'),content=document.createElement('div'),imageCache=new Map();
    content.className='gallery-media-content';
    content.append(...main.children);main.append(content);
    const threeButton=document.createElement('button');
    threeButton.type='button';threeButton.dataset.galleryMode='3d';threeButton.className='gallery-three-entry';
    threeButton.textContent='Explore 3D';threeButton.setAttribute('aria-pressed','false');threeButton.hidden=true;
    $('.gallery-tabs').append(threeButton);
    const threePanel=document.createElement('div');
    threePanel.className='gallery-three-panel';threePanel.hidden=true;
    threePanel.innerHTML='<div class="gallery-three-mount" data-gallery-three-mount aria-label="Interactive 3D result"></div><div class="gallery-three-controls"><div class="gallery-three-modes" role="group" aria-label="3D material"><button type="button" data-gallery-material="pbr" aria-pressed="true">Material</button><button type="button" data-gallery-material="albedo" aria-pressed="false">Albedo</button></div><span class="gallery-three-hint">Drag to rotate · scroll to zoom</span><div class="gallery-three-camera" role="group" aria-label="3D camera"><button type="button" data-gallery-zoom="0.85" aria-label="Zoom out">−</button><button type="button" data-gallery-reset>Reset</button><button type="button" data-gallery-zoom="1.18" aria-label="Zoom in">+</button></div></div>';
    content.append(threePanel);
    const lightRow=document.createElement('div');lightRow.className='gallery-light-controls';
    lightRow.innerHTML='<span class="gallery-light-label">Light</span><div class="gallery-light-options" role="group" aria-label="Display lighting"></div><span class="gallery-light-status" aria-live="polite"></span>';
    threePanel.append(lightRow);
    const threeMount=threePanel.querySelector('[data-gallery-three-mount]');
    let viewer=null,viewerPhase='idle',viewerLibrary=null,lightUIVersion=0;
    function prepareLights(){
      lightRow.querySelector('.gallery-light-options').replaceChildren(...Object.entries(window.SupraGallery3D.lights||{}).map(([id,preset])=>{
        const button=document.createElement('button');button.type='button';button.dataset.galleryLight=id;button.textContent=preset.label;button.setAttribute('aria-pressed','false');return button;
      }));
    }
    function syncLights(message=''){
      const state=viewer?.state(),recommended=window.SupraGallery3D?.lightingForCase?.(current?.id)?.light;
      lightRow.querySelectorAll('[data-gallery-light]').forEach(button=>{
        button.setAttribute('aria-pressed',String(button.dataset.galleryLight===state?.lighting?.light));
        button.disabled=viewerPhase!=='ready'||state?.mode==='albedo';
        button.title=button.dataset.galleryLight===recommended?'Selected for this case':'';
      });
      lightRow.setAttribute('aria-busy',String(!!state?.lightBusy));
      lightRow.querySelector('.gallery-light-status').textContent=message||(state?.mode==='albedo'?'Unlit color':state?.lightBusy?'Preparing light…':state?.lighting?.light===recommended?'Case preset':'');
    }
    const canAnimate=()=>!paused&&!reduced.matches&&!document.hidden;
    const ease=window.SupraTransitions?.easing||'cubic-bezier(.22,.68,.12,1)',duration=window.SupraTransitions?.duration||280;
    function prepareImage(url){
      if(!imageCache.has(url))imageCache.set(url,new Promise((resolve,reject)=>{
        const image=new Image();image.onload=()=>image.decode().catch(()=>{}).then(resolve);image.onerror=reject;image.src=url;
      }).catch(error=>{imageCache.delete(url);throw error;}));
      return imageCache.get(url);
    }
    function prepareOrbit(item){
      cancelOrbitPreparation();
      const url=`${base}${item.id}-orbit.mp4`;
      if(modalVideo.getAttribute('src')!==url){modalVideo.src=url;modalVideo.load();}
      if(modalVideo.readyState>=2)return Promise.resolve();
      return new Promise((resolve,reject)=>{
        let timer;
        const finish=error=>{
          clearTimeout(timer);modalVideo.removeEventListener('loadeddata',ready);modalVideo.removeEventListener('error',failed);
          if(orbitPreparation===request)orbitPreparation=null;
          if(error)reject(error);else resolve();
        };
        const ready=()=>{if(modalVideo.readyState>=2&&modalVideo.getAttribute('src')===url)finish();};
        const failed=()=>finish(new Error('Orbit media could not load.'));
        const request={cancel:()=>finish(new DOMException('Orbit request superseded.','AbortError'))};
        orbitPreparation=request;
        modalVideo.addEventListener('loadeddata',ready);modalVideo.addEventListener('error',failed);
        timer=setTimeout(()=>{if(modalVideo.readyState>=2&&modalVideo.getAttribute('src')===url)finish();else failed();},6000);
      });
    }
    function cancelOrbitPreparation(){orbitPreparation?.cancel();}
    function settleTransition(){mediaTransition?.finish();}
    function transitionContent(update,animate=true){
      if(!animate||!canAnimate()||!dialog.open||!content.animate){update();return Promise.resolve();}
      const height=content.getBoundingClientRect().height,snapshot=content.cloneNode(true);
      snapshot.className='gallery-media-snapshot';snapshot.inert=true;snapshot.setAttribute('aria-hidden','true');
      snapshot.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      // Canvas nodes clone without pixels. Preserve the actual outgoing 3D frame.
      const sourceCanvases=content.querySelectorAll('canvas');
      snapshot.querySelectorAll('canvas').forEach((canvas,index)=>{
        const source=sourceCanvases[index];canvas.width=source.width;canvas.height=source.height;
        const appearance=getComputedStyle(source);canvas.style.opacity=appearance.opacity;canvas.style.transform=appearance.transform;
        try{canvas.getContext('2d').drawImage(source,0,0);}catch{}
      });
      // Freeze an outgoing orbit at its actual frame; cloned videos start empty.
      snapshot.querySelectorAll('video').forEach((video,index)=>{
        const source=content.querySelectorAll('video')[index],canvas=document.createElement('canvas');
        canvas.className='gallery-orbit-frame';canvas.width=source.videoWidth||1;canvas.height=source.videoHeight||1;
        if(source.readyState>=2)canvas.getContext('2d').drawImage(source,0,0);
        else{const poster=document.createElement('img');poster.className='gallery-orbit-frame';poster.src=source.poster;video.replaceWith(poster);return;}
        video.replaceWith(canvas);
      });
      main.append(snapshot);update();
      const nextHeight=content.getBoundingClientRect().height;
      main.style.height=`${height}px`;
      const animations=[snapshot.animate([{opacity:1},{opacity:0}],{duration,easing:ease,fill:'forwards'}),content.animate([{opacity:1,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}],{duration,easing:ease,fill:'forwards'})];
      if(Math.abs(nextHeight-height)>.5)animations.push(main.animate([{height:`${height}px`},{height:`${nextHeight}px`}],{duration,easing:ease,fill:'forwards'}));
      let complete;
      const done=new Promise(resolve=>{complete=resolve;});
      const active={done,finish:()=>{
        if(mediaTransition!==active)return;
        animations.forEach(animation=>animation.cancel());snapshot.remove();main.style.removeProperty('height');mediaTransition=null;complete();
      }};
      mediaTransition=active;Promise.allSettled(animations.map(animation=>animation.finished)).then(active.finish);
      return done;
    }
    grid.innerHTML=cases.map(c=>c.featured?`
      <article class="gallery-card is-featured" data-gallery-card="${c.id}">
        <div class="gallery-feature-stage" data-gallery-feature>
          <img src="${base+c.id}-scene.webp" alt="${c.title} reference with its supplied scene background" loading="lazy" decoding="async">
          <img class="gallery-feature-result" src="${base+c.id}-result-aligned.webp" alt="SUPRA-Tex ${c.title.toLowerCase()} at the matching source camera" loading="lazy" decoding="async">
          <span class="gallery-feature-label">Reference image</span><span class="gallery-feature-label is-result">SUPRA-Tex result</span>
        </div>
        <label class="gallery-feature-controls"><input type="range" min="0" max="100" value="50" data-gallery-feature-range aria-label="Compare ${c.title.toLowerCase()} reference and SUPRA-Tex result"></label>
        <div class="gallery-feature-caption"><strong title="${c.title}">${c.title}</strong><button class="gallery-feature-explore" type="button" data-gallery-open="${c.id}" data-gallery-start-mode="3d" aria-label="Explore ${c.title} in 3D" aria-haspopup="dialog" aria-controls="gallery-dialog">Explore in 3D <span aria-hidden="true">↗</span></button></div>
      </article>`:`
      <article class="gallery-card" data-gallery-card="${c.id}"><button class="gallery-open" type="button" data-gallery-open="${c.id}" title="${c.title}" aria-label="Inspect ${c.title}: reference and SUPRA-Tex result">
        <span class="gallery-card-media"><img src="${base+c.poster}" alt="SUPRA-Tex generated ${c.title.toLowerCase()}" loading="lazy" decoding="async"><video muted playsinline loop preload="none" poster="${base+c.poster}" aria-hidden="true" tabindex="-1" data-gallery-preview="${c.id}"></video><span class="gallery-card-action" aria-hidden="true">↗</span></span>
        <span class="gallery-card-caption"><span><strong>${c.title}</strong></span></span>
      </button></article>`).join('');
    const featureControls=[...grid.querySelectorAll('[data-gallery-card].is-featured')].map(card=>({surface:card.querySelector('[data-gallery-feature]'),range:card.querySelector('[data-gallery-feature-range]')}));
    featureControls.forEach(({surface,range})=>range.addEventListener('input',()=>{surface.style.setProperty('--g-split',`${range.value}%`);range.setAttribute('aria-valuetext',`${range.value}% reference, ${100-Number(range.value)}% SUPRA-Tex`);}));
    function enableImageDrag(surface,range){
      const grip=document.createElement('span');grip.className='gallery-compare-grip';grip.setAttribute('aria-hidden','true');
      grip.innerHTML='<svg viewBox="0 0 24 24"><path d="m8 8-4 4 4 4m8-8 4 4-4 4M12 5v14"/></svg>';surface.append(grip);
      surface.classList.add('gallery-direct-drag');
      surface.querySelectorAll('img').forEach(img=>img.draggable=false);
      let gesture=null;
      const apply=x=>{range.value=String(Math.round(Math.max(0,Math.min(1,(x-gesture.rect.left)/gesture.rect.width))*100));range.dispatchEvent(new Event('input',{bubbles:true}));};
      function release(){surface.classList.remove('is-dragging');if(gesture&&surface.hasPointerCapture(gesture.id))surface.releasePointerCapture(gesture.id);gesture=null;}
      surface.addEventListener('pointerdown',event=>{
        if(!event.isPrimary||event.button!==0)return;
        gesture={id:event.pointerId,x:event.clientX,y:event.clientY,rect:surface.getBoundingClientRect(),touch:event.pointerType==='touch',active:event.pointerType!=='touch'};
        if(gesture.active){event.preventDefault();surface.setPointerCapture(event.pointerId);surface.classList.add('is-dragging');apply(event.clientX);}
      });
      surface.addEventListener('pointermove',event=>{
        if(!gesture||event.pointerId!==gesture.id)return;
        if(!gesture.touch&&!(event.buttons&1)){release();return;}
        if(!gesture.active){
          const dx=Math.abs(event.clientX-gesture.x),dy=Math.abs(event.clientY-gesture.y);
          if(dy>6&&dy>dx){release();return;}
          if(dx<6)return;
          gesture.active=true;surface.setPointerCapture(event.pointerId);surface.classList.add('is-dragging');
        }
        event.preventDefault();apply(event.clientX);
      });
      surface.addEventListener('pointerup',event=>{if(!gesture||event.pointerId!==gesture.id)return;apply(event.clientX);release();});
      surface.addEventListener('pointercancel',release);
      window.addEventListener('blur',release);
      surface.addEventListener('lostpointercapture',()=>{surface.classList.remove('is-dragging');gesture=null;});
      surface.addEventListener('dragstart',event=>event.preventDefault());
      range.addEventListener('focus',()=>surface.classList.add('has-keyboard-focus'));
      range.addEventListener('blur',()=>surface.classList.remove('has-keyboard-focus'));
      return release;
    }
    featureControls.forEach(({surface,range})=>{enableImageDrag(surface,range);range.dispatchEvent(new Event('input'));});
    const resetAlignedDrag=enableImageDrag($('[data-gallery-aligned]'),$('[data-gallery-range]'));
    const allowed=()=>!paused&&!reduced.matches&&!document.hidden;
    function stopPreview(){if(!playing)return;playing.querySelector('video').pause();playing.classList.remove('is-playing');playing=null;}
    function preview(card){
      if(!card||!card.querySelector('video')||!allowed()||!fine.matches||dialog.open||!visibility.get(card))return;
      if(playing===card)return;
      stopPreview();playing=card;
      const video=card.querySelector('video');
      if(!video.getAttribute('src'))video.src=`${base}${card.dataset.galleryCard}-orbit.mp4`;
      video.currentTime=0;
      video.play().then(()=>{if(playing===card&&hovered===card&&allowed()&&!dialog.open)card.classList.add('is-playing');else video.pause();}).catch(()=>{if(playing===card)stopPreview();});
    }
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{visibility.set(entry.target,entry.isIntersecting&&entry.intersectionRatio>.2);if(!visibility.get(entry.target)&&playing===entry.target)stopPreview();else if(hovered===entry.target)preview(entry.target);}),{threshold:[0,.2,.5]});
    grid.querySelectorAll('[data-gallery-card]').forEach(card=>{
      cards.set(card.dataset.galleryCard,card);observer.observe(card);
      card.addEventListener('pointerenter',()=>{hovered=card;preview(card);},{passive:true});
      card.addEventListener('pointerleave',()=>{if(hovered===card)hovered=null;if(playing===card)stopPreview();},{passive:true});
      card.querySelector('button').addEventListener('click',event=>open(card.dataset.galleryCard,event.currentTarget,event.currentTarget.dataset.galleryStartMode));
    });
    function setStatus(text=''){$('[data-gallery-status]').textContent=text;}
    function loadViewerLibrary(){
      if(window.SupraGallery3D?.create)return Promise.resolve();
      if(viewerLibrary)return viewerLibrary;
      viewerLibrary=new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='gallery-viewer.bundle.js?v=110';script.async=true;
        const timeout=setTimeout(()=>finish(new Error('3D viewer loading timed out.')),20000);
        function finish(error){
          clearTimeout(timeout);script.onload=null;script.onerror=null;
          if(error){script.remove();viewerLibrary=null;reject(error);}else resolve();
        }
        script.onload=()=>finish(window.SupraGallery3D?.create?null:new Error('3D viewer is unavailable.'));
        script.onerror=()=>finish(new Error('3D viewer could not load.'));
        document.head.append(script);
      });
      return viewerLibrary;
    }
    function disposeViewer(){
      ++lightUIVersion;
      const previous=viewer;viewer=null;viewerPhase='idle';
      try{previous?.dispose();}catch{}
      threeMount.replaceChildren();threePanel.hidden=true;threePanel.inert=false;
      threePanel.classList.remove('is-preparing');threePanel.removeAttribute('aria-hidden');
      threeButton.disabled=false;threeButton.textContent='Explore 3D';
      threePanel.querySelectorAll('[data-gallery-material]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.galleryMaterial==='pbr')));
    }
    async function enter3D(){
      if(!current?.interactive||!dialog.open)return;
      if(viewerPhase==='loading')return;
      const item=current,token=++renderVersion;
      cancelOrbitPreparation();settleTransition();stopOrbit();mode='3d';syncSelection();
      if(viewerPhase==='ready'&&viewer){
        await transitionContent(()=>{
          $('[data-gallery-orbit]').hidden=true;$('[data-gallery-compare]').hidden=true;$('[data-gallery-direct]').hidden=true;
          threePanel.hidden=false;shownMode='3d';main.setAttribute('aria-busy','false');setStatus();protocol();
        });
        return;
      }
      disposeViewer();viewerPhase='loading';threeButton.disabled=true;threeButton.textContent='Preparing 3D…';
      main.setAttribute('aria-busy','true');setStatus('Loading the interactive result…');
      threePanel.hidden=false;threePanel.inert=true;threePanel.classList.add('is-preparing');threePanel.setAttribute('aria-hidden','true');
      try{
        await loadViewerLibrary();
        if(token!==renderVersion||current!==item||!dialog.open)return;
        prepareLights();
        const instance=window.SupraGallery3D.create(threeMount,{onStatus:message=>{
          if(token!==renderVersion||!dialog.open||viewerPhase!=='loading')return;
          if(typeof message==='string'&&message)setStatus(message);
        }});
        viewer=instance;
        await instance.load(item.id);
        if(token!==renderVersion||viewer!==instance||current!==item||!dialog.open)return;
        if(mediaTransition)await mediaTransition.done;
        if(token!==renderVersion||!dialog.open)return;
        await transitionContent(()=>{
          $('[data-gallery-orbit]').hidden=true;$('[data-gallery-compare]').hidden=true;$('[data-gallery-direct]').hidden=true;
          threePanel.inert=false;threePanel.classList.remove('is-preparing');threePanel.removeAttribute('aria-hidden');
          viewerPhase='ready';shownMode='3d';shownView=view;threeButton.disabled=false;threeButton.textContent='Explore 3D';syncLights();
          content.style.removeProperty('visibility');main.setAttribute('aria-busy','false');setStatus();protocol();
        });
      }catch{
        if(token!==renderVersion||!dialog.open)return;
        disposeViewer();mode=shownMode==='3d'?'compare':(shownMode||'compare');
        main.setAttribute('aria-busy','false');syncSelection();protocol();
        threeButton.textContent='Retry 3D';setStatus('3D could not load. The image comparison is still available; select Retry 3D to try again.');
      }
    }
    function syncPlay(){
      const button=$('[data-gallery-play]');
      button.disabled=!allowed();
      button.textContent=!allowed()?'Motion is off':modalVideo.paused?'Play orbit':'Pause orbit';
    }
    function stopOrbit(){++playVersion;videoIntent=false;modalVideo.pause();syncPlay();}
    function startOrbit(){
      if(!current||current.orbit===false||mode!=='orbit'||!dialog.open||!allowed())return syncPlay();
      if(!modalVideo.getAttribute('src'))modalVideo.src=`${base}${current.id}-orbit.mp4`;
      const token=++playVersion;videoIntent=true;
      modalVideo.play().then(()=>{if(token!==playVersion)return;if(!videoIntent||!allowed()||!dialog.open||mode!=='orbit')modalVideo.pause();syncPlay();}).catch(()=>{if(token!==playVersion||!dialog.open||mode!=='orbit')return;videoIntent=false;syncPlay();setStatus('Select Play orbit to start the preview.');});
    }
    function protocol(){
      if(!current)return;
      if(mode==='3d'){
        $('#gallery-description').textContent='Interactive model with PBR materials and case-specific lighting. Albedo shows surface color without lighting.';
      }else if(mode==='orbit'){
        $('#gallery-description').textContent=`A ${current.arc||24}° orbit with case-specific lighting. The camera differs from the reference.`;
      }else if(current.scenic&&view==='full'){
        $('#gallery-description').textContent='One reference image; matched camera. The background appears only in the reference.';
      }else if(current.aligned){
        $('#gallery-description').textContent=current.views===2?'Front and back input images; front reference and result share a camera.':'One reference image · matched camera.';
      }else if(current.benchmark){
        $('#gallery-description').textContent='One reference image and provided geometry. Orbit previews use a different camera.';
      }else{
        $('#gallery-description').textContent=`Reference and result use different viewpoints and lighting. ${current.views===2?'This asset was generated from front and back input images; the front reference is shown. ':''}`;
      }
    }
    async function renderMedia({initial=false}={}){
      const token=++renderVersion,item=current,nextMode=mode,nextView=view;
      cancelOrbitPreparation();
      const direct=item.aligned&&nextMode==='compare',detail=nextView==='detail';
      const reference=`${base}${direct?(item.scenic&&!detail?item.id+'-scene':item.id+'-input-'+(detail?'detail':'aligned')):item.id+'-input'}.webp`;
      const result=`${base}${direct?item.id+'-result-'+(detail?'detail':'aligned'):item.id+'-result'}.webp`;
      main.setAttribute('aria-busy','true');
      try{
        await Promise.all(nextMode==='orbit'?[prepareImage(result),prepareOrbit(item)]:[prepareImage(reference),prepareImage(result)]);
        // Finish the current crossfade, then commit only the latest requested view.
        if(mediaTransition)await mediaTransition.done;
        if(token!==renderVersion||current!==item||!dialog.open)return;
        const change=()=>{
          if(direct){
            $('[data-gallery-aligned-reference]').src=reference;$('[data-gallery-aligned-result]').src=result;
            $('[data-gallery-aligned]').classList.toggle('is-detail',detail);
          }else if(nextMode==='compare'){
            $('[data-gallery-reference]').src=reference;$('[data-gallery-result]').src=result;
            $('[data-gallery-compare]').dataset.view=nextView;
          }
          modalVideo.poster=`${base}${item.poster||item.id+'-result.webp'}`;
          $('[data-gallery-orbit]').hidden=nextMode!=='orbit';
          $('[data-gallery-compare]').hidden=nextMode!=='compare'||item.aligned;
          $('[data-gallery-direct]').hidden=nextMode!=='compare'||!item.aligned;
          threePanel.hidden=true;
          shownMode=nextMode;shownView=nextView;content.style.removeProperty('visibility');
          protocol();main.setAttribute('aria-busy','false');
        };
        await transitionContent(change,!initial);
        if(token!==renderVersion||!dialog.open)return;
        // Keep the current model while this dialog shows its images or film.
        // The viewer renders on demand; changing case or closing releases it.
        threeButton.disabled=viewerPhase==='loading';
        if(initial)window.SupraTransitions?.reveal(content);
        if(nextMode==='orbit'){if(allowed())startOrbit();else syncPlay();}
      }catch{
        if(token!==renderVersion||!dialog.open)return;
        main.setAttribute('aria-busy','false');content.style.removeProperty('visibility');
        threeButton.disabled=false;
        mode=shownMode||'compare';view=shownView||(item.aligned?'full':'both');syncSelection();
        setStatus('This view could not load. Please select it to try again.');
      }
    }
    function syncSelection(){
      dialog.querySelectorAll('[data-gallery-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.galleryMode===mode)));
      $('[data-gallery-views]').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
      $('[data-gallery-views]').hidden=false;$('[data-gallery-views]').style.visibility=mode==='compare'?'':'hidden';
      $('[data-gallery-views]').inert=mode!=='compare';
    }
    function selectView(next){
      if(view===next&&shownView===next&&main.getAttribute('aria-busy')!=='true')return;
      view=next;syncSelection();setStatus();renderMedia();
    }
    function selectMode(next){
      if(next==='3d'){enter3D();return;}
      if(next==='orbit'&&current?.orbit===false)return;
      if(mode===next&&shownMode===next&&main.getAttribute('aria-busy')!=='true')return;
      if(viewerPhase==='loading')disposeViewer();
      mode=next;stopOrbit();setStatus();syncSelection();renderMedia();
    }
    function lockScroll(){
      savedScroll=window.scrollY;
      bodyStyles={position:document.body.style.position,top:document.body.style.top,width:document.body.style.width,overflow:document.body.style.overflow,paddingRight:document.body.style.paddingRight};
      const gap=innerWidth-document.documentElement.clientWidth;
      document.body.style.position='fixed';document.body.style.top=`-${savedScroll}px`;document.body.style.width='100%';document.body.style.overflow='hidden';
      if(gap)document.body.style.paddingRight=`${gap}px`;
    }
    function open(id,trigger,initialMode='compare'){
      const item=cases.find(c=>c.id===id);if(!item||(dialog.open&&current===item))return;
      const wasOpen=dialog.open;
      ++renderVersion;cancelOrbitPreparation();settleTransition();shownMode=null;shownView=null;
      disposeViewer();
      current=item;opener=trigger||document.activeElement;hovered=null;stopPreview();stopOrbit();
      dialog.dataset.compactOrbit=String(!!current.compactOrbit);
      dialog.dataset.benchmark=String(!!current.benchmark);
      dialog.dataset.interactive=String(!!current.interactive);
      modalVideo.removeAttribute('src');modalVideo.load();
      $('#gallery-dialog-title').textContent=current.title;
      $('[data-gallery-reference]').src=`${base}${id}-input.webp`;
      $('[data-gallery-reference]').alt=`Reference image of ${current.title.toLowerCase()}`;
      $('[data-gallery-result]').src=`${base}${id}-result.webp`;
      $('[data-gallery-result]').alt=`SUPRA-Tex generated ${current.title.toLowerCase()}, presentation view`;
      $('[data-gallery-aligned-reference]').alt=`Reference image of ${current.title.toLowerCase()} at the reference camera`;
      $('[data-gallery-aligned-result]').alt=`SUPRA-Tex ${current.title.toLowerCase()} result at the same camera`;
      $('[data-gallery-live]').hidden=!current.live;
      threeButton.hidden=!current.interactive;$('[data-gallery-mode="orbit"]').hidden=current.orbit===false;
      threeButton.disabled=!!current.interactive;
      const views=current.aligned?[['full','Full object'],['detail',current.id==='A3'?'Inspect lettering':'Inspect detail']]:[['both','Side by side'],['reference','Reference'],['result','Result']];
      $('[data-gallery-views]').innerHTML=views.map(([key,label])=>`<button type="button" data-view="${key}" aria-pressed="false">${label}</button>`).join('');
      $('[data-gallery-views]').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
      view=current.aligned?'full':'both';mode='compare';syncSelection();
      $('[data-gallery-orbit]').hidden=true;$('[data-gallery-compare]').hidden=current.aligned;$('[data-gallery-direct]').hidden=!current.aligned;
      content.style.visibility='hidden';setStatus();protocol();
      $('[data-gallery-orbit-label]').textContent=`${current.arc||24}° orbit`;
      $('[data-gallery-range]').value='50';updateRange();
      if(!wasOpen){lockScroll();dialog.showModal();}dialog.scrollTop=0;$('[data-gallery-close]').focus({preventScroll:true});
      const initialMedia=renderMedia({initial:true}),openingVersion=renderVersion;
      if(initialMode==='3d')initialMedia.then(()=>{
        if(dialog.open&&current===item&&renderVersion===openingVersion)enter3D();
      });
      window.dispatchEvent(new CustomEvent('supra:gallery',{detail:{open:true,caseId:id}}));
    }
    function close(){if(dialog.open)dialog.close();}
    function updateRange(){
      const range=$('[data-gallery-range]');
      $('[data-gallery-aligned]').style.setProperty('--g-split',`${range.value}%`);
      range.setAttribute('aria-valuetext',`${range.value}% reference, ${100-Number(range.value)}% SUPRA-Tex`);
    }
    dialog.addEventListener('close',()=>{
      ++renderVersion;cancelOrbitPreparation();settleTransition();main.setAttribute('aria-busy','false');content.style.removeProperty('visibility');
      resetAlignedDrag();
      disposeViewer();
      stopOrbit();modalVideo.removeAttribute('src');modalVideo.load();
      if(bodyStyles){Object.assign(document.body.style,bodyStyles);bodyStyles=null;window.scrollTo({top:savedScroll,behavior:'instant'});}
      opener?.focus({preventScroll:true});
      window.dispatchEvent(new CustomEvent('supra:gallery',{detail:{open:false}}));
    });
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const focusable=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex="0"]')].filter(e=>!e.closest('[inert]')&&e.getClientRects().length);
      if(!focusable.length)return;
      if(event.shiftKey&&document.activeElement===focusable[0]){event.preventDefault();focusable.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0].focus();}
    });
    $('[data-gallery-close]').addEventListener('click',close);
    dialog.querySelectorAll('[data-gallery-mode]').forEach(b=>b.addEventListener('click',()=>selectMode(b.dataset.galleryMode)));
    $('[data-gallery-range]').addEventListener('input',updateRange);
    $('[data-gallery-play]').addEventListener('click',()=>{if(modalVideo.paused)startOrbit();else stopOrbit();});
    modalVideo.addEventListener('pause',syncPlay);modalVideo.addEventListener('play',syncPlay);
    modalVideo.addEventListener('error',()=>{stopOrbit();setStatus('Orbit unavailable. The reference and still result remain available.');});
    threePanel.querySelectorAll('[data-gallery-material]').forEach(button=>button.addEventListener('click',()=>{
      if(viewerPhase!=='ready'||!viewer)return;
      viewer.setMode(button.dataset.galleryMaterial);
      threePanel.querySelectorAll('[data-gallery-material]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      syncLights();
    }));
    lightRow.addEventListener('click',async event=>{
      const button=event.target.closest('[data-gallery-light]');
      if(!button||button.disabled||!viewer||viewerPhase!=='ready')return;
      const instance=viewer,version=++lightUIVersion;
      const change=instance.setLighting(button.dataset.galleryLight);syncLights();
      try{await change;if(version===lightUIVersion&&viewer===instance)syncLights();}
      catch{if(version===lightUIVersion&&viewer===instance)syncLights('Light unavailable. Try again.');}
    });
    threePanel.querySelector('[data-gallery-reset]').addEventListener('click',()=>viewer?.reset());
    threePanel.querySelectorAll('[data-gallery-zoom]').forEach(button=>button.addEventListener('click',()=>viewer?.zoom(Number(button.dataset.galleryZoom))));
    $('[data-gallery-live]').addEventListener('click',()=>{
      if(!current?.live)return;
      if(typeof window.Supra3D?.openAsset!=='function'){setStatus('The live viewer is still loading. Please try again.');return;}
      const key=current.live;close();requestAnimationFrame(()=>window.Supra3D.openAsset(key));
    });
    function stopAll(){stopPreview();stopOrbit();settleTransition();}
    window.addEventListener('supra:motion',event=>{paused=!!event.detail?.paused;stopAll();});
    reduced.addEventListener('change',()=>{paused=reduced.matches||document.body.classList.contains('motion-paused');stopAll();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll();});
    window.addEventListener('pagehide',()=>{++renderVersion;stopAll();disposeViewer();});
    window.SupraGallery={open:id=>open(id,cards.get(id)?.querySelector('button')),close,state:()=>({open:dialog.open,caseId:current?.id,mode,view,preview:playing?.dataset.galleryCard||null,paused,videoPaused:modalVideo.paused,viewer:viewerPhase,viewerState:viewer?.state()||null})};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


/* Lightweight previews bridge model loading; existing stills preserve retries. */
(() => {
  'use strict';
  const duration=300,easing='cubic-bezier(.22,.68,.12,1)';
  function corners(){
    const node=document.createElement('span');node.className='comp-load-corners';node.setAttribute('aria-hidden','true');
    for(let i=0;i<4;i++)node.append(document.createElement('i'));
    return node;
  }
  function stage(pair,{enabled=()=>true,onChange=()=>{}}={}){
    let cover=null,animation=null,timer=0,state='idle',previewEpoch=0;
    function clear(){
      ++previewEpoch;
      clearTimeout(timer);timer=0;animation?.cancel();animation=null;cover?.remove();cover=null;
      state='idle';delete pair.dataset.revealState;pair.setAttribute('aria-busy','false');onChange();
    }
    function annotations(source,preview=null){
      return [...source.children].filter(e=>e.matches('.comp-diagonal,.comp-stage-label')).map(e=>{
        const clone=e.cloneNode(true);
        if(preview&&clone.matches('.is-commercial'))clone.textContent=preview.right.label;
        for(const node of [clone,...clone.querySelectorAll('*')])for(const a of [...node.attributes])if(a.name.startsWith('data-')||a.name==='id')node.removeAttribute(a.name);
        clone.setAttribute('aria-hidden','true');
        return clone;
      });
    }
    function caption(label){
      const node=document.createElement('span');node.className='comp-load-caption';node.textContent=label;node.setAttribute('role','status');node.setAttribute('aria-live','polite');return node;
    }
    function beginPreview(label,preview){
      const key=`${preview.left.url}|${preview.right.url}`;
      if((state==='waiting'||state==='error')&&cover?.dataset.previewKey===key){
        state='waiting';pair.dataset.revealState=state;pair.setAttribute('aria-busy','true');cover.classList.add('is-waiting');onChange();return;
      }
      clearTimeout(timer);timer=0;animation?.cancel();animation=null;cover?.remove();
      const epoch=++previewEpoch,current=document.createElement('div');
      current.className='comp-load-cover has-preview is-waiting';current.dataset.previewKey=key;
      const visual=document.createElement('div');visual.className='comp-load-picture';visual.setAttribute('aria-hidden','true');
      for(const side of ['left','right']){
        const image=document.createElement('img');image.className=`comp-load-preview is-${side}`;
        image.alt='';image.decoding='async';image.loading='eager';image.fetchPriority='high';image.hidden=true;
        // An obsolete response may complete after another selection or after 3D
        // becomes ready. It must never replace the current comparison.
        image.onload=()=>{if(epoch===previewEpoch&&cover===current)image.hidden=false;};
        image.onerror=()=>{if(epoch===previewEpoch&&cover===current)image.remove();};
        image.src=preview[side].url;visual.append(image);
      }
      const badge=document.createElement('span');badge.className='comp-preview-label';badge.textContent='Preview · Gallery · Front';
      current.append(visual,...annotations(pair,preview),corners(),badge,caption(label));
      cover=current;pair.append(current);state='waiting';pair.dataset.revealState=state;pair.setAttribute('aria-busy','true');onChange();
    }
    function begin(label,{preview=null}={}){
      if(preview){beginPreview(label,preview);return;}
      // Rapid selections keep the last complete picture; never capture a
      // partially loaded pair or allocate more than one holding canvas.
      if(state==='waiting'||state==='error'){
        const retry=state==='error';
        state='waiting';pair.dataset.revealState=state;const caption=cover.querySelector('.comp-load-caption');caption.classList.remove('has-statuses');caption.textContent=label;
        pair.setAttribute('aria-busy','true');
        if(retry)timer=setTimeout(()=>{timer=0;if(cover&&state==='waiting')cover.classList.add('is-waiting');},220);
        onChange();return;
      }
      const previous=cover,previousOpacity=previous?Number(getComputedStyle(previous).opacity):0;
      const canvas=document.createElement('canvas'),source=pair.querySelector('.comp-linked-canvas');
      canvas.className='comp-load-still';
      if(source?.width&&source.height){
        canvas.width=source.width;canvas.height=source.height;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle=getComputedStyle(pair).backgroundColor;ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(source,0,0);
        // Preserve a partially completed crossfade if the visitor switches again.
        const old=previous?.querySelector('canvas');
        if(old?.width){ctx.globalAlpha=previousOpacity;ctx.drawImage(old,0,0,canvas.width,canvas.height);}
      }
      const labels=previousOpacity>.5?previous:pair;
      const marks=annotations(labels);
      clearTimeout(timer);animation?.cancel();animation=null;previous?.remove();
      cover=document.createElement('div');cover.className='comp-load-cover';
      const visual=document.createElement('div');visual.className='comp-load-picture';visual.setAttribute('aria-hidden','true');
      if(source?.width)visual.append(canvas);
      // Keep old method labels with the old result until the new pair is ready.
      cover.append(visual,...marks,corners(),caption(label));pair.append(cover);
      state='waiting';pair.dataset.revealState=state;pair.setAttribute('aria-busy','true');
      timer=setTimeout(()=>{timer=0;if(cover&&state==='waiting')cover.classList.add('is-waiting');},220);
      onChange();
    }
    function statuses(items){
      if(!cover||state!=='waiting')return;
      const caption=cover.querySelector('.comp-load-caption');
      if(!caption.classList.contains('has-statuses')){
        caption.textContent='';caption.classList.add('has-statuses');
        for(const item of items){const row=document.createElement('span');row.className='comp-load-model';caption.append(row);}
      }
      items.forEach((item,index)=>{
        const row=caption.children[index];row.dataset.status=item.status;
        row.textContent=item.status==='ready'?`${item.label} ready`:item.status==='error'?`${item.label} failed`:item.status==='pending'?`${item.label} unavailable`:`Loading ${item.label}…`;
      });
    }
    function ready(){
      if(!cover||state==='revealing')return;
      clearTimeout(timer);timer=0;cover.classList.remove('is-waiting');
      if(!enabled()||!cover.animate){clear();return;}
      state='revealing';pair.dataset.revealState=state;pair.setAttribute('aria-busy','false');
      const current=cover;
      animation=cover.animate([{opacity:1},{opacity:0}],{duration,easing,fill:'forwards'});
      animation.onfinish=()=>{if(cover===current)clear();};onChange();
    }
    function failed(){
      if(!cover)return;clearTimeout(timer);timer=0;
      animation?.cancel();animation=null;
      state='error';pair.dataset.revealState=state;pair.setAttribute('aria-busy','false');cover.classList.remove('is-waiting');onChange();
    }
    function settle(){if(state==='revealing')clear();}
    return {begin,statuses,ready,failed,clear,settle,get busy(){return state==='waiting'||state==='error';},get state(){return state;}};
  }
  function reference(image,{enabled=()=>true}={}){
    const host=image.parentElement,marks=corners();host.append(marks);
    let ghost=null,animations=[],timer=0;
    function settle(){animations.forEach(a=>a.cancel());animations=[];ghost?.remove();ghost=null;}
    function pending(value){clearTimeout(timer);timer=0;host.classList.remove('is-preparing');if(value)timer=setTimeout(()=>host.classList.add('is-preparing'),220);}
    function replace(url,alt){
      pending(false);settle();
      if(enabled()&&image.complete&&image.naturalWidth&&image.src!==url){
        ghost=image.cloneNode();ghost.removeAttribute('data-comp-reference-thumb');ghost.classList.add('comp-reference-ghost');ghost.alt='';ghost.setAttribute('aria-hidden','true');host.append(ghost);
      }
      image.src=url;image.alt=alt;
      if(!ghost)return;
      // Never animate transform: the image uses translateY for layout centering.
      const old=ghost;
      animations=[image.animate([{opacity:0},{opacity:1}],{duration,easing}),old.animate([{opacity:1},{opacity:0}],{duration,easing,fill:'forwards'})];
      animations[1].onfinish=()=>{if(ghost===old)settle();};
    }
    return {pending,replace,settle,clear(){pending(false);settle();}};
  }
  window.SupraComparisonReveal={stage,reference};
})();

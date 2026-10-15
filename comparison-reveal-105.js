/* Stable, opacity-only handoffs. A CPU still bridges GPU asset retirement. */
(() => {
  'use strict';
  const duration=300,easing='cubic-bezier(.22,.68,.12,1)';
  function corners(){
    const node=document.createElement('span');node.className='comp-load-corners';node.setAttribute('aria-hidden','true');
    for(let i=0;i<4;i++)node.append(document.createElement('i'));
    return node;
  }
  function stage(pair,{enabled=()=>true,onChange=()=>{}}={}){
    let cover=null,animation=null,timer=0,state='idle';
    function clear(){
      clearTimeout(timer);timer=0;animation?.cancel();animation=null;cover?.remove();cover=null;
      state='idle';delete pair.dataset.revealState;pair.setAttribute('aria-busy','false');onChange();
    }
    function begin(label){
      // Rapid selections keep the last complete picture; never capture a
      // partially loaded pair or allocate more than one holding canvas.
      if(state==='waiting'||state==='error'){
        const retry=state==='error';
        state='waiting';pair.dataset.revealState=state;cover.querySelector('.comp-load-caption').textContent=label;
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
      const annotations=[...labels.children].filter(e=>e.matches('.comp-diagonal,.comp-stage-label')).map(e=>{
        const clone=e.cloneNode(true);
        for(const node of [clone,...clone.querySelectorAll('*')])for(const a of [...node.attributes])if(a.name.startsWith('data-')||a.name==='id')node.removeAttribute(a.name);
        clone.setAttribute('aria-hidden','true');
        return clone;
      });
      clearTimeout(timer);animation?.cancel();animation=null;previous?.remove();
      cover=document.createElement('div');cover.className='comp-load-cover';
      const visual=document.createElement('div');visual.className='comp-load-picture';visual.setAttribute('aria-hidden','true');
      if(source?.width)visual.append(canvas);
      // Keep old method labels with the old result until the new pair is ready.
      cover.append(visual,...annotations,corners());
      const caption=document.createElement('span');caption.className='comp-load-caption';caption.textContent=label;caption.setAttribute('role','status');
      cover.append(caption);pair.append(cover);
      state='waiting';pair.dataset.revealState=state;pair.setAttribute('aria-busy','true');
      timer=setTimeout(()=>{timer=0;if(cover&&state==='waiting')cover.classList.add('is-waiting');},220);
      onChange();
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
    return {begin,ready,failed,clear,settle,get busy(){return state==='waiting'||state==='error';},get state(){return state;}};
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

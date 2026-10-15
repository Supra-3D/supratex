(() => {
  'use strict';
  const duration=280,easing='cubic-bezier(.22,.68,.12,1)';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),animations=new Map(),images=new Map();
  const enabled=()=>!reduced.matches&&!document.body.classList.contains('motion-paused');
  function settle(){animations.forEach(animation=>animation.cancel());animations.clear();}
  function reveal(targets,{opacity=.4,shift=2}={}){
    if(!targets)return;
    const elements=targets instanceof Element?[targets]:[...targets];
    elements.forEach(element=>{
      const previous=animations.get(element),computed=getComputedStyle(element);
      const from=previous?{opacity:computed.opacity,transform:computed.transform}:{opacity,transform:`translateY(${shift}px)`};
      previous?.cancel();animations.delete(element);
      if(!enabled()||!element.animate)return;
      const animation=element.animate([from,{opacity:1,transform:'translateY(0)'}],{duration,easing});
      animations.set(element,animation);
      animation.onfinish=()=>{if(animations.get(element)===animation)animations.delete(element);};
    });
  }
  function decode(url){
    if(!images.has(url)){
      const image=new Image();image.decoding='async';image.src=url;
      const promise=image.decode().then(()=>image).catch(error=>{images.delete(url);throw error;});
      images.set(url,promise);
    }
    return images.get(url);
  }
  window.addEventListener('supra:motion',event=>{if(event.detail.paused)settle();});
  reduced.addEventListener('change',()=>{if(reduced.matches)settle();});
  window.SupraTransitions={duration,easing,enabled,decode,reveal,settle};
})();

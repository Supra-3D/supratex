'use strict';
(() => {
  const header=document.querySelector('.site-header');
  const toggle=document.getElementById('mobile-menu-toggle');
  const nav=document.getElementById('main-navigation');
  if(!header||!toggle||!nav)return;
  const mobile=matchMedia('(max-width:959.98px)');
  function close(restoreFocus=false){
    header.removeAttribute('data-mobile-menu');
    toggle.setAttribute('aria-expanded','false');
    toggle.querySelector('span').textContent='Menu';
    if(restoreFocus)toggle.focus({preventScroll:true});
  }
  toggle.addEventListener('click',()=>{
    if(toggle.getAttribute('aria-expanded')==='true'){close();return;}
    header.dataset.mobileMenu='open';
    toggle.setAttribute('aria-expanded','true');
    toggle.querySelector('span').textContent='Close';
  });
  nav.addEventListener('click',event=>{if(event.target.closest('a'))close();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){event.preventDefault();close(true);}
  });
  document.addEventListener('pointerdown',event=>{if(!header.contains(event.target))close();});
  header.addEventListener('focusout',event=>{if(event.relatedTarget&&!header.contains(event.relatedTarget))close();});
  function sync(){
    const focusWouldHide=!mobile.matches&&document.activeElement===toggle;
    close();toggle.hidden=!mobile.matches;
    if(focusWouldHide)header.querySelector('.wordmark').focus({preventScroll:true});
  }
  mobile.addEventListener('change',sync);sync();
})();

'use strict';
const cases={
  switch:{asset:'D6',label:'Rows and symbols in the wiring table.',alt:'Lettering, specification table and circuit symbols on an industrial disconnect switch'},
  dial:{asset:'D5',label:'Scale markings, tick spacing and unit labels.',alt:'Curved scales, small numbers and unit labels on an analog multimeter'},
  archive:{asset:'D4',label:'Serif letterforms and line spacing.',alt:'CHAMBER PIECES serif lettering on a music archive box'},
  aid:{asset:'D7',label:'Instructions, pictograms and surface wear.',alt:'First aid lettering, illustrated supplies and printed instructions on a cabinet'},
  tea:{asset:'D8',reference:'input-context',label:'Product lettering, small print and decorative borders.',alt:'IMPERIAL BREAKFAST TEA lettering and small print on a vintage tea tin'},
  candle:{asset:'D9',reference:'input-context',label:'NIGHT BLOOM lettering and botanical illustration.',alt:'NIGHT BLOOM lettering and botanical details on a metal candle tin'},
  apothecary:{asset:'D10',reference:'input-context',label:'Blue lettering and ornament on curved porcelain.',alt:'TINCT. ARNICA lettering and ornamental blue details on a porcelain apothecary jar'}
};
let activeCase='switch';let detailView=true;
let renderedCase=activeCase,renderedDetail=detailView,caseRequest=0;
const stage=document.getElementById('compare-stage');
const range=document.getElementById('compare-range');
function updateCompare(){stage.style.setProperty('--split',`${range.value}%`);range.setAttribute('aria-valuetext',`${100-Number(range.value)} percent SUPRA-Tex`)}
range.addEventListener('input',updateCompare);
const casePanel=document.getElementById('case-panel'),detailToggle=document.getElementById('detail-toggle');
function syncCaseControls(){
  tabs.forEach(tab=>{const selected=tab.dataset.case===renderedCase;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  detailToggle.setAttribute('aria-label',renderedDetail?'Show full object':'Show detail view');
  detailToggle.querySelector('[data-detail-label]').textContent=renderedDetail?'Full object':'Detail view';
}
async function renderCase(){
  const selectedCase=activeCase,selectedDetail=detailView,token=++caseRequest;
  if(selectedCase===renderedCase&&selectedDetail===renderedDetail){casePanel.removeAttribute('aria-busy');return;}
  const selected=cases[selectedCase],view=selectedDetail?'detail':'aligned';
  const updates=[
    {id:'reference-image',kind:'Reference image',file:selected.reference||'input-aligned',detail:false},
    {id:'baseline-image',kind:'Reference image',file:`input-${view}`,detail:selectedDetail},
    {id:'ours-image',kind:'SUPRA-Tex result',file:`result-${view}`,detail:selectedDetail}
  ].map(({id,kind,file,detail})=>({image:document.getElementById(id),kind,detail,url:`assets/gallery/${selected.asset}-${file}.webp`}));
  const changed=updates.filter(({image,url})=>image.getAttribute('src')!==url);
  casePanel.setAttribute('aria-busy','true');
  try{
    await Promise.all(changed.map(({url})=>window.SupraTransitions.decode(url)));
    if(token!==caseRequest)return;
    const caseChanged=selectedCase!==renderedCase;
    for(const {image,kind,detail,url}of updates){if(image.getAttribute('src')!==url)image.src=url;image.alt=`${kind}: ${selected.alt}${detail?', detail view':', full object'}`;}
    document.getElementById('case-caption').textContent=selected.label;
    casePanel.setAttribute('aria-labelledby',`case-${selectedCase}`);
    casePanel.dataset.detailCase=selectedCase;
    casePanel.dataset.detailView=selectedDetail?'detail':'full';
    renderedCase=selectedCase;renderedDetail=selectedDetail;syncCaseControls();
    window.SupraTransitions.reveal(changed.map(({image})=>image),{opacity:.45,shift:0});
    if(caseChanged)window.SupraTransitions.reveal(document.getElementById('case-caption'));
  }catch(_){if(token===caseRequest){activeCase=renderedCase;detailView=renderedDetail;syncCaseControls();}}
  finally{if(token===caseRequest)casePanel.removeAttribute('aria-busy');}
}
const tabs=[...document.querySelectorAll('[data-case]')];
function activateTab(tab,focus=false){if(focus)tab.focus();if(activeCase===tab.dataset.case)return;activeCase=tab.dataset.case;renderCase();}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activateTab(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(i+1)%tabs.length;if(event.key==='ArrowLeft')next=(i-1+tabs.length)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();activateTab(tabs[next],true)}})});
detailToggle.addEventListener('click',()=>{detailView=!detailView;renderCase();});
const dialog=document.getElementById('film-dialog');const film=document.getElementById('full-film');let lastTrigger;
const films={aircraft:{src:'assets/aircraft-film.mp4',title:'SUPRA-Tex — Aircraft demonstration'},collection:{src:'assets/collection-film.mp4',title:'SUPRA-Tex — Multi-asset demonstration'},lettering:{src:'assets/embodied/fine-lettering-comparison.mp4',title:'SUPRA-Tex — Fine lettering in 3D'}};
document.querySelectorAll('[data-film]').forEach(button=>button.addEventListener('click',()=>{lastTrigger=button;const selected=films[button.dataset.film];document.getElementById('film-title').textContent=selected.title;film.src=selected.src;dialog.showModal();document.body.classList.add('dialog-open');film.play().catch(()=>{});}));
function closeFilm(){film.pause();dialog.close();}
document.getElementById('close-film').addEventListener('click',closeFilm);dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeFilm();}});
dialog.addEventListener('close',()=>{film.pause();film.removeAttribute('src');film.load();document.body.classList.remove('dialog-open');lastTrigger?.focus();});
if('IntersectionObserver'in window&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}})},{threshold:.06});document.querySelectorAll('.reveal').forEach((element,i)=>{if(element.closest('.hero'))element.style.transitionDelay=`${i*90}ms`;observer.observe(element);});}
updateCompare();

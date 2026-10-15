'use strict';
// Shared film / browser choreography: an expressive launch and a quiet landing.
(() => {
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smoother=x=>{const t=clamp(x);return t*t*t*(10+t*(-15+6*t));};
  const timing=Object.freeze({reveal:6000,hold:1800,return:4800,rest:800,total:13400});
  function outboundPose(progress){
    const p=clamp(progress),lift=smoother((p-.345)/.575);
    // A forward surge leads the climb. Bank peaks during the pull-up, then
    // releases into a readable flying attitude. Every channel is C2 continuous.
    const launch=smoother((p-.345)/.255),climb=smoother((p-.46)/.42);
    const settle=smoother((p-.67)/.25);
    const pass=smoother((p-.40)/.23)*(1-smoother((p-.66)/.26));
    return{lift,depth:smoother((p-.39)/.53),
      orbit:8*launch+20*climb,pitch:6*launch+6*pass,
      distance:1-.20*launch+.12*settle,bank:32*pass+12*climb,
      x:-.12*launch+.06*climb,y:.035*launch-.17*climb,
      z:115*launch-30*settle,scale:1+.08*climb,pass};
  }
  const home=outboundPose(0),anchor=outboundPose(1);
  function pose(progress,returning=false){
    if(!returning)return outboundPose(progress);
    const p=clamp(progress),remaining=smoother((p-.345)/.575),landing={};
    // Retreat monotonically: never repeat the launch's close pass or bank peak.
    // Settle the shallow bank and restore the image plane slightly earlier,
    // while translation and camera alignment continue without an intermediate stop.
    for(const key of Object.keys(home))landing[key]=home[key]+(anchor[key]-home[key])*remaining;
    landing.bank=anchor.bank*smoother((p-.52)/.40);
    landing.depth=smoother((p-.39)/.53);
    return landing;
  }
  function sample(milliseconds){
    const t=Math.max(0,Math.min(timing.total,milliseconds));
    if(t<=timing.reveal)return{progress:t/timing.reveal,returning:false,returnProgress:0};
    if(t<=timing.reveal+timing.hold)return{progress:1,returning:false,returnProgress:0};
    if(t<timing.reveal+timing.hold+timing.return){
      const q=(t-timing.reveal-timing.hold)/timing.return;
      return{progress:1-q,returning:true,returnProgress:q};
    }
    return{progress:0,returning:false,returnProgress:0};
  }
  // The interactive view has already shown the stationary end pose. Resume at
  // the first moving return frame instead of repeating that stationary tail.
  const returnEntry=timing.reveal+timing.hold+timing.return*(1-.92);
  globalThis.SupraHeroMotion=Object.freeze({timing,pose,sample,returnEntry});
})();

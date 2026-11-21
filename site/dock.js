// The dock is a second LCD under the instrument: the cue, a pixel progress row and "Skip this take".
// While playing, the chapter line, the instrument and the dock are laid out as one stack.
(()=>{
  const universe=document.getElementById('universe'),dock=document.getElementById('play-dock'),counter=document.getElementById('counter'),goal=document.getElementById('goal');
  const cells=document.getElementById('dock-cells'),skip=document.getElementById('dock-skip'),machine=document.getElementById('machine');
  const heading=document.querySelector('.scene-copy'),utility=document.getElementById('utility-controls');
    const ASPECT=1.676,KEYBED=.926,TITLE_GAP=20,DOCK_GAP=16;
  let titleHeightSeen=22;

  function progress(){
    const match=/(\d+)\s*\/\s*(\d+)/.exec(counter.textContent);
    return match&&!counter.hidden?{done:+match[1],total:+match[2]}:null;
  }

  function render(){
    const count=progress();
    cells.hidden=!count;
    if(count){
      if(cells.childElementCount!==count.total)cells.replaceChildren(...Array.from({length:count.total},()=>document.createElement('i')));
      [...cells.children].forEach((cell,index)=>{cell.classList.toggle('on',index<count.done);cell.classList.toggle('now',index===count.done);});
    }
    skip.textContent=T('Skip this take','跳过这一版');
    skip.setAttribute('aria-label',T('Skip this take: the guide fills in the rest and plays it','跳过这一版：剩下的音由引导补上并播放'));
  }

  const pin=(element,property,value)=>element.style.setProperty(property,value,'important');
  function release(){
    for(const property of ['top','width'])machine.style.removeProperty(property);
    heading.style.removeProperty('top');
    dock.style.removeProperty('--dock-top');dock.style.removeProperty('bottom');dock.style.removeProperty('width');
  }

  // Other states (manual, study, phone sideways, intro) keep their own layout.
  function layout(){
    const playing=universe.dataset.scene==='game'&&!dock.hidden&&!['study-open','manual-open'].some(name=>universe.classList.contains(name));
    if(!playing||sidewaysLayout()){release();return;}
    // The phone camera frames controls relative to where the instrument is: never move it mid-shot.
    if(phoneLayout()&&['mission-camera','zoomed'].some(name=>universe.classList.contains(name))&&machine.style.getPropertyValue('top'))return;
    const top=(localRect(utility).bottom||0)+12,bottom=phoneLayout()?12:24;
    if(phoneLayout()){dock.style.removeProperty('width');dock.style.removeProperty('--dock-top');dock.style.removeProperty('bottom');}
    if(heading.offsetHeight)titleHeightSeen=heading.offsetHeight;
    const titleHeight=titleHeightSeen,room=viewHeight()-top-bottom-titleHeight-TITLE_GAP-DOCK_GAP;
    const maxWidth=phoneLayout()?viewWidth()-20:Math.min(viewWidth()-90,1320);
    let width=Math.min(maxWidth,(room-dock.offsetHeight)*ASPECT);
    if(!phoneLayout()){pin(dock,'width',Math.round(width*KEYBED)+'px');width=Math.min(maxWidth,(room-dock.offsetHeight)*ASPECT);pin(dock,'width',Math.round(width*KEYBED)+'px');}
    const height=width/ASPECT,dockHeight=dock.offsetHeight;
    let start;
    if(phoneLayout()){
      // The dock stays on the bottom edge; the instrument sits right on top of it.
      start=localRect(dock).top-DOCK_GAP-height-TITLE_GAP-titleHeight;
    }else{
      const stack=titleHeight+TITLE_GAP+height+DOCK_GAP+dockHeight;
      start=top+Math.max(0,(viewHeight()-top-bottom-stack)/2);
      dock.style.bottom='auto';
      dock.style.setProperty('--dock-top',Math.round(start+titleHeight+TITLE_GAP+height+DOCK_GAP)+'px');
    }
    pin(machine,'width',Math.round(width)+'px');
    pin(machine,'top',Math.round(start+titleHeight+TITLE_GAP+height/2)+'px');
    pin(heading,'top',Math.round(start)+'px');
  }

  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;layout();});};
  skip.addEventListener('click',()=>{skipBirthdayPass();render();});
  const watch=new MutationObserver(()=>{render();schedule();});
  watch.observe(counter,{childList:true,characterData:true,subtree:true,attributes:true});
  watch.observe(goal,{childList:true,characterData:true,subtree:true});
  watch.observe(dock,{attributes:true,attributeFilter:['hidden']});
  watch.observe(universe,{attributes:true,attributeFilter:['class','data-scene']});
  new ResizeObserver(schedule).observe(dock);
  new ResizeObserver(schedule).observe(heading);
  addEventListener('resize',schedule);
  phonePortraitView.addEventListener('change',schedule);
  phoneSidewaysView.addEventListener('change',schedule);
  render();schedule();
})();

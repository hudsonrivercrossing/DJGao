// The dock is a second LCD under the instrument: the cue, a pixel progress row and "Skip this take".
// While playing, the chapter line, the instrument and the dock are laid out as one stack.

// Portrait phone: the title and the instrument (with whatever hangs under it) move as one group, set a little above
// the middle of the free band between the top bar and what sits below it (the dock, or the screen's edge).
// When the band is tight the group first rises to `inset` under the top bar, then the gap below closes to `minGap`,
// and only then does the instrument get smaller. Pixels in, pixels out; `machine` is the instrument's height.
function phoneStackPlacement({freeTop,freeBottom,title,titleGap,machine,below=0,gap=24,minGap=16,inset=12,bias=.42}){
  const group=()=>title+titleGap+machine+below,highest=freeTop+inset;
  let top=Math.min(freeTop+(freeBottom-freeTop-group())*bias,freeBottom-gap-group());
  if(top<highest)top=freeBottom-Math.max(minGap,Math.min(gap,freeBottom-group()-highest))-group();
  if(top<highest){machine=Math.max(0,machine-(highest-top));top=highest;}
  return {titleTop:top,machineTop:top+title+titleGap,machineHeight:machine,bottomGap:freeBottom-(top+group())};
}

(()=>{
  const universe=document.getElementById('universe'),dock=document.getElementById('play-dock'),counter=document.getElementById('counter'),goal=document.getElementById('goal');
  const cells=document.getElementById('dock-cells'),skip=document.getElementById('dock-skip'),machine=document.getElementById('machine');
  const heading=document.querySelector('.scene-copy'),utility=document.getElementById('utility-controls'),word=document.getElementById('scene-word');
  const ASPECT=1.676,KEYBED=.926,TITLE_GAP=20,DOCK_GAP=16;
  let titleHeightSeen=22,placedFrame='';

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
    placedFrame='';
    for(const property of ['top','width'])machine.style.removeProperty(property);
    heading.style.removeProperty('top');
    word.style.removeProperty('top');word.style.removeProperty('visibility');
    dock.style.removeProperty('--dock-top');dock.style.removeProperty('bottom');dock.style.removeProperty('width');
  }

  const MACHINE_ASPECT=1324/792,OPENING_GAP=28;
  const safeBottom=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom'))||0;
  // Moves an element to a new top; a small move within the same frame (the dock card changing height, the follow
  // camera handing back a shot) glides there instead of jumping.
  function moveTop(element,top,glide){
    const was=parseFloat(element.style.getPropertyValue('top')),shift=was-top;
    pin(element,'top',top+'px');
    if(glide&&shift&&Math.abs(shift)<160&&moving())element.animate([{translate:`0px ${shift}px`},{translate:'0px 0px'}],{duration:250,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  // Pins the group from phoneStackPlacement: the instrument's centre (its CSS top is its middle) and the title's top.
  function placePhoneStack(freeBottom,titleGap,below){
    if(heading.offsetHeight)titleHeightSeen=heading.offsetHeight;
    const width=viewWidth()-20,spot=phoneStackPlacement({freeTop:localRect(utility).bottom||0,freeBottom,title:titleHeightSeen,titleGap,machine:width/MACHINE_ASPECT,below});
    const machineWidth=Math.round(spot.machineHeight*MACHINE_ASPECT),frame=universe.dataset.scene+':'+machineWidth,glide=frame===placedFrame;
    placedFrame=frame;
    pin(machine,'width',machineWidth+'px');
    moveTop(machine,Math.round(spot.machineTop+spot.machineHeight/2),glide);
    moveTop(heading,Math.round(spot.titleTop),glide);
    return spot;
  }
  // The opening screen on a portrait phone: title, instrument and power button, centred the same way.
  function layoutOpening(){
    const power=document.getElementById('power-on');
    const below=power&&!power.hidden?Math.max(0,localRect(power).bottom-localRect(machine).bottom):0;
    const spot=placePhoneStack(viewHeight()-safeBottom()-12,OPENING_GAP,below);
    // The faint backdrop word sits in the space above the title, or stays out of the way.
    const freeTop=localRect(utility).bottom||0,room=spot.titleTop-freeTop,height=word.offsetHeight;
    pin(word,'top',Math.round(freeTop+(room-height)/2)+'px');
    word.style.visibility=height&&height<=room?'':'hidden';
  }

  // Other states (manual, study, phone sideways, the opening screen off portrait phones) keep their own layout.
  function layout(){
    const playing=universe.dataset.scene==='game'&&!dock.hidden&&!['study-open','manual-open'].some(name=>universe.classList.contains(name));
    if(!playing&&universe.dataset.scene==='intro'&&phoneLayout()){layoutOpening();return;}
    if(!playing||sidewaysLayout()){release();return;}
    // The phone camera frames controls relative to where the instrument is: never move it mid-shot.
    if(phoneLayout()&&['mission-camera','zoomed'].some(name=>universe.classList.contains(name))&&machine.style.getPropertyValue('top'))return;
    if(phoneLayout()){
      // The dock stays on the bottom edge; the group is centred in the space above it.
      dock.style.removeProperty('width');dock.style.removeProperty('--dock-top');dock.style.removeProperty('bottom');
      placePhoneStack(localRect(dock).top,TITLE_GAP,0);
      return;
    }
    placedFrame='';
    const top=(localRect(utility).bottom||0)+12,bottom=24;
    if(heading.offsetHeight)titleHeightSeen=heading.offsetHeight;
    const titleHeight=titleHeightSeen,room=viewHeight()-top-bottom-titleHeight-TITLE_GAP-DOCK_GAP;
    const maxWidth=Math.min(viewWidth()-90,1320);
    let width=Math.min(maxWidth,(room-dock.offsetHeight)*ASPECT);
    pin(dock,'width',Math.round(width*KEYBED)+'px');width=Math.min(maxWidth,(room-dock.offsetHeight)*ASPECT);pin(dock,'width',Math.round(width*KEYBED)+'px');
    const height=width/ASPECT,dockHeight=dock.offsetHeight;
    const stack=titleHeight+TITLE_GAP+height+DOCK_GAP+dockHeight;
    const start=top+Math.max(0,(viewHeight()-top-bottom-stack)/2);
    dock.style.bottom='auto';
    dock.style.setProperty('--dock-top',Math.round(start+titleHeight+TITLE_GAP+height+DOCK_GAP)+'px');
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

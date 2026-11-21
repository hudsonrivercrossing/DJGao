// The top bar's volume control over the site output (audio.js). A tap on the speaker mutes or unmutes.
// With a mouse the slider sits beside the speaker; on touch a long press opens it in a small popover.
const VOLUME_STEP=5;
const VOLUME_HOLD_MS=400;

const volumePercent=()=>siteSound.muted?0:Math.round(siteSound.level*100);

function syncSoundControl(){
  const percent=volumePercent(),button=$('#sound'),range=$('#volume-range');
  button.setAttribute('aria-label',siteSound.muted?T('Unmute','取消静音'):T('Mute','静音'));
  button.setAttribute('aria-pressed',String(siteSound.muted));
  button.dataset.waves=percent===0?'0':percent<=50?'1':'2';
  range.value=String(percent);
  range.setAttribute('aria-label',T('Volume','音量'));
  range.setAttribute('aria-valuetext',percent+'%');
  $('#volume-value').textContent=percent+'%';
  $('#volume').style.setProperty('--volume',percent+'%');
}

function toggleMute(){
  if(siteSound.muted)unmuteSite();
  else setSiteSound({muted:true});
  syncSoundControl();
}

// 0% is mute; the level underneath is kept so the next tap brings sound back.
function setVolumePercent(percent){
  const level=Math.max(0,Math.min(100,Math.round(percent)))/100;
  setSiteSound(level===0?{muted:true}:{level,muted:false});
  syncSoundControl();
}

function openVolumePopover(){
  $('#volume').classList.add('open');
  $('#sound').setAttribute('aria-expanded','true');
}
function closeVolumePopover(){
  $('#volume').classList.remove('open');
  $('#sound').setAttribute('aria-expanded','false');
}
const volumePopoverOpen=()=>$('#volume').classList.contains('open');

function initVolume(){
  const box=$('#volume'),button=$('#sound'),range=$('#volume-range'),pad=$('#volume-pad');
  let holdTimer=null,held=false,dragging=null;
  const stopHold=()=>{clearTimeout(holdTimer);holdTimer=null;};
  button.addEventListener('pointerdown',event=>{
    held=false;stopHold();
    if(event.pointerType==='mouse')return;
    holdTimer=setTimeout(()=>{holdTimer=null;held=true;openVolumePopover();},VOLUME_HOLD_MS);
  });
  for(const type of ['pointerup','pointercancel','pointerleave'])button.addEventListener(type,stopHold);
  button.addEventListener('contextmenu',event=>event.preventDefault());
  // Enter and Space click the button too.
  button.addEventListener('click',()=>{
    if(held){held=false;return;}
    toggleMute();
  });

  range.addEventListener('input',()=>setVolumePercent(Number(range.value)));
  range.addEventListener('keydown',event=>{
    const steps={ArrowUp:VOLUME_STEP,ArrowRight:VOLUME_STEP,ArrowDown:-VOLUME_STEP,ArrowLeft:-VOLUME_STEP,PageUp:20,PageDown:-20}[event.key];
    const target=event.key==='Home'?0:event.key==='End'?100:steps===undefined?null:volumePercent()+steps;
    if(target===null)return;
    event.preventDefault();
    setVolumePercent(Math.round(target/VOLUME_STEP)*VOLUME_STEP);
  });

  // The popover's slider follows the finger along its own vertical axis, also in sideways mode.
  // The pad covers the rotated range; the thumb's centre stops 6px inside each end.
  const follow=event=>{
    const rect=localRect(pad),point=toLocalPoint(event.clientX,event.clientY);
    setVolumePercent((rect.bottom-6-point.y)/(rect.height-12)*100);
  };
  pad.addEventListener('pointerdown',event=>{
    dragging=event.pointerId;
    pad.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    follow(event);
  });
  pad.addEventListener('pointermove',event=>{if(event.pointerId===dragging)follow(event);});
  for(const type of ['pointerup','pointercancel'])pad.addEventListener(type,event=>{if(event.pointerId===dragging)dragging=null;});

  document.addEventListener('pointerdown',event=>{
    if(volumePopoverOpen()&&!box.contains(event.target))closeVolumePopover();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!volumePopoverOpen())return;
    event.preventDefault();
    closeVolumePopover();
    button.focus();
  });
  syncSoundControl();
}

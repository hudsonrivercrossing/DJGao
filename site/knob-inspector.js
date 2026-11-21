let activeKnob=null;
function placeKnobInspector(knob,width,height,bounds){
  const gap=12,left=Math.max(bounds.left,Math.min(bounds.right-width,knob.left+knob.width/2-width/2));
  const above=knob.top-gap-height,below=knob.bottom+gap;
  if(above>=bounds.top&&above+height<=bounds.bottom)return{left,top:above};
  if(below>=bounds.top&&below+height<=bounds.bottom)return{left,top:below};
  const top=Math.max(bounds.top,Math.min(bounds.bottom-height,knob.top+knob.height/2-height/2));
  if(knob.left-gap-width>=bounds.left)return{left:knob.left-gap-width,top};
  if(knob.left+knob.width+gap+width<=bounds.right)return{left:knob.left+knob.width+gap,top};
  return{left,top};
}
function openKnobInspector(name){
  activeKnob=name;
  const knob=$(`[data-knob="${name}"]`),panel=$('#knob-inspector');
  panel.hidden=false;
  refreshKnobInspector();
  const r=localRect(knob);
  const safe=getComputedStyle($('#universe')),inset=side=>parseFloat(safe.getPropertyValue('--safe-'+side))||0;
  const bounds={left:12+inset('left'),right:viewWidth()-12-inset('right'),top:60+inset('top'),bottom:viewHeight()-12-inset('bottom')};
  const sheet=$('#manual').open?$('#manual'):null;
  if(sheet)bounds.bottom=Math.max(bounds.top+48,Math.min(bounds.bottom,localRect(sheet).top-10));
  panel.style.width=Math.min(264,bounds.right-bounds.left)+'px';panel.style.maxHeight=Math.max(44,bounds.bottom-bounds.top)+'px';const position=placeKnobInspector(r,panel.offsetWidth,panel.offsetHeight,bounds);panel.style.left=position.left+'px';panel.style.top=position.top+'px';
  $('#knob-dismiss').setAttribute('aria-label',T('Close parameter controls','关闭参数'));$('#knob-minus').setAttribute('aria-label',T('Decrease ','减小 ')+name);$('#knob-plus').setAttribute('aria-label',T('Increase ','增大 ')+name);
}
function refreshKnobInspector(fine=false){
  if(!activeKnob)return;const b=$(`[data-knob="${activeKnob}"]`);$('#knob-label').textContent=activeKnob;$('#knob-value').textContent=b.getAttribute('aria-valuetext')||'';
  $('#knob-hint').textContent=fine?T('Fine control','微调模式'):matchMedia('(pointer: coarse)').matches?T('Drag ↑ ↓ · sideways: fine','上下拖动 · 侧移微调'):T('Drag ↑ ↓ · Shift: fine','上下拖动 · Shift 微调');
}
function hideKnobInspector(){activeKnob=null;const panel=document.querySelector('#knob-inspector');if(panel)panel.hidden=true}
function initKnobInspector(){
  $('#knob-dismiss').onclick=hideKnobInspector;$('#knob-minus').onclick=()=>{if(activeKnob)turn(activeKnob,-1)};$('#knob-plus').onclick=()=>{if(activeKnob)turn(activeKnob,1)};
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.hardware-knob,#knob-inspector'))hideKnobInspector()},{capture:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#lcd-dialog').open&&!studyTab)hideKnobInspector()});
  window.addEventListener('resize',hideKnobInspector);
  window.addEventListener('blur',()=>{$$('.hardware-knob.dragging').forEach(e=>e.classList.remove('dragging'));hideKnobInspector()});
}

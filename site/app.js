const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const synth=new SoundLabSynth();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const moving=()=>!reduced.matches;
let followMission=true,framedCue='';
let language='zh',scene='intro',level=0,playing=false,clock=null,playhead=-1,beats=0,completed=[],manualPage=0,pages=[];
const manualPositions={};
let powering=false,introHandedOff=false;
let zoom=1,zoomX=0,zoomY=0,lastNote='',lastScreenMessage='',screenMessageTimer;
const state={view:'home',page:0,focus:0,lane:'drums',octave:0,transpose:0,preset:0,pattern:0,step:0,recordStep:0,recording:false,seq:false,arp:false,arpMode:0,arpOctaves:2,arpRate:8,latch:true,tempo:100,gate:50,swing:50,stepCount:16,seqTranspose:0,mono:false};
const freshPattern=(length=16)=>({notes:Array.from({length},()=>[]),drums:Array.from({length:12},()=>Array(length).fill(false)),bass:Array.from({length},()=>[]),lead:Array.from({length},()=>[]),sfx:Array.from({length},()=>[])});
let banks=Array.from({length:16},()=>freshPattern());
const arpNotes=new Set(),heldNotes=new Map(),heldControls=new Set(),usedModifiers=new Set(),knobAngles=new Map();
const T=(en,zh)=>language==='en'?en:zh;
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const noteName=midi=>names[((midi%12)+12)%12]+(Math.floor(midi/12)-1);
const currentPattern=()=>birthdayJourneyActive()?birthdayJourney.take:banks[state.pattern];
const arpModes=['Up','Down','Inclusive','Exclusive','Random','Order','Repeat'];
const presetNames=['WEB BELL','WEB E.PIANO','WEB GLASS','WEB SOFT PAD','WEB PLUCK'];
const color=()=>level===2&&!guided?'#91efdc':'#f58abd';
try{const saved=JSON.parse(localStorage.getItem('little-sound-panel-v1')||'{}');language=saved.language==='en'?'en':'zh';completed=Array.isArray(saved.completed)?saved.completed.filter(n=>[0,1,2].includes(n)):[];
  if(Array.isArray(saved.banks)&&saved.banks.length===16&&saved.banks.every(p=>p&&['notes','bass','lead','sfx'].every(k=>Array.isArray(p[k])&&p[k].length===16&&p[k].every(a=>Array.isArray(a)&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=127)))&&Array.isArray(p.drums)&&(p.rates===undefined||Array.isArray(p.rates)&&p.rates.length===16&&p.rates.every(rate=>[1,2,4,8,16,32].includes(rate)))&&p.drums.length===12&&p.drums.every(a=>Array.isArray(a)&&a.length===16&&a.every(n=>typeof n==='boolean'))))banks=saved.banks;
}catch{}
function saveProgress(){try{localStorage.setItem('little-sound-panel-v1',JSON.stringify({language,completed,banks}))}catch{}}
function saveDevice(){saveProgress();state.dirty=false;screenMessage('PATTERNS SAVED');flashControl('SAVE');}
function message(text){$('#whisper').textContent=text;$('#whisper').classList.add('visible');clearTimeout(message.timer);message.timer=setTimeout(()=>$('#whisper').classList.remove('visible'),2300);}
function clearScreenMessage(){
  clearTimeout(screenMessageTimer);
  lastScreenMessage='';
}
function screenMessage(text){
  clearScreenMessage();
  lastScreenMessage=text;
  drawDevice();
  screenMessageTimer=setTimeout(()=>{lastScreenMessage='';drawDevice();},1000);
}
function flashControl(name){const button=document.querySelector(`[data-control="${name}"]`);if(!button)return;button.classList.add('feedback');clearTimeout(button.feedbackTimer);button.feedbackTimer=setTimeout(()=>button.classList.remove('feedback'),100);}
function setView(view){clearScreenMessage();state.view=view;state.page=0;state.focus=0;updatePanel();}
function setTempo(value){state.tempo=Math.max(30,Math.min(300,Math.round(value)));if(playing){clearTimeout(clock);scheduleTick()}updatePanel();}
function releaseHeld(){heldNotes.forEach(v=>v.voice?.release(.04));heldNotes.clear();synth.allOff();}
function stopPlayback(clearNotes=false){clearTimeout(clock);clock=null;playing=false;playhead=-1;state.recording=false;if(clearNotes){arpNotes.clear();releaseHeld();$$('.hardware-key.sounding').forEach(key=>{clearTimeout(key.lightTimer);key.classList.remove('sounding')})}updatePanel();}
function startClock(){clearTimeout(clock);playing=true;tick();if(playing)scheduleTick();updatePanel();}
function stepMilliseconds(){
  const divisions=state.arp?state.arpRate:level<2?currentPattern().rates?.[playhead]||16:16;
  const swing=guided&&level===2&&!state.arp?1:playhead%2===0?state.swing/50:(100-state.swing)/50;
  return 60000/state.tempo*4/divisions*swing;
}
function scheduleTick(){clock=setTimeout(()=>{tick();if(playing)scheduleTick();},stepMilliseconds());}
function pulseNote(midi,kind='fm',length=.2,baseMidi){
  if(midi<0||midi>127)return;
  synth.note(midi,kind,length);lastNote=noteName(midi);flashKey(midi,baseMidi);spark(midi);
}
function arpSequence(){
  const notes=[...arpNotes];
  if(state.arpMode!==5)notes.sort((a,b)=>a-b);
  const sequence=[];
  for(let octave=0;octave<state.arpOctaves;octave++){
    for(const note of notes)if(note+octave*12<=127)sequence.push(note+octave*12);
  }
  if(state.arpMode===1)return sequence.reverse();
  if(state.arpMode===2)return sequence.concat(sequence.slice().reverse());
  if(state.arpMode===3)return sequence.concat(sequence.slice(1,-1).reverse());
  if(state.arpMode===6&&level<2)return sequence.flatMap(note=>[note,note]);
  return sequence;
}
function recordedSteps(){
  return currentPattern().notes.slice(0,state.stepCount).filter(notes=>notes.length).length;
}
function recordedLayers(){
  const pattern=currentPattern(),length=state.stepCount;
  return [
    pattern.drums.some(row=>row.slice(0,length).some(Boolean)),
    pattern.bass.slice(0,length).some(notes=>notes.length),
    pattern.lead.slice(0,length).some(notes=>notes.length)
  ];
}
function goalReady(){if(guided)return !currentLessonTarget();return level===0?state.arp&&[0,4,7].every(pc=>[...arpNotes].some(m=>m%12===pc)):level===1?recordedSteps()>=Math.min(4,state.stepCount):recordedLayers().every(Boolean);}
function tick(){
  if(state.arp){
    const sequence=arpSequence();
    if(!sequence.length){stopPlayback();return;}
    playhead=(playhead+1)%sequence.length;
    const index=state.arpMode===4?Math.floor(Math.random()*sequence.length):playhead;
    const notes=level===2&&state.arpMode===6?sequence:[sequence[index]];
    const duration=stepMilliseconds()*state.gate/100/1000;
    notes.forEach(midi=>{
      const part=routeNote(midi);
      if(part==='notes')pulseNote(midi,'fm',duration);
      else if(part==='bass')pulseNote(midi,'bass',duration);
      else if(part==='lead')pulseNote(midi-12,'chip',duration);
      else if(part==='sfx')pulseNote(midi+36,'sfx',duration);
      else if(part==='drums'){synth.drum(midi-17);flashKey(midi);}
    });
  }
  else{playhead=(playhead+1)%state.stepCount;const p=currentPattern(),duration=stepMilliseconds()*state.gate/100/1000;
    if(level<2)p.notes[playhead].forEach(m=>pulseNote(m+state.seqTranspose,'fm',duration));
    else{
      const birthdayTake=Boolean(p.leadLengths);
      const beatSeconds=60/state.tempo;
      p.drums.forEach((row,i)=>{if(row[playhead]){synth.drum(i);flashKey(17+i,birthdayTake?53+i:undefined)}});
      p.bass[playhead].forEach(m=>pulseNote(m,'bass',birthdayTake?beatSeconds*.7:duration,birthdayTake?m:undefined));
      const leadDuration=birthdayTake?p.leadLengths[playhead]*beatSeconds/stepsPerBeat*.9:duration;
      p.lead[playhead].forEach(m=>pulseNote(m-12,'chip',leadDuration,birthdayTake?m-24:undefined));
      p.sfx[playhead].forEach(m=>pulseNote(m+36,'sfx',.12));
    }
  }
  if(!state.recording&&goalReady()){
    if(guided&&level===2){
      if(!state.arp&&playhead===state.stepCount-1){
        if(!stageDone(2))complete();
      }
    }else if(!stageDone(level)){
      beats++;
      if(beats>=(level===0?8:state.stepCount)){complete();return;}
    }
  }
  updateProgress();drawDevice();
}
async function startTransport(){
  if(synth.context?.state!=='running')await synth.wake();
  if(playing){stopPlayback();return;}
  if(state.arp){message(T('ARP follows the keys. Toggle ARP to stop.','ARP 由琴键触发；再按 ARP 可停止。'));return;}
  if(guided&&level===2&&state.recording){message(T('Press REC to finish recording first.','先按 REC 结束录音。'));return;}
  state.seq=true;
  if(guided&&level===2)setView('seq');
  startClock();
}
function routeNote(midi){if(level<2)return 'notes';if(midi<17||midi>112)return null;if(midi>=17&&midi<=28)return 'drums';if(midi>=29&&midi<=40)return 'sfx';return midi<77?'bass':'lead';}
function writeNote(midi){const p=currentPattern(),part=routeNote(midi);
  const target=guided?(birthdayJourneyActive()?birthdayKeyTarget(midi):currentLessonTarget()):null;
  if(guided&&(!target||target.midi!==midi||birthdayJourneyActive()&&(state.transpose!==0||state.octave!==target.octave)))return null;
  const step=target?target.step:playing&&level===2?Math.max(0,playhead):state.recordStep;
  if(target&&level===2){
    birthdayRecordHand(target);
    state.lane=target.part;
  }
  else if(part==='drums'){p.drums[midi-17][step]=!p.drums[midi-17][step];state.lane='drums';}
  else{const row=p[part][step],i=row.indexOf(midi);if(i>=0)row.splice(i,1);else if(row.length<9)row.push(midi);state.lane=part;}
  state.step=step;if(level===2)state.view='lane';if(!guided)saveProgress();return part;
}
function playKey(midi,part,duration,velocity){
  if(!birthdayJourneyActive())return playKeyTone(midi,part,duration,velocity);
  // Earlier keys of a chord are silent and stay lit; the last key sounds every member at once.
  // A wrong key sounds alone. A snare roll sounds as a single hit here; the take plays its ratchet.
  if(birthdayChordHold(midi)){flashKey(midi);return null;}
  const chord=birthdayChordSound(midi);
  if(chord){
    const voices=chord.map(member=>{
      flashKey(member.midi,member.midi-member.octave*12);
      return playTargetTone(member,duration,velocity);
    });
    return {release:seconds=>voices.forEach(voice=>voice?.release(seconds))};
  }
  const target=birthdayKeyTarget(midi);
  return target?playTargetTone(target,duration,velocity):playKeyTone(midi,part,duration,velocity);
}
// In the journey a lit key sounds at its pitch in the take (the drop melody sounds as written).
function playTargetTone(target,duration,velocity){
  const part=routeNote(target.midi);
  if(target.sound!==undefined&&(part==='lead'||part==='bass'))return synth.note(target.sound,part==='lead'?birthdayLeadKind():'bass',duration,velocity);
  return playKeyTone(target.midi,part,duration,velocity);
}
function playKeyTone(midi,part,duration,velocity){
  if(part==='drums'){synth.drum(midi-17,velocity);return null;}
  if(part==='sfx')return birthdayJourneyActive()&&birthdayEncoreEffects[midi]?synth.gameEffect(midi):synth.note(midi+36,'sfx',duration??.16,velocity);
  if(part==='lead')return synth.note(midi-12,birthdayJourneyActive()?birthdayLeadKind():'chip',duration,velocity);
  return synth.note(midi,part==='bass'?'bass':'fm',duration,velocity);
}
async function keyDown(baseMidi,id){
  if(firmwareActive()){firmwareInput(id,baseMidi-39,true);return;}
  if(inspectStudyControl('key',baseMidi))return;
  if(heldNotes.has(id)||scene!=='game')return;const midi=baseMidi+state.octave*12+state.transpose;if(midi<0||midi>127)return;
  const part=routeNote(midi);if(!part)return;
  let earlyRelease=false;
  if(synth.context?.state!=='running'){
    const pending={baseMidi,midi,pending:true,released:false};
    heldNotes.set(id,pending);
    updateKeyFeedback();
    try{await synth.wake();}
    catch{
      if(heldNotes.get(id)!==pending)return;
      heldNotes.delete(id);
      updateKeyFeedback();
      message(T('Audio could not start.','声音暂时无法启动。'));
      return;
    }
    if(heldNotes.get(id)!==pending)return;
    earlyRelease=pending.released;
    heldNotes.delete(id);
  }
  lastNote=noteName(midi);
  if(finishBirthdayAccent(midi))return;
  if(state.view==='edit'&&level<2){
    state.focus=(baseMidi-53)%4;
  }else if(state.arp){
    const adding=!arpNotes.has(midi);
    if(adding||!state.latch)arpNotes.add(midi);
    else arpNotes.delete(midi);
    heldNotes.set(id,{baseMidi,midi,latched:state.latch});
    if(!arpNotes.size)stopPlayback();
    else if(!playing)startClock();
    else if(adding){
      playKey(midi,part,.08,.7);
      flashKey(midi,baseMidi);
    }
  }else{
    if(state.mono)releaseHeld();
    const voice=playKey(midi,part);
    flashKey(midi,baseMidi);
    const written=state.recording?writeNote(midi):null;heldNotes.set(id,{baseMidi,midi,voice,part:written});
  }
  updatePanel();
  if(earlyRelease&&heldNotes.has(id))setTimeout(()=>keyUp(id),70);
}
function keyUp(id){if(firmwareActive()){firmwareInput(id,undefined,false);return;}const held=heldNotes.get(id);if(!held)return;if(held.pending){held.released=true;return}held.voice?.release();heldNotes.delete(id);
  if(state.arp&&!held.latched){arpNotes.delete(held.midi);if(!arpNotes.size)stopPlayback();}
  if(guided&&held.part)syncLessonCursor();
  else if(state.recording&&(!playing||level<2)&&held.part&&held.part!=='drums'&&heldNotes.size===0&&!heldControls.has('SEL')){state.recordStep=(state.recordStep+1)%state.stepCount;state.step=state.recordStep;}
  updatePanel();
}
const controls=[['FX',1000,493],['SEL',1084,493],['ENV',1167,493],['LFO',1250,493],['EDIT',1333,493],['GLO',1417,493],['HOME',1000,576],['SAVE',1084,576],['ARP',1167,576],['SEQ',1250,576],['PLAY',1333,576],['REC',1417,576],['OCT−',366,600],['OCT+',465,600]];
const knobs=[['MASTER',345,345],['SELECT',485,345],['PRESETS',345,485],['ALGORITHM',485,485],['KNOB 1',980,345],['KNOB 2',1128,345],['KNOB 3',1278,345],['KNOB 4',1428,345]];
const whiteMidis=[53,55,57,59,60,62,64,65,67,69,71,72,74,76,77,79];
const whiteX=[337,412,486.5,561.5,635.5,710.5,785.5,860.5,935,1009.5,1085,1159,1233,1307,1383,1458.5];
const blackMidis=[54,56,58,61,63,66,68,70,73,75,78];
const blackX=[374.5,449.5,523.5,673.5,747.5,898,973,1047,1197,1271,1421];
const panelSize={width:1800,height:1238};
const panelRects=new WeakMap();
function texture(el,x,y,width,height){el.style.backgroundImage=`url("${$('.machine-photo').src}")`;el.style.backgroundSize=`${panelSize.width/width*100}% ${panelSize.height/height*100}%`;el.style.backgroundPosition=`${x/(panelSize.width-width)*100}% ${y/(panelSize.height-height)*100}%`;}
function position(el,x,y,width,height){panelRects.set(el,{x,y,w:width,h:height});Object.assign(el.style,{left:x/panelSize.width*100+'%',top:y/panelSize.height*100+'%',width:width/panelSize.width*100+'%',height:height/panelSize.height*100+'%'});}
position($('#device-display'),621,324,230.4,230.4);
function makeKey(midi,x,black){
  const width=62,height=black?123:126,y=black?693:824,left=x-width/2;
  const b=document.createElement('button');b.className='hardware-key '+(black?'black-key':'white-key');b.dataset.midi=midi;b.setAttribute('aria-label',noteName(midi));position(b,left,y,width,height);
  b.innerHTML='<span class="key-cap" aria-hidden="true"><i class="key-led"></i><span class="note-tag"></span></span>';
  texture(b.querySelector('.key-cap'),left,y,width,height);
  const led=b.querySelector('.key-led');Object.assign(led.style,{left:(width/2-4)/width*100+'%',top:(black?36:28)/height*100+'%',width:8/width*100+'%',height:(black?36:69)/height*100+'%'});
  b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);keyDown(midi,'pointer-'+e.pointerId)});
  const up=e=>{keyUp('pointer-'+e.pointerId)};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
  b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();keyDown(midi,'focus-'+midi)}});b.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();keyUp('focus-'+midi)}});
  $('#hardware-controls').append(b);
}
whiteMidis.forEach((n,i)=>makeKey(n,whiteX[i],false));blackMidis.forEach((n,i)=>makeKey(n,blackX[i],true));
controls.forEach(([name,x,y])=>{
  const b=document.createElement('button');b.className='hardware-button';b.dataset.control=name;b.setAttribute('aria-label',name==='PLAY'?'PLAY / STOP':name);b.title=name;position(b,x-33,y-35,66,70);b.innerHTML='<span class="button-cap"><i class="control-led"></i></span>';texture(b.querySelector('.button-cap'),x-33,y-35,66,70);
  let holdTimer=null,savedOnHold=false,pointer=null;
  const cancelPress=()=>{if(firmwareActive())firmwareInput('button-'+pointer,undefined,false);clearTimeout(holdTimer);pointer=null;heldControls.delete(name);usedModifiers.delete(name);b.classList.remove('pressed')};
  b.addEventListener('pointerdown',e=>{if(pointer!==null||e.button!==0)return;if(inspectStudyControl('control',name)){e.preventDefault();return;}e.preventDefault();pointer=e.pointerId;b.setPointerCapture(e.pointerId);
    if(firmwareActive()){firmwareInput('button-'+pointer,fm1Buttons.indexOf(name),true);return;}
    heldControls.add(name);usedModifiers.delete(name);b.classList.add('pressed');savedOnHold=false;if(name==='SAVE'&&level<2&&!guided)holdTimer=setTimeout(()=>{saveDevice();savedOnHold=true},550);if((name==='OCT−'&&heldControls.has('OCT+'))||(name==='OCT+'&&heldControls.has('OCT−'))){usedModifiers.add('OCT−');usedModifiers.add('OCT+');state.octave=0;state.transpose=0;screenMessage('OCTAVE 0');updatePanel()}});
  b.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;const used=usedModifiers.has(name);cancelPress();if(!firmwareActive()&&!savedOnHold&&!used)control(name)});
  ['pointercancel','lostpointercapture'].forEach(type=>b.addEventListener(type,e=>{if(pointer===e.pointerId)cancelPress()}));window.addEventListener('blur',cancelPress);
  b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();if(firmwareActive())firmwareInput('focus-'+name,fm1Buttons.indexOf(name),true);else control(name,true)}});
  b.addEventListener('keyup',e=>{if(firmwareActive()&&(e.key==='Enter'||e.key===' ')){e.preventDefault();firmwareInput('focus-'+name,undefined,false);}});
  $('#hardware-controls').append(b);
});
knobs.forEach(([name,x,y])=>{
  const b=document.createElement('div');b.className='hardware-knob';b.dataset.knob=name;b.setAttribute('role','slider');b.tabIndex=0;b.setAttribute('aria-label',name);b.setAttribute('aria-description',T('Drag vertically; Shift or move sideways for fine control.','上下拖动，侧移或按 Shift 微调。'));position(b,x-37,y-37,74,74);b.innerHTML='<i class="knob-pointer"></i>';if(name==='MASTER'){const cap=document.createElement('i');cap.className='master-cap';texture(cap,x-31,y-31,62,62);b.append(cap)}
  let drag=null,wheelAmount=0;
  b.addEventListener('pointerdown',e=>{if(drag)return;if(inspectStudyControl('knob',name)){e.preventDefault();return;}e.preventDefault();b.focus({preventScroll:true});b.setPointerCapture(e.pointerId);const at=toLocalPoint(e.clientX,e.clientY);drag={id:e.pointerId,x:at.x,y:at.y,remainder:0};b.classList.add('dragging');openKnobInspector(name)});
  b.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const at=toLocalPoint(e.clientX,e.clientY),fine=e.shiftKey||Math.abs(at.x-drag.x)>56;drag.remainder+=(drag.y-at.y)/(fine?18:5);drag.y=at.y;const steps=Math.trunc(drag.remainder);if(steps){drag.remainder-=steps;turn(name,steps)}refreshKnobInspector(fine)});
  const end=e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;b.classList.remove('dragging');refreshKnobInspector(false)};b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);b.addEventListener('lostpointercapture',end);window.addEventListener('blur',()=>{drag=null;b.classList.remove('dragging')});
  b.addEventListener('wheel',e=>{e.preventDefault();if(inspectStudyControl('knob',name))return;wheelAmount+=-e.deltaY*(e.deltaMode===1?16:1)/(e.shiftKey?4:1);const steps=Math.trunc(wheelAmount/40);openKnobInspector(name);if(steps){wheelAmount-=steps*40;turn(name,Math.max(-8,Math.min(8,steps))) }},{passive:false});
  b.addEventListener('keydown',e=>{if(['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&inspectStudyControl('knob',name)){e.preventDefault();return;}if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)){e.preventDefault();openKnobInspector(name);turn(name,e.key==='ArrowUp'||e.key==='ArrowRight'?1:-1)}if(e.key==='Enter'){e.preventDefault();openKnobInspector(name)}if(e.key==='Escape')hideKnobInspector()});
  $('#hardware-controls').append(b);
});
const clockRates=[1,2,4,8,16,32];
const fxPages=['Filter','Delay','Distortion'];
const hz=value=>Math.round(value)+' Hz';
const percent=value=>Math.round(value*100)+'%';
const bpm=value=>value+' BPM';
const semitones=value=>(value>0?'+':'')+value+' st';

function rowsForView(){
  function number(label,key,min,max,step=1,object=state,format=String){
    return {
      label,value:format(object[key]),
      turn(delta){
        object[key]=Math.max(min,Math.min(max,object[key]+delta*step));
        if(object===synth)synth.update();
        if(key==='tempo')setTempo(object[key]);
        if(key==='stepCount'){
          state.step=Math.min(state.step,object[key]-1);
          state.recordStep=Math.min(state.recordStep,object[key]-1);
        }
      }
    };
  }
  function option(label,key,choices,object=state){
    return {label,value:choices[object[key]],turn(delta){
      object[key]=(object[key]+delta%choices.length+choices.length)%choices.length;
      if(object===synth)synth.update();
    }};
  }
  function toggle(label,key,object=state){
    return {label,value:object[key]?'On':'Off',turn(delta){
      object[key]=delta>0;
      if(object===synth)synth.update();
      if(key==='latch'&&!state.latch){arpNotes.clear();stopPlayback();}
    }};
  }
  const cutoff={label:'Cutoff',value:hz(synth.cutoff),turn(delta){
    const index=Math.round(Math.log(synth.cutoff/100)/Math.log(200)*99);
    synth.cutoff=Math.round(100*200**(Math.max(0,Math.min(99,index+delta))/99));
    synth.update();
  }};
  const resonance=number('Resonance','resonance',0,100,1,synth,v=>v+' / 100');
  const delayMix=number('Mix','delay',0,1,.01,synth,percent);
  const tempo=()=>number('Tempo','tempo',30,300,1,state,bpm);
  const gate=()=>number('Gate','gate',20,100,1,state,v=>v+'%');
  const pattern=()=>guided?{label:'Pattern',value:'Practice'}:number('Pattern','pattern',0,15,1,state,v=>String(v+1).padStart(2,'0'));
  const steps=()=>guided?{label:'Steps',value:String(state.stepCount)}:number('Steps','stepCount',1,16);
  const clear={label:'Clear',value:'Select',turn(){setView('clear');}};
  const sync={label:'Clock',value:'Internal'};
  const rate=(label,value,apply)=>({label,value:'1/'+value,turn(delta){
    const index=clockRates.indexOf(value);
    apply(clockRates[Math.max(0,Math.min(clockRates.length-1,index+delta))]);
  }});

  switch(state.view){
    case 'arp':
      return state.page===0
        ? [option('Mode','arpMode',arpModes),number('Octaves','arpOctaves',1,4),rate('Rate',state.arpRate,value=>state.arpRate=value),tempo()]
        : [gate(),number('Swing','swing',50,75,1,state,v=>v+'%'),toggle('Latch','latch'),sync];
    case 'seq':
      if(level===2)return [];
      if(state.page===0)return [pattern(),clear,{label:'Chain',value:'1'},steps()];
      if(state.page===1){
        const p=currentPattern(),step=state.recordStep;
        const voice=option('Voice','preset',presetNames);
        return [{...voice,turn(delta){voice.turn(delta);synth.preset=state.preset;}},
          rate('Step rate',p.rates?.[step]||16,value=>{(p.rates??=Array(16).fill(16))[step]=value;saveProgress();}),tempo(),gate()];
      }
      return [number('Swing','swing',50,75,1,state,v=>v+'%'),sync,number('Seq transpose','seqTranspose',-24,24,1,state,semitones),
        {label:'Cursor',value:String(state.recordStep+1),turn:moveStep}];
    case 'seqsettings':
      return [pattern(),steps(),gate(),clear];
    case 'fx':
      if(state.page===1)return [number('Feedback','delayFeedback',0,.85,.01,synth,percent),number('Time','delayMs',30,900,10,synth,v=>v+' ms'),delayMix,toggle('Delay','delayEnabled',synth)];
      if(state.page===2)return [number('Gain','drive',0,1,.01,synth,percent),number('Tone','driveTone',400,20000,100,synth,hz),number('Level','driveLevel',0,1,.01,synth,percent),toggle('Drive','driveEnabled',synth)];
      return [option('Type','filterMode',['Low pass','Band pass','High pass'],synth),cutoff,resonance,toggle('Filter','filterEnabled',synth)];
    case 'env': {
      // Map the percentage controls to the web synth's time and level ranges.
      const time=(label,key,min,max)=>({label,value:Math.round((synth[key]-min)/(max-min)*100)+'%',turn(delta){
        synth[key]=Math.max(min,Math.min(max,synth[key]+delta*(max-min)/100));
      }});
      return [time('Attack','attack',.005,1.5),time('Decay','decay',.05,2),
        number('Sustain','sustain',0,1,.01,synth,percent),time('Release','releaseTime',.03,2)];
    }
    case 'lfo':
      return [option('Wave','lfoWave',['Sine','Triangle','Saw','Square'],synth),number('Speed','lfoRate',.1,20,.1,synth,v=>v.toFixed(1)+' Hz'),number('Pitch depth','lfoAmount',0,100,1,synth,v=>v+' ¢'),number('Amp depth','lfoAmp',0,100,1,synth,v=>v+'%')];
    case 'edit':
      if(level===2&&!birthdayJourneyActive())return [number('Drums','drumsLevel',0,99,1,synth),number('Bass','bassLevel',0,99,1,synth),number('Lead','leadLevel',0,99,1,synth),{label:'Engine',value:'8-Bit'}];
      return [number('Ratio','ratio',.5,8,.25,synth,v=>v.toFixed(2)+'×'),number('FM index','fmIndex',.1,8,.1,synth,v=>v.toFixed(1)),
        option('Web algorithm','algorithm',['01','02','03','04'],synth),{label:'Voice',value:state.mono?'Mono':'Poly',turn(delta){state.mono=delta>0;}}];
    case 'global':
      return [tempo(),number('Transpose','transpose',-12,12,1,state,semitones),toggle('Latch','latch'),number('Volume','volume',0,1,.01,synth,percent)];
    default:
      if(level===2&&!birthdayJourneyActive())return [number('Drums','drumsLevel',0,99,1,synth),number('Bass','bassLevel',0,99,1,synth),number('Lead','leadLevel',0,99,1,synth),tempo()];
      return [cutoff,resonance,number('FM index','fmIndex',.1,8,.1,synth,v=>v.toFixed(1)),{...delayMix,label:'Echo mix'}];
  }
}
function moveStep(delta){state.step=Math.max(0,Math.min(state.stepCount-1,state.step+delta));state.recordStep=state.step;if(!playing){const p=currentPattern();if(level<2)p.notes[state.step].forEach(m=>pulseNote(m+state.seqTranspose));else if(state.lane==='drums')p.drums.forEach((r,i)=>{if(r[state.step])synth.drum(i)});else p[state.lane][state.step].forEach(m=>pulseNote(state.lane==='lead'?m-12:state.lane==='sfx'?m+36:m,state.lane==='bass'?'bass':state.lane==='sfx'?'sfx':'chip'));}updatePanel();}
function turn(name,delta){if(firmwareActive()){turnFirmware(name,delta);return;}if(scene!=='game'||inspectStudyControl('knob',name))return;knobAngles.set(name,(knobAngles.get(name)||0)+delta*6);for(const modifier of heldControls)usedModifiers.add(modifier);
  if(birthdayJourneyTurn(name,delta)){updatePanel();return;}
  if(name==='MASTER'){synth.volume=Math.max(0,Math.min(1,synth.volume+delta*.025));synth.update();screenMessage('VOLUME '+Math.round(synth.volume*100));}
  else if(name==='PRESETS'&&level===2&&heldControls.has('SEL')){
    state.pattern=(state.pattern+delta%16+16)%16;
    screenMessage('PATTERN '+String(state.pattern+1).padStart(2,'0'));
  }
  else if(name==='PRESETS'){state.preset=(state.preset+delta% (level===2?1:5)+(level===2?1:5))%(level===2?1:5);synth.preset=state.preset;screenMessage(level===2?'WEB KIT':presetNames[state.preset]);}
  else if(name==='SELECT'){
    if(heldControls.has('REC')&&state.seq){moveStep(delta);}
    else if(state.view==='seq'&&level===2){state.focus=(state.focus+delta%4+4)%4;}
    else if(state.view==='lane'&&['bass','lead'].includes(state.lane)){
      const low=state.lane==='bass'?-12:0;
      state.rowOffset=Math.max(low,Math.min(low+24,(state.rowOffset||0)+delta));
    }
    else if(state.view==='fx'||state.view==='arp'||level<2&&state.view==='seq'){const count=state.view==='arp'?2:3;state.page=(state.page+delta%count+count)%count;state.focus=0;}
    else state.focus=(state.focus+delta%4+4)%4;
  }else if(name==='ALGORITHM'){
    if(heldControls.has('OCT−')||heldControls.has('OCT+')){state.transpose=Math.max(-12,Math.min(12,state.transpose+delta));screenMessage('TRANSPOSE '+state.transpose);}
    else if(state.view==='lane'||state.view==='seq'&&level===2)moveStep(delta);
    else if(level===2&&['global','fx','env','lfo','edit','arp','seqsettings'].includes(state.view))rowsForView()[state.focus]?.turn?.(delta);
    else if(state.view==='clear'){state.focus=delta>0?1:0;}
    else{synth.algorithm=(synth.algorithm+delta%4+4)%4;screenMessage('WEB FM ALG '+String(synth.algorithm+1).padStart(2,'0'));}
  }else{const index=Number(name.slice(-1))-1;if(state.view==='clear'){if(index===3&&delta>0)clearPattern();else if(index===1){state.view='seq';state.focus=0;}}else {const row=rowsForView()[index];if(row?.turn){state.focus=index;row.turn(delta);}}}
  state.dirty=true;updatePanel();
}
function clearPattern(){if(guided){setView('seq');screenMessage('NEW SONG IN HELP ?');return;}if(playing){screenMessage('STOP BEFORE CLEAR');return}banks[state.pattern]=freshPattern();state.step=state.recordStep=0;state.dirty=true;state.view='seq';state.page=0;screenMessage('PATTERN CLEARED');updatePanel();}
async function control(name,keyboard=false){if(scene!=='game'||inspectStudyControl('control',name))return;
  flashControl(name);
  if(birthdayJourneyControl(name))return;
  if(name==='HOME'){setView(['lane','seqsettings'].includes(state.view)?'seq':'home');return}
  if(name==='SAVE'){if(guided){message(T('Your practice take is ready to replay here.','这次练习的录音可以在这里回听。'));return;}if(level===2||keyboard)saveDevice();else message(T('Hold SAVE to store your work.','按住 SAVE 保存。'));return}
  if(name==='OCT−'||name==='OCT+'){state.octave=Math.max(-3,Math.min(3,state.octave+(name==='OCT+'?1:-1)));releaseHeld();screenMessage('OCTAVE '+(state.octave>0?'+':'')+state.octave);updatePanel();return}
  if(name==='ARP'){
    if(level<2&&state.seq){screenMessage('DISABLE SEQ TO ENTER');return}
    if(state.arp){state.arp=false;arpNotes.clear();stopPlayback(true);setView('home');}
    else{stopPlayback(true);state.arp=true;setView('arp');message(T('Latch is ON: click notes to hold or release.','练习锁音已开：点琴键锁住，再点释放。'));}return
  }
  if(name==='SEQ'){
    if(level<2&&state.arp){screenMessage('DISABLE ARP TO ENTER');return}
    if(level<2){if(state.seq){state.seq=false;stopPlayback();setView('home')}else{state.seq=true;setView('seq')}}
    else{state.seq=true;setView(state.view==='seq'?'seqsettings':'seq')}
    return
  }
  if(name==='PLAY'){try{await startTransport()}catch{message(T('Audio could not start.','声音暂时无法启动。'))}return}
  if(name==='REC'){
    if(state.arp){screenMessage('DISABLE ARP FIRST');return}
    if(synth.context?.state!=='running')await synth.wake();
    state.seq=true;
    if(state.recording){state.recording=false;if(level<2){if(!playing)startClock()}updatePanel();return}
    if((level<2||guided)&&playing)stopPlayback();
    state.recording=true;state.recordStep=state.step;state.view=level===2?'lane':'seq';syncLessonCursor();updatePanel();return
  }
  if(name==='SEL'){
    if(state.view==='clear'){if(state.focus===1)clearPattern();else setView('seq');}
    else if(level===2&&state.view==='seq'){state.lane=['lead','bass','sfx','drums'][state.focus];state.rowOffset=0;state.view='lane';}
    else if(state.view==='seqsettings'&&state.focus===3){state.view='clear';state.focus=0;}
    updatePanel();return
  }
  const views={FX:'fx',ENV:'env',LFO:'lfo',EDIT:'edit',GLO:'global'};if(views[name])setView(state.view===views[name]?'home':views[name]);
}
function flashKey(midi,base=midi-state.octave*12-state.transpose){const key=document.querySelector(`[data-midi="${base}"]`);if(!key)return;key.classList.add('sounding');clearTimeout(key.lightTimer);key.lightTimer=setTimeout(()=>key.classList.remove('sounding'),90);}
function nextCue(){
  const cue=(en,zh,control=null,midi=null,knob=null)=>({text:T(en,zh),control,midi,knob});
  const octave=target=>{const presses=Math.abs(target-state.octave),button=state.octave<target?'OCT+':'OCT−';return cue('Set octave to '+target+' · press '+button+' '+presses+(presses>1?' times':' time'),'把八度调到 '+(target>0?'+':'')+target+' · 还要按 '+presses+' 次 '+button,button);};
  const resetPitch=()=>cue('Press both OCT buttons together to reset pitch.','同时按 OCT− 和 OCT+，重置音高。',['OCT−','OCT+']);
  if(birthdayJourneyActive())return birthdayJourneyCue(cue,octave,resetPitch);
  if(stageDone(level)&&!playing)return cue('Experiment unlocked. Play anything you like.','随便弹，试试旋钮。');
  if(stageDone(level))return cue(['It plays itself. Try a knob.','Your loop is running. Make it yours.','Three layers. One little soundtrack.'][level],['旋律会自己跑了。试着转一下旋钮。','循环做好了。接着改成你喜欢的样子。','鼓、贝斯、主旋律，都有了。'][level]);
  if(level===0){
    if(!state.arp)return cue('Press ARP on the instrument.','先按机身上的 ARP。','ARP');
    if(state.transpose!==0)return resetPitch();
    if(state.octave!==0)return octave(0);
    const note=[60,64,67].find(m=>!arpNotes.has(m));
    if(note)return cue('Tap '+noteName(note)+'. Let it join the melody.','点一下 '+noteName(note)+'，让它加入旋律。',null,note);
    return cue('Listen. Your first melody is taking shape.','听一下，你的第一段旋律。');
  }
  if(level===1){
    const count=recordedSteps();
    if(!state.seq)return cue('Press SEQ to open the sequencer.','先按 SEQ，打开循环。','SEQ');
    if(state.recording){if(count>=Math.min(4,state.stepCount))return cue('Press REC again to finish recording.','再按一次 REC，结束录入。','REC');return cue('Play '+(Math.min(4,state.stepCount)-count)+' more notes. Release each one.','再弹 '+(Math.min(4,state.stepCount)-count)+' 个音。每个音弹完松手。',null,[60,64,67,72][Math.min(count,3)]);}
    if(count<Math.min(4,state.stepCount))return cue('Press REC. The next keys will be recorded.','按 REC，接下来弹的音会被录下。','REC');
    if(!playing)return cue('Press PLAY to hear your loop.','按 PLAY，听听这段循环。','PLAY');
    return cue('Listen to one full turn of your loop.','听它完整转一圈。');
  }
  const [drums,bass,lead]=recordedLayers();
  if(drums&&bass&&lead){if(state.recording)return cue('Press REC to finish recording.','按 REC，结束录入。','REC');if(!playing)return cue('Press PLAY. All three layers play together.','按 PLAY，让三条音轨一起响。','PLAY');return cue('Listen to your little soundtrack.','听一下，你做的小配乐。');}
  if(!state.seq)return cue('Press SEQ. Build a three-layer soundtrack.','先按 SEQ，做一个三层的小配乐。','SEQ');
  if(!state.recording)return cue('Press REC to enter notes.','按 REC，准备录入。','REC');
  if(state.transpose!==0)return resetPitch();
  const target=!drums?-3:!bass?0:2;
  if(state.octave!==target)return octave(target);
  return cue(!drums?'Tap F0 for your first drum.':!bass?'Tap C4 for a bass note.':'Tap C6 for the lead melody.',!drums?'点 F0，放进第一个鼓点。':!bass?'点 C4，加一声贝斯。':'点 C6，加上主旋律。',null,!drums?53:60);
}
function updateProgress(){
  const journey=birthdayJourneyActive();
  const cue=scene==='intro'?{text:'',control:null,midi:null}:nextCue(),done=!journey&&stageDone(level);
  const goal=$('#goal');
  const title=done?T(['Arpeggio ready','Tune recorded','Your track is ready'][level],['琶音弹起来了','旋律录好了','小曲完成了'][level]):cue.text;
  if(goal.textContent!==title){
    goal.textContent=title;
    if(moving()&&scene==='game'&&$('#interlude').hidden){
      goal.getAnimations().forEach(animation=>animation.cancel());
      goal.animate([{opacity:.45,translate:'0 3px'},{opacity:1,translate:'0 0'}],{duration:155,easing:'cubic-bezier(.22,1,.36,1)'});
    }
  }
  const context=scene==='game'&&journey?birthdayJourneyContext():'';
  $('#lesson-context').hidden=!context;
  $('#lesson-context').textContent=context;
  // In the journey the counter is this take's groups of keys: a chord counts once all its members are in.
  const work=journey?birthdayJourney.work:null;
  const groups=work?djHandGroups(birthdayJourney.pass,work.mode):null,chords=groups?.some(group=>group.targets.length>1);
  const parts=work?groups.filter(group=>group.targets.every(target=>work.takes[birthdayJourney.pass].has(target.id))).length:level===0?[60,64,67].filter(m=>arpNotes.has(m)).length:level===1?Math.min(4,recordedSteps()):recordedLayers().filter(Boolean).length;
  const total=work?groups.length:level===1?Math.min(4,state.stepCount):3;
  const showSong=journey&&birthdayJourney.step==='finished',showNextTake=journey&&birthdayPassHeard();
  $('#counter').hidden=done||showSong||journey&&!work;
  $('#counter').textContent=parts+' / '+total+' '+(chords?T('STEPS','格'):T(!guided&&level===2?'LAYERS':'NOTES',!guided&&level===2?'条音轨':'个音'));
  const modeStep=journey&&birthdayJourney.step==='mode';
  $('#mode-standard').hidden=$('#mode-hard').hidden=!modeStep;
  $('#mode-standard').textContent=T('Standard','标准');
  $('#mode-hard').textContent=T('Hard · play every layer','困难 · 每一层都亲手弹');
  $('#dock-skip').hidden=!(journey&&['voice','record','notes'].includes(birthdayJourney.step));
  const freeSong=!journey&&scene==='game'&&level===2&&birthdayJourney?.step==='finished';
  $('#mission-next').hidden=(!done&&!showSong&&!showNextTake)||(!journey&&scene==='game'&&level===2&&!freeSong);
  $('#mission-next').textContent=showNextTake?T('Next take →','下一版 →'):showSong||freeSong?T('My song →','我的生日歌 →'):level===0?T('Record the tune →','把旋律录下来 →'):T('Add drums and bass →','去加鼓和贝斯 →');
  $('#device-hud').classList.toggle('mission-complete',done);
  const nextControls=Array.isArray(cue.control)?cue.control:[cue.control];
  $$('.hardware-button').forEach(b=>b.classList.toggle('next-control',nextControls.includes(b.dataset.control)));
  const keys=cue.midi===null?[]:[cue.midi].flat();
  const held=birthdayJourneyActive()?birthdayChordHeldKeys():[];
  $$('.hardware-key').forEach(b=>{b.classList.toggle('hinted',keys.includes(Number(b.dataset.midi)));b.classList.toggle('held',held.includes(Number(b.dataset.midi)));});
  if(!studyTab&&!$('#manual').open){
    const selectors=nextControls.filter(Boolean).map(name=>`[data-control="${name}"]`);
    selectors.push(...keys.map(key=>`[data-midi="${key}"]`));
    if(cue.knob)selectors.push(`[data-knob="${cue.knob}"]`);
    setSpotlight(selectors);
  }
  paintCourseRoute();
  positionMissionCamera(cue);
}
function updateKeyFeedback(){
  const held=new Set(),lit=new Set(),pitchOffset=state.octave*12+state.transpose;
  for(const note of heldNotes.values()){
    held.add(note.baseMidi);
    if(!note.pending&&!note.latched)lit.add(note.baseMidi);
  }
  $$('.hardware-key').forEach(b=>{
    const baseMidi=Number(b.dataset.midi),midi=baseMidi+pitchOffset,label=noteName(midi),isLit=lit.has(baseMidi)||arpNotes.has(midi);
    b.classList.toggle('down',isLit);b.classList.toggle('held',held.has(baseMidi));
    b.setAttribute('aria-pressed',String(isLit));b.setAttribute('aria-label',label);
    const tag=b.querySelector('.note-tag');if(tag.textContent!==label)tag.textContent=label;
  });
}
function updatePanel(){
  if(firmwareActive())return;
  const running=playing||Boolean(birthdayPreview);
  $('#universe').classList.toggle('playing',running||heldNotes.size>0);$('#universe').classList.toggle('recording',state.recording);
  updateKeyFeedback();
  const lit={ARP:state.arp,SEQ:state.seq,REC:state.recording,PLAY:running&&!state.arp,FX:state.view==='fx',ENV:state.view==='env',LFO:state.view==='lfo',EDIT:state.view==='edit',GLO:state.view==='global'};
  controls.forEach(([name])=>document.querySelector(`[data-control="${name}"]`)?.classList.toggle('lit',!!lit[name]));
  const rows=rowsForView();
  const focusedRow=rows[state.focus];
  const cursorView=state.view==='lane'||level===2&&state.view==='seq';
  const pageValue=state.view==='fx'?fxPages[state.page]:state.view==='arp'?'ARP '+(state.page+1)+'/2':
    state.view==='seq'&&level<2?'SEQ '+(state.page+1)+'/3':cursorView?state.lane.toUpperCase():state.view.toUpperCase();
  $$('.hardware-knob').forEach(knob=>{
    const name=knob.dataset.knob,angle=knobAngles.get(name)||0;
    let value;
    switch(name){
      case 'MASTER': value=percent(synth.volume);break;
      case 'SELECT': value=pageValue;break;
      case 'PRESETS': value=level===2&&!birthdayJourneyActive()?'WEB KIT':presetNames[state.preset];break;
      case 'ALGORITHM':
        value=cursorView?'Step '+(state.step+1):birthdayJourneyActive()&&state.view==='home'?'Lead Wave · '+birthdayLeadWave():level===2&&focusedRow?focusedRow.label+' '+focusedRow.value:'WEB ALG '+(synth.algorithm+1);
        break;
      default: {
        const row=rows[Number(name.slice(-1))-1];
        value=row?row.label+' '+row.value:T('No parameter on this page','本页无对应参数');
      }
    }
    knob.style.setProperty('--knob-angle',angle+'deg');
    if(name==='MASTER')knob.style.setProperty('--cap-angle',(synth.volume-.55)*260+'deg');
    knob.setAttribute('aria-valuetext',value);
    knob.setAttribute('aria-valuemin','0');
    knob.setAttribute('aria-valuemax','100');
    knob.setAttribute('aria-valuenow',String(name==='MASTER'?Math.round(synth.volume*100):Math.max(0,Math.min(100,Math.round((angle+130)/260*100)))));
  });
  refreshKnobInspector();updateProgress();drawDevice();
}
function copy(){document.documentElement.lang=language==='zh'?'zh-CN':'en';$('#language').textContent=language==='zh'?'EN':'中文';syncSoundControl();
  syncFirmwareLabels();
  if(firmwareActive())return;
  const journey=birthdayJourneyActive();
  $('#lcd-open').hidden=scene==='intro';
  $('#lcd-open').setAttribute('aria-label',T('Enlarge instrument display','放大合成器屏幕'));
  $('#lcd-title').textContent=T('FM-1 display','FM-1 屏幕');
  $('#lcd-close').setAttribute('aria-label',T('Close enlarged display','收起屏幕'));
  $('#chapter-label').hidden=scene==='intro'; $('#chapter-label').textContent=scene==='intro'?'':guided?T('A BIRTHDAY TRACK','做一首生日小曲'):['ARP','LOOP','8-BIT'][level];
  $('#scene-title').innerHTML=scene==='intro'?T('THIS PINK ONE. <em>YOURS.</em>','这台粉色，<em>归你了。</em>'):T(['PLAY THE <em>NOTES.</em>','RECORD THE <em>TUNE.</em>','ADD THE <em>BAND.</em>'][level],['让音符<em>轮流响。</em>','把旋律<em>录下来。</em>','给旋律加<em>一支乐队。</em>'][level]);
  $('#scene-hint').textContent=scene==='intro'?T('A little pink synth. Yours to play.','一台粉红色的小机器，直接上手。'):'';
  $('#power-on').setAttribute('aria-label',T('Power on the instrument','开机'));$('#guide-label').textContent=T('Manual','手册');$('#guide-note').textContent=T('Tap any key or knob to learn it','点机器上任意按键或旋钮，看它做什么');
  $('#advanced-label').textContent=T('Advanced','进阶');$('#advanced-note').textContent=T('Three tricks to try next','接下来可以试的三个玩法');
  $('#study-close').setAttribute('aria-label',T('Close','关闭'));
  if(studyTab)renderStudy();$('#gesture-hint').textContent=T('Play keys · drag knobs · 1× to zoom / drag body to pan','点琴键 · 拖旋钮 · 点 1× 放大，拖动机身移动');$('#info-title').textContent=T('Help','帮助');$('#info-button').setAttribute('aria-label',T('Help','帮助'));$('#info-close').setAttribute('aria-label',T('Close','关闭'));$('#info-song').setAttribute('aria-label',T('My song','我的歌'));$('#info-about').textContent=T('About','关于');$('#info-lang').textContent=language==='zh'?'English':'中文';$('#info-fw').textContent=T('Firmware','固件');$('#info-screen').textContent=T('Bigger screen','放大屏幕');syncInfoSong();syncFullscreenButton();syncFullscreenSheet();$('#rotate-hint').setAttribute('aria-label',T('Turn sideways to see the whole instrument','横过来看整台机器'));
  $('#info-copy').textContent=T('The guided song follows a Baud Girl V102 arrangement score and uses a browser synth. Firmware mode runs a selected FM-1 update file through fm1-emu, with the firmware driving the sound, display and LEDs. Product image: Baud Girl / Madeline.','生日歌引导采用 Baud Girl V102 的编曲谱，使用网页合成器发声。「固件」模式通过 fm1-emu 运行所选的 FM-1 更新文件，由固件驱动声音、屏幕和灯。产品图片：Baud Girl / Madeline。');
  $('#restart-song').textContent=T('Make a new song','重新做一首');$('#restart-song-question').textContent=T('Delete the birthday song you recorded and start again from choosing a mode? This cannot be undone.','删掉现在录的生日歌，从选模式重新开始？这一步不能撤销。');$('#restart-song-no').textContent=T('Cancel','取消');$('#restart-song-yes').textContent=T('Delete and start over','删掉，重新做');$('#hardware-done').textContent=T('Completed on my FM-1 ✓','我已在真机完成这关 ✓');
  $('#hardware-done').hidden=journey;
  if(journey){
    const pass=birthdayJourney.pass;
    $('#chapter-label').textContent=T(...djTakes[pass].title);
    $('#scene-title').innerHTML=T(['PLAY THE <em>MUSIC BOX.</em>','START THE <em>HOUSE PARTY.</em>','BUILD THE <em>DROP.</em>','PLAY THE <em>ENCORE.</em>'][pass],['弹响<em>八音盒。</em>','开一场 <em>House Party。</em>','做一个 <em>Drop。</em>','弹完<em>安可。</em>'][pass]);
  }
  paintCourseRoute();updatePanel();if($('#manual').open){manualPages();drawManual(0)}
}
function entrance(){if(!moving())return;$('#machine').getAnimations().forEach(a=>a.cancel());$('#machine').animate([{opacity:0,translate:'0px 20px',scale:.96},{opacity:1,translate:'0px 0px',scale:1}],{duration:280,easing:'cubic-bezier(.22,1,.36,1)'});$('.scene-copy').animate([{opacity:0,translate:'0px -8px'},{opacity:1,translate:'0px 0px'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});}
function fitMachine(){
  framedCue='';
  zoom=1;zoomX=zoomY=0;
  applyZoom();
}

function applyZoom(){
  $('#universe').classList.toggle('zoomed',zoom>1.05);
  const machine=$('#machine'),button=$('#zoom');
  machine.style.setProperty('--zoom',zoom);
  machine.style.setProperty('--pan-x',zoomX+'px');
  machine.style.setProperty('--pan-y',zoomY+'px');
  const follow=phoneLayout()&&scene==='game'&&!stageDone(level);
  button.textContent=follow?T('Follow','跟随'):zoom===1?'1×':zoom.toFixed(1)+'×';
  if(follow)button.setAttribute('aria-pressed',String(zoom>1.05));else button.removeAttribute('aria-pressed');
  button.setAttribute('aria-label',follow?T('Follow the current control','跟随当前操作'):zoom>1.05?T('Show full instrument','恢复全貌'):T('Magnify instrument','放大机身'));
}

function missionCameraTransform(rects,area,machine){
  const left=Math.min(...rects.map(rect=>rect.x)),right=Math.max(...rects.map(rect=>rect.x+rect.w));
  const top=Math.min(...rects.map(rect=>rect.y)),bottom=Math.max(...rects.map(rect=>rect.y+rect.h));
  const scale=machine.width/1324;
  const fitWidth=(area.right-area.left)/((right-left+28)*scale);
  const fitHeight=(area.bottom-area.top)/((bottom-top+26)*scale);
  const target=48/(Math.min(...rects.map(rect=>rect.w))*scale);
  const magnification=Math.max(1,Math.min(3.5,target,fitWidth,fitHeight));
  return {
    zoom:magnification,
    x:(area.left+area.right)/2-machine.x-((left+right)/2-900)*scale*magnification,
    y:(area.top+area.bottom)/2-machine.y-((top+bottom)/2-619)*scale*magnification
  };
}

function positionMissionCamera(cue){
  if(scene!=='game'||!phoneLayout()||!followMission||(!birthdayJourneyActive()&&stageDone(level))||$('#manual').open||studyTab)return;
  if(heldNotes.size||heldControls.size||$('.hardware-knob.dragging'))return;
  const controls=[cue.control].flat().filter(Boolean);
  const notes=cue.midi===null?[]:level===0?[60,64,67]:level===1?[60,64,67,72]:[cue.midi].flat();
  const id=level+':'+[...controls,...notes,cue.knob].join(',');
  if(!controls.length&&!notes.length&&!cue.knob||framedCue===id)return;
  const elements=[...controls.map(name=>$('[data-control="'+name+'"]')),...notes.map(note=>$('[data-midi="'+note+'"]'))];
  if(cue.knob)elements.push($(`[data-knob="${cue.knob}"]`));
  const machine=$('#machine'),hud=$('#device-hud'),utility=$('#utility-controls');
  $('#universe').classList.add('mission-camera');
  const area={
    left:16,right:viewWidth()-16,
    top:localRect(utility).bottom+16,
    bottom:localRect(hud).top-22
  };
  if(area.bottom-area.top<90||machine.clientWidth===0){
    $('#universe').classList.remove('mission-camera');
    return;
  }
  const shot=missionCameraTransform(elements.map(element=>panelRects.get(element)),area,{
    x:machine.offsetLeft,y:machine.offsetTop,width:machine.clientWidth
  });
  framedCue=id;
  zoom=shot.zoom;zoomX=shot.x;zoomY=shot.y;
  applyZoom();
}

function toggleMissionZoom(){
  const stage=$('#universe');
  if(zoom>1.05||stage.classList.contains('mission-camera')){
    followMission=false;
    stage.classList.remove('mission-camera');
    fitMachine();
    return;
  }
  if(phoneLayout()&&!stageDone(level)){
    followMission=true;
    framedCue='';
    positionMissionCamera(nextCue());
    if(framedCue)return;
    followMission=false;
  }
  zoom=1.8;zoomX=zoomY=0;
  applyZoom();
}
function go(n){introHandedOff=false;hideKnobInspector();$('#universe').classList.remove('mission-camera');followMission=true;$('#hardware-controls').inert=false;stopPlayback(true);level=n;scene='game';beats=0;state.seqTranspose=0;clearScreenMessage();state.arp=false;state.seq=false;state.recording=false;state.view='home';state.page=0;state.focus=0;state.step=state.recordStep=0;state.octave=0;state.transpose=0;state.stepCount=guided&&n===1?8:16;state.latch=true;state.pattern=n===2?1:0;state.tempo=n===0?100:110;state.preset=0;synth.preset=0;synth.algorithm=0;fitMachine();$('#universe').dataset.scene='game';$('#universe').dataset.level=n;$('#scene-word').textContent=guided?'PLAY.':['ARP.','LOOP.','8-BIT.'][n];$('#power-on').hidden=true;$('#power-error').hidden=true;$('#device-hud').hidden=false;$('#chapters').hidden=false;$('#info-button').hidden=false;$('#play-dock').hidden=false;$('#guide-button').hidden=false;$('#zoom').hidden=false;$('#interlude').hidden=true;copy();entrance();}
async function start(){
  if(powering)return;$('#power-error').hidden=true;powering=true;const button=$('#power-on');button.disabled=true;button.classList.add('powering');drawDevice();
  try{await synth.wake();startBirthdayJourney();[60,67,72].forEach((m,i)=>setTimeout(()=>synth.note(m,'chime',.22),i*85));}
  catch{$('#power-error').textContent=T('Audio could not start. Tap power to try again.','声音暂时无法启动，点电源再试一次。');$('#power-error').hidden=false}
  finally{powering=false;button.disabled=false;button.classList.remove('powering');drawDevice()}
}
function showIntro(){leaveBirthdayJourney();endBirthdaySurprise(false);if(birthdayMusicPlaying)stopBirthdayMusic();closeStudy(false);$('#universe').classList.remove('mission-camera');hideKnobInspector();closeManual();$('#hardware-controls').inert=true;stopPlayback(true);scene='intro';level=0;state.view='home';state.arp=false;state.seq=false;state.octave=0;fitMachine();$('#universe').dataset.scene='intro';$('#universe').dataset.level='0';$('#scene-word').textContent='PLAY.';['#device-hud','#chapters','#info-button','#guide-button','#play-dock','#zoom','#interlude'].forEach(s=>$(s).hidden=true);$('#power-on').hidden=false;$('#power-error').hidden=true;copy();if(introHandedOff)introHandedOff=false;else entrance();}
function complete(force=false){
  if(birthdayJourneyActive())return;
  if(stageDone(level)&&!force)return;
  if(guided)courseDone.add(level);
  else if(!stageDone(level))completed.push(level);
  saveProgress();
  copy();
  if(moving())$('#cue-flash').animate([
    {opacity:.9,transform:'scaleX(.06)'},{opacity:.85,transform:'scaleX(1)',offset:.68},{opacity:0,transform:'scaleX(1)'}
  ],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});
}

function interludeActions(){
  if($('#interlude').dataset.celebrating)return [$('#birthday-skip')];
  return $$('#interlude button:not(:disabled), #interlude summary, #interlude a[href]')
    .filter(element=>element.getClientRects().length&&!element.closest('[inert]'));
}
$('#interlude').addEventListener('keydown',event=>{
  if(event.key==='Tab'){
    const actions=interludeActions();
    if(!actions.length)return;
    event.preventDefault();
    const current=actions.indexOf(document.activeElement);
    actions[(current+(event.shiftKey?-1:1)+actions.length)%actions.length].focus();
  }
  if(event.key==='Escape'){
    event.preventDefault();
    if($('#interlude').dataset.celebrating)endBirthdaySurprise();
    else if($('#interlude').dataset.view==='hardware')showBirthdayHardware(false);
    else{closeBirthdayPlayer();$('#info-button').focus({preventScroll:true});}
  }
});
$('#birthday-play').onclick=toggleBirthdayMusic;
setupPremiere();
$('#mode-standard').onclick=()=>chooseBirthdayMode('standard');
$('#mode-hard').onclick=()=>chooseBirthdayMode('hard');
$('#birthday-skip').onclick=()=>endBirthdaySurprise();
$('#mission-next').onclick=()=>{
  if(birthdayJourneyActive()){if(birthdayPassHeard())advanceBirthdayPass();else openBirthdayPlayer();return;}
  if(level===2){if(birthdayJourney?.step==='finished')openBirthdayPlayer();return;}
  const preset=state.preset;
  go(level+1);
  if(level===1){state.preset=preset;synth.preset=preset;updatePanel();}
};
$('#rotate-hint').onclick=()=>message(T('Turn your phone sideways to see the whole instrument. Upright is easier to play.','把手机横过来能看到整台机器；竖着拿更好弹。'));$('#power-on').onclick=start;$('#language').onclick=()=>{language=language==='zh'?'en':'zh';saveProgress();copy()};$('#zoom').onclick=toggleMissionZoom;$('#lcd-open').onclick=()=>{
  if(inspectStudyControl('lcd','LCD'))return;
  hideKnobInspector();
  $('#lcd-dialog').showModal();
  drawDevice();
};
$('#lcd-close').onclick=()=>$('#lcd-dialog').close();
// Help: "My song" shows what there is to open or lose. Away from an unfinished song (in free
// play), it leads back to the same take.
function syncInfoSong(){
  const finished=birthdayJourney?.step==='finished',away=Boolean(birthdayJourney)&&!finished&&!birthdayJourneyActive();
  $('#info-open-song').hidden=!finished&&!away;
  $('#info-open-song-label').textContent=finished?T('Open my birthday song','打开我的生日歌'):T('Back to my birthday song','回到我的生日歌');
  $('#restart-song').hidden=!birthdaySongHasProgress();
  $('#info-song').hidden=$('#info-open-song').hidden&&$('#restart-song').hidden;
}
$('#info-button').onclick=()=>{syncInfoSong();$('#restart-song-confirm').hidden=true;$('#info-copy').hidden=true;$('#info-about').setAttribute('aria-expanded','false');$('#info').showModal();$('#guide-button').focus()};
// Closed with Escape or ×, focus goes back to the ? button; a row that opened something keeps its own focus.
$('#info').addEventListener('close',()=>{const active=document.activeElement;if(!active||active===document.body||active.closest?.('#info'))$('#info-button').focus({preventScroll:true})});
$('#info-open-song').onclick=()=>{$('#info').close();if(birthdayJourney?.step==='finished')openBirthdayPlayer();else resumeBirthdayJourney();};
[['#info-lang','#language'],['#info-fw','#firmware-entry'],['#info-screen','#lcd-open']].forEach(([proxy,target])=>$(proxy).onclick=()=>{$('#info').close();$(target).click()});
$('#info-about').onclick=()=>{const open=$('#info-copy').hidden;$('#info-copy').hidden=!open;$('#info-about').setAttribute('aria-expanded',String(open));};
$('#restart-song').onclick=()=>{$('#restart-song-confirm').hidden=false;$('#restart-song-no').focus()};$('#restart-song-no').onclick=()=>{$('#restart-song-confirm').hidden=true;$('#restart-song').focus()};$('#restart-song-yes').onclick=()=>{$('#restart-song-confirm').hidden=true;$('#info').close();startNewBirthdaySong()};['#guide-button','#advanced-button'].forEach(id=>$(id).addEventListener('click',()=>$('#info').close()));$('#info-close').onclick=()=>$('#info').close();

function escapeText(s){return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
function manualPages(){
  const root=document.createElement('div');root.innerHTML=window.tutorialsByLanguage[language][level];
  let title=T('Before you start','开始之前'),html='',part='';pages=[];
  const flush=()=>{if(html.trim())pages.push({title,part,html});html=''};
  [...root.children].forEach(node=>{if(node.tagName==='H3'){flush();part=node.textContent;title=part;return}if(node.tagName==='H4'){flush();title=node.textContent;return}html+=node.outerHTML});flush();
  manualPage=Math.min(manualPositions[level]||0,pages.length-1);
  $('#manual-jump').replaceChildren(...pages.map((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=p.title;return o}));
  $('#manual-jump-label').textContent=T('Jump to a step','跳转步骤');$('#manual-close').setAttribute('aria-label',T('Close guide','收起手册'));$('#manual-prev').setAttribute('aria-label',T('Previous step','上一步'));$('#manual-next').setAttribute('aria-label',T('Next step','下一步'));
}
function drawManual(direction=1){
  const p=pages[manualPage];if(!p)return;manualPositions[level]=manualPage;
  $('#manual-title').textContent=p.title;$('#manual-eyebrow').textContent=(level<2?T('FM-1 / STOCK V15','FM-1 / 原厂 V15'):'FM-1 / BAUD GIRL V102');
  $('#manual-content').innerHTML=(p.part&&p.part!==p.title?'<p class="manual-section">'+escapeText(p.part)+'</p>':'')+p.html;$('#manual-content').scrollTop=0;$('#manual-page').textContent=String(manualPage+1).padStart(2,'0')+' / '+String(pages.length).padStart(2,'0');$('#manual-jump').value=manualPage;
  $('#manual-prev').disabled=manualPage===0;$('#manual-next').disabled=manualPage===pages.length-1;$('#manual-progress').style.transform=`scaleX(${(manualPage+1)/pages.length})`;
  if(direction&&moving())$('#manual-content').animate([{opacity:0,translate:`${direction*8}px 0px`},{opacity:1,translate:'0px 0px'}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)'});
}
function closeManual(){if($('#manual').open)$('#manual').close();$('#universe').classList.remove('manual-open');$('#guide-button').setAttribute('aria-expanded','false');if(scene==='game'&&!studyTab){framedCue='';updateProgress();}}
$('#manual-close').onclick=closeManual;$('#manual').addEventListener('close',()=>{if($('#manual').open)return;$('#universe').classList.remove('manual-open');$('#guide-button').setAttribute('aria-expanded','false')});
$('#manual-prev').onclick=()=>{if(manualPage>0){manualPage--;drawManual(-1)}};$('#manual-next').onclick=()=>{if(manualPage<pages.length-1){manualPage++;drawManual(1)}};
$('#manual-jump').onchange=e=>{manualPage=Number(e.target.value);drawManual(0)};
$('#hardware-done').onclick=()=>{closeManual();complete(true)};
$('#manual').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeManual();return}if(e.target.closest('select'))return;if(e.key==='ArrowRight'){$('#manual-next').click();e.preventDefault()}if(e.key==='ArrowLeft'){$('#manual-prev').click();e.preventDefault()}});
let manualSwipe=null;
$('#manual-content').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||e.target.closest('table,a,button,input,select'))return;manualSwipe=toLocalPoint(e.clientX,e.clientY)});
$('#manual-content').addEventListener('pointerup',e=>{if(!manualSwipe)return;const at=toLocalPoint(e.clientX,e.clientY),dx=at.x-manualSwipe.x,dy=at.y-manualSwipe.y;manualSwipe=null;if(Math.abs(dx)>60&&Math.abs(dy)<40)$(dx<0?'#manual-next':'#manual-prev').click()});
$('#manual-content').addEventListener('pointercancel',()=>manualSwipe=null);

const screen=$('#device-display'),sc=screen.getContext('2d');
const enlargedScreen=$('#lcd-preview'),enlargedContext=enlargedScreen.getContext('2d');
sc.scale(screen.width/480,screen.height/480);

function lcdText(content,x,y,{size=24,fill='#faf3ff',align='left',width=440,number=false}={}){
  const displayType=number||size>=29;
  sc.font=displayType?`600 ${size}px "Pixelify Sans", "Fusion Pixel", monospace`:`600 ${size}px Arial, sans-serif`;
  sc.fillStyle=fill;
  sc.textAlign=align;
  sc.fillText(String(content),x,y,width);
}

function mirrorDisplay(){
  if($('#lcd-dialog').open)enlargedContext.drawImage(screen,0,0);
}

// Lead Wave picker: four rows, the dial highlighted, the take's goal marked, the shape drawn small.
function drawWavePicker(){
  const rows=birthdayWavePicker(),accent=color();
  rows.forEach(({name,current,target},index)=>{
    const y=72+index*58;
    sc.fillStyle=current?'#4a2f5c':'#1a1224';sc.fillRect(18,y,444,50);
    if(current){sc.fillStyle=accent;sc.fillRect(18,y,5,50);}
    lcdText(name,38,y+35,{size:28,fill:current?'#fff6fc':'#cdb7da',width:250});
    if(target)lcdText('TARGET',446,y+33,{size:20,align:'right',fill:'#9ef1da',width:130});
    drawWaveShape(name,232,y+11,72,28,current?'#ffd2ec':'#6f5680');
  });
}
function drawWaveShape(name,x,y,width,height,stroke){
  const duty={'Pulse 50':.5,'Pulse 25':.25,'Pulse 12.5':.125}[name];
  sc.strokeStyle=stroke;sc.lineWidth=3;sc.beginPath();
  for(let cycle=0;cycle<2;cycle++){
    const left=x+cycle*width/2,span=width/2;
    if(duty===undefined){sc.moveTo(left,y+height);sc.lineTo(left+span/2,y);sc.lineTo(left+span,y+height);}
    else{sc.moveTo(left,y+height);sc.lineTo(left,y);sc.lineTo(left+span*duty,y);sc.lineTo(left+span*duty,y+height);sc.lineTo(left+span,y+height);}
  }
  sc.stroke();
}
function drawWave(){
  const x=18,y=302,width=444,height=98;
  sc.fillStyle='#100c19';
  sc.fillRect(x,y,width,height);
  sc.strokeStyle='#392944';
  sc.lineWidth=1;
  sc.beginPath();
  sc.moveTo(x,y+height/2);
  sc.lineTo(x+width,y+height/2);
  sc.stroke();
  // Muted, the scope stays on its flat line.
  if(!synth.analyser||synth.muted)return;

  synth.analyser.getByteTimeDomainData(synth.samples);
  sc.strokeStyle=color();
  sc.lineWidth=2.5;
  sc.beginPath();
  for(let i=0;i<synth.samples.length;i+=4){
    const px=x+i/(synth.samples.length-1)*width;
    const py=y+height/2+(synth.samples[i]-128)/128*height*.48;
    if(i===0)sc.moveTo(px,py);
    else sc.lineTo(px,py);
  }
  sc.stroke();
}

function drawParameters(rows,compact){
  const height=compact?105:153;
  rows.forEach((row,index)=>{
    const x=18+(index%2)*225,y=68+Math.floor(index/2)*(height+8);
    const selected=state.focus===index&&state.view!=='home';
    sc.fillStyle=selected?'#332440':'#191223';
    sc.fillRect(x,y,219,height);
    if(selected){
      sc.fillStyle=color();
      sc.fillRect(x,y,3,height);
    }
    lcdText(row.label,x+12,y+(compact?30:39),{size:23,fill:row.turn?'#decaed':'#ad9dbb',width:194});
    lcdText(row.value,x+12,y+(compact?79:102),{size:compact?35:40,fill:row.turn?'#fff6fc':'#c0aecf',width:194,number:true});
    if(row.turn)lcdText('K'+(index+1),x+204,y+height-10,{size:16,align:'right',fill:'#b49cc7'});
  });
}

function drawMiniSteps(){
  const p=currentPattern(),width=444/16;
  for(let i=0;i<16;i++){
    const x=18+i*width,active=i<state.stepCount;
    sc.fillStyle=active&&p.notes[i].length?color():active?'#483451':'#1b1426';
    sc.fillRect(x,370,width-3,23);
    if(active&&i===(state.recording?state.recordStep:state.step)){
      sc.strokeStyle=state.recording?'#ff799e':'#ddc9eb';sc.lineWidth=2;
      sc.strokeRect(x-1,369,width-1,25);
    }
    if(playing&&i===playhead){
      sc.fillStyle='#fff2f7';sc.fillRect(x,398,width-3,4);
    }
  }
}

function patternPageStart(step){return Math.floor(step/16)*16;}

function patternStepLabel(step){
  if(!birthdayJourneyActive())return 'STEP '+String(step+1).padStart(2,'0')+' / '+state.stepCount;
  const firstHalf=step<48;
  return (firstHalf?'A ':'B ')+String(step-(firstHalf?0:48)+1).padStart(2,'0')+' / '+(firstHalf?48:state.stepCount-48);
}

function drawPattern(){
  const pattern=currentPattern(),lanes=['lead','bass','sfx','drums'],startX=102,width=359/16;
  const start=patternPageStart(playing?playhead:state.step);
  lanes.forEach((lane,index)=>{
    const y=75+index*75;
    if(state.focus===index){sc.fillStyle='#34263f';sc.fillRect(12,y-5,456,58);}
    lcdText(lane.toUpperCase(),22,y+30,{size:22,fill:'#f3ddf5',width:73});
    for(let i=0;i<16;i++){
      const step=start+i,x=startX+i*width,active=step<state.stepCount;
      const filled=lane==='drums'?pattern.drums.some(row=>row[step]):pattern[lane][step]?.length;
      sc.fillStyle=active&&filled?color():active?'#46334e':'#20182b';
      sc.fillRect(x,y+8,width-3,29);
      if((playing&&step===playhead)||(state.focus===index&&step===state.step)){
        sc.strokeStyle=playing&&step===playhead?'#fff':color();
        sc.lineWidth=2;sc.strokeRect(x-1,y+7,width-1,31);
      }
    }
  });
  const footer=state.stepCount>16?patternStepLabel(playing?playhead:state.step):'SELECT lane  ·  ALGORITHM step';
  lcdText(footer,18,400,{size:22,fill:'#d1b9e2'});
}

function drawLane(){
  const pattern=currentPattern(),part=state.lane;
  const first=part==='drums'?17:part==='sfx'?29:(part==='lead'?77:53)+(state.rowOffset||0);
  const x=73,y=68,cw=389/16,rh=26;
  const cursor=state.recording?state.recordStep:state.step;
  const start=patternPageStart(playing?playhead:cursor);
  for(let row=0;row<12;row++){
    const midi=first+11-row,rowY=y+row*rh;
    lcdText(noteName(midi),18,rowY+19,{size:19,fill:'#dec8ee'});
    for(let col=0;col<16;col++){
      const step=start+col;
      const active=step<state.stepCount;
      const filled=active&&(part==='drums'?pattern.drums[midi-17][step]:pattern[part][step].includes(midi));
      sc.fillStyle=active&&filled?color():active?'#2c2038':'#181220';
      sc.fillRect(x+col*cw,rowY,cw-3,rh-3);
    }
  }
  if(playing){sc.fillStyle='#ffffff25';sc.fillRect(x+(playhead-start)*cw,y,cw-3,rh*12-3);}
  if(cursor>=start&&cursor<start+16){
    sc.strokeStyle=state.recording?'#ff769f':'#f0d8ff';
    sc.lineWidth=2;
    sc.strokeRect(x+(cursor-start)*cw-1,y-1,cw-1,rh*12-1);
  }
  lcdText(patternStepLabel(cursor),18,403,{size:23,number:true});
}

function drawAlgorithm(){
  const algorithm=fmAlgorithms[synth.algorithm],accent=color();
  sc.fillStyle='#281c35';sc.fillRect(16,123,448,210);
  lcdText('WEB FM  '+String(synth.algorithm+1).padStart(2,'0'),32,162,{size:26,fill:'#f5e5ff'});
  sc.lineWidth=2.5;sc.strokeStyle=accent;sc.fillStyle=accent;
  for(const [source,target] of algorithm.routes){
    const [x1,y1]=algorithm.layout[source], [x2,y2]=algorithm.layout[target];
    const a=Math.atan2(y2-y1,x2-x1),edgeX=x2-24,edgeY=y2;
    sc.beginPath();sc.moveTo(x1+22,y1);sc.lineTo(edgeX,edgeY);sc.stroke();
    sc.beginPath();sc.moveTo(edgeX,edgeY);
    sc.lineTo(edgeX-9*Math.cos(a-.5),edgeY-9*Math.sin(a-.5));
    sc.lineTo(edgeX-9*Math.cos(a+.5),edgeY-9*Math.sin(a+.5));sc.fill();
  }
  for(const [label,[x,y]] of Object.entries(algorithm.layout)){
    sc.fillStyle='#463354';sc.fillRect(x-23,y-20,46,40);
    lcdText(label,x,y+7,{size:label==='OUT'?16:24,align:'center',width:41});
  }
  lcdText(algorithm.name,32,313,{size:23,fill:'#d3bddf'});
}

function drawDevice(){
  if(firmwareActive()){firmwareDrawDisplay();return;}
  sc.fillStyle='#0d0915';
  sc.fillRect(0,0,480,480);
  if(scene==='intro'){
    lcdText('FM-1',240,220,{size:76,align:'center',fill:'#bd99d4'});
    lcdText(powering?'STARTING…':'SOUND ADVENTURE',240,266,{size:22,align:'center',fill:'#957aa7'});
    mirrorDisplay();
    return;
  }

  const {view,page}=state,accent=color();
  const pattern=String(state.pattern+1).padStart(2,'0');
  const titles={
    home:birthdayJourneyActive()?'LEAD  /  '+birthdayLeadWave():level===2?'8-BIT  /  WEB KIT':String(state.preset+1).padStart(2,'0')+'  '+presetNames[state.preset],
    seq:level===2?'PATTERN '+pattern:'SEQ  '+(page+1)+'/3',
    lane:'P'+pattern+'  '+state.lane.toUpperCase(),arp:'ARP  '+(page+1)+'/2',
    fx:'FX  /  '+fxPages[page].toUpperCase(),global:'GLOBAL',
    seqsettings:'PATTERN SETTINGS',clear:'CLEAR PATTERN?'
  };
  sc.fillStyle='#2a1e38';sc.fillRect(0,0,480,54);
  lcdText(titles[view]||view.toUpperCase(),18,37,{size:31,fill:'#f5e4ff'});
  if(view==='clear'){
    lcdText('Clear pattern '+pattern+'?',18,151,{size:33});
    lcdText('Other patterns are kept.',18,198,{size:25,fill:'#d3bddf'});
    ['Cancel','Clear'].forEach((label,index)=>{
      const x=18+index*225;
      sc.fillStyle=state.focus===index?'#594063':'#211729';
      sc.fillRect(x,247,219,64);
      lcdText(label,x+16,288,{size:28});
    });
    lcdText('SELECT with ALGORITHM · confirm with SEL',18,380,{size:23,fill:'#d3bddf'});
  }else if(view==='seq'&&level===2)drawPattern();
  else if(view==='lane')drawLane();
  else if(view==='home'&&birthdayJourneyActive()&&birthdayJourney.step==='voice')drawWavePicker();
  else{
    const compact=view==='home'||view==='seq';
    drawParameters(rowsForView(),compact);
    if(view==='home')drawWave();
    else if(view==='seq')drawMiniSteps();
  }

  sc.fillStyle='#23182f';sc.fillRect(0,420,480,60);
  lcdText((state.recording?'REC':playing||birthdayPreview?'PLAY':'STOP')+'  '+state.tempo+' BPM',18,457,{size:25,number:true,fill:state.recording?'#ff9cba':'#f4e9fb',width:265});
  const octave=(state.octave>0?'+':'')+state.octave;
  lcdText((lastNote?lastNote+'  ':'')+'OCT '+octave+(state.dirty?' •':''),462,457,{size:22,align:'right',number:true,fill:accent,width:185});
  if(lastScreenMessage.startsWith('WEB FM ALG'))drawAlgorithm();
  else if(lastScreenMessage){
    sc.fillStyle='#2c1d38';sc.fillRect(16,313,448,86);
    sc.fillStyle=accent;sc.fillRect(16,313,4,86);
    lcdText(lastScreenMessage,36,365,{size:29,fill:'#fff6fc',width:411});
  }
  mirrorDisplay();
}
const cosmos=$('#cosmos'),ctx=cosmos.getContext('2d');let stars=[],particles=[],w=0,h=0,frame=0,last=0,lastWave=0;
function resize(){w=viewWidth();h=viewHeight();const d=Math.min(devicePixelRatio||1,2);cosmos.width=Math.round(w*d);cosmos.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);stars=Array.from({length:80},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.2+.25,phase:Math.random()*6,speed:Math.random()*.05+.01}));}
function burst(x,y,count=10){if(!moving())return;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=Math.random()*2+1;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:.013+Math.random()*.01,r:Math.random()*3+1,color:i%2?'#b9a4ff':color()})}if(particles.length>130)particles.splice(0,particles.length-130);}
function spark(midi){if(playing)return;const key=document.querySelector(`[data-midi="${midi-state.octave*12-state.transpose}"]`),r=localRect(key||$('#machine'));burst(r.left+r.width*.5,r.top+r.height*.25,3);}
function paint(time){frame=0;if(document.hidden)return;const dt=last?Math.min((time-last)/16.67,2):1;last=time;ctx.clearRect(0,0,w,h);stars.forEach(s=>{if(moving())s.y-=s.speed*dt;if(s.y<0)s.y=h;ctx.globalAlpha=.12+(Math.sin(time*.0007+s.phase)+1)*.11;ctx.fillStyle='#d4b7ec';ctx.fillRect(s.x,s.y,s.r,s.r)});particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.02*dt;p.life-=p.decay*dt;ctx.globalAlpha=Math.max(p.life,0)*.5;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.r,p.r)});ctx.globalAlpha=1;if(moving()&&scene==='game'&&state.view==='home'&&!lastScreenMessage&&time-lastWave>=50){lastWave=time;drawWave();mirrorDisplay();}if(!reduced.matches||playing||heldNotes.size)frame=requestAnimationFrame(paint);}
resize();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseFirmwareInputs();stopFirmwareAudition(firmwareSession);stopBirthdayPreview();if(birthdayMusicPlaying)stopBirthdayMusic();stopPlayback(true);cancelAnimationFrame(frame);frame=0}else{last=0;frame=requestAnimationFrame(paint)}});reduced.addEventListener('change',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint)});
const gestures=new Map();let pinch=null;
$('#machine-viewport').addEventListener('pointerdown',e=>{if(e.target.closest('.hardware-key,.hardware-knob,.hardware-button,.power-switch'))return;$('#machine').classList.add('gesturing');const at=toLocalPoint(e.clientX,e.clientY);gestures.set(e.pointerId,at);$('#machine-viewport').setPointerCapture(e.pointerId);if(gestures.size===2){const p=[...gestures.values()];pinch={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),zoom,x:zoomX,y:zoomY,cx:(p[0].x+p[1].x)/2,cy:(p[0].y+p[1].y)/2}}else if(zoom>1)pinch={pan:true,x:zoomX,y:zoomY,startX:at.x,startY:at.y};});
$('#machine-viewport').addEventListener('pointermove',e=>{if(!gestures.has(e.pointerId)||!pinch)return;followMission=false;$('#universe').classList.remove('mission-camera');const at=toLocalPoint(e.clientX,e.clientY);gestures.set(e.pointerId,at);if(gestures.size===2){const p=[...gestures.values()];zoom=Math.max(1,Math.min(3,pinch.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/pinch.distance));zoomX=pinch.x+(p[0].x+p[1].x)/2-pinch.cx;zoomY=pinch.y+(p[0].y+p[1].y)/2-pinch.cy}else if(pinch.pan){zoomX=pinch.x+at.x-pinch.startX;zoomY=pinch.y+at.y-pinch.startY}zoomX=Math.max(-viewWidth()*.7,Math.min(viewWidth()*.7,zoomX));zoomY=Math.max(-viewHeight()*.6,Math.min(viewHeight()*.6,zoomY));applyZoom();});
window.addEventListener('resize',()=>{
  if(scene!=='game')return;
  framedCue='';
  if(!phoneLayout()&&$('#universe').classList.contains('mission-camera')){
    $('#universe').classList.remove('mission-camera');fitMachine();
  }else positionMissionCamera(nextCue());
  // The zoom button reads Follow only in the phone's upright layout; sideways mode changes that without a media change.
  applyZoom();
});
const endGesture=e=>{$('#machine').classList.remove('gesturing');gestures.delete(e.pointerId);if(gestures.size<2)pinch=null};$('#machine-viewport').addEventListener('pointerup',endGesture);$('#machine-viewport').addEventListener('pointercancel',endGesture);$('#machine-viewport').addEventListener('lostpointercapture',endGesture);
const shortcuts={a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71,k:72,o:73,l:74,p:75,';':76};
document.addEventListener('keydown',e=>{if(e.target.closest('#manual,#knob-inspector,#lcd-dialog,#study,#volume')||!$('#interlude').hidden||$('#info').open||$('#fullscreen-sheet').open||(scene!=='game'&&!firmwareActive())||e.repeat)return;const key=e.key.toLowerCase();if(e.code==='Space'&&e.target.closest('button'))return;if(e.code==='Space'){e.preventDefault();if(firmwareActive())firmwareInput('space',12,true);else control('PLAY');return}if(Object.hasOwn(shortcuts,key)){e.preventDefault();keyDown(shortcuts[key],'keyboard-'+key)}});
document.addEventListener('keyup',e=>{keyUp('keyboard-'+e.key.toLowerCase());if(e.code==='Space'&&firmwareActive())firmwareInput('space',undefined,false);});window.addEventListener('blur',()=>{releaseFirmwareInputs();releaseHeld();heldControls.clear();$$('.hardware-button.pressed').forEach(b=>b.classList.remove('pressed'));updatePanel()});
initKnobInspector();initStudy();initFirmware();initVolume();copy();frame=requestAnimationFrame(paint);
document.fonts?.load('600 24px "Pixelify Sans"').then(drawDevice,()=>{});

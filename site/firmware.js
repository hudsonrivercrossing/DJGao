const fm1Buttons=['OCT−','OCT+','FX','SEL','ENV','LFO','EDIT','GLO','HOME','SAVE','ARP','SEQ','PLAY','REC'];
const fm1Encoders=['SELECT','ALGORITHM','KNOB 1','KNOB 2','KNOB 3','KNOB 4','PRESETS'];
const firmwareSectorSize=4096;
const firmwareKeyPulseMs=72;
const baudGirlV102Hash='7b169a69b30570581d0ebc7b44851e3e08898d2956ade155363bcf18fac5c348';
// The firmware's output into the site volume (audio.js). Not measured (it needs an FM-1 package): it takes
// the song playback's trim, on the guess that the emulated device is about as hot as the engine copying it.
const FIRMWARE_TRIM=DJ_OUTPUT_TRIM;
let firmwareSession=null;
let firmwareBirthdayIndex=null;

function firmwareActive(){return Boolean(firmwareSession?.ready);}

function firmwareFlashDelta(base,flash){
  const changed=[];
  for(let start=0;start<flash.length;start+=firmwareSectorSize){
    const end=start+firmwareSectorSize;
    if(flash.subarray(start,end).some((byte,index)=>byte!==base[start+index]))changed.push(start);
  }
  const stride=4+firmwareSectorSize;
  const buffer=new Uint8Array(changed.length*stride),view=new DataView(buffer.buffer);
  changed.forEach((offset,index)=>{
    view.setUint32(index*stride,offset,true);
    buffer.set(flash.subarray(offset,offset+firmwareSectorSize),index*stride+4);
  });
  return buffer;
}

function firmwareSaveFlash(session,flash){
  if(!session.base||!flash||session.base.length!==flash.length)return;
  try{
    const bytes=firmwareFlashDelta(session.base,flash);
    let raw='';
    for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
    localStorage.setItem(session.key,btoa(raw));
  }catch{
    $('#firmware-state').textContent=T('Browser storage is unavailable.','浏览器暂时无法保存。');
  }
}

function firmwareReadFlash(key){
  try{return Uint8Array.from(atob(localStorage.getItem(key)||''),letter=>letter.charCodeAt(0)).buffer;}
  catch{return null;}
}

function firmwareLed(id,value){
  const element=id<14?$(`[data-control="${fm1Buttons[id]}"]`):$(`[data-midi="${id+39}"]`);
  const on=Math.min(1,Math.max(0,value)*3);
  if(id<14){element.style.setProperty('--firmware-led',on);return;}
  element.setAttribute('aria-pressed',String(on>.1));
  const lit=element.classList.contains('firmware-key-lit');
  if(on>0){
    if(!lit||element.firmwareLightTimer!==undefined)element.firmwareLightUntil=performance.now()+firmwareKeyPulseMs;
    clearTimeout(element.firmwareLightTimer);
    element.firmwareLightTimer=undefined;
    element.classList.add('firmware-key-lit');
    element.style.setProperty('--firmware-led',on);
  }else if(lit&&element.firmwareLightTimer===undefined){
    const remaining=element.firmwareLightUntil-performance.now();
    if(remaining>0)element.firmwareLightTimer=setTimeout(()=>resetFirmwareKeyLight(element),remaining);
    else resetFirmwareKeyLight(element);
  }
}

function resetFirmwareKeyLight(key){
  clearTimeout(key.firmwareLightTimer);
  key.firmwareLightTimer=undefined;
  key.classList.remove('firmware-key-lit');
  key.style.setProperty('--firmware-led',0);
}

function firmwareDrawDisplay(){
  const bitmap=firmwareSession?.canvas;
  if(!bitmap)return;
  sc.imageSmoothingEnabled=false;
  sc.drawImage(bitmap,0,0,480,480);
  sc.imageSmoothingEnabled=true;
  mirrorDisplay();
}

function firmwareDrawFrame(session,{lcd,leds,halted}){
  if(halted){$('#firmware-state').textContent=T('Firmware stopped. Power off to restart.','固件已停止，请关机后重启。');return;}
  if(lcd){
    const image=session.image;
    for(let i=0;i<lcd.length;i++){
      const pixel=lcd[i],offset=i*4;
      image.data[offset]=((pixel>>>11)&31)*255/31;
      image.data[offset+1]=((pixel>>>5)&63)*255/63;
      image.data[offset+2]=(pixel&31)*255/31;
      image.data[offset+3]=255;
    }
    session.painter.putImageData(image,0,0);
    firmwareDrawDisplay();
  }
  for(let id=0;id<leds.length;id++)firmwareLed(id,leds[id]);
}

function firmwareInput(source,id,down){
  const session=firmwareSession;
  if(!session?.ready)return;
  if(down){
    if(session.closing)return;
    if(session.audio?.state==='suspended'||session.audio?.state==='interrupted')session.audio.resume().catch(()=>{});
    if(session.keys.has(source))return;
    session.keys.set(source,id);
  }else{
    if(!session.keys.has(source))return;
    id=session.keys.get(source);
    session.keys.delete(source);
  }
  const holds=[...session.keys.values()].filter(key=>key===id).length;
  if(down?holds!==1:holds!==0)return;
  session.node.port.postMessage({type:'key',id,down});
  const element=id<14?$(`[data-control="${fm1Buttons[id]}"]`):$(`[data-midi="${id+39}"]`);
  element.classList.toggle(id<14?'pressed':'held',down);
}

function releaseFirmwareInputs(){
  if(firmwareActive())for(const source of firmwareSession.keys.keys())firmwareInput(source,undefined,false);
}

function turnFirmware(name,delta){
  const session=firmwareSession;
  if(session.closing)return;
  if(name==='MASTER'){
    session.volume=Math.max(0,Math.min(1023,session.volume+delta*24));
    session.node.port.postMessage({type:'pot',value:session.volume});
  }else session.node.port.postMessage({type:'enc',enc:fm1Encoders.indexOf(name),clicks:delta});
  const knob=$(`[data-knob="${name}"]`);
  const angle=(knobAngles.get(name)||0)+delta*12;
  knobAngles.set(name,angle);
  knob.style.setProperty(name==='MASTER'?'--cap-angle':'--knob-angle',(name==='MASTER'?(session.volume/1023-.55)*260:angle)+'deg');
  knob.setAttribute('aria-valuetext',name==='MASTER'?Math.round(session.volume/1023*100)+'%':T('Read the firmware LCD','请看固件屏幕'));
}

function syncFirmwareLabels(){
  const session=firmwareSession;
  $('#firmware-entry').textContent=firmwareActive()?T('Power off','关机'):T('Firmware','固件');
  $('#firmware-entry').setAttribute('aria-haspopup',firmwareActive()?'false':'dialog');
  $('#firmware-title').textContent=T('Run FM-1 firmware','运行 FM-1 固件');
  $('#firmware-help').textContent=T('Choose an FM-1 .fwsc update file. It runs locally in this browser.','选择 FM-1 的 .fwsc 更新文件，在浏览器里直接运行。');
  $('#firmware-file-label').textContent=T('Firmware file','固件文件');
  $('#firmware-boot').textContent=T('Power on','开机');
  $('#firmware-close').setAttribute('aria-label',T('Close','关闭'));
  $('#firmware-state').hidden=!firmwareActive();
  if(firmwareActive())$('#firmware-state').textContent=session.name;
  if(session?.ready&&session.birthdayIndex!==null)syncFirmwareAuditionLabels(session);
}

async function bootFirmware(file){
  if(!file||firmwareSession)return;
  const button=$('#firmware-boot'),status=$('#firmware-load-state');
  button.disabled=true;
  status.textContent=T('Booting firmware…','正在启动固件…');
  let session;
  let workletUrl;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    const audio=new Audio({sampleRate:44100,latencyHint:'interactive'});
    session=firmwareSession={audio,keys:new Map(),volume:560,name:file.name,birthdayIndex:firmwareBirthdayIndex};
    if(!audio.audioWorklet)throw new Error(T('Use this preview on localhost or HTTPS in a browser with AudioWorklet.','请在支持 AudioWorklet 的浏览器中，从 localhost 或 HTTPS 打开。'));
    await audio.resume();
    const inlineWasm=$('#firmware-wasm')?.textContent.trim();
    const inlineWorklet=$('#firmware-worklet')?.textContent;
    workletUrl=inlineWorklet?URL.createObjectURL(new Blob([inlineWorklet],{type:'text/javascript'})):null;
    const wasm=inlineWasm?Uint8Array.from(atob(inlineWasm),letter=>letter.charCodeAt(0)).buffer:await fetch('assets/fm1-emu/fm1_web.wasm').then(response=>response.arrayBuffer());
    const pkg=await file.arrayBuffer();
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',pkg));
    const digest=Array.from(hash,byte=>byte.toString(16).padStart(2,'0')).join('');
    if(session.birthdayIndex!==null&&digest!==baudGirlV102Hash){
      throw new Error(T('Choose the official Baud Girl FM-1 V102 .fwsc for birthday playback.','生日歌试听需要官方 Baud Girl FM-1 V102 的 .fwsc 文件。'));
    }
    session.key='djgao-fm1:'+digest;
    await audio.audioWorklet.addModule(workletUrl||'assets/fm1-emu/worklet.js');
    session.node=new AudioWorkletNode(audio,'fm1',{numberOfInputs:0,outputChannelCount:[2]});
    session.output=audio.createGain();
    session.node.connect(session.output).connect(siteBus(audio));
    session.output.gain.value=FIRMWARE_TRIM;
    const canvas=session.canvas=document.createElement('canvas');
    canvas.width=canvas.height=240;
    session.painter=canvas.getContext('2d');
    session.image=session.painter.createImageData(240,240);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error(T('The firmware did not boot in time.','固件启动超时。'))),12000);
      session.node.port.onmessage=({data})=>{
        if(data.type==='booted'){
          clearTimeout(timer);
          if(data.board!==0){reject(new Error(T('Choose an FM-1 package.','请选择 FM-1 固件。')));return;}
          session.base=data.base;
          resolve();
        }else if(data.type==='frame'&&session.ready)firmwareDrawFrame(session,data);
        else if(data.type==='snapshot'){
          firmwareSaveFlash(session,data.flash);
          session.snapshotDone?.();
        }else if(data.type==='error'){
          clearTimeout(timer);
          if(session.ready)$('#firmware-state').textContent=data.message;
          else reject(new Error(data.message));
        }
      };
      session.node.port.postMessage({type:'boot',seq:1,wasm,package:pkg,mhz:100,sectors:firmwareReadFlash(session.key)});
    });
    showFirmwarePanel(session);
  }catch(error){
    firmwareSession=null;
    if(session?.audio)await session.audio.close().catch(()=>{});
    status.textContent=error.message;
  }finally{
    if(workletUrl)URL.revokeObjectURL(workletUrl);
    button.disabled=false;
  }
}

function showFirmwarePanel(session){
  $('#firmware-dialog').close();
  closeStudy(false);closeManual();hideKnobInspector();
  stopBirthdayPreview();stopBirthdayMusic();stopPlayback(true);
  $('#interlude').hidden=true;
  scene='firmware';
  session.ready=true;
  $('#universe').dataset.scene='game';
  $('#universe').dataset.firmware='yes';
  $('#universe').classList.remove('mission-camera');
  $('#hardware-controls').inert=false;
  for(const id of ['power-on','play-dock','scene-title','chapter-label','info-button','power-error'])$('#'+id).hidden=true;
  for(const id of ['volume','zoom','lcd-open'])$('#'+id).hidden=false;
  for(const key of $$('.hardware-key')){
    resetFirmwareKeyLight(key);
    key.classList.remove('down','held','sounding','hinted');
    key.setAttribute('aria-label',noteName(Number(key.dataset.midi)));
  }
  for(const control of $$('.hardware-button'))control.classList.remove('lit','feedback','next-control','pressed');
  setSpotlight([]);
  fitMachine();
  drawDevice();
  copy();
  session.node.port.postMessage({type:'pot',value:session.volume});
  if(session.birthdayIndex!==null)showFirmwareAudition(session);
}

async function powerOffFirmware(){
  const session=firmwareSession;
  if(!session?.ready||session.closing)return;
  session.closing=true;
  stopFirmwareAudition(session);
  $('#firmware-audition').hidden=true;
  releaseFirmwareInputs();
  await new Promise(resolve=>{
    const timer=setTimeout(resolve,1700);
    session.snapshotDone=()=>{clearTimeout(timer);resolve();};
    session.node.port.postMessage({type:'snapshot',seq:1,request:1,pause:true});
  });
  await session.audio.close().catch(()=>{});
  $$('.hardware-key').forEach(resetFirmwareKeyLight);
  firmwareSession=null;
  delete $('#universe').dataset.firmware;
  $('#scene-title').hidden=false;
  if(session.birthdayIndex!==null){
    go(2);
    state.stepCount=birthdayJourney.take.lead.length;
    state.tempo=djTakes[birthdayJourney.pass].bpm;
    Object.assign(synth,birthdaySound(birthdayJourney.pass,state.tempo,birthdayJourney.work.mixes[birthdayJourney.pass]));
    synth.update();
    openBirthdayPlayer();
    cueBirthdayTake(session.birthdayIndex);
    showBirthdayHardware(true);
    return;
  }
  showIntro();
  $('#firmware-entry').focus({preventScroll:true});
}

function showFirmwarePicker(birthdayIndex=null){
  firmwareBirthdayIndex=birthdayIndex;
  $('#firmware-load-state').textContent=birthdayIndex===null?'':T('Choose the Baud Girl V102 FM-1 update file for this take.','选择这版使用的 Baud Girl V102 FM-1 固件。');
  $('#firmware-boot').disabled=!$('#firmware-file').files?.length;
  $('#firmware-dialog').showModal();
}

function openBirthdayFirmware(index){
  if(firmwareSession)return;
  stopBirthdayMusic();
  showFirmwarePicker(index);
}

function syncFirmwareAuditionLabels(session){
  const {wave}=birthdayCardMixes[session.birthdayIndex];
  const names=birthdayHardwareTake(session.birthdayIndex).presets.map(({id})=>djV102Presets[id].name);
  $('#firmware-audition-setup').textContent=T(
    'Select this take’s 8-Bit preset · '+names.map(name=>name[0]).join(' / ')+' · '+wave+' · MIDI In 1 · 124 BPM',
    '选这版的 8-Bit Preset · '+names.map(name=>name[1]).join(' / ')+' · '+wave+' · MIDI In 1 · 124 BPM'
  );
  $('#firmware-audition-play').textContent=session.audition?T('Stop','停止'):T('Play take','试听这版');
  $('#firmware-audition-back').textContent=T('Back to song','回到生日歌');
}

function showFirmwareAudition(session){
  syncFirmwareAuditionLabels(session);
  $('#firmware-audition-play').onclick=()=>session.audition?stopFirmwareAudition(session):playFirmwareAudition(session);
  $('#firmware-audition-back').onclick=powerOffFirmware;
  $('#firmware-audition').hidden=false;
}

// Plays the take's exported patterns into the running firmware as MIDI, step by step at each
// pattern's Rate: a Ratchet repeats the step's notes inside it, a Chance step rolls each time.
function playFirmwareAudition(session){
  if(session.closing)return;
  if(synth.muted){
    synth.muted=false;
    syncSoundControl();
  }
  const {patterns}=birthdayHardwareTake(session.birthdayIndex);
  const audition=session.audition={timers:[],held:new Set()};
  const moments=new Map(),at=ms=>{const key=Math.round(ms);if(!moments.has(key))moments.set(key,{on:[],off:[]});return moments.get(key);};
  let start=0;
  for(const pattern of patterns){
    const stepMs=djV102StepSeconds(pattern.rate)*1000;
    pattern.steps.forEach((step,index)=>{
      if(step.chance&&Math.random()*100>=step.chance)return;
      const hit=stepMs/step.ratchet;
      for(let repeat=0;repeat<step.ratchet;repeat++)for(const {note,vel,end} of step.notes){
        const on=start+index*stepMs+repeat*hit;
        at(on).on.push([note,vel]);
        at(step.ratchet>1?on+hit*.9:start+(end+1)*stepMs).off.push(note);
      }
    });
    start+=pattern.length*stepMs;
  }
  $('#firmware-audition-play').textContent=T('Stop','停止');
  for(const [ms,{on,off}] of moments){
    audition.timers.push(setTimeout(()=>{
      const bytes=[];
      for(const midi of off){bytes.push(0x80,midi,0);audition.held.delete(midi);}
      for(const [midi,velocity] of on){bytes.push(0x90,midi,velocity);audition.held.add(midi);}
      session.node.port.postMessage({type:'midi',bytes});
    },ms));
  }
  audition.timers.push(setTimeout(()=>stopFirmwareAudition(session),start+900));
}

function stopFirmwareAudition(session){
  const audition=session?.audition;
  if(!audition)return;
  audition.timers.forEach(clearTimeout);
  const bytes=Array.from(audition.held,midi=>[0x80,midi,0]).flat();
  if(bytes.length)session.node.port.postMessage({type:'midi',bytes});
  session.audition=null;
  $('#firmware-audition-play').textContent=T('Play take','试听这版');
}

function initFirmware(){
  const picker=$('#firmware-file'),dialog=$('#firmware-dialog');
  $('#firmware-entry').onclick=()=>{
    if(firmwareActive()){powerOffFirmware();return;}
    if(firmwareSession)return;
    showFirmwarePicker();
  };
  picker.onchange=()=>{$('#firmware-boot').disabled=!picker.files.length;};
  $('#firmware-boot').onclick=()=>bootFirmware(picker.files[0]);
  $('#firmware-close').onclick=()=>{if(!firmwareSession)dialog.close();};
  dialog.addEventListener('cancel',event=>{if(firmwareSession&&!firmwareActive())event.preventDefault();});
}

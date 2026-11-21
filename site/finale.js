// The four DJ takes as the guide names them; `wave` is the Lead Wave each take's voice step asks for.
const birthdayJourneyVersions=djTakes.map(({title},pass)=>({
  title,
  wave:['Triangle','Pulse 25','Pulse 12.5','Pulse 12.5'][pass]
}));

// The card plays one timeline of the whole set. `birthdayPosition` is where play starts or
// resumes, in seconds; `birthdaySet` is the djTimeline of her work while the card is open.
let birthdayRun=0,birthdayMusicPlaying=false,birthdayPlayer=null,birthdayCardMixes=null,birthdaySelected=0;
let birthdaySet=null,birthdayPosition=0,birthdayFrom=0,birthdayFrame=0;
const birthdayTimers=new Set();

function birthdayClock(seconds){
  const whole=Math.max(0,Math.floor(seconds));
  return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');
}

function birthdayTakeLength(pass){
  const {takeStarts,length}=birthdaySet;
  return (takeStarts[pass+1]??length)-takeStarts[pass];
}

function birthdayTakeAt(seconds){
  return birthdaySet.takeStarts.reduce((found,start,pass)=>seconds>=start-.001?pass:found,0);
}

// Where the playhead is: read from the audio clock while playing, else the kept place.
function birthdayElapsed(){
  const start=birthdayPlayer?.startTime,now=synth.context?.currentTime;
  if(!birthdayMusicPlaying||!Number.isFinite(start)||!Number.isFinite(now))return birthdayPosition;
  return Math.max(birthdayFrom,Math.min(birthdaySet.length,now-start));
}

function paintBirthdayPlay(){
  const button=$('#birthday-play');
  button.dataset.state=birthdayMusicPlaying?'playing':'';
  button.textContent=birthdayMusicPlaying?T('Pause','暂停'):birthdayPosition>0?T('Resume','继续播放'):T('Play all','播放全部');
}

// Each take fills as the playhead crosses it; the readout under the timeline follows.
function paintBirthdayTimeline(seconds=birthdayPosition){
  if(!birthdaySet)return;
  const current=birthdayTakeAt(seconds);
  Array.from($('#birthday-timeline').children).forEach((segment,pass)=>{
    const progress=Math.max(0,Math.min(1,(seconds-birthdaySet.takeStarts[pass])/birthdayTakeLength(pass)));
    segment.style.setProperty('--progress',progress.toFixed(4));
    segment.dataset.state=birthdayMusicPlaying&&pass===current?'playing':progress>=1?'played':'';
  });
  const time=birthdayClock(seconds)+' / '+birthdayClock(birthdaySet.length);
  if($('#birthday-time').textContent!==time)$('#birthday-time').textContent=time;
}

function followBirthdayPlayhead(){
  cancelAnimationFrame(birthdayFrame);
  const step=()=>{
    if(!birthdayMusicPlaying)return;
    const seconds=birthdayElapsed();
    paintBirthdayTimeline(moving()?seconds:Math.floor(seconds));
    birthdayFrame=requestAnimationFrame(step);
  };
  birthdayFrame=requestAnimationFrame(step);
}

function birthdaySchedule(task,milliseconds){
  const timer=setTimeout(()=>{birthdayTimers.delete(timer);task();},milliseconds);
  birthdayTimers.add(timer);
  return timer;
}

function birthdaySound(index,bpm,mix){
  return {
    preset:mix?.preset??(index===1?1:0),ratio:index===1?2.25:2,algorithm:index===1?1:0,fmIndex:index===1?1.02:.7,
    attack:.007,decay:index===0?.58:.21,sustain:index===0?.16:.32,releaseTime:mix?.releaseTime??(index===0?.37:.09),
    cutoff:index>=2?15800:14200,resonance:5,filterMode:0,filterEnabled:true,
    delay:mix?.delay??(index===0?.16:index===1?.12:.065),delayFeedback:.19,delayMs:index===0?245:60/bpm*375,delayEnabled:true,
    driveEnabled:false,lfoAmp:0,lfoAmount:0,drumsLevel:index>=2?62:51,bassLevel:index>=2?62:55,leadLevel:85,
    // Her lit keys at about -20 LUFS at 50% volume, level with the take's playback (audio.js keyTrim).
    keyTrim:[22.4,16.4,18.4,21.3][index]
  };
}

// Stopping keeps the place, so play resumes there; `note` replaces the take name for a moment.
function stopBirthdayMusic(note=''){
  if(birthdayMusicPlaying&&birthdaySet)birthdayPosition=birthdayElapsed();
  birthdayRun++;
  birthdayTimers.forEach(clearTimeout);
  birthdayTimers.clear();
  cancelAnimationFrame(birthdayFrame);
  birthdayMusicPlaying=false;
  birthdayPlayer?.stop();
  birthdayPlayer=null;
  $('#interlude').removeAttribute('data-playing');
  paintBirthdayPlay();
  paintBirthdayTimeline();
  if(note)$('#birthday-status').textContent=note;
}

// Plays the set on the DJ voice engine from `from` seconds to the end.
// The card's data-arrangement and the selected take follow the playhead.
async function startBirthdayMusic(from=0){
  if(birthdayMusicPlaying||!birthdayJourney?.work||!birthdaySet)return;
  const card=$('#interlude');
  if(synth.muted){
    $('#birthday-status').textContent=T('Sound is off. Tap to hear the song.','声音已关，点一下听生日歌。');
    $('#birthday-play').textContent=T('Turn on sound and play','打开声音并播放');
    return;
  }
  const run=++birthdayRun;
  birthdayMusicPlaying=true;
  birthdayPosition=birthdayFrom=from;
  paintBirthdayPlay();
  if(synth.context?.state!=='running'){
    $('#birthday-status').textContent=T('Starting audio…','正在打开声音…');
    const watchdog=birthdaySchedule(()=>{
      if(run===birthdayRun)stopBirthdayMusic(T('Tap play to start the sound.','点播放，开启声音。'));
    },1500);
    try{await synth.wake();}
    catch{
      if(run===birthdayRun)stopBirthdayMusic(T('Tap play to try again.','点播放，再试一次。'));
      return;
    }finally{
      clearTimeout(watchdog);
      birthdayTimers.delete(watchdog);
    }
  }
  if(run!==birthdayRun)return;
  const {events,length,takeStarts}=birthdaySet,first=birthdayTakeAt(from);
  const enter=pass=>{
    if(run!==birthdayRun)return;
    card.dataset.arrangement=String(pass);
    card.dataset.playing='yes';
    selectBirthdayTake(pass);
  };
  birthdayPlayer=djPlay(synth.context,djOutput(synth.context).input,events,{from});
  enter(first);
  takeStarts.forEach((start,pass)=>{if(pass>first)birthdaySchedule(()=>enter(pass),(start-from)*1000);});
  birthdaySchedule(()=>{
    stopBirthdayMusic();
    birthdayPosition=0;
    card.removeAttribute('data-arrangement');
    selectBirthdayTake(0);
    paintBirthdayPlay();
    paintBirthdayTimeline();
  },(length-from+.15)*1000);
  paintBirthdayTimeline(from);
  followBirthdayPlayhead();
}

// The primary button plays or pauses; a take on the timeline plays from that take's start.
function toggleBirthdayMusic(pass){
  const jump=Number.isInteger(pass);
  if(birthdayMusicPlaying){
    stopBirthdayMusic();
    if(!jump)return;
  }
  if(synth.muted){
    synth.muted=false;
    syncSoundControl();
  }
  if(jump)startBirthdayMusic(birthdaySet.takeStarts[pass]);
  else startBirthdayMusic(birthdayPosition<birthdaySet.length?birthdayPosition:0);
}

// ALGORITHM steps through the 8-Bit lead waves in this order.
const birthdayWaves=['Triangle','Pulse 50','Pulse 25','Pulse 12.5'];
// The take-4 game effects her keys sound while she records (app.js).
const birthdayEncoreEffects={
  29:['Coin','金币'],
  30:['Jump','跳跃'],
  34:['Power-Up','能量升级']
};
let birthdayJourney=null,birthdayPreview=null,birthdayCelebrationTimer,birthdayChime;

function birthdayJourneyActive(){return Boolean(birthdayJourney?.active);}

// The Lead Wave on the panel: the dial while she is choosing it, then the take's wave.
function birthdayLeadWave(){
  const journey=birthdayJourney;
  if(journey.step==='voice')return journey.dial;
  return journey.work?journey.work.mixes[journey.pass].wave:birthdayJourneyVersions[0].wave;
}

function birthdayLeadKind(wave=birthdayLeadWave()){
  return {'Triangle':'triangle','Pulse 50':'chip','Pulse 25':'pulse25','Pulse 12.5':'pulse125'}[wave];
}

// The take's pattern on the LCD sequencer: whole bars of the take that hold every hard-mode target.
function newBirthdayPassPattern(pass){
  const bar=djTakes[pass].stepsPerBar,end=Math.max(...djHandTargets(pass,'hard').map(({step,length})=>step+length));
  return newBirthdayTake(Math.ceil(end/bar)*bar);
}

// pass, step and heard live in the work once a mode is chosen; before that, in the mode step.
function newBirthdayJourney(){
  const waiting={pass:0,step:'mode',heard:false};
  const field=name=>({enumerable:true,get(){return (this.work??waiting)[name];},set(value){(this.work??waiting)[name]=value;}});
  const patterns=[0,1,2,3].map(newBirthdayPassPattern);
  return Object.defineProperties({active:true,work:null,dial:null,patterns,take:patterns[0]},
    {pass:field('pass'),step:field('step'),heard:field('heard')});
}

// Records one hand target she played: its id in the work, its note in the take's pattern.
function birthdayRecordHand(target){
  const journey=birthdayJourney,done=journey?.work?.takes[journey.pass];
  if(!done||done.has(target.id))return false;
  done.add(target.id);
  writeBirthdayEvent(journey.take,target);
  djSaveWork(journey.work);
  return true;
}

// The group of keys she is on and the members she has not played yet, in any order.
function birthdayChord(){
  const work=birthdayJourneyActive()?birthdayJourney.work:null,group=work&&djNextGroup(work);
  if(!group)return null;
  const done=work.takes[work.pass];
  return {...group,left:group.targets.filter(target=>!done.has(target.id))};
}

// The unplayed member of the current group under this key at the current OCT, if any.
function birthdayKeyTarget(midi){
  const chord=birthdayChord();
  if(!chord||state.transpose!==0||state.octave!==chord.octave)return null;
  return chord.left.find(target=>target.midi===midi)||null;
}

// While recording, the last unplayed member of a chord sounds every member together.
function birthdayChordSound(midi){
  const chord=birthdayChord();
  if(!state.recording||!chord||chord.targets.length<2||chord.left.length!==1||birthdayKeyTarget(midi)?.id!==chord.left[0].id)return null;
  return chord.targets;
}

// While recording, a chord's earlier members are held silently until the last one sounds them all.
function birthdayChordHold(midi){
  const chord=birthdayChord();
  return Boolean(state.recording&&chord&&chord.targets.length>1&&chord.left.length>1&&birthdayKeyTarget(midi));
}

// Keys of the current chord she has already pressed: they stay lit until the chord sounds.
function birthdayChordHeldKeys(){
  const chord=birthdayChord();
  if(!state.recording||!chord||chord.targets.length<2||state.octave!==chord.octave||state.transpose!==0)return [];
  const left=new Set(chord.left.map(target=>target.id));
  return chord.targets.filter(target=>!left.has(target.id)).map(target=>target.midi-target.octave*12);
}

// The last note of the set, as it sounds: lead targets are written an octave above their sound.
function birthdayAccent(mode){
  const last=djHandTargets(3,mode).at(-1);
  return last.part==='lead'?last.midi-12:last.midi;
}

function writeBirthdayEvent(take,{part,step,midi,length}){
  if(part==='drums')take.drums[midi-17][step]=true;
  else take[part][step].push(midi);
  if(part==='lead')take.leadLengths[step]=length;
}

// The LCD leaves the take's pattern too: the screen she goes to draws its own.
function leaveBirthdayJourney(){
  stopBirthdayPreview();
  if(!birthdayJourney?.active)return;
  birthdayJourney.active=false;
  state.recording=false;
  state.view='home';
}

// Power-on opens the mode step; chooseBirthdayMode starts take 1.
// "Make a new song": the only way to throw a recorded song away, reached after a confirmation.
function startNewBirthdaySong(){
  djClearWork();
  if(!$('#interlude').hidden)closeBirthdayPlayer();
  leaveBirthdayJourney();
  birthdayJourney=null;
  startBirthdayJourney();
}

function birthdaySongHasProgress(){
  const work=birthdayJourney?.work;
  return Boolean(work&&(work.step==='finished'||work.takes.some(take=>take.size)));
}

function startBirthdayJourney(){
  closeStudy(false);
  guided=true;
  birthdayJourney=newBirthdayJourney();
  go(2);
  // Until she has played a note, the choice of mode is still hers to make.
  const stored=djLoadWork(),started=stored&&(stored.step==='finished'||stored.takes.some(take=>take.size));
  if(started)restoreBirthdayWork(stored);
  else showBirthdayPass();
}

// Rebuilds the LCD patterns from the recorded ids. A take cut off midway restarts from its
// beginning; a take she recorded to the end waits for PLAY, then "Next take".
function restoreBirthdayWork(work){
  const journey=birthdayJourney,complete=!djNextTarget(work);
  if(work.step!=='finished'&&!complete)work.takes[work.pass].clear();
  journey.work=work;
  work.takes.forEach((done,pass)=>{
    for(const target of djHandTargets(pass,work.mode))if(done.has(target.id))writeBirthdayEvent(journey.patterns[pass],target);
  });
  if(work.step==='finished'){
    showBirthdayPass();
    openBirthdayPlayer();
  }else if(complete){
    work.step='listen';
    work.heard=false;
    djSaveWork(work);
    showBirthdayPass();
  }else setBirthdayPass(work.pass);
}

// Help's "Back to my birthday song": back to the DJ journey where she left it, or to My song once it is done.
function resumeBirthdayJourney(){
  if(!birthdayJourney){startBirthdayJourney();return;}
  closeStudy(false);
  if(!birthdayJourney.active){
    guided=true;
    birthdayJourney.active=true;
    go(2);
    showBirthdayPass();
  }
  if(birthdayJourney.step==='finished')openBirthdayPlayer();
}

function chooseBirthdayMode(mode){
  if(!['standard','hard'].includes(mode)||!birthdayJourneyActive()||birthdayJourney.step!=='mode')return;
  const seed=typeof crypto!=='undefined'&&crypto.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*2**32);
  birthdayJourney.work=djNewWork(mode,seed);
  djSaveWork(birthdayJourney.work);
  setBirthdayPass(0);
}

// Each take starts one ALGORITHM click away from its wave, on the wave before it.
function setBirthdayPass(pass){
  stopBirthdayPreview();
  const journey=birthdayJourney,wave=birthdayJourneyVersions[pass].wave;
  journey.pass=pass;
  journey.heard=false;
  journey.step='voice';
  journey.dial=birthdayWaves[(birthdayWaves.indexOf(wave)+birthdayWaves.length-1)%birthdayWaves.length];
  if(journey.work)djSaveWork(journey.work);
  showBirthdayPass();
}

function showBirthdayPass(){
  const journey=birthdayJourney,{pass}=journey;
  // From take 4 the birthday show's video downloads in the background, so it plays without a wait.
  if(pass===3)prefetchPremiere();
  journey.take=journey.patterns[pass];
  state.tempo=djTakes[pass].bpm;
  state.stepCount=journey.take.lead.length;
  state.step=state.recordStep=0;
  Object.assign(synth,birthdaySound(pass,state.tempo,journey.work?.mixes[pass]));
  synth.update();
  setView('home');
  fitMachine();
  copy();
}

function stopBirthdayPreview(){
  if(!birthdayPreview)return;
  birthdayPreview.player?.stop();
  birthdayPreview=null;
  if(birthdayJourney.step==='listening')birthdayJourney.step='listen';
  birthdayTimers.forEach(clearTimeout);
  birthdayTimers.clear();
  synth.allOff();
}

function finishBirthdayPassPreview(){
  birthdayPreview=null;
  birthdayJourney.step='heard';
  updatePanel();
}

// The take is played back once; she moves on with "Next take", never by PLAY.
function birthdayPassHeard(){
  return birthdayJourneyActive()&&birthdayJourney.heard&&['listen','listening','heard'].includes(birthdayJourney.step);
}

function advanceBirthdayPass(){
  if(!birthdayPassHeard())return;
  setBirthdayPass(birthdayJourney.pass+1);
}

// Skip this take: the guide records every target she has not played yet, then plays the take.
// Skipping take 4 ends the set exactly as its last key would.
function skipBirthdayPass(){
  if(!birthdayJourneyActive())return;
  const journey=birthdayJourney,{work}=journey;
  if(!work||!['voice','record','notes'].includes(journey.step))return;
  state.recording=false;
  for(let target=djNextTarget(work);target;target=djNextTarget(work))birthdayRecordHand(target);
  if(journey.pass===3){
    finishBirthdaySong(djHandTargets(3,work.mode).at(-1));
    return;
  }
  journey.step='listening';
  setView('seq');
  previewBirthdayPass();
}

function previewBirthdayPass(){
  stopBirthdayPreview();
  const journey=birthdayJourney;
  journey.heard=true;
  const {events,length}=djTakeTimeline(journey.work,journey.pass);
  const preview=birthdayPreview={player:null};
  function play(){
    if(birthdayPreview!==preview)return;
    preview.player=djPlay(synth.context,djOutput(synth.context).input,events,{onEvent:event=>{
      if(event.key!==undefined)flashKey(event.midi,event.key);
    }});
    birthdaySchedule(finishBirthdayPassPreview,(length+.15)*1000);
  }
  if(synth.context?.state==='running')play();
  else synth.wake().then(play,()=>{
    if(birthdayPreview!==preview)return;
    stopBirthdayPreview();
    message(T('Tap PLAY or the highlighted control to try the sound again.','再点 PLAY 或亮着的控件，重试声音。'));
    updatePanel();
  });
  updatePanel();
}

// Cues read the target's title in the current language, so a language switch shows at once.
function birthdayJourneyCue(cue,octave,resetPitch){
  const {step,pass}=birthdayJourney;
  switch(step){
    case 'mode':return cue('Pick how much you play yourself.','选一下：你想亲手弹多少？');
    case 'voice':{
      const wave=birthdayJourneyVersions[pass].wave,{direction,clicks}=birthdayWaveTurns();
      return cue('Turn ALGORITHM to '+wave+' · '+clicks+' '+(direction==='up'?'clockwise':'anticlockwise'),'转 ALGORITHM，选 '+wave+' · '+(direction==='up'?'顺':'逆')+'时针转 '+clicks+' 格',null,null,'ALGORITHM');
    }
    case 'record':return cue(['Press REC to play the music box.','Press REC to start the house party.','Press REC to build the drop.','Press REC to play the encore.'][pass],['按 REC，弹八音盒。','按 REC，开一场 House Party。','按 REC，录下 Drop。','按 REC，弹安可。'][pass],'REC');
    case 'notes':{
      const target=currentLessonTarget();
      if(!state.recording)return cue('Press REC to keep recording.','按 REC，接着录。','REC');
      if(!target)return cue('Press REC to keep this take.','按 REC，保留这段录音。','REC');
      if(state.transpose!==0)return resetPitch();
      if(state.octave!==target.octave)return octave(target.octave);
      const chord=birthdayChord();
      if(chord.targets.length>1){
        // Drums are named, never given a pitch; pitched keys read as their note names.
        const names=language=>chord.left.map(member=>member.name?member.name[language]:noteName(member.midi)).join(' ');
        const step=chord.step+1,left=chord.left.length;
        return cue('Chord · step '+step+' · play '+names(0)+' ('+left+' left)','和弦 · 第 '+step+' 格 · 弹 '+names(1)+'（还差 '+left+' 个）',null,chord.left.map(member=>member.midi-member.octave*12));
      }
      return cue(...target.title,null,target.midi-target.octave*12);
    }
    case 'listen':return cue('Press PLAY to hear this take.','按 PLAY，听听这次录音。','PLAY');
    case 'listening':return cue('Listening to this take. PLAY stops it.','正在播放这一版。按 PLAY 停下。');
    case 'heard':return cue('Press PLAY to hear it again, or go to the next take.','再按 PLAY 听一遍，或点「下一版」。','PLAY');
    default:return cue('Your birthday song is ready.','你的生日歌做好了。');
  }
}

function birthdayJourneyContext(){
  if(birthdayJourney.step==='notes')return T('The guide moves the cursor. Each lit key records one event.','引导会移动光标。每点一次亮键，就录下一颗音或一个鼓点。');
  return '';
}

function birthdayJourneyControl(name){
  if(!birthdayJourneyActive())return false;
  const journey=birthdayJourney,{step}=journey;
  if(name==='REC'){
    if(!['record','notes'].includes(step))return true;
    state.seq=true;
    state.recording=!state.recording;
    journey.step=!state.recording&&!currentLessonTarget()?'listen':'notes';
    if(state.recording){state.view='lane';syncLessonCursor();}
    updatePanel();
    return true;
  }
  if(name==='PLAY'){
    if(['listen','heard'].includes(step)){
      journey.step='listening';
      setView('seq');
      previewBirthdayPass();
    }else if(step==='listening'){stopBirthdayPreview();updatePanel();}
    else if(step==='finished')openBirthdayPlayer();
    return true;
  }
  return name==='ARP'&&step!=='finished';
}

// The Lead Wave page on the LCD while she is choosing: every wave, where the dial is, and the goal.
function birthdayWavePicker(){
  const journey=birthdayJourney,target=birthdayJourneyVersions[journey.pass].wave;
  return birthdayWaves.map(name=>({name,current:name===journey.dial,target:name===target}));
}

// Fewest ALGORITHM clicks from the dial to the take's wave; up (clockwise, drag up) wins a tie.
function birthdayWaveTurns(){
  const journey=birthdayJourney,count=birthdayWaves.length;
  const from=birthdayWaves.indexOf(journey.dial),to=birthdayWaves.indexOf(birthdayJourneyVersions[journey.pass].wave);
  const up=(to-from+count)%count,down=(from-to+count)%count;
  return up<=down?{direction:'up',clicks:up}:{direction:'down',clicks:down};
}

// ALGORITHM moves the Lead Wave dial; reaching the take's wave opens the record step.
function birthdayJourneyTurn(name,delta){
  if(!birthdayJourneyActive())return false;
  const journey=birthdayJourney,{pass,step}=journey;
  if(name!=='ALGORITHM'||state.view!=='home'||step!=='voice')return false;
  const index=(birthdayWaves.indexOf(journey.dial)+delta%birthdayWaves.length+birthdayWaves.length)%birthdayWaves.length;
  journey.dial=birthdayWaves[index];
  if(journey.dial===birthdayJourneyVersions[pass].wave)journey.step='record';
  synth.note(72,birthdayLeadKind(journey.dial),.24,.7);
  screenMessage(journey.dial.toUpperCase());
  return true;
}

// The last hand target of take 4 records the note and opens the birthday cheer from that key.
function finishBirthdayAccent(midi){
  if(!birthdayJourneyActive()||!state.recording)return false;
  const journey=birthdayJourney,{work}=journey;
  if(!work||journey.pass!==3||journey.step!=='notes')return false;
  const last=djHandTargets(3,work.mode).at(-1);
  if(work.takes[3].size!==djHandTargets(3,work.mode).length-1||djNextTarget(work)?.id!==last.id||!writeNote(midi))return false;
  finishBirthdaySong(last);
  return true;
}

function finishBirthdaySong(last){
  const journey=birthdayJourney,key=localRect($(`[data-midi="${last.midi-last.octave*12}"]`));
  journey.work.mixes[3].accent=birthdayAccent(journey.work.mode);
  journey.step='finished';
  djSaveWork(journey.work);
  state.recording=false;
  stopBirthdayPreview();
  openBirthdayPlayer({x:key.left+key.width/2,y:key.top+key.height/2});
}

function endBirthdaySurprise(focus=true){
  clearTimeout(birthdayCelebrationTimer);
  clearTimeout(birthdayChime);
  $('#birthday-surprise').hidden=true;
  delete $('#interlude').dataset.celebrating;
  $('#interlude').setAttribute('aria-labelledby','win-title');
  // Focus lands on the card's primary action: the birthday show once it is there, Play all otherwise.
  if(focus)($('#premiere-open').hidden?$('#birthday-play'):$('#premiere-open')).focus({preventScroll:true});
}

function showBirthdaySurprise({x,y}){
  const card=$('#interlude'),surprise=$('#birthday-surprise'),sparks=$('#birthday-sparks');
  card.dataset.celebrating='yes';
  card.setAttribute('aria-labelledby','birthday-cheer');
  surprise.style.setProperty('--key-x',x+'px');
  surprise.style.setProperty('--key-y',y+'px');
  const reach=Math.hypot(Math.max(x,viewWidth()-x),Math.max(y,viewHeight()-y));
  sparks.replaceChildren(...Array.from({length:38},(_,index)=>{
    const pixel=document.createElement('i'),angle=index*2.39996,distance=reach*(.24+(index%7)*.095);
    pixel.style.setProperty('--dx',Math.round(Math.cos(angle)*distance)+'px');
    pixel.style.setProperty('--dy',Math.round(Math.sin(angle)*distance)+'px');
    pixel.style.setProperty('--wait',(index%9)*23+'ms');
    pixel.style.setProperty('--pixel',(4+index%5*2)+'px');
    return pixel;
  }));
  $('#birthday-cheer').textContent=T('Happy birthday!','生日快乐!');
  $('#birthday-skip').textContent=T('See my song →','看看我的歌 →');
  surprise.hidden=false;
  $('#birthday-skip').focus({preventScroll:true});
  birthdayChime=setTimeout(()=>{
    const finalNote=birthdayJourney.work.mixes[3].accent;
    for(const interval of [-12,-8,-5])synth.note(finalNote+interval,'chime',.45,.38);
  },300);
}

function downloadUrl(url,name){
  const link=document.createElement('a');
  link.href=url;
  link.download=name;
  link.click();
}

function downloadFile(blob,name){
  const url=URL.createObjectURL(blob);
  downloadUrl(url,name);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function downloadBirthdayPatterns(){
  const bytes=encodeDjPatterns(birthdayJourney.work);
  downloadFile(new Blob([bytes],{type:'application/octet-stream'}),'happy-birthday-dj-set-fm1-v102-patterns.syx');
}

const birthdayRateNames={5:'1/8T',6:'1/16',7:'1/16T',9:'1/32T'};

// The take's patterns on the FM-1: their slots in play order, rates, lengths and presets.
function birthdayHardwareTake(index){
  const patterns=djV102Patterns(birthdayJourney.work).filter(pattern=>pattern.take===index);
  const presets=[...new Set(patterns.map(pattern=>pattern.preset))].map(id=>({
    id,slots:patterns.filter(pattern=>pattern.preset===id).map(pattern=>pattern.slot)
  }));
  return {patterns,presets,rates:[...new Set(patterns.map(pattern=>birthdayRateNames[pattern.rate]))]};
}

// The take's notes she recorded, for its segment of the timeline: pitched notes as bars on a
// shared pitch scale, drum hits and game sounds as dots along the bottom.
function birthdayNoteMarks(take){
  const steps=take.lead.length,pitched=[],hits=new Set();
  take.lead.forEach((row,step)=>row.forEach(midi=>pitched.push({step,midi:midi-12,length:take.leadLengths[step]||1})));
  take.bass.forEach((row,step)=>row.forEach(midi=>pitched.push({step,midi,length:1})));
  take.drums.forEach(row=>row.forEach((hit,step)=>{if(hit)hits.add(step);}));
  take.sfx.forEach((row,step)=>{if(row.length)hits.add(step);});
  const midis=pitched.map(({midi})=>midi),low=Math.min(...midis),range=Math.max(1,Math.max(...midis)-low);
  const marks=pitched.map(({step,midi,length})=>{
    const note=document.createElement('i');
    note.style.setProperty('--start',step/steps*100+'%');
    note.style.setProperty('--length',length/steps*100+'%');
    note.style.setProperty('--pitch',((midi-low)/range).toFixed(3));
    return note;
  });
  for(const step of hits){
    const hit=document.createElement('b');
    hit.style.setProperty('--start',step/steps*100+'%');
    marks.push(hit);
  }
  return marks;
}

function selectBirthdayTake(index){
  birthdaySelected=index;
  $('#interlude').dataset.selectedTake=String(index);
  if(!birthdaySet)return;
  const name=T(...djTakes[index].title);
  $('#birthday-status').textContent=name;
  Array.from($('#birthday-timeline').children).forEach((segment,pass)=>{
    if(pass===index)segment.setAttribute('aria-current','true');
    else segment.removeAttribute('aria-current');
  });
  $('#birthday-firmware-preview').textContent=T('Hear “'+name+'” in the firmware first','先用固件试听「'+name+'」');
}

// One take on the FM-1: its slots in play order (the summary), then rates, steps, lead wave, echo and presets.
function birthdayHardwareSlots(pass){
  return 'Pattern '+birthdayHardwareTake(pass).patterns.map(pattern=>pattern.slot).join(' → ');
}

function birthdayHardwareLine(pass){
  const {wave,delay}=birthdayCardMixes[pass],{patterns,presets,rates}=birthdayHardwareTake(pass);
  const steps=patterns.map(pattern=>pattern.length).join(' + ');
  const presetText=lang=>presets.map(({id,slots})=>{
    const {name,settings}=djV102Presets[id];
    return name[lang]+' ('+slots.join(', ')+'): '+settings[lang];
  }).join(lang?'；':'; ');
  return T(
    'Rate '+rates.join(', then ')+' · '+steps+' steps · Lead Wave '+wave+' · Delay Mix '+percent(delay)+' · '+presetText(0)+'.',
    'Rate '+rates.join('，之后 ')+' · '+steps+' 步 · 主奏波形 '+wave+' · 回声混合 '+percent(delay)+' · '+presetText(1)+'。'
  );
}

function renderBirthdayHardware(){
  const items=lines=>lines.map(line=>{const item=document.createElement('li');item.textContent=T(...line);return item;});
  $('#birthday-hardware-back').textContent=T('← Back','← 返回');
  $('#birthday-hardware-back').setAttribute('aria-label',T('Back to the song','回到生日歌'));
  $('#birthday-hardware-title').textContent=T('Play it on your FM-1','在 FM-1 上弹');
  $('#birthday-step-backup').textContent=T('Back up first','先备份');
  $('#birthday-backup-warning').textContent=T('Sending this replaces all 16 patterns on your FM-1. Back them up in Device Manager first.','发送会覆盖 FM‑1 上全部 16 个 Pattern，先在 Device Manager 里备份。');
  $('#birthday-backup-how').textContent=T('Connect the FM-1 running Baud Girl V102 to Device Manager and save a backup of all 16 patterns.','在 Device Manager 连接运行 Baud Girl V102 的 FM-1，把 16 个 Pattern 全部备份。');
  $('#birthday-step-download').textContent=T('Download','下载');
  $('#birthday-pattern-download').textContent=T('Download all four · .syx','下载全部四版 · .syx');
  $('#birthday-pattern-download').onclick=downloadBirthdayPatterns;
  $('#birthday-firmware-preview').onclick=()=>openBirthdayFirmware(birthdaySelected);
  $('#birthday-step-send').textContent=T('Send','发送');
  $('#birthday-send-how').textContent=T('Open the .syx in Library and choose Send. The set fills Patterns 9–16 and then 1–8, chained in play order.','在 Library 打开 .syx，点 Send。这套歌先占 Pattern 9–16，再占 1–8，按播放顺序串好。');
  $('#birthday-hardware-source').textContent='Device Manager ↗';
  $('#birthday-step-setup').textContent=T('Set up','设置');
  $('#birthday-hardware-guide').replaceChildren(...items([
    ['In GLO set Tempo 124 and Sync Off, and leave Seq Transpose at 0: every key change is already in the notes.','GLO 里 Tempo 设 124、Sync 关；Seq Transpose 保持 0，升调已经写进音符。'],
    ['Make the presets listed for each take below. Each pattern keeps its own Rate and steps; give each pattern its preset in SEQ → Settings → Preset, then SAVE.','按下面每版列的设置做好 Preset。每个 Pattern 自带 Rate 和步数；在 SEQ → Settings → Preset 给每个 Pattern 指定它的 Preset，按 SAVE。'],
    ['Drums: kick F0, snare F♯0, closed hat G0, clap G♯0, open hat A0, crash A♯0, riser B0, HEY C1, candle blow C♯1, wind-up click D1, applause D♯1. Audition each key and set it in EDIT → Drums; make HEY from Pulse 50 with Snap and a short Decay.','鼓位：底鼓 F0、军鼓 F♯0、闭镲 G0、拍掌 G♯0、开镲 A0、镲片 A♯0、上扫 B0、HEY C1、吹蜡烛 C♯1、发条咔哒 D1、掌声 D♯1。先逐个按键试听，在 EDIT → Drums 里改；HEY 用 Pulse 50 加 Snap、短 Decay。'],
    ['Select Pattern 9 and press PLAY.','选 Pattern 9，按 PLAY。']
  ]));
  $('#birthday-hardware-takes').replaceChildren(...birthdayJourneyVersions.map(({title},pass)=>{
    const item=document.createElement('li'),take=document.createElement('details'),summary=document.createElement('summary'),detail=document.createElement('p');
    summary.textContent=T(...title)+' · '+birthdayHardwareSlots(pass);
    detail.textContent=birthdayHardwareLine(pass);
    take.append(summary,detail);
    item.append(take);
    return item;
  }));
  $('#birthday-hardware-notes-title').textContent=T('How it differs from the web','和网页的差异');
  $('#birthday-hardware-notes').replaceChildren(...items([
    ['Arpeggios, chords and the filter type come from the presets; the file locks only Filter Cutoff and Bitcrush Bits.','琶音、和弦和滤波类型由 Preset 决定，文件里只锁 Filter Cutoff 和 Bitcrush Bits。'],
    ['Chance rolls again on every pass, and only on steps where every hit is a Chance hit; other Chance hits always play.','Chance 每遍重新随机，而且只在整步都是 Chance 音时生效；和别的音同一步的 Chance 音每遍都响。'],
    ['A Ratchet repeats every note on its step, inside that one step.','Ratchet 会把这一步的所有音在这一步之内连打。'],
    ['Pitch slides are left out, the party horn is the Alarm effect, bass below F2 plays an octave up, and the drop’s chord keys play an octave up.','滑音没有写进去，派对喇叭换成 Alarm 音效，低于 F2 的贝斯高一个八度，Drop 的和弦键高一个八度。'],
    ['Not yet checked on an FM-1: the drum slots, Ratchet over held notes and effects, echo tails across preset changes, the HEY sound, and the 8-Bit limiter dipping the mix when every part is loud.','还没在真机上验证：鼓位、Ratchet 遇到长音和音效、换 Preset 时的回声尾巴、HEY 的音色，以及三个声部都很响时 8-Bit 限幅器把整体压低。']
  ]));
}

function renderBirthdayPlayer(){
  const {work,patterns}=birthdayJourney,length=birthdayClock(birthdaySet.length);
  const played=work.takes.reduce((sum,take)=>sum+take.size,0);
  $('#win-title').textContent=T('Your birthday song','你的生日歌');
  $('#win-detail').textContent=T('Four takes · '+length+' · you played '+played+(played===1?' note':' notes')+' yourself','四版 · '+length+' · 你亲手弹了 '+played+' 个音');
  $('#birthday-close').setAttribute('aria-label',T('Back to the instrument','回到琴面'));
  $('#birthday-close').onclick=()=>{
    closeBirthdayPlayer();
    $('#info-button').focus({preventScroll:true});
  };
  $('#birthday-timeline').setAttribute('aria-label',T('Four takes. Tap one to play from it.','四版。点一版，从那里开始播放。'));
  $('#birthday-timeline').replaceChildren(...patterns.map((take,pass)=>{
    const segment=document.createElement('button'),notes=document.createElement('span'),name=T(...djTakes[pass].title);
    segment.type='button';
    segment.className='birthday-take';
    segment.dataset.take=String(pass);
    segment.style.setProperty('--grow',birthdayTakeLength(pass).toFixed(2));
    segment.setAttribute('aria-label',T('Play from take '+(pass+1)+', '+name,'从第 '+(pass+1)+' 版「'+name+'」开始播放'));
    notes.className='birthday-notes';
    notes.setAttribute('aria-hidden','true');
    notes.append(...birthdayNoteMarks(take));
    segment.append(notes);
    segment.onclick=()=>toggleBirthdayMusic(pass);
    return segment;
  }));
  paintPremiere();
  $('#birthday-fm1').textContent=T('You can also play it on a real FM-1 →','也可以在真的 FM-1 上弹 →');
  $('#birthday-fm1').onclick=()=>showBirthdayHardware(true);
  $('#birthday-hardware-back').onclick=()=>showBirthdayHardware(false);
  renderBirthdayHardware();
  selectBirthdayTake(birthdaySelected);
  paintBirthdayPlay();
  paintBirthdayTimeline();
}

// Puts the playhead at the start of a take without playing, e.g. back from the firmware preview.
function cueBirthdayTake(pass){
  if(birthdayMusicPlaying)stopBirthdayMusic();
  birthdayPosition=birthdaySet.takeStarts[pass];
  selectBirthdayTake(pass);
  paintBirthdayPlay();
  paintBirthdayTimeline();
}

// The FM-1 steps replace the player inside the card; Back returns to it.
function showBirthdayHardware(show){
  if(show&&birthdayMusicPlaying)stopBirthdayMusic();
  $('#birthday-player-view').hidden=show;
  $('#birthday-hardware').hidden=!show;
  $('#interlude').setAttribute('aria-labelledby',show?'birthday-hardware-title':'win-title');
  $('#interlude').dataset.view=show?'hardware':'player';
  $('.birthday-note').scrollTop=0;
  (show?$('#birthday-hardware-back'):$('#birthday-fm1')).focus({preventScroll:true});
}

function openBirthdayPlayer(origin){
  if(birthdayJourney?.step!=='finished')return;
  closeStudy(false);
  hideKnobInspector();
  stopBirthdayPreview();
  stopPlayback(true);
  stopBirthdayMusic();
  const {work,patterns}=birthdayJourney;
  if(origin)synth.note(work.mixes[3].accent,birthdayLeadKind(work.mixes[3].wave),.42,1);
  // The card plays the DJ timeline; the LCD patterns only draw her notes on it.
  birthdayCardMixes=work.mixes.map((mix,pass)=>({...mix,take:patterns[pass]}));
  birthdaySet=djTimeline(work);
  birthdaySelected=0;
  birthdayPosition=0;
  const card=$('#interlude');
  card.classList.add('finale');
  card.dataset.song='yes';
  card.removeAttribute('data-arrangement');
  delete card.dataset.view;
  $('#birthday-close').hidden=false;
  prefetchPremiere();
  $('#birthday-player-view').hidden=false;
  $('#birthday-hardware').hidden=true;
  $('#birthday-hardware-differences').open=false;
  renderBirthdayPlayer();
  card.hidden=false;
  $('#hardware-controls').inert=true;
  if(origin)showBirthdaySurprise(origin);
  else endBirthdaySurprise();
}

function closeBirthdayPlayer(){
  endBirthdaySurprise(false);
  stopBirthdayMusic();
  $('#interlude').hidden=true;
  $('#hardware-controls').inert=false;
  copy();
}

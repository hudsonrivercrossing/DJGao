const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '../site', name), 'utf8');
const app = source('app.js');
const audio = source('audio.js');
const segment = (code, start, end) => code.slice(code.indexOf(start), code.indexOf(end));

function parameterContext() {
  const pattern = {notes:Array.from({length:16},()=>[]),drums:Array.from({length:12},()=>Array(16).fill(false))};
  for(const part of ['bass','lead','sfx'])pattern[part]=Array.from({length:16},()=>[]);
  const context = vm.createContext({
    state:{view:'home',page:0,focus:0,octave:0,tempo:120,swing:50,gate:50,stepCount:16,recordStep:0,step:0,preset:0,arpMode:0,arpRate:8,arpOctaves:1,pattern:0,lane:'bass'},
    level:1,playhead:0,playing:false,guided:false,scene:'game',lastNote:'',lastScreenMessage:'',
    arpModes:['Up','Down','Inclusive','Exclusive','Random','Order','Repeat'],
    presetNames:['WEB BELL','WEB E.PIANO','WEB GLASS','WEB SOFT PAD','WEB PLUCK'],
    currentPattern:()=>pattern,arpNotes:new Set([67,60,64]),color:()=> '#f58abd',noteName:String,
    birthdayJourneyActive:()=>false,birthdayPreview:null,firmwareActive:()=>false,moveStep(){},saveProgress(){},stopPlayback(){},setTempo(){},setView(){}
  });
  vm.runInContext(audio+'\nconst synth=new SoundLabSynth();',context);
  vm.runInContext(segment(app,'const clockRates=','function moveStep'),context);
  vm.runInContext(segment(app,'function stepMilliseconds','function recordedSteps'),context);
  return {context,pattern,run:code=>vm.runInContext(code,context)};
}

test('Stock parameter pages bound cutoff and gate, and step rates survive older patterns',()=>{
  const {run,pattern}=parameterContext();
  assert.equal(run('stepMilliseconds()'),125);
  assert.equal(run("state.view='seq';state.page=1;rowsForView()[1].value"),'1/16');
  assert.equal(run("rowsForView()[1].turn(-1);stepMilliseconds()"),250);
  assert.equal(pattern.rates[0],8);
  assert.equal(run("rowsForView()[3].turn(-999);rowsForView()[3].value"),'20%');
  assert.equal(run("state.view='fx';state.page=0;rowsForView()[1].turn(999);rowsForView()[1].value"),'20000 Hz');
  assert.equal(run("rowsForView()[1].turn(-999);rowsForView()[1].value"),'100 Hz');
  assert.equal(run("state.page=1;rowsForView()[1].turn(1);rowsForView()[1].value"),'250 ms');
});

test('Stock ARP distinguishes inclusive, exclusive, order and repeat modes',()=>{
  const {run}=parameterContext();
  for(const [mode,expected] of [
    [2,[60,64,67,67,64,60]],[3,[60,64,67,64]],[5,[67,60,64]],[6,[60,60,64,64,67,67]]
  ])assert.deepEqual(Array.from(run('state.arpMode='+mode+';arpSequence()')),expected);
});

test('Effect controls and the music-box voice reach the Web Audio graph',async()=>{
  const oscillators=[];
  const parameter=()=>({
    value:0,setTargetAtTime(value){this.value=value;},
    setValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(value){this.value=value;}
  });
  const node=()=>({gain:parameter(),frequency:parameter(),Q:parameter(),delayTime:parameter(),detune:parameter(),threshold:parameter(),ratio:parameter(),attack:parameter(),knee:parameter(),release:parameter(),connect(){},start(){}});
  class AudioContext {
    currentTime=0;
    createGain=node;
    createBiquadFilter=node;
    createWaveShaper=node;
    createDynamicsCompressor=node;
    createDelay=node;
    createAnalyser=node;
    createOscillator(){const oscillator=node();oscillators.push(oscillator);return oscillator;}
    resume(){}
  }
  const {context,run}=parameterContext();
  context.window={AudioContext};
  await run('synth.wake()');
  run("state.view='fx';state.page=1;rowsForView()[1].turn(5);rowsForView()[3].turn(-1)");
  assert.equal(run('synth.echo.delayTime.value'),.29);
  assert.equal(run('synth.echoMix.gain.value'),0);
  run("state.view='edit';level=2;rowsForView()[0].turn(-99)");
  assert.equal(run('synth.parts.drums.gain.value'),0);
  assert.ok(run('synth.parts.bass.gain.value')>0);
  const before=oscillators.length;
  run("synth.note(69,'chime')");
  assert.deepEqual(oscillators.slice(before).map(o=>Math.round(o.frequency.value)),[440,1214,2376]);
});

test('LCD renders every supported page and mirrors the live canvas when enlarged',()=>{
  const {context,run}=parameterContext();
  let mirrored=0;
  const calls=[];
  const painter=new Proxy({}, {get:(target,key)=>target[key]??((...args)=>{if(key==='fillText')calls.push(args[0]);})});
  const canvas={width:960,height:960,getContext:()=>painter};
  const preview={getContext:()=>({drawImage(input){assert.equal(input,canvas);mirrored++;}})};
  context.$=selector=>({'#device-display':canvas,'#lcd-preview':preview,'#lcd-dialog':{open:true}}[selector]);
  vm.runInContext(segment(app,"const screen=$('#device-display')","const cosmos"),context);
  for(const [level,view,pages] of [[0,'home',1],[0,'arp',2],[1,'seq',3],[1,'fx',3],[1,'env',1],[1,'lfo',1],[1,'edit',1],[1,'global',1],[1,'clear',1],[2,'home',1],[2,'seq',1],[2,'lane',1],[2,'seqsettings',1]]){
    context.level=level;context.state.view=view;
    for(let page=0;page<pages;page++){context.state.page=page;run('drawDevice()');}
  }
  run("lastScreenMessage='WEB FM ALG 02';synth.algorithm=1;drawDevice()");
  assert.ok(mirrored>15);
  for(const label of ['FX  /  DELAY','9000 Hz','Drums','Parallel'])assert.ok(calls.includes(label),label);
});

test('Portrait camera frames the note group above the mission hint',()=>{
  const area={left:16,right:374,top:76,bottom:686};
  const machine={x:195,y:430,width:364};
  const keys=[635.5,785.5,935].map(x=>({x:x-31,y:824,w:62,h:126}));
  const context=vm.createContext({keys,area,machine});
  vm.runInContext(segment(app,'function missionCameraTransform','function positionMissionCamera'),context);
  const shot=vm.runInContext('missionCameraTransform(keys,area,machine)',context);
  const scale=machine.width/1324*shot.zoom;
  assert.ok(62*scale>=47);
  for(const key of keys){
    const x=machine.x+shot.x+(key.x-900)*scale;
    const y=machine.y+shot.y+(key.y-619)*scale;
    assert.ok(x>=area.left&&x+key.w*scale<=area.right);
    assert.ok(y>=area.top&&y+key.h*scale<=area.bottom);
  }
});


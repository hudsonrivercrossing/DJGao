const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const site = name => fs.readFileSync(path.join(__dirname,'../site',name),'utf8');

// A recording AudioContext and a hand-driven clock: enough to see which voices start, at what pitch, with which ramps.
const clock={now:0,next:1,timers:new Map()};
const context=vm.createContext({
  T:(en,zh)=>zh,
  setTimeout:(fn,ms)=>{const id=clock.next++;clock.timers.set(id,{fn,due:clock.now+(ms||0)});return id;},
  clearTimeout:id=>clock.timers.delete(id)
});
vm.runInContext(['audio.js','learning-content.js','dj-score.js','dj-synth.js'].map(site).join('\n'),context);
vm.runInContext(`
function fullWork(seed){const work=djNewWork('hard',seed);work.takes=[0,1,2,3].map(pass=>new Set(djHandTargets(pass,'hard').map(target=>target.id)));return work;}
`,context);
const run=code=>vm.runInContext(code,context);
const mtof=m=>440*2**((m-69)/12);

function fakeContext(){
  const ctx={calls:[],currentTime:0,sampleRate:8000};
  const log=(op,detail)=>ctx.calls.push({op,...detail});
  const param=(name,initial=0)=>{
    const p={value:initial,name};
    for(const op of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime'])
      p[op]=(value,time)=>{log(op,{param:name,value,time});return p;};
    p.cancelScheduledValues=time=>{log('cancelScheduledValues',{param:name,time});return p;};
    return p;
  };
  const node=(kind,extra={})=>{
    const n={kind,connections:[],connect(target){this.connections.push(target);return target;},disconnect(){this.connections=[];},...extra};
    ctx.nodes_.push(n);
    if(kind==='oscillator'||kind==='buffersource'){
      n.started=null;
      n.start=when=>{n.started={kind,when,frequency:n.firstFrequency};log('start',{kind});ctx.started_.push(n.started);};
      n.stop=when=>log('stop',{kind,when});
    }
    return n;
  };
  ctx.started_=[];ctx.nodes_=[];
  ctx.destination=node('destination');
  ctx.createOscillator=()=>{
    const o=node('oscillator',{type:'sine',detune:param('detune'),setPeriodicWave(w){this.wave=w;}});
    const f=param('frequency');
    const set=f.setValueAtTime;
    f.setValueAtTime=(value,time)=>{if(o.firstFrequency===undefined)o.firstFrequency=value;return set(value,time);};
    o.frequency=f;
    return o;
  };
  ctx.createGain=()=>node('gain',{gain:param('gain',1)});
  ctx.createBiquadFilter=()=>node('biquad',{type:'lowpass',frequency:param('frequency'),Q:param('Q')});
  ctx.createBufferSource=()=>node('buffersource',{loop:false});
  ctx.createWaveShaper=()=>node('waveshaper');
  ctx.createDelay=()=>node('delay',{delayTime:param('delayTime')});
  ctx.createPeriodicWave=(re,im)=>({re,im});
  ctx.createDynamicsCompressor=()=>node('compressor',{threshold:param('threshold'),ratio:param('ratio'),knee:param('knee'),attack:param('attack'),release:param('release')});
  ctx.createMediaStreamDestination=()=>node('streamdestination',{stream:{id:'stream'}});
  ctx.createBuffer=(channels,length)=>({getChannelData:()=>new Float32Array(length)});
  ctx.started=kind=>ctx.started_.filter(s=>s.kind===kind);
  ctx.ramps=name=>ctx.calls.filter(c=>c.param===name&&/Ramp/.test(c.op));
  ctx.sets=name=>ctx.calls.filter(c=>c.param===name&&c.op==='setValueAtTime');
  return ctx;
}
// Moves the hand-driven clock forward, running every timer that falls due on the way.
function flush(ctx,ms=120000){
  const end=clock.now+ms;
  for(;;){
    let pick=null;
    for(const [id,t] of clock.timers)if(t.due<=end&&(!pick||t.due<pick.t.due))pick={id,t};
    if(!pick)break;
    clock.timers.delete(pick.id);
    clock.now=Math.max(clock.now,pick.t.due);
    ctx.currentTime=clock.now/1000;
    pick.t.fn();
  }
  clock.now=end;ctx.currentTime=clock.now/1000;
}
const play=(ctx,events,options)=>{context.ctx=ctx;context.events=events;context.options=options;return run('djPlay(ctx,ctx.destination,events,options)');};
const lead=(extra={})=>({time:0,take:1,part:'lead',midi:72,length:.12,velocity:1,voice:'pulse25',...extra});
const reset=()=>{clock.now=0;clock.timers.clear();};

test('A ratchet x3 note starts three voices inside one step',()=>{
  reset();const ctx=fakeContext();
  play(ctx,[lead({ratchet:3})]);flush(ctx);
  assert.equal(ctx.started('oscillator').filter(o=>o.frequency===mtof(72)).length,3);
});
test('A slide ramps the pitch by its semitones',()=>{
  reset();const ctx=fakeContext();
  play(ctx,[lead({take:0,midi:84,length:.28,slide:-30})]);flush(ctx);
  assert.ok(ctx.ramps('frequency').some(r=>Math.abs(r.value-mtof(54))<.01));
});
test('A cents offset detunes the voice',()=>{
  reset();const ctx=fakeContext();
  play(ctx,[lead({voice:'pulse25',cents:12})]);flush(ctx);
  assert.ok(ctx.sets('detune').some(c=>c.value===12));
});
test('Every voice and fx kind used by the timeline schedules without throwing',()=>{
  reset();const ctx=fakeContext();
  assert.doesNotThrow(()=>{context.ctx=ctx;run('djPlay(ctx,ctx.destination,djTimeline(fullWork(1)).events)');flush(ctx);});
  assert.ok(ctx.started('oscillator').length>1000);
  assert.ok(ctx.started('buffersource').length>100);
});
test('stop() cancels pending windows',()=>{
  reset();const ctx=fakeContext();
  context.ctx=ctx;const h=run('djPlay(ctx,ctx.destination,djTimeline(fullWork(1)).events)');
  h.stop();const n=ctx.calls.length;flush(ctx,100);assert.equal(ctx.calls.length,n);
});
test('stop() silences voices it already scheduled',()=>{
  reset();const ctx=fakeContext();
  const h=play(ctx,[lead({length:2})]);
  const before=ctx.calls.filter(c=>c.op==='stop').length;
  h.stop();
  assert.ok(ctx.calls.filter(c=>c.op==='stop').length>before);
});
test('Events are scheduled in 200 ms windows with a 0.6 s look-ahead',()=>{
  reset();const ctx=fakeContext();
  const h=play(ctx,[lead({time:2})]);
  assert.equal(ctx.started('oscillator').length,0);
  flush(ctx,1000);assert.equal(ctx.started('oscillator').length,0);
  flush(ctx,600);assert.equal(ctx.started('oscillator').length,1);
  assert.ok(Math.abs(ctx.started('oscillator')[0].when-(h.startTime+2))<1e-9);
});
test('Velocities above 1 are clamped',()=>{
  reset();const ctx=fakeContext();
  play(ctx,[{time:0,take:1,part:'drums',midi:17,velocity:3,voice:'kick'}]);flush(ctx);
  const peaks=ctx.sets('gain').map(c=>c.value);
  assert.ok(peaks.length>0&&peaks.every(v=>v<=1));
  assert.ok(ctx.sets('gain').some(c=>c.value===.95));
  assert.ok(ctx.ramps('frequency').some(r=>r.value===42));
});
test('Each take sets the playback level from DJ_TAKE_TRIM when it starts',()=>{
  reset();const ctx=fakeContext();
  play(ctx,[lead({time:0,take:0}),lead({time:.1,take:0}),lead({time:2,take:1})]);flush(ctx,3000);
  const master=ctx.calls.filter(c=>c.op==='setValueAtTime'&&c.param==='gain'&&(Math.abs(c.value-.8*run('DJ_TAKE_TRIM[0]'))<1e-9||c.value===.8));
  assert.deepEqual(master.map(c=>+c.value.toFixed(3)),[+(.8*run('DJ_TAKE_TRIM[0]')).toFixed(3),.8]);
  assert.ok(Math.abs(master[1].time-2.15)<.01,'the second take resets the level at its first note');
});
test('from skips earlier events and onEvent fires once per event',()=>{
  reset();const ctx=fakeContext();const seen=[];
  const events=[lead({time:0,midi:60}),lead({time:1,midi:64}),lead({time:2,midi:67})];
  const h=play(ctx,events,{from:1,onEvent:e=>seen.push([e.midi,ctx.currentTime])});
  flush(ctx);
  assert.deepEqual(seen.map(s=>s[0]),[64,67]);
  assert.ok(Math.abs(seen[0][1]-(h.startTime+1))<.02);
  assert.ok(Math.abs(seen[1][1]-(h.startTime+2))<.02);
});
test('An fx event ramps the filter over its length',()=>{
  reset();const ctx=fakeContext();
  const h=play(ctx,[{time:0,take:1,part:'fx',velocity:1,length:2,fx:{target:'filter',type:'lowpass',from:380,to:18000}}]);
  flush(ctx);
  assert.ok(ctx.sets('frequency').some(c=>c.value===380));
  const ramp=ctx.ramps('frequency').find(r=>r.value===18000);
  assert.ok(ramp&&Math.abs(ramp.time-(h.startTime+2))<1e-9);
});
test('Crush and dist fx drive their mix gains',()=>{
  reset();const ctx=fakeContext();
  play(ctx,[
    {time:0,take:2,part:'fx',velocity:1,length:1,fx:{target:'crush',from:0,to:.55,dry:[1,.55]}},
    {time:2,take:2,part:'fx',velocity:1,fx:{target:'dist',from:.35,to:.35,dry:[.8,.8]}}]);
  flush(ctx);
  assert.ok(ctx.ramps('gain').some(r=>r.value===.55));
  assert.ok(ctx.sets('gain').some(c=>c.value===.35));
});
test('djOutput is one cached bus into the site volume and a recording stream',()=>{
  const ctx=fakeContext();context.ctx=ctx;
  const a=run('djOutput(ctx)'),b=run('djOutput(ctx)');
  assert.equal(a,b);
  assert.ok(!a.input.connections.includes(ctx.destination),'never straight to the speakers');
  const trim=a.input.connections.find(n=>n.kind==='gain');
  assert.equal(trim.connections[0],run('siteBus(ctx)'));
  assert.equal(trim.gain.value,run('DJ_OUTPUT_TRIM'));
  assert.ok(a.input.connections.some(n=>n.kind==='streamdestination'));
  assert.equal(a.stream.stream.id,'stream');
});
test('A playback that is never stopped tears its rig down after the last tail',()=>{
  reset();const ctx=fakeContext();
  play(ctx,[lead({time:0}),lead({time:1,length:.5})]);
  const wired=()=>ctx.nodes_.filter(n=>n.connections.includes(ctx.destination)).length;
  flush(ctx,1500);
  assert.equal(wired(),1);
  flush(ctx,2500);
  assert.equal(wired(),0);
  assert.equal(clock.timers.size,0);
});
test('Finished voices are dropped from the playback, so stop() only silences live ones',()=>{
  reset();const ctx=fakeContext();
  const h=play(ctx,[lead({time:0}),lead({time:3.5,length:2}),lead({time:10})]);
  flush(ctx,3600);
  const before=ctx.calls.filter(c=>c.op==='stop').length;
  h.stop();
  assert.equal(ctx.calls.filter(c=>c.op==='stop').length-before,1);
});
test('Starting mid-song first applies the latest filter and mixes before from',()=>{
  reset();const ctx=fakeContext();
  const fx=(time,fx,length)=>({time,take:1,part:'fx',velocity:1,...(length?{length}:{}),fx});
  const h=play(ctx,[
    fx(0,{target:'filter',type:'lowpass',from:380,to:18000},1),
    fx(.5,{target:'crush',from:.3,to:.3,dry:[.6,.6]}),
    fx(1,{target:'filter',type:'lowpass',from:18000,to:600},2),
    fx(2.5,{target:'filter',type:'lowpass',from:900,to:900}),
    lead({time:3})],{from:2});
  const at=h.startTime+2,near=(c,value)=>Math.abs(c.time-at)<1e-9&&Math.abs(c.value-value)<1e-6;
  const mid=18000*(600/18000)**.5;
  assert.ok(ctx.sets('frequency').some(c=>near(c,mid)),'filter resumes its ramp half way');
  assert.ok(ctx.ramps('frequency').some(r=>r.value===600&&Math.abs(r.time-(h.startTime+3))<1e-9));
  assert.ok(ctx.sets('gain').some(c=>near(c,.3)),'crush mix');
  assert.ok(ctx.sets('gain').some(c=>near(c,.6)),'dry mix');
  assert.ok(!ctx.sets('frequency').some(c=>c.value===380),'only the latest filter event applies');
  assert.ok(!ctx.sets('frequency').some(c=>c.value===900&&c.time<h.startTime+2.5-1e-9),'later events wait for their time');
});
test('The echo is a dotted eighth of each take’s tempo',()=>{
  reset();const ctx=fakeContext();
  context.ctx=ctx;
  const h=run('djPlay(ctx,ctx.destination,djTimeline(fullWork(1)).events)');
  flush(ctx);
  const starts=run('djTimeline(fullWork(1)).takeStarts');
  const at=time=>ctx.sets('delayTime').filter(c=>Math.abs(c.time-(h.startTime+time))<1e-6).map(c=>c.value);
  assert.ok(at(starts[0]).some(v=>Math.abs(v-60/96*.75)<1e-3),'take 1: '+at(starts[0]));
  for(const pass of [1,2,3])assert.ok(at(starts[pass]).some(v=>Math.abs(v-60/124*.75)<1e-3),'take '+(pass+1));
  assert.ok(ctx.sets('delayTime').every(c=>c.value>.3));
});

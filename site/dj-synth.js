// The DJ voice engine: plays a DjEvent timeline (dj-score.js) on Web Audio, approximating the
// Baud Girl V102 8-Bit engine. Every sound and its parameters come from the demo the arrangement was approved on.

const djMtof=midi=>440*2**((midi-69)/12);
const djPulseDuty={pulse50:.5,pulse25:.25,pulse125:.125};
const djCaches=new WeakMap();
const djCacheOf=context=>{
  if(!djCaches.has(context))djCaches.set(context,{waves:{},noise:null,output:null});
  return djCaches.get(context);
};

// Song playback is mixed hot (about -14 LUFS). This trim (-5.5 dB) puts it near -20 LUFS at 50% volume,
// level with her keys (audio.js keyTrim). The music box is gentler than the other takes and is lifted by its own trim.
const DJ_OUTPUT_TRIM=.53;
const DJ_TAKE_TRIM=[1.5,1,1,1];
// One bus per context: a compressor into the site's volume (audio.js) that also feeds the share-video
// recorder at full level, whatever the volume is.
function djOutput(context){
  const cache=djCacheOf(context);
  if(cache.output)return cache.output;
  const input=context.createDynamicsCompressor();
  input.threshold.value=-10;input.ratio.value=4;
  const stream=context.createMediaStreamDestination(),trim=context.createGain();
  trim.gain.value=DJ_OUTPUT_TRIM;
  input.connect(trim);trim.connect(siteBus(context));
  input.connect(stream);
  return cache.output={input,stream};
}

function djPulse(context,duty){
  const waves=djCacheOf(context).waves;
  if(waves[duty])return waves[duty];
  const n=64,re=new Float32Array(n),im=new Float32Array(n);
  for(let k=1;k<n;k++)re[k]=2/(k*Math.PI)*Math.sin(k*Math.PI*duty);
  return waves[duty]=context.createPeriodicWave(re,im);
}

function djNoise(context){
  const cache=djCacheOf(context);
  if(cache.noise)return cache.noise;
  const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);
  let x=1;
  for(let i=0;i<data.length;i++){x^=x<<13;x^=x>>17;x^=x<<5;data[i]=((x>>>0)/4294967295)*2-1;}
  return cache.noise=buffer;
}

function djBitCurve(bits){
  const steps=2**bits,curve=new Float32Array(4096);
  for(let i=0;i<4096;i++)curve[i]=Math.round((i/2048-1)*steps)/steps;
  return curve;
}

// The signal path of one playback: music -> filter -> dry / distortion / bitcrush -> master,
// plus a feedback delay and a drum bus that skips the filter.
function djRig(context,destination,state){
  const gain=value=>{const g=context.createGain();g.gain.value=value;return g;};
  const master=gain(.8);master.connect(destination);
  const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=20000;filter.Q.value=.8;
  const music=context.createGain();music.connect(filter);
  const dist=context.createWaveShaper(),curve=new Float32Array(1024);
  for(let i=0;i<1024;i++)curve[i]=Math.tanh((i/512-1)*3);
  dist.curve=curve;
  const distMix=gain(0),dry=gain(1),crusher=context.createWaveShaper(),crushMix=gain(0);
  crusher.curve=djBitCurve(4);
  filter.connect(dry).connect(master);
  filter.connect(dist).connect(distMix).connect(master);
  filter.connect(crusher).connect(crushMix).connect(master);
  const delay=context.createDelay(2),feedback=gain(.38),delayMix=gain(.22);
  delay.connect(feedback).connect(delay);
  delay.connect(delayMix).connect(master);
  const drums=gain(.95);drums.connect(master);
  return {context,state,master,filter,filterType:'lowpass',music,drums,delay,delayMix,dry,distMix,crushMix};
}

// Remembers when each source ends so finished voices can be dropped from the playback.
function djSource(rig,source){
  const stop=source.stop.bind(source);
  source.stop=when=>{source.endsAt=when;stop(when);};
  rig.state.sources.push(source);
  return source;
}

function djEnvelope(g,t,peak,a,d,s,rel,length){
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(peak,t+a);
  g.gain.exponentialRampToValueAtTime(Math.max(peak*s,.0005),t+a+d);
  if(length)g.gain.setTargetAtTime(0,t+length,rel);
}

// A pitched voice. `wave` is 'tri' or a pulse duty; `slide` bends the pitch by semitones over the note.
function djTone(rig,t,midi,length,{wave=.25,gain=.18,a=.004,d=.12,s=.6,rel=.06,slide=0,vib=0,send=.25,cents=0,bus}={}){
  const context=rig.context,o=djSource(rig,context.createOscillator()),g=context.createGain();
  if(wave==='tri')o.type='triangle';else o.setPeriodicWave(djPulse(context,wave));
  o.frequency.setValueAtTime(djMtof(midi),t);
  if(slide)o.frequency.exponentialRampToValueAtTime(djMtof(midi+slide),t+length);
  if(cents)o.detune.setValueAtTime(cents,t);
  if(vib){
    const lfo=djSource(rig,context.createOscillator()),depth=context.createGain();
    lfo.frequency.value=5.5;depth.gain.value=djMtof(midi)*vib;
    lfo.connect(depth).connect(o.frequency);lfo.start(t+.12);lfo.stop(t+length+.3);
  }
  djEnvelope(g,t,gain,a,d,s,rel,length);
  o.connect(g).connect(bus||rig.music);
  if(send){const sg=context.createGain();sg.gain.value=send;g.connect(sg).connect(rig.delay);}
  o.start(t);o.stop(t+length+.4);
}

function djNoiseHit(rig,t,length,{type='highpass',f=7000,q=.7,gain=.2,a=.001,sweep=0}={}){
  const context=rig.context,s=djSource(rig,context.createBufferSource()),filter=context.createBiquadFilter(),g=context.createGain();
  s.buffer=djNoise(context);s.loop=true;
  filter.type=type;filter.frequency.setValueAtTime(f,t);filter.Q.value=q;
  if(sweep)filter.frequency.exponentialRampToValueAtTime(sweep,t+length);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(gain,t+a);
  g.gain.exponentialRampToValueAtTime(.0005,t+length);
  s.connect(filter).connect(g).connect(rig.drums);
  s.start(t,Math.random());s.stop(t+length+.05);
}

function djDrumTone(rig,t,from,to,over,peak,length,end){
  const o=djSource(rig,rig.context.createOscillator()),g=rig.context.createGain();
  o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+over);
  g.gain.setValueAtTime(peak,t);g.gain.exponentialRampToValueAtTime(.001,t+length);
  o.connect(g).connect(rig.drums);o.start(t);o.stop(t+end);
}

function djHey(rig,t,v){
  const context=rig.context;
  for(const [f,gain] of [[560,.5],[1850,.32]]){
    const o=djSource(rig,context.createOscillator()),band=context.createBiquadFilter(),g=context.createGain();
    o.setPeriodicWave(djPulse(context,.25));
    o.frequency.setValueAtTime(240,t);o.frequency.linearRampToValueAtTime(205,t+.22);
    band.type='bandpass';band.frequency.value=f;band.Q.value=6;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain*v,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.26);
    o.connect(band).connect(g).connect(rig.drums);o.start(t);o.stop(t+.3);
  }
  djNoiseHit(rig,t,.05,{type:'bandpass',f:3200,gain:.15*v});
}

const djSfxTone=(rig,t,midi,length,options)=>djTone(rig,t,midi,length,{wave:.5,s:1,send:0,bus:rig.drums,...options});

// Drum-slot and effect voices. Each gets (rig, time, velocity, event).
const djHits={
  kick:(r,t,v)=>djDrumTone(r,t,150,42,.12,.95*v,.32,.35),
  snare:(r,t,v)=>{djNoiseHit(r,t,.16,{type:'bandpass',f:2200,q:.6,gain:.42*v});djDrumTone(r,t,220,140,.08,.25*v,.1,.12);},
  clap:(r,t,v)=>{for(const o of [0,.011,.022])djNoiseHit(r,t+o,.09,{type:'bandpass',f:1500,q:1.4,gain:.32*v});djNoiseHit(r,t+.03,.22,{type:'bandpass',f:1300,q:1,gain:.12*v});},
  hat:(r,t,v)=>djNoiseHit(r,t,.04,{f:8500,gain:.11*v}),
  open:(r,t,v)=>djNoiseHit(r,t,.2,{f:7500,gain:.12*v}),
  crash:(r,t,v)=>djNoiseHit(r,t,1.4,{f:5200,gain:.16*v}),
  riser:(r,t,v,e)=>{const length=e.length||1;djNoiseHit(r,t,length,{type:'bandpass',f:400,sweep:9000,q:2,gain:.16*v,a:length*.9});},
  blow:(r,t,v)=>djNoiseHit(r,t,.7,{type:'bandpass',f:5000,sweep:300,q:1.2,gain:.28*v,a:.05}),
  hey:djHey,
  click:(r,t,v,e)=>djNoiseHit(r,t,.025,{type:'bandpass',f:e.params?.f||3200,q:3,gain:.12*v}),
  applause:(r,t,v,e)=>djNoiseHit(r,t,.05,{type:'bandpass',f:e.params?.f||3000,q:.9,gain:.11*v}),
  coin:(r,t,v,e)=>{
    if(e.params?.pitch)return djSfxTone(r,t,e.params.pitch,.12,{gain:.13*v,d:.1,s:.3,send:.3});
    djSfxTone(r,t,83,.06,{gain:.12*v,d:.05});djSfxTone(r,t+.06,88,.22,{gain:.12*v,d:.2,s:.2,send:.2});
  },
  jump:(r,t,v)=>djSfxTone(r,t,60,.18,{gain:.12*v,d:.18,s:.6,slide:14,send:.15}),
  oneUp:(r,t,v)=>[76,79,88,84,86,91].forEach((m,i)=>djSfxTone(r,t+i*.075,m,.08,{gain:.11*v,d:.07,send:.2})),
  powerUp:(r,t,v)=>{for(let i=0;i<12;i++)djSfxTone(r,t+i*.03,60+i*2+(i%2)*7,.04,{gain:.09*v,d:.03});},
  horn:(r,t,v)=>{
    djTone(r,t,67,.55,{wave:.125,gain:.14*v,a:.02,d:.5,s:.9,slide:5,vib:.012,send:.3,bus:r.drums});
    djTone(r,t,74,.55,{wave:.25,gain:.08*v,a:.02,d:.5,s:.9,slide:5,send:0,bus:r.drums});
  },
  fall:(r,t,v)=>djSfxTone(r,t,96,.9,{gain:.1*v,d:.9,s:.5,slide:-48,send:.4})
};

// An fx event automates the shared filter, dry mix, distortion, bitcrush or delay over `length`.
function djAutomate(rig,time,event){
  const {fx,length=0}=event,now=rig.context.currentTime;
  const ramp=(param,from,to,linear)=>{
    if(from!==undefined)param.setValueAtTime(from,time);
    if(length&&to!==undefined&&to!==from){
      if(from===undefined)param.setValueAtTime(param.value,time);
      linear?param.linearRampToValueAtTime(to,time+length):param.exponentialRampToValueAtTime(to,time+length);
    }else if(to!==undefined&&to!==from)param.setValueAtTime(to,time);
  };
  const cancel=param=>param.cancelScheduledValues(time);
  if(fx.target==='filter'){
    const filter=rig.filter;
    if(fx.type&&fx.type!==rig.filterType){
      const type=fx.type;rig.filterType=type;
      // The filter type cannot be scheduled, so switch it when the event's time arrives.
      const wait=(time-now)*1000;
      if(wait>5)djLater(rig.state,()=>{filter.type=type;},wait);else filter.type=type;
    }
    cancel(filter.frequency);
    filter.frequency.setValueAtTime(fx.from,time);
    if(length&&fx.to!==fx.from)filter.frequency.exponentialRampToValueAtTime(fx.to,time+length);
    else filter.frequency.setValueAtTime(fx.to,time);
    return;
  }
  const mix=fx.target==='crush'?rig.crushMix:fx.target==='dist'?rig.distMix:null;
  if(mix){
    cancel(mix.gain);ramp(mix.gain,fx.from,fx.to,true);
    if(fx.dry){cancel(rig.dry.gain);ramp(rig.dry.gain,fx.dry[0],fx.dry[1],true);}
    return;
  }
  if(fx.target==='delay'){
    if(fx.seconds)rig.delay.delayTime.setValueAtTime(fx.seconds,time);
    cancel(rig.delayMix.gain);
    if(fx.from!==undefined)ramp(rig.delayMix.gain,fx.from,fx.to,true);
    else rig.delayMix.gain.setTargetAtTime(fx.to,time,length?length/3:.05);
  }
}

// An fx event as it stands at timeline second `at`: a finished ramp settles on its end
// values; a ramp still running resumes from where it would be.
function djSettle(event,at){
  const {fx,length=0}=event,done=length?Math.min(1,(at-event.time)/length):1;
  const mid=(from,to,exponential)=>from===undefined?to:exponential?from*(to/from)**done:from+(to-from)*done;
  const settled={...fx,from:mid(fx.from,fx.to,fx.target==='filter')};
  if(fx.dry)settled.dry=[mid(fx.dry[0],fx.dry[1]),fx.dry[1]];
  return {...event,fx:settled,length:done<1?length*(1-done):0};
}

function djLater(state,fn,ms){
  const id=setTimeout(fn,Math.max(0,ms));
  state.timers.push(id);
  return id;
}

function djVoice(rig,event,time){
  const velocity=Math.min(1,event.velocity??1),slot=event.voice;
  if(event.part==='fx'){djAutomate(rig,time,event);return;}
  const hit=djHits[slot];
  if(event.part==='drums'||event.part==='sfx'){
    if(!hit)return;
    const n=event.ratchet>1?event.ratchet:1,gap=n>1?(event.length||.1)/n:0;
    for(let k=0;k<n;k++)hit(rig,time+k*gap,velocity,event);
    return;
  }
  const wave=slot==='tri'?'tri':djPulseDuty[slot];
  if(wave===undefined)return;
  const env=event.env||{},n=event.ratchet>1?event.ratchet:1,gap=event.length/n;
  const options={wave,gain:.24*velocity,...env,slide:event.slide||0,cents:event.cents||0};
  const length=n>1?gap*(event.gate||.9):event.length;
  for(let k=0;k<n;k++)djTone(rig,time+k*gap,event.midi,length,options);
}

// Schedules `events` in 200 ms windows, 0.6 s ahead of the audio clock. `from` is a timeline second.
// Once the last event's tail has passed, the rig tears itself down as stop() would.
function djPlay(context,destination,events,{from=0,onEvent}={}){
  const state={timers:[],sources:[],stopped:false};
  const rig=djRig(context,destination,state);
  const startTime=context.currentTime+.15-from;
  let index=events.findIndex(event=>event.time>=from-.001);
  if(index<0)index=events.length;
  // Starting mid-song: the filter and mixes are where the earlier fx events left them.
  if(from>0){
    const latest={};
    for(const event of events.slice(0,index))if(event.part==='fx')latest[event.fx.target]=event;
    for(const event of Object.values(latest))djAutomate(rig,startTime+from,djSettle(event,from));
  }
  const end=events.slice(index).reduce((last,event)=>Math.max(last,event.time+(event.length||0)),from);
  const stop=()=>{
    if(state.stopped)return;
    state.stopped=true;
    state.timers.forEach(id=>clearTimeout(id));
    const now=context.currentTime;
    state.sources.forEach(source=>{try{source.stop(now);}catch(error){}});
    rig.master.gain.cancelScheduledValues(now);
    rig.master.gain.setValueAtTime(0,now);
    rig.master.disconnect();
  };
  const pump=()=>{
    if(state.stopped)return;
    state.sources=state.sources.filter(source=>!(source.endsAt<context.currentTime));
    const horizon=context.currentTime+.6;
    while(index<events.length&&startTime+events[index].time<horizon){
      const event=events[index++],time=Math.max(context.currentTime,startTime+event.time);
      if(event.take!==rig.take&&DJ_TAKE_TRIM[event.take]){rig.take=event.take;rig.master.gain.setValueAtTime(.8*DJ_TAKE_TRIM[event.take],time);}
      djVoice(rig,event,time);
      if(onEvent)djLater(state,()=>{if(!state.stopped)onEvent(event);},(time-context.currentTime)*1000);
    }
    if(index<events.length)djLater(state,pump,200);
    else djLater(state,stop,(startTime+end+2-context.currentTime)*1000);
  };
  pump();
  return {startTime,stop};
}

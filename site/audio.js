const fmAlgorithms=[
  {name:'Stack',routes:[['X','M'],['M','C'],['C','OUT']],layout:{X:[104,239],M:[212,239],C:[320,239],OUT:[417,239]}},
  {name:'Parallel',routes:[['X','C'],['M','C'],['C','OUT']],layout:{X:[104,204],M:[104,277],C:[281,239],OUT:[417,239]}},
  {name:'Two carriers',routes:[['M','C'],['C','OUT'],['X','OUT']],layout:{M:[104,204],C:[237,204],X:[237,277],OUT:[417,239]}},
  {name:'Deep stack',routes:[['M','C'],['C','X'],['X','OUT']],layout:{M:[104,239],C:[212,239],X:[320,239],OUT:[417,239]}}
];

// The site's one output. Every sound (keys, song playback, the intro, firmware mode) reaches the speakers
// through a volume gain and a safety limiter on its context. Volume v in [0,1] gives gain 2v: 50% is unity.
// The limiter's compressor lets a fast transient overshoot by a dB or so; the clipper after it is a straight
// line up to -3 dBFS and bends smoothly into a -1 dBFS ceiling.
const SITE_CEILING=10**(-1/20),SITE_KNEE=10**(-3/20);
let siteClipCurve=null;
function siteClip(){
  if(siteClipCurve)return siteClipCurve;
  const curve=new Float32Array(8193),room=SITE_CEILING-SITE_KNEE;
  for(let i=0;i<curve.length;i++){
    const x=i/4096-1,a=Math.abs(x);
    curve[i]=Math.sign(x)*(a<=SITE_KNEE?a:SITE_KNEE+room*Math.tanh((a-SITE_KNEE)/room));
  }
  return siteClipCurve=curve;
}
const SITE_SOUND_KEY='djgao-volume-v1';
const siteSound={level:.5,muted:false,buses:new Set()};
try{
  const saved=JSON.parse(localStorage.getItem(SITE_SOUND_KEY)||'{}');
  if(Number.isFinite(saved.level))siteSound.level=Math.max(0,Math.min(1,saved.level));
  siteSound.muted=saved.muted===true;
}catch{}
const siteGain=()=>siteSound.muted?0:2*siteSound.level;

// The volume input on `context`, made on first use.
function siteBus(context){
  for(const bus of siteSound.buses)if(bus.context===context)return bus.gain;
  const gain=context.createGain(),limiter=context.createDynamicsCompressor(),clipper=context.createWaveShaper();
  gain.gain.value=siteGain();
  limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.1;
  clipper.curve=siteClip();
  gain.connect(limiter);limiter.connect(clipper);clipper.connect(context.destination);
  siteSound.buses.add({context,gain,limiter,clipper});
  return gain;
}

// Sets the level (0–1) and/or mute, ramps every live bus there and remembers it.
function setSiteSound({level=siteSound.level,muted=siteSound.muted}={}){
  siteSound.level=Math.max(0,Math.min(1,level));
  siteSound.muted=muted;
  for(const bus of siteSound.buses){
    if(bus.context.state==='closed'){siteSound.buses.delete(bus);continue;}
    bus.gain.gain.setTargetAtTime(siteGain(),bus.context.currentTime,.03);
  }
  try{localStorage.setItem(SITE_SOUND_KEY,JSON.stringify({level:siteSound.level,muted:siteSound.muted}))}catch{}
}

// Unmuting brings back the last level, or 50% when that was too quiet to hear.
function unmuteSite(){setSiteSound({level:siteSound.level>=.1?siteSound.level:.5,muted:false});}

class SoundLabSynth {
  constructor() {
    this.context = null;
    this.voices = new Set();
    this.volume = .55;
    this.cutoff = 9000;
    this.resonance = 5;
    this.filterMode = 0;
    this.filterEnabled = true;
    this.delay = .16;
    this.delayMs = 240;
    this.delayFeedback = .24;
    this.delayEnabled = true;
    this.drive = .08;
    this.driveTone = 6500;
    this.driveLevel = 1;
    this.driveEnabled = true;
    this.attack = .012;
    this.decay = .45;
    this.sustain = .38;
    this.releaseTime = .35;
    this.fmIndex = 1.5;
    this.ratio = 2;
    this.algorithm = 0;
    this.preset = 0;
    this.lfoRate = 3;
    this.lfoAmount = 0;
    this.lfoWave = 0;
    this.lfoAmp = 0;
    this.drumsLevel = 82;
    this.bassLevel = 86;
    this.leadLevel = 75;
    // dB after the synth's compressor, so her keys sit near -20 LUFS at 50% volume (finale.js sets one per take).
    this.keyTrim = 2.5;
  }
  get muted(){return siteSound.muted;}
  set muted(on){if(on)setSiteSound({muted:true});else unmuteSite();}
  async wake() {
    if(!this.context) {
      const c=this.context=new (window.AudioContext||window.webkitAudioContext)();
      this.input=c.createGain(); this.filter=c.createBiquadFilter(); this.filter.type='lowpass';
      this.shaper=c.createWaveShaper(); this.tone=c.createBiquadFilter(); this.tone.type='lowpass'; this.driveGain=c.createGain(); this.master=c.createGain(); this.compressor=c.createDynamicsCompressor();
      this.compressor.threshold.value=-14; this.compressor.ratio.value=5; this.compressor.attack.value=.006;
      this.filterWet=c.createGain(); this.filterDry=c.createGain();
      this.tremolo=c.createGain(); this.input.connect(this.tremolo);
      this.tremolo.connect(this.filter); this.filter.connect(this.filterWet); this.filterWet.connect(this.shaper);
      this.tremolo.connect(this.filterDry); this.filterDry.connect(this.shaper);
      this.shaper.connect(this.tone); this.tone.connect(this.driveGain); this.driveGain.connect(this.master); this.master.connect(this.compressor); this.keyGain=c.createGain(); this.compressor.connect(this.keyGain); this.keyGain.connect(siteBus(c));
      this.echo=c.createDelay(1); this.echo.delayTime.value=.24; this.feedback=c.createGain(); this.feedback.gain.value=.24; this.echoMix=c.createGain();
      this.driveGain.connect(this.echo); this.echo.connect(this.feedback); this.feedback.connect(this.echo); this.echo.connect(this.echoMix); this.echoMix.connect(this.master);
      this.parts={drums:c.createGain(),bass:c.createGain(),lead:c.createGain()};
      Object.values(this.parts).forEach(part=>part.connect(this.input));
      this.analyser=c.createAnalyser(); this.analyser.fftSize=1024; this.compressor.connect(this.analyser); this.samples=new Uint8Array(1024);
      this.lfo=c.createOscillator(); this.lfoDepth=c.createGain(); this.lfo.connect(this.lfoDepth);
      this.lfoAmplitude=c.createGain(); this.lfo.connect(this.lfoAmplitude); this.lfoAmplitude.connect(this.tremolo.gain);
      this.lfo.start(); this.update();
    }
    if(this.context.state!=='running')await this.context.resume();
  }
  update() {
    if(!this.context)return; const t=this.context.currentTime;
    this.master.gain.setTargetAtTime(this.volume*.42,t,.025);
    this.keyGain.gain.setTargetAtTime(10**(this.keyTrim/20),t,.025);
    this.filter.type=['lowpass','bandpass','highpass'][this.filterMode];
    this.filter.frequency.setTargetAtTime(this.cutoff,t,.025);
    this.filter.Q.setTargetAtTime(this.resonance/100*18,t,.025);
    this.filterWet.gain.setTargetAtTime(this.filterEnabled?1:0,t,.025);
    this.filterDry.gain.setTargetAtTime(this.filterEnabled?0:1,t,.025);
    this.echo.delayTime.setTargetAtTime(this.delayMs/1000,t,.025);
    this.feedback.gain.setTargetAtTime(this.delayFeedback,t,.025);
    this.echoMix.gain.setTargetAtTime(this.delayEnabled?this.delay:0,t,.025);
    this.tone.frequency.setTargetAtTime(this.driveEnabled?this.driveTone:20000,t,.025);
    this.driveGain.gain.setTargetAtTime(this.driveEnabled?this.driveLevel:1,t,.025);
    this.lfo.type=['sine','triangle','sawtooth','square'][this.lfoWave];
    this.lfo.frequency.setTargetAtTime(this.lfoRate,t,.025);
    this.lfoDepth.gain.setTargetAtTime(this.lfoAmount,t,.025);
    const amplitudeDepth=this.lfoAmp/100*.45;
    this.tremolo.gain.setTargetAtTime(1-amplitudeDepth,t,.025);
    this.lfoAmplitude.gain.setTargetAtTime(amplitudeDepth,t,.025);
    for (const [name,part] of Object.entries(this.parts)) part.gain.setTargetAtTime(this[name+'Level']/99,t,.025);
    const drive=this.driveEnabled?this.drive:0;
    if(this.lastDrive!==drive){
      this.lastDrive=drive;
      const amount=drive*35,curve=new Float32Array(512);
      for(let i=0;i<curve.length;i++){
        const x=i*2/(curve.length-1)-1;
        curve[i]=amount?Math.tanh(x*(1+amount))/Math.tanh(1+amount):x;
      }
      this.shaper.curve=curve;this.shaper.oversample='2x';
    }
  }
  note(midi,kind='fm',duration=null,velocity=1) {
    if(!this.context)return null; if(this.voices.size>=24)this.voices.values().next().value.release(.025);
    const c=this.context,t=c.currentTime,frequency=440*2**((midi-69)/12),amp=c.createGain(),oscillators=[],nodes=[];
    const strength=Math.max(.05,Math.min(1.3,velocity)),peak=.13*strength,attack=Math.max(.005,this.attack);
    amp.gain.setValueAtTime(.0001,t);
    amp.gain.exponentialRampToValueAtTime(peak,t+attack);
    const lead=['chip','pulse25','pulse125','triangle'].includes(kind);
    amp.gain.exponentialRampToValueAtTime(Math.max(.005*strength,peak*this.sustain),t+attack+this.decay); amp.connect(kind==='bass'?this.parts.bass:lead?this.parts.lead:this.input);
    const make=(ratio,type='sine')=>{const o=c.createOscillator();o.type=type;o.frequency.value=frequency*ratio;this.lfoDepth.connect(o.detune);oscillators.push(o);return o};
    if(kind==='fm') {
      const [carrierRatio,modRatio,extraRatio]=[[1,this.ratio,3],[1,this.ratio+.5,5],[1,this.ratio*Math.SQRT2,2],[.5,this.ratio,7]][this.algorithm];
      for(let branch=0;branch<2;branch++){
        const carrier=make(carrierRatio*(branch?1.003:1)),mod=make(modRatio*(branch?1.5:1)),mod2=make(extraRatio);
        const depth=c.createGain(),depth2=c.createGain(),level=c.createGain();
        const color=[1,1.7,.6,2.5,1.1][this.preset%5];
        depth.gain.setValueAtTime(frequency*this.fmIndex*color,t); depth.gain.exponentialRampToValueAtTime(Math.max(1,frequency*this.fmIndex*.14),t+.7);
        depth2.gain.value=frequency*this.fmIndex*.24; level.gain.value=branch?.33:.66;
        const operators={M:mod,C:carrier,X:mod2};
        for(const [from,to] of fmAlgorithms[this.algorithm].routes){
          if(to==='OUT'){operators[from].connect(level);continue;}
          const modulation=from==='M'?depth:depth2;
          operators[from].connect(modulation);
          modulation.connect(operators[to].frequency);
        }
        level.connect(amp);nodes.push(depth,depth2,level);
      }
    } else if(kind==='chime'){
      for(const [ratio,volume,decay] of [[1,.82,1.1],[2.76,.19,.28],[5.4,.065,.12]]){
        const partial=make(ratio),envelope=c.createGain();
        envelope.gain.setValueAtTime(volume,t);
        envelope.gain.exponentialRampToValueAtTime(.0001,t+decay);
        partial.connect(envelope);
        envelope.connect(amp);
        nodes.push(envelope);
      }
    } else {
      const carrier=make(1,kind==='bass'||kind==='triangle'?'triangle':'square');
      const duty={pulse25:.25,pulse125:.125}[kind];
      if(duty){
        this.pulseWaves??={};
        if(!this.pulseWaves[kind]){
          const harmonics=new Float32Array(48);
          for(let n=1;n<harmonics.length;n++)harmonics[n]=2*Math.sin(Math.PI*n*duty)/(Math.PI*n);
          this.pulseWaves[kind]=c.createPeriodicWave(harmonics,new Float32Array(harmonics.length));
        }
        carrier.setPeriodicWave(this.pulseWaves[kind]);
      }
      const level=c.createGain();level.gain.value=kind==='bass'?.9:.35;carrier.connect(level);level.connect(amp);nodes.push(level);
      if(kind==='bass'){const sub=make(.5,'sine'),g=c.createGain();g.gain.value=.3;sub.connect(g);g.connect(amp);nodes.push(g)}
    }
    oscillators.forEach(o=>o.start(t));
    let released=false,releaseTimer;
    const voice={midi,release:(seconds=this.releaseTime)=>{if(released)return;released=true;clearTimeout(releaseTimer);const end=c.currentTime+Math.max(.025,seconds);amp.gain.cancelAndHoldAtTime(c.currentTime);amp.gain.exponentialRampToValueAtTime(.0001,end);oscillators.forEach(o=>o.stop(end+.02));this.voices.delete(voice);setTimeout(()=>{oscillators.forEach(o=>{this.lfoDepth.disconnect(o.detune);o.disconnect()});nodes.forEach(n=>n.disconnect());amp.disconnect()},Math.max(.025,seconds)*1000+80)}};
    this.voices.add(voice);if(duration!==null)releaseTimer=setTimeout(()=>voice.release(Math.min(this.releaseTime,.24)),duration*1000);return voice;
  }
  drum(index,velocity=1) {
    if(!this.context)return; const c=this.context,t=c.currentTime,amp=c.createGain();amp.connect(this.parts.drums);
    const snare=index%4===1,hat=index%4>=2; amp.gain.setValueAtTime(Math.max(.001,(hat?.1:snare?.22:.45)*velocity),t);amp.gain.exponentialRampToValueAtTime(.0001,t+(hat?.055:.19));
    if(snare||hat){const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.2),c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const source=c.createBufferSource(),filter=c.createBiquadFilter();filter.type='highpass';filter.frequency.value=hat?6500:1700;source.buffer=buffer;source.connect(filter);filter.connect(amp);source.start();source.stop(t+.2);source.onended=()=>{source.disconnect();filter.disconnect();amp.disconnect()};}
    else{const o=c.createOscillator();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(42,t+.16);o.connect(amp);o.start();o.stop(t+.21);o.onended=()=>{o.disconnect();amp.disconnect()};}
  }
  gameEffect(midi){
    const contour={29:[990,1320],30:[230,330,480,720],34:[440,550,660,880,1100,1320]}[midi];
    if(!this.context||!contour)return null;
    const c=this.context,t=c.currentTime,oscillator=c.createOscillator(),gain=c.createGain();
    const interval=midi===34?.041:.042;
    oscillator.type='square';
    contour.forEach((hz,index)=>oscillator.frequency.setValueAtTime(hz,t+index*interval));
    gain.gain.setValueAtTime(.065,t);
    gain.gain.exponentialRampToValueAtTime(.0001,t+interval*contour.length+.04);
    oscillator.connect(gain).connect(this.parts.lead);
    oscillator.start(t);
    oscillator.stop(t+interval*contour.length+.045);
    const voice={release:(seconds=.02)=>{gain.gain.cancelAndHoldAtTime(c.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+seconds);}};
    this.voices.add(voice);
    oscillator.onended=()=>{this.voices.delete(voice);oscillator.disconnect();gain.disconnect();};
    return null;
  }
  allOff(){[...this.voices].forEach(v=>v.release(.05));}
}

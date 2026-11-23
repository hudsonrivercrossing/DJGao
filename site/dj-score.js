// The four-take DJ birthday set, ported from the compose() of the demo the arrangement was approved on.
//
// Events (DjEvent) carry the sounding pitch in `midi` for lead and bass, the kit slot in
// `midi` for drums (F0 = 17…) and SFX (F1 = 29…). `key` is the physical key that makes the
// sound on the V102 panel at the guide's OCT. Tonal `velocity` × 0.24 is the demo's gain.
// A ratchet splits `length` into evenly spaced hits; `gate` is how much of each hit sounds.
// `via` marks notes the machine generates from a pressed key (arpeggio, Auto-Chord, doubles).
// `chance` is the declared probability of an event that was drawn in.
//
// Hand targets carry the note written into the pattern in `midi`; the key she presses is
// `midi - octave*12`. The 8-Bit lead sounds one octave below the written note, so lead
// targets are written one octave above their sound. Only the drop melody (`2:mel`) sounds
// as written: its preset sets Lead Octave +1. Pitched targets carry the pitch they sound
// in `sound`, read from the hand's main (non-`via`) event, or the written note when the
// machine generates every sound from the key (arpeggio bass).

const djHouseStep=60/124/4,djEncoreStep=60/124/6,djBoxBeat=60/96;
const djDrumSlots={kick:17,snare:18,hat:19,clap:20,open:21,crash:22,riser:23,hey:24,blow:25,click:26,applause:27};
const djEffectSlots={coin:29,jump:30,oneUp:31,fall:32,horn:33,powerUp:34};
const djDrumTitles={clap:['Clap','拍掌'],open:['Open hat','开镲'],snare:['Snare','军鼓'],hey:['HEY','HEY']};
const djWaveVoices={'Triangle':'tri','Pulse 50':'pulse50','Pulse 25':'pulse25','Pulse 12.5':'pulse125'};
const djNoteNames=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const djChords={C:[48,[60,64,67]],G:[43,[59,62,67]],G7:[43,[59,62,65]],C7:[48,[58,64,67]],F:[41,[60,65,69]],D:[50,[62,66,69]],A:[45,[61,64,69]],A7:[45,[61,64,67]],D7:[50,[60,66,69]],G2:[43,[59,62,67]]};
// The 4/4 house remix of the melody: [bar, step, length in steps, pitch in C].
const djRemix=[[0,12,2,67],[0,14,2,67],
  [1,0,4,69],[1,4,4,67],[1,8,6,72],
  [2,0,8,71],[2,12,2,67],[2,14,2,67],
  [3,0,4,69],[3,4,4,67],[3,8,6,74],
  [4,0,8,72],[4,12,2,67],[4,14,2,67],
  [5,0,4,79],[5,4,4,76],[5,8,4,72],[5,12,4,71],
  [6,0,8,69],[6,12,2,77],[6,14,2,77],
  [7,0,4,76],[7,4,4,72],[7,8,8,74],
  [8,0,8,72]];
const djEncoreKeys=[2,4,6,9];

function djRandom(seed){
  let a=seed>>>0;
  return ()=>{
    a=(a+0x6D2B79F5)>>>0;
    let t=a;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

const djNoteName=midi=>djNoteNames[((midi%12)+12)%12]+(Math.floor(midi/12)-1);
const djRound=value=>Math.round(value*1e6)/1e6;
const djPhraseOf=index=>index<6?1:index<12?2:index<19?3:4;

function djFitOctave(low,high,preferred){
  const fits=[-3,-2,-1,0,1,2,3].filter(octave=>low-octave*12>=53&&high-octave*12<=79);
  if(!fits.length)return null;
  return fits.reduce((best,octave)=>Math.abs(octave-preferred)<Math.abs(best-preferred)?octave:best);
}

// `declared`: every Chance draw comes up true, so each Chance event exists once whatever the
// seed (the hardware export rolls them on the FM-1). The draw still takes its random number.
function djComposer(rng,declared=false){
  const b={events:[],hands:[],sections:[],rng,length:0};
  let into=b.events;
  const push=event=>{into.push(event);return event;};
  b.tone=(time,part,midi,length,voice,gain,env={},extra={})=>push({time,part,midi,length,velocity:Math.round(gain/.24*1000)/1000,voice,...(Object.keys(env).length?{env}:{}),...extra});
  b.drum=(time,name,velocity=1,extra={})=>push({time,part:'drums',midi:djDrumSlots[name],velocity,voice:name,...extra});
  b.sfx=(time,name,extra={})=>push({time,part:'sfx',midi:djEffectSlots[name],velocity:1,voice:name,...extra});
  b.fx=(time,fx,length=0)=>push({time,part:'fx',velocity:1,...(length?{length}:{}),fx});
  b.draw=chance=>rng()<chance||declared;
  b.section=(id,start,title)=>b.sections.push({id,start,title});
  // A hand target: the events emitted inside `emit` exist only once she records `def.id`
  // (or, in standard mode, when the target belongs to hard mode and the guide places it).
  b.hand=(def,emit)=>{
    const outer=into;into=[];emit();
    b.hands.push({...def,events:into});
    into=outer;
  };
  return b;
}

// ===== Take 1 · Music box (3/4, 96 BPM) =====
function djComposeMusicBox(b){
  const spb=djBoxBeat,third={67:64,69:65,72:69,71:67,74:71,79:76,76:72,77:74};
  let t=.05;
  b.section('windup',0,['Wind-up','上发条']);
  [0,.28,.5,.68,.82,.93,1.02,1.1].forEach((offset,i)=>b.drum(t+offset,'click',1,{params:{f:3200+i*300}}));
  b.tone(t+1.22,'lead',96,.5,'tri',.05,{d:.45,s:.1,send:.5});
  t+=1.4;
  const t0=t;
  b.section('musicbox',t0,['Music box solo','八音盒独奏']);
  let beat=0;
  birthdayMelody.forEach(([m,l],i)=>{
    const time=t0+beat*spb,step=beat*4,phrase=djPhraseOf(i);
    b.hand({id:'0:mel:'+i,layer:'mel',mode:'standard',part:'lead',step,midi:m+24,length:l*4,phrase,
      title:['Phrase '+phrase+' / 4 · Play '+djNoteName(m+24),'第 '+phrase+' / 4 句 · 弹 '+djNoteName(m+24)]},()=>{
      b.tone(time,'lead',m+12,l*spb*.9,'tri',.24,{d:.5,s:.25,send:.3});
      b.tone(time,'lead',m+36,.12,'tri',.035,{d:.1,s:.1,send:.5},{via:'double'});
    });
    if(i>=13){
      const h=third[m];
      b.hand({id:'0:harm:'+i,layer:'harm',mode:'hard',part:'lead',step,midi:h+24,length:l*4,
        title:['Harmony · step '+(step+1)+' · Play '+djNoteName(h+24),'和声 · 第 '+(step+1)+' 格 · 弹 '+djNoteName(h+24)]},
        ()=>b.tone(time,'lead',h+12,l*spb*.85,'tri',.1,{d:.5,s:.25,send:.25}));
    }
    beat+=l;
  });
  const C=djChords;
  [C.C,C.G,C.G7,C.C,C.C,C.F,C.C,C.C].forEach(([root,chord],i)=>{
    const time=t0+(1+i*3)*spb;
    b.tone(time,'bass',root,spb*2.6,'tri',.16,{d:.6,s:.3,send:0});
    chord.forEach(n=>b.tone(time+spb,'bass',n,.18,'tri',.035,{d:.15,s:.2,send:.2}));
    chord.forEach(n=>b.tone(time+2*spb,'bass',n,.18,'tri',.03,{d:.15,s:.2,send:.2}));
  });
  t=t0+25*spb;
  b.section('horn',t,['Party horn + scratch','派对喇叭 + 搓碟']);
  b.sfx(t,'horn');
  b.drum(t+.45,'hey');
  b.tone(t+.62,'lead',84,.28,'pulse25',.14,{d:.28,s:1,send:.3},{slide:-30});
  b.length=t+1.1;
}

// ===== Take 2 · House party (4/4, 124 BPM) =====
function djComposeHouse(b){
  const st=djHouseStep,bar=i=>i*16*st,C=djChords;
  const chords=[C.C,C.C,C.C,C.G,C.G7,C.C,C.C7,C.F,C.G7,C.C];
  b.section('house-intro',0,['Intro: filter opens','前奏：滤波打开']);
  b.fx(0,{target:'filter',type:'lowpass',from:380,to:18000},2*16*st);
  b.section('house',bar(2),['House groove','House 律动']);
  // Bass: she holds one root per chord; Alberti (preset Key + Pattern Alberti) plays the 16ths.
  [[0,3],[3,5],[5,7],[7,8],[8,9],[9,10]].forEach(([from,to],g)=>{
    const root=chords[from][0],step=from*16;
    b.hand({id:'1:bass:'+g,layer:'bass',mode:'standard',part:'bass',step,midi:root,length:(to-from)*16,
      title:['Bass · step '+(step+1)+' · Hold '+djNoteName(root),'贝斯 · 第 '+(step+1)+' 格 · 按住 '+djNoteName(root)]},()=>{
      for(let i=from;i<to;i++){
        const [r,ch]=chords[i],notes=[r-12,r,ch[0]-12+7,ch[1]-12,ch[2]-12];
        for(let s=0;s<16;s++){
          const off=s%4===2,midi=off?notes[1]:[notes[0],notes[2],notes[3],notes[2]][s%4];
          b.tone(bar(i)+s*st,'bass',midi,st*.85,'pulse50',off?.13:.07,{d:.08,s:.4,send:0},{via:'arp-alberti'});
        }
      }
    });
  });
  let clap=0,open=0;
  for(let i=0;i<10;i++){
    const intro=i<2,cut=i===7;
    for(let b4=0;b4<4;b4++){
      const time=bar(i)+b4*4*st,step=i*16+b4*4,muted=cut&&b4<2;
      if(!muted)b.drum(time,'kick');
      if(intro)continue;
      if(b4%2&&!muted){
        if(i===7||i===9)b.drum(time,'clap');
        else b.hand(djDrumTarget('1:clap:'+clap++,'clap','standard',step),()=>b.drum(time,'clap'));
      }
      if(!muted)b.hand(djDrumTarget('1:open:'+open++,'open','hard',step+2),()=>b.drum(time+2*st,'open',.8));
      for(let s=0;s<4;s++)if(b.draw(.75)&&!muted)b.drum(time+s*st,'hat',.5+b.rng()*.6,{chance:.75});
    }
  }
  let roll=0;
  const snareRoll=(barIndex,hits)=>hits.forEach(([s,ratchet,velocity])=>{
    const step=barIndex*16+s;
    b.hand(djDrumTarget('1:roll:'+roll++,'snare','hard',step,ratchet),()=>b.drum(bar(barIndex)+s*st,'snare',velocity,ratchet>1?{ratchet,length:st}:{}));
  });
  snareRoll(1,[[8,1,.5+8/30],[10,1,.5+10/30],[11,2,.7],[12,3,.5+12/30],[13,4,.5+13/30],[14,1,.5+14/30],[15,1,.5+15/30]]);
  b.drum(bar(1)+15*st,'hey');
  djRemix.forEach(([bb,s,l,m],i)=>{
    const step=(bb+1)*16+s,phrase=djPhraseOf(i);
    b.hand({id:'1:mel:'+i,layer:'mel',mode:'standard',part:'lead',step,midi:m+24,length:l,phrase,
      title:['Phrase '+phrase+' / 4 · Play '+djNoteName(m+24),'第 '+phrase+' / 4 句 · 弹 '+djNoteName(m+24)]},
      ()=>b.tone(bar(bb+1)+s*st,'lead',m+12,l*st*.92,'pulse25',.17,{d:.2,s:.55,vib:.006,send:.32}));
  });
  b.sfx(bar(3)+12*st,'coin');b.sfx(bar(5)+12*st,'coin');
  // House piano: with the preset Key on, one key per chord gives the triad (Auto-Chord).
  let chord=0;
  for(let i=2;i<9;i++){
    if(i===7)continue;
    const ch=chords[i][1];
    for(const s of [6,14]){
      const step=i*16+s;
      b.hand({id:'1:chord:'+chord++,layer:'chord',mode:'hard',part:'lead',step,midi:ch[0]+24,length:1,
        title:['Chord · step '+(step+1)+' · Play '+djNoteName(ch[0]+24),'和弦 · 第 '+(step+1)+' 格 · 弹 '+djNoteName(ch[0]+24)]},
        ()=>ch.forEach((n,k)=>b.tone(bar(i)+s*st,'lead',n+12,st*1.1,'pulse50',.045,{a:.002,d:.08,s:.3,send:.15},k?{via:'auto-chord'}:{})));
    }
  }
  b.section('filter-dip',bar(6),['DJ filter dip','DJ 滤波下潜']);
  b.fx(bar(6),{target:'filter',type:'lowpass',from:18000,to:600},8*st);
  b.fx(bar(6)+8*st,{target:'filter',type:'lowpass',from:600,to:18000},8*st);
  snareRoll(6,[[12,2,.55+12/40],[13,3,.55+13/40],[14,4,.55+14/40],[15,4,.55+15/40]]);
  b.drum(bar(6)+8*st,'riser',1,{length:8*st});
  b.drum(bar(5)+14*st,'hey');
  b.section('name-2',bar(7),['“dear ___”: everyone stops','「dear ___」：全场停一拍']);
  b.sfx(bar(7),'oneUp');
  b.hand(djDrumTarget('1:hey-name','hey','standard',7*16+8),()=>b.drum(bar(7)+8*st,'hey'));
  b.drum(bar(7)+8*st,'crash',.7);
  b.section('stutter',bar(9),['Stutter + scratch','卡顿 + 搓碟']);
  for(const [s,ratchet] of [[8,1],[10,2],[12,3],[14,4]])
    b.tone(bar(9)+s*st,'lead',84,ratchet>1?2*st:st*2*.8,'pulse25',.16,{d:.05,s:.8,send:.2},ratchet>1?{ratchet,gate:.8}:{});
  b.tone(bar(10)-st*.5,'lead',84,.28,'pulse25',.14,{d:.28,s:1,send:.3},{slide:-30});
  b.length=bar(10)+st*2;
}

function djDrumTarget(id,name,mode,step,ratchet=1){
  const [en,zh]=djDrumTitles[name],times=ratchet>1?' ×'+ratchet:'';
  return {id,layer:id.split(':')[1],mode,part:'drums',step,midi:djDrumSlots[name],length:1,...(ratchet>1?{ratchet}:{}),
    name:[en+times,zh+times],title:[en+times+' · step '+(step+1),zh+times+' · 第 '+(step+1)+' 格']};
}

// ===== Take 3 · Birthday drop =====
function djComposeDrop(b){
  const st=djHouseStep,bar=i=>i*16*st,C=djChords;
  b.section('breakdown',0,['Breakdown: the music box returns','Breakdown：八音盒回来了']);
  b.fx(0,{target:'filter',type:'lowpass',from:18000,to:18000});
  {
    let beat=0;
    const k=16/12*4*st;
    birthdayMelody.slice(0,12).forEach(([m,l],i)=>{
      // The music-box beat is 16/3 steps; the hardware pattern needs whole steps.
      const step=Math.round(beat*16/3),time=step*st;
      b.hand({id:'2:break:'+i,layer:'break',mode:'hard',part:'lead',step,midi:m+24,length:Math.round(l*16/3),
        title:['Music box · step '+(step+1)+' · Play '+djNoteName(m+24),'八音盒 · 第 '+(step+1)+' 格 · 弹 '+djNoteName(m+24)]},()=>{
        b.tone(time,'lead',m+12,l*k*.9,'tri',.2,{d:.6,s:.35,send:.4});
        for(let j=0;j<l*k/(st/2)-1;j++){
          const n=[m+12,m+16,m+19,m+24,m+28,m+31][j%6];
          b.tone(time+j*st/2,'lead',n+12,st*.4,'pulse50',.025,{d:.05,s:.2,send:.45},{via:'arp-wide32'});
        }
      });
      beat+=l;
    });
    [[0,C.C],[1,C.G],[2,C.G7],[3,C.C]].forEach(([i,[root,ch]])=>{
      ch.concat(root).forEach(n=>b.tone(bar(i),'bass',n,16*st*.95,'tri',.05,{a:.4,d:1,s:.8,send:.2},n===root?{}:{via:'auto-chord'}));
      b.drum(bar(i)+8*st,'clap',.6);
      if(i>=2)for(let q=0;q<4;q++)b.drum(bar(i)+q*4*st,'kick',.6);
    });
  }
  b.section('build',bar(4),['Build','Build：越滚越密']);
  const rise=2*16*st-st*4;
  b.fx(bar(4),{target:'filter',type:'highpass',from:60,to:1400},rise);
  b.fx(bar(4),{target:'crush',from:0,to:.55,dry:[1,.55]},rise);
  b.drum(bar(4),'riser',1,{length:rise});
  const ratchets={24:3,26:4,27:4};
  let roll=0;
  for(let s=0;s<28;s++){
    const time=bar(4)+s*st,ratchet=ratchets[s]||1,velocity=ratchet>1?.9:.45+s/45;
    if(s<16){if(s%2===0)b.drum(time,'snare',velocity);}
    else b.hand(djDrumTarget('2:roll:'+roll++,'snare','standard',64+s,ratchet),()=>b.drum(time,'snare',velocity,ratchet>1?{ratchet,length:st}:{}));
    if(s%4===0)b.drum(time,'kick',.9);
    b.tone(time,'bass',43+(s%2)*12,st*.9,'pulse50',.08,{d:.05,s:.8,send:0});
  }
  b.drum(bar(4)+24*st,'hey');
  b.tone(bar(4),'lead',67,rise,'pulse25',.07,{a:.3,d:2,s:1,send:.2},{slide:24});
  b.section('silence',bar(5)+12*st,['Silence · blow the candles','静一拍 · 吹蜡烛']);
  b.fx(bar(5)+12*st,{target:'filter',type:'lowpass',from:20000,to:20000});
  b.fx(bar(5)+12*st,{target:'crush',from:0,to:0,dry:[0,0]});
  b.drum(bar(5)+13*st,'blow');
  b.fx(bar(5)+12*st+3.9*st,{target:'crush',from:0,to:0,dry:[1,1]});
  const drop=bar(6),dbar=i=>drop+i*16*st,up=2;
  b.section('drop',drop,['DROP: a whole tone up','DROP：升一个全音']);
  b.fx(drop,{target:'dist',from:.35,to:.35,dry:[.8,.8]});
  b.drum(drop,'crash');b.sfx(drop-.05,'powerUp');
  const dch=[C.D,C.D,C.A,C.A7,C.D,C.D7,C.G2,C.A7,C.D];
  [[0,2],[2,4],[4,6],[6,7],[7,8],[8,9]].forEach(([from,to],g)=>{
    const root=dch[from][0],step=96+from*16;
    b.hand({id:'2:bass:'+g,layer:'bass',mode:'hard',part:'bass',step,midi:root,length:(to-from)*16,
      title:['Bass · step '+(step+1)+' · Hold '+djNoteName(root),'贝斯 · 第 '+(step+1)+' 格 · 按住 '+djNoteName(root)]},()=>{
      for(let i=from;i<to;i++)for(let s=0;s<16;s++)
        b.tone(dbar(i)+s*st,'bass',dch[i][0]-12+(s%2)*12,st*.8,'pulse50',.12,{d:.06,s:.5,send:0},{via:'arp-octave'});
    });
  });
  let chord=0;
  for(let i=0;i<9;i++){
    const ch=dch[i][1],cut=i===6;
    for(let b4=0;b4<4;b4++){
      const time=dbar(i)+b4*4*st;
      if(i===8&&b4>0)break;
      if(!(cut&&b4<2)){
        b.drum(time,'kick');b.drum(time+2*st,'open',.9);
        if(b4%2)b.drum(time,'clap');
        for(let s=0;s<4;s++)if(b.draw(.8))b.drum(time+s*st,'hat',.5+b.rng()*.6,{chance:.8});
      }
    }
    if(i===4)b.drum(dbar(i),'crash',.8);
    if(!cut&&i<8)for(const s of [2,6,10,14]){
      const step=96+i*16+s;
      b.hand({id:'2:chord:'+chord++,layer:'chord',mode:'hard',part:'lead',step,midi:ch[0]+24,length:1,
        title:['Chord · step '+(step+1)+' · Play '+djNoteName(ch[0]+24),'和弦 · 第 '+(step+1)+' 格 · 弹 '+djNoteName(ch[0]+24)]},
        ()=>ch.forEach((n,k)=>b.tone(dbar(i)+s*st,'lead',n+12,st*1.4,'pulse50',.04,{a:.02,d:.1,s:.5,send:.1},k?{via:'auto-chord'}:{})));
    }
  }
  // The drop melody: written up a whole tone; the preset's Lead Octave +1 lifts it an octave.
  djRemix.forEach(([bb,s,l,m],i)=>{
    const top=m+up+24,step=96+bb*16+s,phrase=djPhraseOf(i),ch=dch[Math.min(bb,8)][1];
    b.hand({id:'2:mel:'+i,layer:'mel',mode:'standard',part:'lead',step,midi:top,length:l,phrase,
      title:['Phrase '+phrase+' / 4 · Play '+djNoteName(top),'第 '+phrase+' / 4 句 · 弹 '+djNoteName(top)]},()=>{
      b.tone(dbar(bb)+s*st,'lead',top,l*st*.9,'pulse125',.13,{d:.15,s:.6,vib:.005,send:.25});
      ch.forEach(n=>b.tone(dbar(bb)+s*st,'lead',n+12,l*st*.7,'pulse125',.045,{d:.12,s:.4,send:.1},{via:'auto-chord'}));
    });
  });
  b.drum(dbar(3)+14*st,'hey');b.sfx(dbar(5)+12*st,'coin');
  b.section('name-3',dbar(6),['“dear ___”: the whole crowd','「dear ___」：全场大合唱']);
  b.sfx(dbar(6),'oneUp');
  b.hand(djDrumTarget('2:hey-name','hey','standard',96+6*16+8),()=>b.drum(dbar(6)+8*st,'hey'));
  b.drum(dbar(6)+8*st,'crash');b.sfx(dbar(6)+8*st+.12,'coin');
  b.section('machine-gun',dbar(8),['Machine-gun ending','机关枪收尾']);
  for(const [s,ratchet] of [[0,2],[4,3],[8,4]]){
    const time=dbar(8)+s*st;
    b.drum(time,'kick',.9,{ratchet,length:4*st});
    C.D[1].concat(74).forEach(n=>b.tone(time,'lead',n+12,4*st,'pulse125',.07,{d:.05,s:.7,send:.2},{ratchet,gate:.4}));
  }
  b.drum(dbar(8)+12*st,'crash');
  C.D[1].concat(78).forEach(n=>b.tone(dbar(8)+12*st,'lead',n+12,.9,'pulse125',.07,{d:.9,s:1,send:.3},{slide:-24}));
  b.sfx(dbar(8)+12*st,'fall');
  const t=dbar(9);
  b.section('rewind',t,['Rewind · encore','倒带急停 · 全场喊安可']);
  b.fx(t,{target:'dist',from:0,to:0,dry:[1,1]});
  [0,.5,.88,1.18,1.4,1.56,1.68,1.78].forEach((offset,i)=>{b.drum(t+.15+offset,'hey');b.drum(t+.15+offset,'clap',.4+i*.07);});
  b.length=t+2.05;
}

// ===== Take 4 · Hyper encore (124 BPM, pattern Rate 1/16T: six steps a beat, heard as 186 BPM) =====
function djComposeEncore(b){
  const st=djEncoreStep,bar=i=>i*16*st;
  const keyOf=bb=>djEncoreKeys[Math.min(3,Math.floor((bb-1)/2))]??2;
  b.section('countdown',0,['Countdown 3-2-1','倒数 3‑2‑1']);
  [0,4,8].forEach((s,i)=>{
    b.hand({id:'3:coin:'+i,layer:'coin',mode:'standard',part:'sfx',step:s,midi:djEffectSlots.coin,length:1,
      title:['Coin · step '+(s+1),'金币 · 第 '+(s+1)+' 格']},
      ()=>b.sfx(bar(0)+s*st,'coin',{params:{pitch:[76,79,84][i]}}));
    b.drum(bar(0)+s*st,'kick',.7);
  });
  for(let k=0;k<4;k++)b.drum(bar(0)+(12+k)*st,'snare',.6+k*2*.05,{ratchet:2,length:st});
  b.sfx(bar(0)+10*st,'powerUp');
  djEncoreKeys.forEach((key,i)=>b.section('encore-key-'+(i+1),bar(1+i*2),['Phrase '+(i+1)+' in '+djNoteName(60+key).replace(/-?\d+$/,''),'第 '+(i+1)+' 句 · '+djNoteName(60+key).replace(/-?\d+$/,'')+' 调']));
  for(let i=1;i<=9;i++){
    const k=i<=8?keyOf(i):9,base=bar(i);
    if(i<=8&&(i===1||keyOf(i)!==keyOf(i-1)))b.drum(base,'crash',.9);
    if(i===9)break;
    for(const s of [0,10])b.drum(base+s*st,'kick');
    for(const s of [4,12])b.drum(base+s*st,'snare');
    for(const s of [7,9,15])if(b.draw(.6))b.drum(base+s*st,'snare',.25,{chance:.6});
    for(let s=0;s<16;s+=2)b.drum(base+s*st,'hat',s%4?.5:.8);
    const r=[0,7,7,0,0,5,7,0][i-1];
    for(const s of [0,3,6,8,11,14]){
      const f=36+k+r;
      b.tone(base+s*st,'bass',f,st*2.6,'pulse50',.09,{d:.1,s:.6,send:0});
      b.tone(base+s*st,'bass',f,st*2.6,'pulse25',.06,{d:.1,s:.6,send:0},{cents:12,via:'double'});
    }
    // A three-note bell over four-beat bars: the waltz hiding in the drum & bass.
    for(let s=0;s<16;s++){
      const n=[0,4,7][((i-1)*16+s)%3];
      b.tone(base+s*st,'lead',72+k+n+12,st*.7,'pulse50',.022,{d:.05,s:.2,send:.35},{via:'arp-up3'});
    }
  }
  djRemix.forEach(([bb,s,l,m],i)=>{
    if(bb>8)return;
    const k=s>=12?keyOf(bb+1):keyOf(Math.max(1,bb)),time=bar(bb)+s*st,step=bb*16+s,phrase=djPhraseOf(i),written=m+k+24;
    b.hand({id:'3:mel:'+i,layer:'mel',mode:'standard',part:'lead',step,midi:written,length:l,phrase,group:'3:mel:'+k,
      title:['Phrase '+phrase+' / 4 · Play '+djNoteName(written),'第 '+phrase+' / 4 句 · 弹 '+djNoteName(written)]},()=>{
      b.tone(time,'lead',m+k+12,l*st*.92,'pulse125',.15,{d:.1,s:.65,vib:.007,send:.3});
      b.tone(time,'lead',m+k+24,l*st*.6,'pulse25',.035,{d:.08,s:.4,send:.3},{via:'double'});
    });
    // Canon: the bass answers one bar later, an octave under the written melody.
    if(bb>=1&&bb<8){
      const midi=m+keyOf(bb+1)-12,canonStep=step+16;
      b.hand({id:'3:canon:'+i,layer:'canon',mode:'hard',part:'bass',step:canonStep,midi,length:l,
        title:['Bass canon · step '+(canonStep+1)+' · Play '+djNoteName(midi),'贝斯卡农 · 第 '+(canonStep+1)+' 格 · 弹 '+djNoteName(midi)]},
        ()=>b.tone(time+16*st,'bass',midi,l*st*.8,'pulse50',.075,{d:.1,s:.5,send:.1}));
    }
  });
  b.section('fireworks',bar(9),['Fireworks + applause','烟花 + 掌声']);
  b.drum(bar(9),'crash');b.sfx(bar(9),'oneUp');
  [57,61,64,69,73,76,81].forEach((n,k)=>b.tone(bar(9),'lead',n+12,2.2,'pulse125',.05,{d:1.6,s:.3,send:.5},k?{via:'auto-chord'}:{}));
  b.fx(bar(9),{target:'delay',to:.4},.15);
  for(let k=0;k<26;k++)if(b.draw(.8)){
    const n=81+[0,4,7,12,16,19][Math.floor(b.rng()*6)];
    b.tone(bar(9)+k*st,'lead',n,.08,'pulse50',.05,{d:.07,s:.1,send:.5},{chance:.8});
  }
  [3,7,11].forEach(k=>b.sfx(bar(9)+k*st*2,'coin'));
  [16,20,24].forEach(s=>b.drum(bar(9)+s*st,'hey'));
  const clap=bar(9)+28*st,seconds=2.6;
  for(let i=0;i<seconds*26;i++)if(b.draw(.75)){
    const time=clap+i/26+b.rng()*.03,f=1800+b.rng()*2500,gain=.05+b.rng()*.06;
    b.drum(time,'applause',Math.round(gain/.11*1000)/1000,{chance:.75,params:{f:Math.round(f)}});
  }
  b.length=clap+2.8;
}

const djComposers=[djComposeMusicBox,djComposeHouse,djComposeDrop,djComposeEncore];
const djTakeMeta=[
  {id:'musicbox',title:['Music box','八音盒'],bpm:96,stepsPerBeat:4,stepsPerBar:12},
  {id:'house',title:['House Party','House Party'],bpm:124,stepsPerBeat:4,stepsPerBar:16},
  {id:'drop',title:['Birthday Drop','Birthday Drop'],bpm:124,stepsPerBeat:4,stepsPerBar:16},
  // A bar of the encore is 16 steps of the 1/16T grid, as its composer counts them.
  {id:'encore',title:['Hyper Encore','Hyper Encore'],bpm:124,stepsPerBeat:6,stepsPerBar:16,rate:'1/16T'}
];
const djFirstTakeStart=.3;

// Composes all four takes with one seeded generator, in declaration order.
function djCompose(seed,declared=false){
  const rng=djRandom(seed);
  let start=djFirstTakeStart;
  return djComposers.map(compose=>{
    const b=djComposer(rng,declared);
    compose(b);
    const take={start,length:b.length,events:b.events,hands:b.hands,sections:b.sections};
    start+=b.length;
    return take;
  });
}

const djScoreShape=djCompose(0);
const djTakes=djTakeMeta.map((meta,pass)=>{
  const {start,length,sections}=djScoreShape[pass];
  return {...meta,start,length,sections:sections.map(s=>({...s,start:djRound(start+s.start)}))};
});

// The octave each target group asks for: the one nearest the part's usual OCT that puts
// every key of the group on the panel (F3–G5, keys 53–79).
const djPreferredOctave={lead:2,bass:-1,drums:-3,sfx:-2};
const djHandDefs=djScoreShape.map(({hands})=>{
  const groups=new Map();
  for(const hand of hands){
    const group=hand.group||hand.id.split(':').slice(0,2).join(':');
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push(hand);
  }
  for(const [group,list] of groups){
    const midis=list.map(hand=>hand.midi);
    const octave=djFitOctave(Math.min(...midis),Math.max(...midis),djPreferredOctave[list[0].part]);
    if(octave===null)throw new Error('No octave fits '+group);
    list.forEach(hand=>hand.octave=octave);
  }
  for(const hand of hands)if(hand.part==='lead'||hand.part==='bass'){
    const main=hand.events.find(event=>!event.via&&(event.part==='lead'||event.part==='bass'));
    hand.sound=main?main.midi:hand.midi;
  }
  return hands;
});

function djHandTargets(pass,mode){
  return djHandDefs[pass]
    .filter(hand=>mode==='hard'||hand.mode==='standard')
    .map(({id,part,step,midi,octave,length,title,name,ratchet,phrase,sound})=>({id,part,step,midi,octave,length,title,...(name?{name}:{}),...(ratchet?{ratchet}:{}),...(phrase?{phrase}:{}),...(sound!==undefined?{sound}:{})}));
}

// The notes she played herself: every recorded note except the ones the guide filled in on a skip.
function djPlayedByHand(work){
  return work.takes.reduce((sum,take,pass)=>{
    const guided=work.guided?.[pass];
    return sum+[...take].filter(id=>!guided?.has(id)).length;
  },0);
}

function djNewWork(mode,seed){
  return {
    version:1,mode,seed,pass:0,step:'mode',heard:false,
    takes:[0,1,2,3].map(()=>new Set()),
    // The ids in each take that the guide filled in when she skipped it; they are in takes too.
    guided:[0,1,2,3].map(()=>new Set()),
    mixes:[{wave:'Triangle',delay:.22},{wave:'Pulse 25',delay:.22},{wave:'Pulse 12.5',delay:.22},{wave:'Pulse 12.5',delay:.22}]
  };
}

// Keys meant to sound together: a take's targets on one step at one OCT setting, one cell of
// progress. Groups follow each one's first target; a group of one is a single key.
function djHandGroups(pass,mode){
  const groups=new Map();
  for(const target of djHandTargets(pass,mode)){
    const key=target.step+'/'+target.octave;
    if(!groups.has(key))groups.set(key,{step:target.step,octave:target.octave,targets:[]});
    groups.get(key).targets.push(target);
  }
  return [...groups.values()];
}

function djNextGroup(work){
  const done=work.takes[work.pass];
  return djHandGroups(work.pass,work.mode).find(group=>group.targets.some(target=>!done.has(target.id)))||null;
}

// A chord is finished before the next group starts.
function djNextTarget(work){
  const done=work.takes[work.pass];
  return djNextGroup(work)?.targets.find(target=>!done.has(target.id))||null;
}

function djPresetKey(event){
  if(event.via||event.midi===undefined)return undefined;
  if(event.part==='drums')return event.midi+36;
  if(event.part==='sfx')return event.midi+24;
  const written=event.part==='lead'?event.midi+12:event.midi;
  const octave=djFitOctave(written,written,djPreferredOctave[event.part]);
  return octave===null?undefined:written-octave*12;
}

// `declared` keeps every Chance event, each tagged with its probability, for the V102 export.
function djTimeline(work,{declared=false}={}){
  const takes=djCompose(work.seed,declared),events=[];
  takes.forEach((take,pass)=>{
    const mix=work.mixes?.[pass],recorded=work.takes?.[pass]||new Set(),voice=djWaveVoices[mix?.wave];
    const place=(event,extra)=>{
      const out={...event,...extra,time:djRound(take.start+event.time),take:pass};
      if(out.length!==undefined)out.length=djRound(out.length);
      if(out.key===undefined){const key=djPresetKey(out);if(key!==undefined)out.key=key;}
      events.push(out);
    };
    // The echo is a dotted eighth of the take's tempo.
    if(mix)place({time:0,part:'fx',velocity:1,fx:{target:'delay',from:mix.delay,to:mix.delay,seconds:djRound(60/djTakes[pass].bpm*.75)}});
    take.events.forEach(event=>place(event));
    djHandDefs[pass].forEach((def,index)=>{
      const hand=take.hands[index],key=def.midi-def.octave*12;
      const played=recorded.has(def.id),placed=work.mode==='standard'&&def.mode==='hard';
      if(!played&&!placed)return;
      hand.events.forEach(event=>place(event,{
        key,
        ...(played?{hand:def.id}:{}),
        ...(played&&voice&&def.layer==='mel'&&!event.via?{voice}:{})
      }));
    });
  });
  events.sort((a,b)=>a.time-b.time);
  const last=takes[takes.length-1];
  return {events,length:djRound(last.start+last.length),takeStarts:takes.map(take=>djRound(take.start))};
}

function djTakeTimeline(work,pass){
  const {events,takeStarts}=djTimeline(work),start=takeStarts[pass];
  return {
    events:events.filter(event=>event.take===pass).map(event=>({...event,time:djRound(event.time-start)})),
    length:djRound(djTakes[pass].length)
  };
}

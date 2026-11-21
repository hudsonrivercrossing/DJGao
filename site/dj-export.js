// The DJ set as Baud Girl V102 patterns: a Device Manager pattern backup (.syx) that its
// Library opens and sends. The bytes follow the Device Manager's own code (baudgirl.com,
// fm1/app fm1seq.js, read 2026-11-19): a 0x22 message writes four 32-byte steps with the
// pattern's five settings, a 0x21 message eight steps of four locks.
//
// What the file holds, and what it leaves to the presets (docs/fm1-v102-dj-verification.md):
// - Each note is the key the sequencer plays: drums F0–E1, SFX F1–E2, bass F2–E5 as it sounds,
//   lead F5–E8 one octave above its sound. The drop's preset sets Lead Octave +1, so its lead is
//   written as it sounds. A note outside its part's keys moves by octaves into them.
// - Key changes are already in the notes: no step Transpose, and Seq Transpose stays 0.
// - A `via` note comes from the preset's Arpeggio, Chord or Auto-Chord, so only its key is written.
// - A Chance event is written once, with its declared probability as the step's Chance.
// - Locks carry Filter Cutoff and Bitcrush Bits only; the filter type and every on/off is the preset's.

const djV102FirstSlot=8,djV102Tempo=124;
const djV102Rates={'1/8T':5,'1/16':6,'1/16T':7,'1/32T':9};
// A step's length in ticks, 192 to a quarter note (fm1seq.js VALUE_TICKS).
const djV102Ticks={5:64,6:48,7:32,9:16};
const djV102StepSeconds=rate=>djV102Ticks[rate]/192*60/djV102Tempo;
// Filter Cutoff 0–107 in Hz (Device Manager editmodel.js FX_CUTOFF, M-VAVE's own table).
const djV102Cutoff=[
  100,105,110,116,122,128,135,142,149,157,165,174,183,193,203,214,226,238,251,265,279,295,311,328,
  346,365,385,406,428,452,477,503,530,559,590,622,656,692,730,770,812,856,903,952,1004,1058,1115,1175,
  1238,1304,1373,1446,1522,1602,1686,1774,1867,1964,2066,2173,2285,2402,2525,2654,2789,2931,3079,3235,
  3398,3569,3748,3936,4132,4337,4552,4777,5012,5258,5515,5784,6065,6359,6666,6987,7322,7672,8037,8418,
  8815,9229,9661,10111,10580,11069,11578,12108,12660,13235,13833,14456,15104,15778,16479,17209,17968,18757,19578,20000
];
const djV102Locks={cutoff:33,bits:56};
// The FM-1's twelve built-in effects run Coin, Jump, Laser, Shoot, Explosion, Power-Up, 1-Up,
// Hurt, Blip, Warp, Alarm, Fall from F1. It has no party horn; Alarm stands in.
const djV102Effects={coin:29,jump:30,powerUp:34,oneUp:35,horn:39,fall:40};

// One preset per musical section; every pattern names the one it plays with.
const djV102Presets={
  box:{name:['Music box','八音盒'],settings:['Lead Triangle and polyphonic, Bass Triangle, Key Off, both Arpeggios Off','主奏三角波、复音，贝斯三角波，Key Off，两个 Arpeggio 都关']},
  house:{name:['House','House'],settings:['Key C Major; Bass Wave Pulse 50, Chord Triad, Pattern Alberti, Arp Speed 1/16; Lead Pattern Off; Arp Sync Beat; Filter On, Low Pass','Key C 大调；贝斯 Pulse 50、Chord Triad、Pattern Alberti、Arp Speed 1/16；主奏 Pattern Off；Arp Sync Beat；Filter 开、Low Pass']},
  breakdown:{name:['Breakdown','Breakdown'],settings:['Lead Triangle, Lead Arpeggio Major Wide at 1/32; Bass Arpeggio Major with Note Engine Auto-Chord','主奏三角波，Lead Arpeggio Major Wide、1/32；贝斯 Arpeggio Major，Note Engine 选 Auto-Chord']},
  build:{name:['Build','Build'],settings:['A copy of Breakdown with both Arpeggios Off; Filter On, High Pass, Cutoff 100 Hz; Bitcrush On, Bits 16, Mix 100','复制 Breakdown，两个 Arpeggio 关；Filter 开、High Pass、Cutoff 100 Hz；Bitcrush 开、Bits 16、Mix 100']},
  drop:{name:['Drop','Drop'],settings:['Lead Octave +1; Key D Major; Lead Chord Triad with Note Engine Auto-Chord; Lead Follows Bass; Bass Pattern Octave Down at 1/16; Distortion On','Lead Octave +1；Key D 大调；主奏 Chord Triad，Note Engine 选 Auto-Chord；Lead Follows 选 Bass；贝斯 Pattern Octave Down、1/16；Distortion 开']},
  'encore-d':{name:['Encore in D','安可 · D'],settings:['Key D Major; Lead Chord Triad, Pattern Up, Arp Speed 1/16T, Arp Sync Beat; Bass Pulse 50','Key D 大调；主奏 Chord Triad、Pattern Up、Arp Speed 1/16T、Arp Sync Beat；贝斯 Pulse 50']},
  'encore-e':{name:['Encore in E','安可 · E'],settings:['A copy of Encore in D with Key E','复制「安可 · D」，Key 改 E']},
  'encore-fs':{name:['Encore in F♯','安可 · F♯'],settings:['A copy of Encore in D with Key F♯','复制「安可 · D」，Key 改 F♯']},
  'encore-a':{name:['Encore in A','安可 · A'],settings:['A copy of Encore in D with Key A; its Delay Mix at 40% for the fireworks','复制「安可 · D」，Key 改 A；烟花这里 Delay Mix 40%']}
};

// Each take's patterns on the composer's own grid: [rate, grid seconds, first step, end step, preset].
// Step 0 is the composer's step 0: the take's start, or in take 1 the melody's first note (3/4,
// twelve steps to a bar, bar lines at steps 4, 16, …). `null` reaches the take's first or last step.
// Splits fall on bar lines that no held note or held arpeggio key crosses, and where the preset
// changes. The encore's fireworks and applause run at 1/32T so each applause hit has its own step.
const djV102Plan=[
  [['1/8T',djBoxBeat/4,null,52,'box'],['1/8T',djBoxBeat/4,52,null,'box']],
  [['1/16',djHouseStep,0,48,'house'],['1/16',djHouseStep,48,112,'house'],['1/16',djHouseStep,112,null,'house']],
  [['1/16',djHouseStep,0,64,'breakdown'],['1/16',djHouseStep,64,96,'build'],['1/16',djHouseStep,96,160,'drop'],['1/16',djHouseStep,160,224,'drop'],['1/16',djHouseStep,224,null,'drop']],
  [['1/16T',djEncoreStep,0,48,'encore-d'],['1/16T',djEncoreStep,48,80,'encore-e'],['1/16T',djEncoreStep,80,112,'encore-fs'],['1/16T',djEncoreStep,112,144,'encore-a'],
    ['1/32T',djEncoreStep/2,288,352,'encore-a'],['1/32T',djEncoreStep/2,352,null,'encore-a']]
];

// Where each take's grid starts: take 1's step 0 is its melody's first note.
function djV102Anchor(pass){
  if(pass!==0)return 0;
  return djTakes[0].sections.find(section=>section.id==='musicbox').start-djTakes[0].start;
}

function djV102Pieces(pass){
  const anchor=djV102Anchor(pass),plan=djV102Plan[pass],length=djTakes[pass].length;
  return plan.map(([rate,grid,from,to,preset])=>({
    take:pass,rate:djV102Rates[rate],grid,anchor,preset,
    from:from??-Math.round(anchor/grid),
    to:to??Math.round((length-anchor)/grid)
  }));
}

const djV102Velocity=velocity=>Math.min(127,Math.max(1,Math.round(velocity*127)));

// The key the sequencer stores for an event, in the part's own keys (manual §6.1.1).
function djV102Key(event,preset){
  if(event.part==='drums')return event.midi;
  if(event.part==='sfx')return djV102Effects[event.voice];
  let note=event.midi;
  const [low,high]=event.part==='bass'?[41,76]:[77,112];
  if(event.part==='lead'&&preset!=='drop')note+=12;
  while(note<low)note+=12;
  while(note>high)note-=12;
  return note;
}

// The keys she holds for an arpeggio that makes every sound of its own (House and Drop bass).
function djV102ArpKeys(work,pass){
  const done=work.takes?.[pass]||new Set();
  return djHandDefs[pass].filter(def=>{
    if(def.part!=='lead'&&def.part!=='bass')return false;
    if(def.events.some(event=>!event.via&&(event.part==='lead'||event.part==='bass')))return false;
    return done.has(def.id)||(work.mode==='standard'&&def.mode==='hard');
  }).map(def=>({part:def.part,midi:def.midi,step:def.step,steps:def.length,
    velocity:Math.max(...def.events.map(event=>event.velocity))}));
}

// The set as patterns: each step's notes (key, velocity, last step), Ratchet, Gate, Chance and locks.
function djV102Patterns(work){
  const {events,takeStarts}=djTimeline(work,{declared:true});
  const patterns=[];
  for(let pass=0;pass<djTakes.length;pass++){
    const pieces=djV102Pieces(pass).map(piece=>({...piece,steps:Array.from({length:piece.to-piece.from},()=>({notes:[],ratchet:1,gate:null,chance:null,locks:[],sources:[]})),moved:0,drift:0}));
    const locate=time=>{
      for(const piece of pieces){
        const step=Math.round((time-piece.anchor)/piece.grid);
        if(step>=piece.from&&step<piece.to)return [piece,step-piece.from];
      }
      const first=pieces[0],last=pieces.at(-1);
      return time<first.anchor+first.from*first.grid?[first,0]:[last,last.steps.length-1];
    };
    // Every step of the take in play order: a note whose step is full or already holds its key
    // moves to the nearest later step that can take it (or, at the take's end, an earlier one).
    const order=pieces.flatMap(piece=>piece.steps.map((_,index)=>[piece,index]));
    const place=(piece,at,source)=>{
      const fits=([target,index])=>{const step=target.steps[index];return step.notes.length<9&&!step.notes.some(note=>note.note===source.note);};
      const origin=order.findIndex(([target,index])=>target===piece&&index===at);
      let found=origin;
      if(!fits(order[origin])){
        found=-1;
        for(let k=origin+1;k<order.length&&found<0;k++)if(fits(order[k]))found=k;
        for(let k=origin-1;k>=0&&found<0;k--)if(fits(order[k]))found=k;
        if(found<0)throw new Error('No step can take note '+source.note);
        piece.moved++;
        piece.drift=Math.max(piece.drift,Math.abs(found-origin));
      }
      const [target,index]=order[found],step=target.steps[index];
      step.notes.push({note:source.note,vel:source.vel,length:source.length});
      step.sources.push(source);
      if(source.ratchet>1)step.ratchet=Math.max(step.ratchet,source.ratchet);
      if(source.gate)step.gate=Math.max(step.gate??0,source.gate);
    };
    const takeEvents=events.filter(event=>event.take===pass);
    for(const event of takeEvents){
      if(event.part==='fx'||event.via)continue;
      const [piece,index]=locate(event.time-takeStarts[pass]);
      const ratchet=event.ratchet>1?event.ratchet:1,tonal=event.part==='lead'||event.part==='bass';
      place(piece,index,{
        note:djV102Key(event,piece.preset),vel:djV102Velocity(event.velocity),
        length:tonal&&ratchet===1?Math.max(1,Math.round((event.length||0)/piece.grid)):1,
        ratchet,gate:ratchet>1&&event.gate?Math.max(5,Math.min(100,Math.round(event.gate*100))):null,chance:event.chance||null
      });
    }
    for(const key of djV102ArpKeys(work,pass)){
      const piece=pieces.find(p=>key.step>=p.from&&key.step<p.to);
      place(piece,key.step-piece.from,{note:djV102Key(key,piece.preset),vel:djV102Velocity(key.velocity),length:key.steps,ratchet:1,gate:null,chance:null});
    }
    // Filter and Bitcrush moves become a lock on every step they cover.
    for(const event of takeEvents){
      const {fx}=event;
      if(event.part!=='fx'||!event.length||fx.from===fx.to||!['filter','crush'].includes(fx.target))continue;
      const start=event.time-takeStarts[pass];
      for(const piece of pieces)piece.steps.forEach((step,index)=>{
        const time=piece.anchor+(piece.from+index)*piece.grid,progress=(time-start)/event.length;
        if(progress<-1e-9||progress>=1-1e-9)return;
        if(fx.target==='filter'){
          const hz=fx.from*(fx.to/fx.from)**progress;
          let best=0;
          djV102Cutoff.forEach((value,i)=>{if(Math.abs(Math.log(value/hz))<Math.abs(Math.log(djV102Cutoff[best]/hz)))best=i;});
          step.locks.push({what:djV102Locks.cutoff,value:best});
        }else{
          // The web's crusher is 4 bits at full mix: mix 0 is 16 bits, mix 1 is 4.
          const amount=fx.from+(fx.to-fx.from)*progress;
          step.locks.push({what:djV102Locks.bits,value:Math.min(16,Math.max(1,Math.round(16-12*amount)))});
        }
      });
    }
    for(const piece of pieces){
      piece.steps.forEach(step=>{
        // Chance is the whole step's: only a step of Chance events alike, with no lock, rolls.
        const odds=new Set(step.sources.map(source=>source.chance));
        if(step.sources.length&&odds.size===1&&!odds.has(null)&&!step.locks.length)step.chance=Math.round([...odds][0]*100);
        delete step.sources;
      });
      // A note lasts its length, to the pattern's end at most, and ends before its own pitch returns.
      const last=new Map();
      for(let index=piece.steps.length-1;index>=0;index--){
        for(const note of piece.steps[index].notes){
          const next=last.get(note.note)??piece.steps.length;
          note.end=Math.min(index+note.length-1,next-1);
          delete note.length;
        }
        for(const note of piece.steps[index].notes)last.set(note.note,index);
      }
      patterns.push({take:pass,preset:piece.preset,rate:piece.rate,length:piece.steps.length,steps:piece.steps,moved:piece.moved,drift:piece.drift});
    }
  }
  if(patterns.length>16)throw new Error('The set needs '+patterns.length+' patterns');
  patterns.forEach((pattern,index)=>{
    pattern.slot=(djV102FirstSlot+index)%16+1;
    pattern.chain=(djV102FirstSlot+(index+1)%patterns.length)%16+1;
  });
  return patterns;
}

// A pattern's 64 steps as the synth stores them (fm1seq.js; firmware seq_carry.h). A step with
// its own Gate or Chance is EXTENDED: +11..+13 hold its options and +14..+19 the notes that end
// there; otherwise +11..+19 hold them. +29 is 0x40 with the Ratchet in bits 2–3.
function djV102StepBytes(pattern){
  const bytes=new Uint8Array(64*32).fill(0xff),at=index=>bytes.subarray(index*32,index*32+32);
  for(let index=0;index<64;index++){const step=at(index);step[30]=0;step[31]=0;}
  const extended=step=>(step[29]&0xe0)===0x60;
  const release=(step,note)=>{
    if(extended(step)){
      for(let j=14;j<20;j++)if(step[j]===note)return true;
      for(let j=14;j<20;j++)if(step[j]>=128){step[j]=note;step[31]=9;return true;}
      return false;
    }
    const count=Math.min(step[31],9);
    for(let j=0;j<count;j++)if(step[11+j]===note)return true;
    if(count>=9)return false;
    step[11+count]=note;step[31]=count+1;
    return true;
  };
  // Where the synth puts an end that does not fit: earlier steps of the note first, then later ones.
  const end=(start,note,last)=>{
    for(let j=last;j>=start;j--)if(release(at(j),note))return;
    for(let j=last+1;j<64;j++)if(release(at(j),note))return;
  };
  pattern.steps.forEach((source,index)=>{
    const step=at(index),options=source.gate!==null||source.chance!==null;
    if(source.ratchet>1||options)step[29]=0x40|((source.ratchet-1)<<2)|(options?0x30:0);
    if(options){
      step[11]=source.gate===null?0xff:0x80|source.gate;
      step[12]=source.chance===null?0xff:0x80|source.chance;
    }
    source.notes.forEach(({note,vel},j)=>{step[j]=note;step[20+j]=vel;});
    step[30]=source.notes.length;
  });
  for(const single of [true,false])pattern.steps.forEach((source,index)=>{
    for(const note of source.notes)if((note.end===index)===single)end(index,note.note,note.end);
  });
  return bytes;
}

function djV102Message(body){
  const checksum=body.reduce((sum,byte)=>(sum+(byte^0xff))&0xff,0)&0x7f;
  return [0xf0,0x43,0x00,0x7d,...body,checksum,0xf7];
}

// 8-into-7: groups of seven bytes, each after a byte of their top bits.
function djV102Pack(bytes){
  const out=[];
  for(let i=0;i<bytes.length;i+=7){
    const group=Array.from(bytes.slice(i,i+7));
    out.push(group.reduce((mask,byte,k)=>mask|((byte>>7)<<k),0),...group.map(byte=>byte&0x7f));
  }
  return out;
}

// The backup: every pattern's sixteen whole-step messages, then its eight lock messages; the
// last message saves.
function encodeDjPatterns(work){
  const patterns=djV102Patterns(work),messages=[];
  for(const pattern of patterns){
    const steps=djV102StepBytes(pattern),pat=pattern.slot-1;
    const settings=[100,50,pattern.rate,pattern.length,128|(pattern.chain-1)];
    for(let part=0;part<16;part++)messages.push([0x22,pat,part,0,...djV102Pack([...settings,...steps.subarray(part*128,part*128+128)])]);
  }
  for(const pattern of patterns)for(let eighth=0;eighth<8;eighth++){
    const body=[0x21,pattern.slot-1,eighth,0];
    for(let index=eighth*8;index<eighth*8+8;index++){
      const locks=pattern.steps[index]?.locks||[];
      for(let j=0;j<4;j++)body.push(...(locks[j]?[locks[j].what,locks[j].value]:[0x7f,0x7f]));
    }
    messages.push(body);
  }
  messages.at(-1)[3]=1;
  return Uint8Array.from(messages.flatMap(djV102Message));
}

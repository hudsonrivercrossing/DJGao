const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const site = name => fs.readFileSync(path.join(__dirname,'../site',name),'utf8');

function makePage({stored={}}={}){
  const context2d=new Proxy({}, {get:(target,key)=>target[key]??(()=>{})});
  const nodes=new Map(),timers=new Map(),route=[0,1,2,3].map(stage=>({route:String(stage)}));
  let sequence=0,now=0;
  function element(){
    const classes=new Set(),sub=new Map(),attributes=new Map();
    return {
      className:'',style:{setProperty(){}},children:[],dataset:{},textContent:'',scrollTop:0,
      open:false,hidden:false,clientWidth:700,offsetLeft:400,offsetTop:300,
      classList:{
        add:(...names)=>names.forEach(name=>classes.add(name)),
        remove:(...names)=>names.forEach(name=>classes.delete(name)),
        toggle:(name,on)=>on?classes.add(name):classes.delete(name),
        contains:name=>classes.has(name)
      },
      setAttribute:(name,value)=>attributes.set(name,String(value)),
      getAttribute:name=>attributes.get(name),
      removeAttribute:name=>attributes.delete(name),
      querySelector(selector){if(!sub.has(selector))sub.set(selector,element());return sub.get(selector);},
      append(...children){this.children.push(...children);},
      replaceChildren(...children){this.children=children;},
      getAnimations:()=>[],addEventListener(type,listener){((this.listeners??={})[type]??=[]).push(listener);},focus(){},
      show(){this.open=true;},showModal(){this.open=true;},close(){this.open=false;},click(){this.clicks=(this.clicks||0)+1;},
      getContext:()=>context2d,
      getBoundingClientRect:()=>({left:0,right:700,top:400,bottom:450,width:700,height:50})
    };
  }
  const html=site('index.html');
  for(const [tag,id] of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g))nodes.set('#'+id,Object.assign(element(),{hidden:/\shidden[\s>]/.test(tag)}));
  for(const selector of ['.machine-photo','.scene-copy','.birthday-note'])nodes.set(selector,element());
  const hardware=nodes.get('#hardware-controls');
  const querySelector=selector=>{
    const data=selector.match(/^\[data-(midi|control|knob)="([^"]+)"\]$/);
    if(data)return hardware.children.find(node=>String(node.dataset[data[1]])===data[2]);
    return nodes.get(selector)||null;
  };
  const chapterNodes=route.map(dataset=>Object.assign(element(),{dataset}));
  const querySelectorAll=selector=>{
    if(selector==='#chapters [data-route]')return chapterNodes;
    const group={'.hardware-key':'midi','.hardware-button':'control','.hardware-knob':'knob'}[selector];
    if(group)return hardware.children.filter(node=>group in node.dataset);
    return [];
  };
  const sounds=[];
  const local=new Map(Object.entries(stored)),listeners=new Map();
  const context=vm.createContext({
    document:{querySelector,querySelectorAll,createElement:element,documentElement:{},
      addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);}},
    fireVisibility:()=>(listeners.get('visibilitychange')||[]).forEach(listener=>listener()),
    window:{addEventListener(){}},location:{search:'?nointro'},
    matchMedia:query=>({matches:query.includes('reduced-motion'),addEventListener(){}}),
    localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)},
    innerWidth:1000,innerHeight:800,devicePixelRatio:1,performance:{now:()=>now},
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    setTimeout(fn,delay=0){timers.set(++sequence,{fn,at:now+delay});return sequence;},clearTimeout:id=>timers.delete(id),sounds
  });
  const code=['fullscreen.js','content.js','audio.js','knob-inspector.js','learning-content.js','learning.js','dj-score.js','dj-synth.js','dj-storage.js','dj-export.js','finale.js','premiere.js','firmware.js','volume.js','app.js','intro.js'].map(site).join('\n');
  vm.runInContext(code,context);
  const run=code=>vm.runInContext(code,context);
  run("synth.wake=async()=>{};synth.note=(midi,kind,duration)=>{sounds.push({midi,kind,duration});return {release(){}}};synth.drum=drum=>sounds.push({drum});synth.gameEffect=effect=>{sounds.push({effect});return null}");
  function fire(id){
    const timer=timers.get(id);
    assert.ok(timer,'Expected a scheduled timer');
    timers.delete(id);
    now=Math.max(now,timer.at);
    timer.fn();
  }
  return {run,nodes,timers,local,fire,time:()=>now};
}

test('A warm piano key schedules its voice and lights during the press handler',async()=>{
  const {run,timers,fire,time}=makePage();
  await run('start()');
  run('openPlayground(1)');
  run('sounds.length=0;synth.context={state:"running"};synth.wake=()=>new Promise(()=>{})');
  run('keyDown(60,"touch")');
  assert.equal(run('sounds[0]?.midi'),60);
  assert.equal(run('$(\'[data-midi="60"]\').classList.contains("down")'),true);
  run('keyUp("touch")');
  assert.equal(run('$(\'[data-midi="60"]\').classList.contains("down")'),false);
  assert.equal(run('$(\'[data-midi="60"]\').classList.contains("sounding")'),true);
  const tail=run('$(\'[data-midi="60"]\').lightTimer');
  assert.equal(timers.get(tail).at-time(),90);
  fire(tail);
  assert.equal(run('$(\'[data-midi="60"]\').classList.contains("sounding")'),false);
});

test('A quick tap during audio resume lights only when the voice can sound',async()=>{
  const {run,fire,timers}=makePage();
  await run('start()');
  run('openPlayground(1)');
  run(`sounds.length=0;synth.context={state:'suspended'};
    let finishResume;
    synth.wake=()=>new Promise(resolve=>{finishResume=resolve;});
    const tap=keyDown(60,'touch');
    keyUp('touch')`);
  assert.equal(run('sounds.length'),0);
  const keyState=state=>run(`$('[data-midi="60"]').classList.contains('${state}')`);
  assert.equal(keyState('held'),true);
  assert.equal(keyState('down'),false);
  await run(`synth.context.state='running';finishResume();tap`);
  assert.equal(run('sounds[0].midi'),60);
  assert.equal(keyState('down'),true);
  fire(Math.max(...timers.keys()));
  assert.equal(keyState('down'),false);
});

test('Adding notes to a running arpeggio sounds each key immediately and keeps the beat',async()=>{
  const {run}=makePage();
  await run('start()');
  run('openPlayground(0)');
  await run('control("ARP")');
  await run('keyDown(60,"first")');
  run('keyUp("first");sounds.length=0;synth.context={state:"running"}');
  const nextBeat=run('clock');
  run('keyDown(64,"second")');
  assert.equal(run('sounds[0]?.midi'),64);
  assert.equal(run('clock'),nextBeat);
  assert.equal(run('$(\'[data-midi="64"]\').classList.contains("sounding")'),true);
});

// A power-on page whose DJ previews are recorded instead of played (the test page has no audio graph).
function journeyPage(){
  const page=makePage();
  const {run,nodes,timers,fire}=page;
  run(`var djPlays=[];djOutput=()=>({input:'bus'});
    djPlay=(context,destination,events,options={})=>{const play={events,options,stopped:false,stop(){play.stopped=true;}};djPlays.push(play);return play;}`);
  const press=midi=>run(`keyDown(${midi},'test').then(()=>keyUp('test'))`);
  const command=name=>run(`control(${JSON.stringify(name)})`);
  // Presses the next n djNextTarget keys, pressing OCT first when the octave differs.
  const enterTargets=async n=>{
    for(let i=0;i<n;i++){
      const target=run('djNextTarget(birthdayJourney.work)');
      assert.ok(target,'Expected another hand target');
      while(run('state.octave')!==target.octave)await command(run('state.octave')>target.octave?'OCT−':'OCT+');
      await press(target.midi-target.octave*12);
    }
  };
  const finishPass=async()=>{await command('REC');await command('PLAY');nodes.get('#mission-next').onclick();};
  const startStandardAtTake=async pass=>{
    await run('start()');
    run("chooseBirthdayMode('standard')");
    for(let p=0;p<pass;p++){run('skipBirthdayPass()');await finishPass();}
    run('turn("ALGORITHM",1)');
    await command('REC');
  };
  // Runs the preview to its end: the wake promise, then every guide timer in time order.
  const drain=async()=>{
    await Promise.resolve();await Promise.resolve();
    while(run('Boolean(birthdayPreview)')){
      const ids=Array.from(run('birthdayTimers')).sort((a,b)=>timers.get(a).at-timers.get(b).at);
      assert.ok(ids.length);
      fire(ids[0]);
    }
  };
  const fireNextBirthdayTimer=()=>{
    const ids=Array.from(run('birthdayTimers')).sort((a,b)=>a-b);
    assert.ok(ids.length,'Expected a pending birthday timer');
    fire(ids[0]);
  };
  const finishedStandardWork=async()=>{
    await startStandardAtTake(3);
    run('skipBirthdayPass()');
  };
  return {...page,press,command,enterTargets,finishPass,startStandardAtTake,drain,fireNextBirthdayTimer,finishedStandardWork};
}

async function accentAfterPlayingTake4(){
  const page=journeyPage();
  await page.startStandardAtTake(3);
  await page.enterTargets(page.run("djHandTargets(3,'standard').length"));
  return {accent:page.run('birthdayJourney.work.mixes[3].accent'),run:page.run};
}

async function accentAfterSkippingTake4(){
  const page=journeyPage();
  await page.startStandardAtTake(3);
  page.run('skipBirthdayPass()');
  return {accent:page.run('birthdayJourney.work.mixes[3].accent'),run:page.run};
}

test('Power-on waits in the mode step until a mode is chosen',async()=>{
  const {run,nodes}=journeyPage();
  await run('start()');
  assert.equal(run('birthdayJourney.step'),'mode');
  assert.equal(run('birthdayJourney.work'),null);
  assert.equal(run('nextCue().text'),'选一下：你想亲手弹多少？');
  run('skipBirthdayPass()');
  assert.equal(run('birthdayJourney.step'),'mode');
  assert.equal(nodes.get('#counter').hidden,true);
  run("chooseBirthdayMode('hard')");
  assert.equal(run('birthdayJourney.work.mode'),'hard');
  assert.equal(run('Number.isInteger(birthdayJourney.work.seed)&&birthdayJourney.work.seed>=0'),true);
  assert.equal(run('birthdayJourney.step'),'voice');
  assert.equal(run('nextCue().knob'),'ALGORITHM');
  assert.equal(nodes.get('#counter').textContent,'0 / '+run("djHandGroups(0,'hard').length")+' 格');
});

test('Standard mode: four takes by hand, then the last key opens the card',async()=>{
  const {run,nodes,enterTargets,finishPass,command}=journeyPage();
  await run('start()');
  assert.equal(run('birthdayJourney.step'),'mode');
  run("chooseBirthdayMode('standard')");
  const waves=[];
  for(let pass=0;pass<4;pass++){
    assert.equal(run('birthdayJourney.pass'),pass);
    run('turn("ALGORITHM",1)');await command('REC');
    waves.push(run(`birthdayJourney.work.mixes[${pass}].wave`));
    const n=run(`djHandTargets(${pass},'standard').length`);
    await enterTargets(pass<3?n:n-1);
    if(pass<3){
      assert.equal(run(`birthdayJourney.work.takes[${pass}].size`),n);
      assert.equal(nodes.get('#counter').textContent,n+' / '+n+' 个音');
      await finishPass();
    }
  }
  assert.deepEqual(waves,['Triangle','Pulse 25','Pulse 12.5','Pulse 12.5']);
  await enterTargets(1);
  assert.equal(nodes.get('#interlude').dataset.celebrating,'yes');
  assert.equal(run('birthdayJourney.step'),'finished');
  assert.equal(run("birthdayJourney.work.takes[3].size"),run("djHandTargets(3,'standard').length"));
});

test('A recorded hand target is written into the take pattern for the LCD',async()=>{
  const {run,enterTargets,startStandardAtTake}=journeyPage();
  await startStandardAtTake(1);
  const target=run('djNextTarget(birthdayJourney.work)');
  await enterTargets(1);
  assert.equal(run('state.stepCount'),160);
  assert.equal(run(`currentPattern().${target.part}[${target.step}].includes(${target.midi})`),true);
  assert.equal(run('birthdayRecordHand(djHandTargets(1,"standard")[0])'),false);
});

test('Hiding the page stops recording but keeps what was played',async()=>{
  const {run,enterTargets,startStandardAtTake}=journeyPage();
  await startStandardAtTake(1);await enterTargets(3);
  run("document.hidden=true;fireVisibility()");
  assert.equal(run('state.recording'),false);
  assert.equal(run('birthdayJourney.work.takes[1].size'),3);
  assert.equal(run('nextCue().text'),'按 REC，接着录。');
});

test('Switching language mid-take keeps progress',async()=>{
  const {run,enterTargets,startStandardAtTake}=journeyPage();
  await startStandardAtTake(1);await enterTargets(3);
  run('language="en";copy()');
  assert.equal(run('nextCue().text'),run('djNextTarget(birthdayJourney.work).title[0]'));
  assert.equal(run('birthdayJourney.work.takes[1].size'),3);
});

test('Skipping take 4 ends on the same accent as playing it',async()=>{
  const played=await accentAfterPlayingTake4(),skipped=await accentAfterSkippingTake4();
  assert.equal(typeof played.accent,'number');
  assert.equal(skipped.accent,played.accent);
  assert.equal(skipped.run('birthdayJourney.step'),'finished');
  assert.equal(played.run('birthdayJourney.step'),'finished');
});

test('PLAY only plays and stops; Next take moves on',async()=>{
  const {run,nodes,command,enterTargets,startStandardAtTake}=journeyPage();
  await startStandardAtTake(0);await enterTargets(25);await command('REC');await command('PLAY');
  assert.equal(run('birthdayJourney.step'),'listening');
  await Promise.resolve();
  assert.equal(run('djPlays.length'),1);
  assert.equal(run('djPlays[0].events.length'),run('djTakeTimeline(birthdayJourney.work,0).events.length'));
  run('djPlays[0].options.onEvent(djPlays[0].events.find(event=>event.hand==="0:mel:0"))');
  assert.equal(run(`$('[data-midi="67"]').classList.contains('sounding')`),true);
  await command('PLAY');
  assert.equal(run('djPlays[0].stopped'),true);
  assert.equal(run('birthdayJourney.step'),'listen');
  assert.equal(run('birthdayJourney.pass'),0);
  assert.equal(nodes.get('#mission-next').hidden,false);
  nodes.get('#mission-next').onclick();
  assert.equal(run('birthdayJourney.pass'),1);
});

// Reads a Device Manager pattern backup the way its own decoder does (fm1seq.js bankFromSyx,
// stepInfo, stepLocks): 0x22 whole-step messages, then 0x21 lock messages.
function decodeV102(raw){
  const bytes=Buffer.from(raw),slots=new Map();
  const ysum=body=>body.reduce((sum,byte)=>(sum+(byte^0xff))&0xff,0)&0x7f;
  const slot=pat=>{if(!slots.has(pat))slots.set(pat,{pat,parts:new Set(),eighths:new Set(),raw:new Uint8Array(2048),lockBytes:new Uint8Array(512).fill(0xff)});return slots.get(pat);};
  for(let start=0;start<bytes.length;){
    const end=bytes.indexOf(0xf7,start),m=bytes.subarray(start,end+1);
    assert.deepEqual([...m.subarray(0,4)],[0xf0,0x43,0,0x7d]);
    assert.equal(m.at(-2),ysum(m.subarray(4,-2)));
    const target=slot(m[5]);
    if(m[4]===0x22){
      assert.equal(m.length,162);
      const data=Array.from({length:133},(_,i)=>{const g=Math.floor(i/7)*8,k=i%7;return m[8+g+1+k]|(((m[8+g]>>k)&1)<<7);});
      if(target.set)assert.deepEqual(target.set,data.slice(0,5));
      target.set=data.slice(0,5);
      target.raw.set(data.slice(5),m[6]*128);
      target.parts.add(m[6]);
    }else{
      assert.equal(m[4],0x21);assert.equal(m.length,74);
      for(let i=0;i<64;i+=2)if(m[8+i]!==0x7f){target.lockBytes[m[6]*64+i]=m[8+i];target.lockBytes[m[6]*64+i+1]=m[9+i];}
      target.eighths.add(m[6]);
    }
    start=end+1;
  }
  const patterns=[...slots.values()].map(({pat,parts,eighths,raw,lockBytes,set})=>{
    assert.equal(parts.size,16);assert.equal(eighths.size,8);
    const [gate,swing,rate,length,chainByte]=set;
    const steps=Array.from({length},(_,k)=>{
      const s=raw.subarray(k*32,k*32+32),marked=(s[29]&0xc0)===0x40,ext=marked&&!!(s[29]&0x20);
      const opt=o=>ext&&s[o]!==0xff?s[o]&0x7f:null;
      const notes=[];for(let j=0;j<Math.min(s[30],9);j++)notes.push({note:s[j],vel:s[20+j]});
      const ends=ext?[...s.subarray(14,20)].filter(n=>n<128):[...s.subarray(11,11+Math.min(s[31],9))];
      const locks=[];for(let j=0;j<4;j++)if(lockBytes[8*k+2*j]!==0xff)locks.push({what:lockBytes[8*k+2*j],value:lockBytes[8*k+2*j+1]});
      const transpose=opt(13);
      return {notes,ends,locks,ratchet:marked?((s[29]>>2)&3)+1:1,gate:opt(11),chance:opt(12)??100,transpose:transpose===null?null:transpose-64};
    });
    return {slot:pat+1,gate,swing,rate,chain:chainByte>=128?(chainByte&15)+1:null,steps};
  });
  // In play order: Pattern 9 first, then along the chain.
  const order=[patterns.find(p=>p.slot===9)];
  while(order.length<patterns.length)order.push(patterns.find(p=>p.slot===order.at(-1).chain));
  return order;
}
const exportWork='(()=>{const work=djNewWork("hard",3);work.takes=[0,1,2,3].map(pass=>new Set(djHandTargets(pass,"hard").map(t=>t.id)));return work;})()';

test('The export fits V102 limits and every note sits in its 8-Bit part’s keys',()=>{
  const {run}=makePage();
  const patterns=decodeV102(run(`encodeDjPatterns(${exportWork})`));
  assert.ok(patterns.length<=16);
  for(const p of patterns){
    assert.ok(p.steps.length>=1&&p.steps.length<=64);
    assert.equal(p.gate,100);assert.equal(p.swing,50);
    for(const st of p.steps){
      assert.ok(st.notes.length<=9);
      assert.ok(st.locks.length<=4);
      assert.equal(new Set(st.notes.map(n=>n.note)).size,st.notes.length);
      for(const {note,vel} of st.notes){assert.ok(note>=17&&note<=112,String(note));assert.ok(vel>=1&&vel<=127);}
    }
  }
  // Take order: music box 1/8T, house and drop 1/16, encore 1/16T, then fireworks and applause 1/32T.
  assert.deepEqual([...new Set(patterns.map(p=>p.rate))],[5,6,7,9]);
});

test('Patterns chain from Pattern 9 in take order and every non-arp event appears once',()=>{
  const {run}=makePage();
  const patterns=decodeV102(run(`encodeDjPatterns(${exportWork})`));
  const slots=patterns.map((_,i)=>(8+i)%16+1);
  assert.deepEqual(patterns.map(p=>p.slot),slots);
  assert.deepEqual(patterns.map(p=>p.chain),patterns.map((_,i)=>slots[(i+1)%patterns.length]));
  const events=run(`djTimeline(${exportWork},{declared:true}).events.filter(e=>e.part!=="fx"&&!e.via).length`);
  // A held arpeggio bass key makes no sound of its own on the web; on the FM-1 it is the key the arp plays from.
  const arpKeys=run(`[1,2].flatMap(p=>djHandTargets(p,"hard")).filter(t=>/^[12]:bass:/.test(t.id)).length`);
  assert.equal(arpKeys,12);
  assert.equal(patterns.flatMap(p=>p.steps.flatMap(s=>s.notes)).length,events+arpKeys);
  // Every note that starts also ends, in its own pattern.
  for(const p of patterns){
    const starts=p.steps.flatMap(s=>s.notes.map(n=>n.note)).sort(),ends=p.steps.flatMap(s=>s.ends).sort();
    assert.deepEqual(ends,starts);
  }
});

test('Ratchet, Chance and the Cutoff and Bits locks survive the round trip',()=>{
  const {run}=makePage();
  const steps=decodeV102(run(`encodeDjPatterns(${exportWork})`)).flatMap(p=>p.steps);
  assert.ok(steps.some(s=>s.ratchet===4));
  assert.ok(steps.some(s=>s.chance>0&&s.chance<100));
  assert.ok(steps.filter(s=>s.chance<100).every(s=>[60,75,80].includes(s.chance)&&!s.locks.length));
  const locks=steps.flatMap(s=>s.locks);
  // Only Filter Cutoff (33) and Bitcrush Bits (56); never an effect's Type or On/Off.
  assert.deepEqual([...new Set(locks.map(l=>l.what))].sort(),[33,56]);
  assert.ok(locks.every(({what,value})=>what===33?value>=0&&value<=107:value>=1&&value<=16));
});

test('Key changes are written into the notes: no step Transpose anywhere',()=>{
  const {run}=makePage();
  const steps=decodeV102(run(`encodeDjPatterns(${exportWork})`)).flatMap(p=>p.steps);
  assert.ok(steps.every(s=>s.transpose===null));
});

test('Firmware mode sends real matrix edges and keeps a key held until its final input is released',async()=>{
  const {run}=makePage();
  run(`const inputs=[];firmwareSession={ready:true,keys:new Map(),volume:560,node:{port:{postMessage(message){inputs.push(message)}}}}`);
  await run(`keyDown(60,'touch1');keyDown(60,'touch2');keyUp('touch1');keyUp('touch2')`);
  run(`firmwareInput('rec',fm1Buttons.indexOf('REC'),true);turn('ALGORITHM',3);firmwareInput('rec',undefined,false);turn('MASTER',-2)`);
  assert.deepEqual(JSON.parse(run('JSON.stringify(inputs)')), [
    {type:'key',id:21,down:true},{type:'key',id:21,down:false},
    {type:'key',id:13,down:true},{type:'enc',enc:1,clicks:3},{type:'key',id:13,down:false},{type:'pot',value:512}
  ]);
  assert.equal(run('sounds.length'),0);
  assert.equal(run(`const base=new Uint8Array(8192),flash=base.slice();flash[4097]=77;
    const delta=firmwareFlashDelta(base,flash);delta.length===4100&&new DataView(delta.buffer).getUint32(0,true)===4096&&delta[5]===77`),true);
});

test('A one-frame firmware key light remains visible before fading and a retrigger cancels its pending fade',()=>{
  const {run,timers,fire,time}=makePage();
  const lit=()=>run(`$('[data-midi="60"]').classList.contains('firmware-key-lit')`);
  run('firmwareLed(21,.3);firmwareLed(21,0)');
  assert.equal(lit(),true);
  const first=run(`$('[data-midi="60"]').firmwareLightTimer`);
  assert.equal(timers.get(first).at-time(),72);
  run('firmwareLed(21,.3)');
  assert.equal(timers.has(first),false);
  run('firmwareLed(21,0)');
  fire(run(`$('[data-midi="60"]').firmwareLightTimer`));
  assert.equal(lit(),false);
});

// Every node under a study body, depth first (the test page's elements keep plain children arrays).
function studyNodes(nodes){
  const all=[],walk=list=>list.forEach(node=>{all.push(node);walk(node.children||[]);});
  walk(nodes.get('#study-content').children);
  return all;
}

test('Power-on goes straight to the song: there is no panel tour anywhere',async()=>{
  const html=site('index.html');
  for(const gone of ['id="panel-tour"','id="replay-tour"','id="tour-','onboarding.js'])assert.ok(!html.includes(gone),gone);
  const {run,nodes,local}=makePage();
  await run('start()');
  for(const name of ['beginTour','finishTour','renderTour','tourSteps','touring','initTour','noteTourAction'])assert.equal(run('typeof '+name),'undefined',name);
  assert.equal(run('typeof openKnobInspector'),'function','the knob inspector stays');
  assert.equal(run('birthdayJourney.step'),'mode');
  assert.equal(nodes.get('#universe').classList.contains('touring'),false);
  assert.equal(nodes.get('#info-button').hidden,false);
  assert.equal([...local.keys()].some(key=>/tour|introduced/.test(key)),false);
});

test('The manual opens straight into lookup: MASTER, a labelled list and a folded glossary',async()=>{
  const {run,nodes,local}=makePage();
  await run('start()');
  nodes.get('#guide-button').onclick();
  assert.equal(run('studyTab'),'manual');
  assert.equal(run('selectedControl.join()'),'knob,MASTER');
  assert.match(nodes.get('#panel-scrim').innerHTML,/<ellipse/);
  const body=nodes.get('#study-content').children;
  assert.equal(body[0].className,'study-lead');
  assert.equal(body[0].textContent,'点一下机器上的按键、按钮或旋钮。');
  const field=body.find(node=>node.className==='study-field');
  const [label,select]=field.children;
  assert.equal(label.textContent,'或从列表里选');
  assert.equal(label.htmlFor,select.id);
  assert.equal(select.id,'study-control-select');
  assert.deepEqual(select.children.map(group=>group.label),['旋钮','按键与屏幕','琴键'],'controls first, then keys');
  assert.equal(select.value,JSON.stringify(['knob','MASTER']));
  const card=body.find(node=>node.className==='study-entry');
  assert.equal(card.children[0].textContent,'MASTER');
  assert.equal(card.children[1].textContent,'音量');
  const glossary=body.find(node=>node.className==='study-glossary');
  assert.equal(glossary.open,false);
  assert.equal(body.at(-1).textContent,'查看真机操作步骤');
  assert.equal(body.at(-1).className,'study-text');
  const text=studyNodes(nodes).map(node=>node.textContent).join('|');
  for(const gone of ['认识面板','下一步','直接查按键','重看面板引导','开始查阅'])assert.ok(!text.includes(gone),gone);
  for(const name of ['firstManualStops','manualStop','completeManualIntro','frameManualStop'])assert.equal(run('typeof '+name),'undefined',name);
  assert.equal(local.has('fm1-manual-introduced'),false);
  await run('control("REC")');
  assert.equal(run('state.recording'),false);
  assert.equal(run('selectedControl[1]'),'REC');
  await run('keyDown(60,"manual-key")');
  assert.equal(run('selectedControl[1]'),60);
  assert.equal(run('heldNotes.size'),0);
  assert.equal(run('[...whiteMidis,...blackMidis].filter(midi=>describePanelKey("key",midi)).length'),27);
});

test('Advanced: three recipes with one Try it each, then a single Sources line',async()=>{
  const {run,nodes}=makePage();
  await run('start()');
  nodes.get('#advanced-button').onclick();
  const body=nodes.get('#study-content').children;
  const cards=body.filter(node=>node.className==='study-card');
  assert.deepEqual(cards.map(card=>card.children[0].textContent),['做一个自己的 FM 铃声','把和弦放到拍子中间','混一套 8‑Bit 小乐队']);
  for(const card of cards){
    const actions=card.children.filter(node=>node.className==='study-action');
    assert.deepEqual(actions.map(node=>node.textContent),['去试试']);
    assert.equal(card.children.some(node=>node.className==='study-link'),false,'links live in Sources');
    assert.ok(card.children[1].textContent.split('。').filter(Boolean).length<=2,'at most two sentences');
  }
  const sources=body.filter(node=>node.className==='study-sources');
  assert.equal(sources.length,1);
  assert.equal(body.at(-1),sources[0]);
  assert.equal(sources[0].children[0].textContent,'资料');
  const links=sources[0].children.filter(node=>node.className==='study-link');
  assert.deepEqual(links.map(link=>link.textContent),['David Hilowitz ↗','Golf Easter · SLOOP ↗','Baud Girl V102 ↗','SLOOP 按键与轨道手册 ↗','Firmware Hub ↗']);
  assert.equal(studyNodes(nodes).filter(node=>node.textContent==='打开自由演奏').length,0);
  cards[1].children.find(node=>node.className==='study-action').onclick();
  assert.equal(run('studyTab'),null);
  assert.equal(run('level'),2);
  assert.equal(run('guided'),false);
});

test('Every pitched key she records sounds at its pitch in the take',async()=>{
  const {run,command,press}=journeyPage();
  await run('start()');
  run("chooseBirthdayMode('hard')");
  for(let pass=0;pass<4;pass++){
    if(pass>0){await command('REC');await command('PLAY');run("$('#mission-next').onclick()");}
    run('turn("ALGORITHM",1)');await command('REC');
    // A chord's last key sounds every member at its pitch; the keys before it are silent.
    const groups=run(`djHandGroups(${pass},'hard')`);
    for(const group of pass<3?groups:groups.slice(0,-1)){
      for(const [index,target] of group.targets.entries()){
        while(run('state.octave')!==target.octave)await command(run('state.octave')>target.octave?'OCT−':'OCT+');
        run('sounds.length=0');
        await press(target.midi-target.octave*12);
        const members=index===group.targets.length-1?group.targets:[];
        const pitched=[...members].filter(t=>t.part==='lead'||t.part==='bass').map(t=>t.sound);
        assert.deepEqual([...run('sounds.map(s=>s.midi)')].filter(m=>m!==undefined),pitched,target.id);
      }
    }
  }
});

test('The card after the journey offers the V102 export and firmware preview in its FM-1 steps',async()=>{
  const {run,nodes,startStandardAtTake}=journeyPage();
  await startStandardAtTake(3);
  assert.doesNotThrow(()=>run('skipBirthdayPass()'));
  run('endBirthdaySurprise()');
  assert.equal(nodes.get('#interlude').hidden,false);
  assert.equal(nodes.get('#birthday-hardware').hidden,true);
  nodes.get('#birthday-fm1').onclick();
  assert.equal(nodes.get('#birthday-hardware').hidden,false);
  assert.equal(nodes.get('#birthday-pattern-download').hidden,false);
  assert.equal(nodes.get('#birthday-firmware-preview').hidden,false);
  assert.doesNotThrow(()=>run('selectBirthdayTake(2)'));
  const takes=nodes.get('#birthday-hardware-takes').children;
  assert.equal(takes.length,4);
  // Each take folds away: a closed details whose summary is its name and slots.
  takes.forEach((item,pass)=>{
    const [details]=item.children,[summary,detail]=details.children;
    assert.equal(details.open,false);
    assert.equal(summary.textContent,run(`T(...djTakes[${pass}].title)+' · '+birthdayHardwareSlots(${pass})`));
    assert.match(summary.textContent,/ · Pattern \d+( → \d+)*$/);
    assert.match(detail.textContent,/Rate/);
  });
  assert.equal(takes[0].children[0].children[0].textContent.startsWith('八音盒 · Pattern 9'),true);
  assert.doesNotThrow(()=>run('encodeDjPatterns(birthdayJourney.work)'));
});

test('Hear this take in V102 sends the take’s exported patterns to the firmware',async()=>{
  const {run,timers,startStandardAtTake}=journeyPage();
  await startStandardAtTake(3);
  run('skipBirthdayPass()');
  run('endBirthdaySurprise()');
  run(`var sent=[];firmwareSession={ready:true,keys:new Map(),birthdayIndex:2,output:{gain:{value:1}},node:{port:{postMessage(message){sent.push(message)}}}};
    Math.random=()=>0;playFirmwareAudition(firmwareSession)`);
  for(const [id,timer] of [...timers].sort((a,b)=>a[1].at-b[1].at)){timers.delete(id);timer.fn();}
  const bytes=run('sent.flatMap(message=>message.bytes)');
  const ons=[];for(let i=0;i<bytes.length;i+=3)if(bytes[i]===0x90)ons.push(bytes[i+1]);
  const steps=run('birthdayHardwareTake(2).patterns.flatMap(p=>p.steps)');
  assert.equal(ons.length,steps.reduce((sum,step)=>sum+step.notes.length*step.ratchet,0));
  assert.equal(run('firmwareSession.audition'),null);
});

test('Skip this take fills the take, plays it once and waits for Next take',async()=>{
  const {run,nodes,command,drain}=journeyPage();
  await run('start()');
  run("chooseBirthdayMode('standard')");
  run('skipBirthdayPass()');
  assert.equal(run('birthdayJourney.step'),'listening');
  assert.equal(run('birthdayJourney.work.mixes[0].wave'),'Triangle');
  assert.equal(run('birthdayJourney.work.takes[0].size'),25);
  await drain();
  assert.equal(run('djPlays.length'),1);
  assert.equal(run('birthdayJourney.step'),'heard');
  assert.equal(run('birthdayJourney.pass'),0);
  run('updateProgress()');
  assert.equal(nodes.get('#counter').textContent,'25 / 25 个音');
  assert.equal(nodes.get('#mission-next').hidden,false);
  assert.equal(nodes.get('#mission-next').textContent,'下一版 →');
  nodes.get('#mission-next').onclick();
  assert.equal(run('birthdayJourney.pass'),1);

  run('turn("ALGORITHM",1)');
  await command('REC');
  const first=run('djNextTarget(birthdayJourney.work)');
  assert.equal(first.octave,-1);
  assert.equal(run('nextCue().text'),'把八度调到 -1 · 还要按 1 次 OCT−');
  await command('OCT−');
  assert.equal(run('nextCue().text'),first.title[1]);

  run('skipBirthdayPass()');
  assert.equal(run('birthdayJourney.work.takes[1].size'),run("djHandTargets(1,'standard').length"));
  await drain();
  nodes.get('#mission-next').onclick();
  run('skipBirthdayPass()');await drain();
  nodes.get('#mission-next').onclick();
  assert.equal(run('birthdayJourney.pass'),3);
  run('skipBirthdayPass()');
  assert.equal(run('birthdayJourney.step'),'finished');
  const last=run("djHandTargets(3,'standard').at(-1)");
  assert.equal(run('birthdayJourney.work.mixes[3].accent'),last.midi-12);
  assert.equal(nodes.get('#interlude').dataset.celebrating,'yes');
});

test('The mode step offers Standard and Hard and starts take 1',async()=>{
  const {run,nodes}=journeyPage();
  await run('start()');run('updateProgress()');
  assert.equal(nodes.get('#mode-standard').hidden,false);
  assert.equal(nodes.get('#mode-hard').hidden,false);
  assert.equal(nodes.get('#dock-skip').hidden,true);
  assert.equal(nodes.get('#mode-standard').textContent,'标准');
  nodes.get('#mode-hard').onclick();
  assert.equal(run('birthdayJourney.work.mode'),'hard');
  assert.equal(run('birthdayJourney.step'),'voice');
  assert.equal(nodes.get('#mode-standard').hidden,true);
  assert.equal(nodes.get('#mode-hard').hidden,true);
});

test('Only standard and hard are modes',async()=>{
  const {run}=journeyPage();
  await run('start()');
  for(const bad of ['easy',undefined,null,'','Hard'])run(`chooseBirthdayMode(${JSON.stringify(bad)===undefined?'undefined':JSON.stringify(bad)})`);
  assert.equal(run('birthdayJourney.step'),'mode');
  assert.equal(run('birthdayJourney.work'),null);
});

test('After the last key the cheer waits for a tap, then the card shows one timeline of four takes',async()=>{
  const {run,nodes,finishedStandardWork}=journeyPage();
  await finishedStandardWork();
  assert.equal(nodes.get('#interlude').dataset.celebrating,'yes');
  assert.equal(nodes.get('#birthday-surprise').hidden,false);
  assert.equal(run('birthdayCelebrationTimer'),undefined);
  assert.equal(run('birthdayTimers.size'),0);
  nodes.get('#birthday-skip').onclick();
  assert.equal(nodes.get('#birthday-surprise').hidden,true);
  assert.equal(nodes.get('#interlude').dataset.celebrating,undefined);
  const segments=nodes.get('#birthday-timeline').children;
  assert.equal(segments.length,4);
  segments.forEach((segment,pass)=>{
    assert.match(segment.getAttribute('aria-label'),new RegExp('第 '+(pass+1)+' 版'));
    assert.ok(segment.children[0].children.length>0,'her notes are drawn inside take '+(pass+1));
  });
  assert.equal(segments[0].getAttribute('aria-current'),'true');
  assert.equal(nodes.get('#birthday-status').textContent,run('T(...djTakes[0].title)'));
  const length=run('djTimeline(birthdayJourney.work).length'),clock=Math.floor(length/60)+':'+String(Math.floor(length)%60).padStart(2,'0');
  assert.equal(nodes.get('#birthday-time').textContent,'0:00 / '+clock);
  const played=run('birthdayJourney.work.takes.reduce((sum,take)=>sum+take.size,0)');
  assert.equal(nodes.get('#win-detail').textContent,'四版 · '+clock+' · 你亲手弹了 '+played+' 个音');
});

test('Play all is the card’s only primary action; the birthday show is a quiet tile under it',async()=>{
  const html=site('index.html');
  const player=html.slice(html.indexOf('id="birthday-player-view"'),html.indexOf('id="birthday-hardware"'));
  assert.equal(player.match(/birthday-primary/g).length,1);
  assert.match(player,/<button id="birthday-play"[^>]*class="birthday-primary"/);
  assert.match(player,/<button id="premiere-open" type="button" hidden>/);
  for(const gone of ['share-video','share-more','share-download','birthday-share','birthday-roll','birthday-reel','birthday-takes','birthday-recap','birthday-explore','birthday-manual','birthday-advanced','share-make','share-dialog'])assert.ok(!html.includes('id="'+gone+'"'),gone);
  for(const gone of ['birthday-share','share-video','sendShareVideo'])assert.ok(!site('finale.js').includes(gone),gone);
  const {nodes,finishedStandardWork,loadFull}=premierePage();
  await finishedStandardWork();
  nodes.get('#birthday-skip').onclick();
  await loadFull();
  assert.equal(nodes.get('#premiere-open').hidden,false);
  assert.equal(nodes.get('#premiere-open-label').textContent,'看你的生日现场');
  assert.equal(nodes.get('#birthday-play').textContent,'播放全部');
});

// A journey page with fake video files (fed by hand per URL), share sheet, clipboard and <video>.
function premierePage({files=2,ios=false,clipboard=true,agent}={}){
  const page=journeyPage();
  const {run,nodes}=page;
  run(`var shared=[],made=[],fetched=[],feeds={},copied=[],urls=0;
    globalThis.Blob=class{constructor(parts,options){this.parts=parts;this.type=options?.type;}};
    globalThis.File=class{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options?.type;}};
    globalThis.URL={createObjectURL:()=>'blob:'+(++urls),revokeObjectURL(){}};
    globalThis.navigator={userAgent:${JSON.stringify(ios?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)':'Mozilla/5.0 (Macintosh)')},platform:'',maxTouchPoints:0,...${JSON.stringify(agent||{})},
      canShare:data=>data.files.length<=${files}&&data.files.every(file=>file instanceof File),
      share:async data=>{shared.push(data.files.map(file=>file.name));},
      clipboard:{writeText:${clipboard?'async text=>{copied.push(text);}':'async()=>{throw new Error("denied");}'}}};
    globalThis.fetch=url=>{fetched.push(url);return new Promise((resolve,reject)=>{
      const queue=[],waiting=[];
      const read=()=>new Promise(take=>{if(queue.length)take(queue.shift());else waiting.push(take);});
      const give=item=>{if(waiting.length)waiting.shift()(item);else queue.push(item);};
      feeds[url]={respond:(ok=true)=>resolve({ok,status:ok?200:404,headers:{get:name=>name==='content-length'?'100':null},body:{getReader:()=>({read})}}),
        push:bytes=>give({done:false,value:{length:bytes}}),end:()=>give({done:true}),fail:()=>reject(new TypeError('Failed to fetch'))};
    });};
    const makeElement=document.createElement;document.createElement=tag=>{const node=makeElement(tag);node.tagName=tag;made.push(node);return node;};`);
  const doc=run('document');
  for(const node of nodes.values())node.focus=function(){doc.activeElement=this;};
  const video=nodes.get('#premiere-video');
  Object.assign(video,{paused:true,currentTime:0,duration:87.3,plays:0,muted:false,volume:1,
    play(){this.plays++;this.paused=false;(this.listeners.play||[]).forEach(f=>f());return Promise.resolve();},
    pause(){this.paused=true;(this.listeners.pause||[]).forEach(f=>f());}});
  const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
  const full='assets/share/happy-birthday.mp4',parts=['assets/share/happy-birthday-story-1.mp4','assets/share/happy-birthday-story-2.mp4'];
  const load=async url=>{run(`feeds[${JSON.stringify(url)}].respond();feeds[${JSON.stringify(url)}].push(60);feeds[${JSON.stringify(url)}].push(40);feeds[${JSON.stringify(url)}].end()`);await flush();};
  const loadFull=()=>load(full);
  // Video events on the <video>; keys go to the show's document-wide handler.
  const fire=(name,event={})=>name==='keydown'?run('premiereKey')({preventDefault(){},...event}):(nodes.get('#premiere-video').listeners[name]||[]).forEach(f=>f({preventDefault(){},...event}));
  // A finished song with its video here and the card's cheer dismissed: ready to open the show.
  const ready=async()=>{await page.finishedStandardWork();nodes.get('#birthday-skip').onclick();await loadFull();};
  const atEnd=async()=>{await ready();run('reduced.matches=false');nodes.get('#premiere-open').onclick();fire('ended');};
  const json=expression=>JSON.parse(run('JSON.stringify('+expression+')'));
  return {...page,flush,load,loadFull,full,parts,video,doc,fire,ready,atEnd,json};
}

test('The birthday show is a step on the finished card only, and its video downloads from take 4, not before',async()=>{
  const p=premierePage();
  await p.startStandardAtTake(2);
  assert.equal(p.run('fetched.length'),0,'take 3: nothing downloads yet');
  p.run('skipBirthdayPass()');
  await p.finishPass();
  assert.equal(p.run('birthdayJourney.pass'),3);
  assert.deepEqual(p.json('fetched'),[p.full],'take 4: the full video, in the background');
  assert.equal(p.nodes.get('#premiere-open').hidden,true,'no show before the song is finished');
  p.run('skipBirthdayPass()');
  assert.equal(p.run('birthdayJourney.step'),'finished');
  p.nodes.get('#birthday-skip').onclick();
  assert.equal(p.nodes.get('#premiere-open').hidden,false,'on the card while it still downloads');
  p.run('closeBirthdayPlayer();openBirthdayPlayer()');
  assert.deepEqual(p.json('fetched'),[p.full],'once per page, and never the Story halves unasked');
  // A half-finished song restored on this device: no show, no download.
  const half=premierePage();
  await half.startStandardAtTake(2);
  half.run('openBirthdayPlayer()');
  assert.equal(half.nodes.get('#premiere-open').hidden,true);
  assert.equal(half.run('fetched.length'),0);
});

test('Opening the show plays it full screen with sound; with reduced motion the poster waits under a play button',async()=>{
  const p=premierePage();
  await p.ready();
  p.run('reduced.matches=false');
  p.nodes.get('#premiere-open').onclick();
  assert.equal(p.nodes.get('#premiere').hidden,false);
  assert.equal(p.nodes.get('#interlude').inert,true);
  assert.equal(p.video.src,'blob:1');
  assert.equal(p.video.plays,1);
  assert.equal(p.nodes.get('#premiere-surface').getAttribute('aria-label'),'暂停');
  assert.equal(p.nodes.get('#premiere-loading').hidden,true);
  p.nodes.get('#premiere-surface').onclick();
  assert.equal(p.video.paused,true,'a tap pauses');
  assert.equal(p.nodes.get('#premiere-surface').dataset.state,'paused');
  p.nodes.get('#premiere-surface').onclick();
  assert.equal(p.video.plays,2,'another tap plays on');
  p.video.pause();
  assert.equal(p.nodes.get('#premiere-surface').dataset.state,'paused','a pause from outside shows the play button');
  p.nodes.get('#premiere-surface').onclick();
  assert.equal(p.video.plays,3);
  const calm=premierePage();
  await calm.ready();
  calm.nodes.get('#premiere-open').onclick();
  assert.equal(calm.video.plays,0,'reduced motion: no autoplay');
  assert.equal(calm.nodes.get('#premiere-surface').dataset.state,'paused');
  assert.equal(calm.nodes.get('#premiere-surface').getAttribute('aria-label'),'播放');
  calm.nodes.get('#premiere-surface').onclick();
  assert.equal(calm.video.plays,1);
  const html=site('index.html');
  assert.match(html,/<video id="premiere-video" playsinline preload="auto" poster="assets\/share\/happy-birthday-poster\.webp"><\/video>/);
  assert.ok(fs.existsSync(path.join(__dirname,'../site/assets/share/happy-birthday-poster.webp')));
});

test('Opened before the video is here, the poster shows a quiet progress line and it starts when ready',async()=>{
  const p=premierePage();
  await p.finishedStandardWork();
  p.nodes.get('#birthday-skip').onclick();
  p.run('reduced.matches=false');
  p.nodes.get('#premiere-open').onclick();
  const line=p.nodes.get('#premiere-loading');
  assert.equal(line.hidden,false);
  assert.equal(line.textContent,'正在加载视频… 0%');
  const voice=p.nodes.get('#premiere-announce');
  assert.equal(voice.textContent,'正在加载视频','the live region hears the start, not the number');
  p.run(`feeds[${JSON.stringify(p.full)}].respond();feeds[${JSON.stringify(p.full)}].push(42)`);
  await p.flush();
  assert.equal(line.textContent,'正在加载视频… 42%');
  assert.equal(voice.textContent,'正在加载视频… 25%','then in quarters only');
  assert.equal(p.video.plays,0);
  p.run(`feeds[${JSON.stringify(p.full)}].push(58);feeds[${JSON.stringify(p.full)}].end()`);
  await p.flush();
  assert.equal(p.video.plays,1);
  assert.equal(line.hidden,true);
  assert.equal(voice.textContent,'视频准备好了。');
  const html=site('index.html');
  assert.match(html,/<p id="premiere-loading" aria-hidden="true" hidden><\/p>/);
  assert.match(html,/<p id="premiere-announce" role="status"><\/p>/);
  assert.match(site('style.css'),/#premiere-loading\{[^}]*font-variant-numeric:tabular-nums/);
});

test('The video plays through the site volume bus, or follows the site volume where it cannot',async()=>{
  const p=premierePage();
  await p.ready();
  p.run(`var connected=[];
    const node=()=>({gain:{value:1,setTargetAtTime(){}},threshold:{},knee:{},ratio:{},attack:{},release:{},connect(t){return t;}});
    synth.context={state:'running',currentTime:0,destination:{},createGain:node,createDynamicsCompressor:node,createWaveShaper:node,
      createMediaElementSource:element=>({element,connect(target){connected.push(target);}})};`);
  p.run('reduced.matches=false');
  p.nodes.get('#premiere-open').onclick();
  assert.equal(p.run('connected.length'),1);
  assert.equal(p.run('connected[0]===siteBus(synth.context)'),true);
  const bare=premierePage();
  await bare.ready();
  bare.run('setSiteSound({level:.3,muted:false})');
  bare.nodes.get('#premiere-open').onclick();
  assert.equal(bare.video.muted,false);
  assert.ok(Math.abs(bare.video.volume-.6)<1e-9);
  bare.run('setSiteSound({muted:true})');
  (bare.video.listeners.timeupdate||[]).forEach(f=>f());
  assert.equal(bare.video.muted,true);
});

test('✕ and Escape close the show and give focus back; Tab stays inside it',async()=>{
  const p=premierePage();
  await p.ready();
  const tile=p.nodes.get('#premiere-open');
  for(const close of [()=>p.fire('keydown',{key:'Escape'}),()=>p.nodes.get('#premiere-close').onclick()]){
    tile.focus();
    tile.onclick();
    assert.equal(p.doc.activeElement,p.nodes.get('#premiere-surface'));
    p.fire('keydown',{key:'Tab'});
    assert.equal(p.doc.activeElement,p.nodes.get('#premiere-close'));
    p.fire('keydown',{key:'Tab'});
    assert.equal(p.doc.activeElement,p.nodes.get('#premiere-surface'));
    p.fire('keydown',{key:'Tab',shiftKey:true});
    assert.equal(p.doc.activeElement,p.nodes.get('#premiere-close'));
    close();
    assert.equal(p.nodes.get('#premiere').hidden,true);
    assert.equal(p.nodes.get('#interlude').inert,false);
    assert.equal(p.video.paused,true);
    assert.equal(p.doc.activeElement,tile);
  }
  assert.equal(p.nodes.get('#premiere-close').getAttribute('aria-label'),'关闭');
  assert.match(site('style.css'),/#premiere-close\{[^}]*width:44px;height:44px/);
});

test('At the end the title card holds, and Share, Save and Watch again rise in',async()=>{
  const p=premierePage();
  await p.atEnd();
  const {nodes}=p;
  assert.equal(nodes.get('#premiere-end').hidden,false);
  assert.equal(nodes.get('#premiere-end-main').hidden,false);
  assert.equal(nodes.get('#premiere-surface').hidden,true);
  assert.equal(nodes.get('#premiere-share').textContent,'分享到 Instagram');
  assert.equal(nodes.get('#premiere-save').textContent,'保存到相册');
  assert.equal(nodes.get('#premiere-again').textContent,'再看一次');
  assert.equal(nodes.get('#premiere-save-hint').hidden,true,'the Save Video hint is for iPhone only');
  assert.equal(p.doc.activeElement,nodes.get('#premiere-share'));
  assert.equal(p.video.currentTime,0,'the fake never moves; the real one stays on its last frame');
  const css=site('style.css');
  assert.match(css,/--premiere-ease:cubic-bezier\(\.32,\.72,0,1\)/);
  assert.match(css,/#premiere-end>div\{[^}]*animation:premiere-rise 220ms var\(--premiere-ease\) both/);
  assert.match(css,/@keyframes premiere-rise\{from\{opacity:0;transform:translateY\(8px\)\}\}/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#premiere-end>div\{animation:none\}\}/);
  assert.doesNotMatch(css,/transition:all/);
  nodes.get('#premiere-again').onclick();
  assert.equal(nodes.get('#premiere-end').hidden,true);
  assert.equal(p.video.plays,2);
});

test('Share copies the caption and asks where it goes; Reels shares one file named happy-birthday.mp4',async()=>{
  const p=premierePage();
  await p.atEnd();
  const {nodes,run}=p;
  nodes.get('#premiere-share').onclick();
  await p.flush();
  assert.deepEqual(p.json('copied'),['生日快乐 DJ GAO 🎂']);
  assert.equal(nodes.get('#premiere-status').textContent,'文案已复制，在 Instagram 里粘贴。');
  assert.equal(nodes.get('#premiere-choose').hidden,false);
  assert.equal(nodes.get('#premiere-choose-title').textContent,'发到哪里？');
  assert.equal(nodes.get('#premiere-reels-hint').textContent,'在分享菜单里选 Instagram → Reels。');
  assert.equal(nodes.get('#premiere-story-label').textContent,'快拍');
  nodes.get('#premiere-reels').onclick();
  await p.flush();
  assert.deepEqual(p.json('shared'),[['happy-birthday.mp4']]);
  assert.deepEqual(p.json('fetched'),[p.full],'Reels needs nothing more');
  // A clipboard that refuses stays silent.
  const quiet=premierePage({clipboard:false});
  await quiet.atEnd();
  quiet.nodes.get('#premiere-share').onclick();
  await quiet.flush();
  assert.equal(quiet.nodes.get('#premiere-status').textContent,'');
  assert.equal(quiet.nodes.get('#premiere-choose').hidden,false);
});

test('Where the full file cannot be shared, Reels saves it instead',async()=>{
  const p=premierePage({files:0});
  await p.atEnd();
  p.nodes.get('#premiere-share').onclick();
  p.run('made.length=0');
  p.nodes.get('#premiere-reels').onclick();
  const link=p.run('made.find(node=>node.tagName==="a")');
  assert.equal(link.download,'happy-birthday.mp4');
  assert.equal(link.clicks,1);
  assert.equal(p.run('shared.length'),0);
});

test('Story downloads only the two halves, then Share 2 clips shares them in order',async()=>{
  const p=premierePage();
  await p.atEnd();
  const {nodes,run}=p;
  nodes.get('#premiere-share').onclick();
  nodes.get('#premiere-story').onclick();
  assert.deepEqual(p.json('fetched'),[p.full,...p.parts]);
  assert.equal(nodes.get('#premiere-story-view').hidden,false);
  assert.equal(nodes.get('#premiere-story-share').hidden,true,'no share until both are here');
  assert.equal(nodes.get('#premiere-story-progress').textContent,'正在准备快拍… 0%');
  await p.load(p.parts[0]);
  assert.equal(nodes.get('#premiere-story-progress').textContent,'正在准备快拍… 50%');
  await p.load(p.parts[1]);
  const button=nodes.get('#premiere-story-share');
  assert.equal(button.hidden,false);
  assert.equal(button.textContent,'分享 2 段');
  assert.equal(nodes.get('#premiere-story-hint2').children.map(span=>span.textContent).join(''),'先发第 1 段，再发第 2 段。');
  assert.equal(p.doc.activeElement,button);
  button.onclick();
  await p.flush();
  assert.deepEqual(p.json('shared'),[['happy-birthday-story-1.mp4','happy-birthday-story-2.mp4']]);
  nodes.get('#premiere-story').onclick();
  assert.equal(run('fetched.length'),3,'fetched once per page');
});

test('Story falls back to saving both parts when two clips cannot be shared together',async()=>{
  const toSaves=async(options,setup='')=>{
    const p=premierePage(options);
    await p.atEnd();
    p.nodes.get('#premiere-share').onclick();
    p.nodes.get('#premiere-story').onclick();
    await p.load(p.parts[0]);await p.load(p.parts[1]);
    p.run(setup);
    p.nodes.get('#premiere-story-share').onclick();
    await p.flush();
    return p;
  };
  for(const p of [await toSaves({files:1}),await toSaves({},`navigator.share=async()=>{throw Object.assign(new Error('no'),{name:'NotAllowedError'});}`)]){
    const {nodes}=p;
    assert.equal(nodes.get('#premiere-saves').hidden,false);
    assert.equal(nodes.get('#premiere-part-1').textContent,'保存第 1 段');
    assert.equal(nodes.get('#premiere-part-2').textContent,'保存第 2 段');
    assert.equal(nodes.get('#premiere-part-1').download,'happy-birthday-story-1.mp4');
    assert.equal(nodes.get('#premiere-part-2').download,'happy-birthday-story-2.mp4');
    assert.match(nodes.get('#premiere-part-1').href,/^blob:/);
    assert.equal(p.run('shared.length'),0);
  }
  const dismissed=await toSaves({},`navigator.share=async()=>{throw Object.assign(new Error('no'),{name:'AbortError'});}`);
  assert.equal(dismissed.nodes.get('#premiere-saves').hidden,true,'dismissing the sheet changes nothing');
  assert.equal(dismissed.nodes.get('#premiere-story-view').hidden,false);
});

test('Save to Photos opens the share sheet on iPhone and downloads elsewhere',async()=>{
  const phone=premierePage({ios:true});
  await phone.atEnd();
  assert.equal(phone.nodes.get('#premiere-save-hint').hidden,false);
  assert.deepEqual(phone.nodes.get('#premiere-save-hint').children.map(span=>span.textContent),['「保存到相册」会打开分享菜单，','选「存储视频」。'],'whole phrases, so it never breaks inside one');
  phone.nodes.get('#premiere-save').onclick();
  await phone.flush();
  assert.deepEqual(phone.json('shared'),[['happy-birthday.mp4']]);
  const desk=premierePage();
  await desk.atEnd();
  desk.run('made.length=0');
  desk.nodes.get('#premiere-save').onclick();
  const link=desk.run('made.find(node=>node.tagName==="a")');
  assert.equal(link.download,'happy-birthday.mp4');
  assert.equal(link.clicks,1);
  assert.equal(desk.run('shared.length'),0);
});

test('Only an iPhone or a real iPad gets the Save Video hint; a touch Mac (desktop emulation) downloads',async()=>{
  const emulated=premierePage({agent:{platform:'MacIntel',maxTouchPoints:5}});
  await emulated.atEnd();
  assert.equal(emulated.nodes.get('#premiere-save-hint').hidden,true);
  emulated.run('made.length=0');
  emulated.nodes.get('#premiere-save').onclick();
  assert.equal(emulated.run('made.find(node=>node.tagName==="a")').download,'happy-birthday.mp4');
  assert.equal(emulated.run('shared.length'),0);
  const ipad=premierePage({agent:{platform:'MacIntel',maxTouchPoints:5,standalone:false}});
  await ipad.atEnd();
  assert.equal(ipad.nodes.get('#premiere-save-hint').hidden,false);
});

test('Picking Story keeps focus in the show, and keys reach it from anywhere while it is open',async()=>{
  const p=premierePage();
  await p.atEnd();
  const {nodes}=p;
  nodes.get('#premiere-share').onclick();
  nodes.get('#premiere-story').onclick();
  assert.equal(p.doc.activeElement,nodes.get('#premiere-back'),'Back holds focus while the clips load');
  assert.match(site('premiere.js'),/document\.addEventListener\('keydown',premiereKey\)/);
  p.fire('keydown',{key:'Escape'});
  assert.equal(nodes.get('#premiere-choose').hidden,false,'Escape steps back to the choice');
});

test('A muted site shows one speaker beside ✕ that brings the sound back; the page behind is inert',async()=>{
  const p=premierePage();
  await p.ready();
  p.run('setSiteSound({muted:true})');
  p.nodes.get('#premiere-open').onclick();
  assert.equal(p.nodes.get('#utility-controls').inert,true);
  const sound=p.nodes.get('#premiere-sound');
  assert.equal(sound.hidden,false);
  assert.equal(sound.getAttribute('aria-label'),'声音已关，打开声音');
  sound.onclick();
  assert.equal(p.run('siteSound.muted'),false);
  assert.equal(sound.hidden,true);
  assert.notEqual(p.doc.activeElement,sound,'focus moves off the button that went away');
  p.nodes.get('#premiere-close').onclick();
  assert.equal(p.nodes.get('#utility-controls').inert,false);
  const loud=premierePage();
  await loud.ready();
  loud.nodes.get('#premiere-open').onclick();
  assert.equal(loud.nodes.get('#premiere-sound').hidden,true,'no speaker while the sound is on');
  assert.match(site('style.css'),/#premiere-sound\{[^}]*width:44px;height:44px/);
});

test('Saving the parts one by one ticks each off and moves to the next',async()=>{
  const p=premierePage({files:1});
  await p.atEnd();
  const {nodes}=p;
  nodes.get('#premiere-share').onclick();
  nodes.get('#premiere-story').onclick();
  await p.load(p.parts[0]);await p.load(p.parts[1]);
  nodes.get('#premiere-story-share').onclick();
  nodes.get('#premiere-part-1').onclick();
  assert.equal(nodes.get('#premiere-part-1').textContent,'第 1 段已保存 ✓');
  assert.equal(nodes.get('#premiere-part-2').textContent,'保存第 2 段');
  assert.equal(p.doc.activeElement,nodes.get('#premiere-part-2'));
});

test('Premiere buttons press with the scale property alone, and the two choices share a top line',()=>{
  const css=site('style.css');
  const premiere=css.slice(css.indexOf('#premiere-open{'));
  assert.doesNotMatch(premiere,/premiere[^{]*:active\{transform:scale/);
  assert.match(css,/\.premiere-primary:active\{scale:\.97\}/);
  assert.match(css,/\.premiere-choice\{[^}]*justify-content:flex-start/);
  const html=site('index.html');
  assert.ok(html.indexOf('id="premiere-status"')<html.indexOf('id="premiere-back"'),'the copied note sits above Back');
});

test('Escape steps back one view at a time onto the control that opened it, and closes only from the top',async()=>{
  const p=premierePage({files:1});
  await p.atEnd();
  const {nodes}=p;
  const escape=()=>p.fire('keydown',{key:'Escape'});
  nodes.get('#premiere-share').onclick();
  escape();
  assert.equal(nodes.get('#premiere-end-main').hidden,false);
  assert.equal(p.doc.activeElement,nodes.get('#premiere-share'));
  nodes.get('#premiere-share').onclick();
  nodes.get('#premiere-story').onclick();
  escape();
  assert.equal(nodes.get('#premiere-choose').hidden,false);
  assert.equal(p.doc.activeElement,nodes.get('#premiere-story'));
  nodes.get('#premiere-story').onclick();
  await p.load(p.parts[0]);await p.load(p.parts[1]);
  nodes.get('#premiere-story-share').onclick();
  assert.equal(nodes.get('#premiere-saves').hidden,false);
  escape();
  assert.equal(nodes.get('#premiere-choose').hidden,false);
  assert.equal(p.doc.activeElement,nodes.get('#premiere-story'));
  escape();escape();
  assert.equal(nodes.get('#premiere').hidden,true,'from the end controls, Escape closes');
});

test('Story progress is announced in quarters and once when ready; the visible line counts every percent',async()=>{
  const p=premierePage();
  await p.atEnd();
  const {nodes,run}=p;
  nodes.get('#premiere-share').onclick();
  nodes.get('#premiere-story').onclick();
  const voice=nodes.get('#premiere-announce');
  assert.equal(voice.textContent,'正在准备快拍');
  run(`feeds[${JSON.stringify(p.parts[0])}].respond();feeds[${JSON.stringify(p.parts[0])}].push(70)`);
  await p.flush();
  assert.equal(nodes.get('#premiere-story-progress').textContent,'正在准备快拍… 35%');
  assert.equal(voice.textContent,'正在准备快拍… 25%');
  run(`feeds[${JSON.stringify(p.parts[0])}].push(30);feeds[${JSON.stringify(p.parts[0])}].end()`);
  await p.load(p.parts[1]);
  assert.equal(voice.textContent,'快拍的两段准备好了。');
  assert.match(site('index.html'),/<p id="premiere-story-progress" class="premiere-hint" aria-hidden="true">/);
  assert.match(site('style.css'),/\.premiere-hint>span\{display:inline-block\}/);
});

test('A video that cannot be fetched quietly takes its option away',async()=>{
  for(const fail of ['fail()','respond(false)']){
    const p=premierePage();
    await p.finishedStandardWork();
    p.nodes.get('#birthday-skip').onclick();
    p.run(`feeds[${JSON.stringify(p.full)}].${fail}`);
    await p.flush();
    assert.equal(p.nodes.get('#premiere-open').hidden,true,fail);
    p.run('openPremiere()');
    assert.equal(p.nodes.get('#premiere').hidden,true,fail);
  }
  const p=premierePage();
  await p.atEnd();
  p.nodes.get('#premiere-share').onclick();
  p.nodes.get('#premiere-story').onclick();
  p.run(`feeds[${JSON.stringify(p.parts[0])}].fail()`);
  await p.flush();
  assert.equal(p.nodes.get('#premiere-choose').hidden,false,'back to the choice');
  assert.equal(p.nodes.get('#premiere-story').hidden,true,'without Story');
  assert.equal(p.nodes.get('#premiere-reels').hidden,false);
  assert.equal(p.nodes.get('#premiere-status').textContent,'快拍的两段没能加载。');
});

test('The site no longer makes video: no recorder, no three.js, and the offline file does not carry the video',()=>{
  const root=path.join(__dirname,'..');
  for(const gone of ['site/share-video.js','site/share-scene.js','site/assets/three'])assert.equal(fs.existsSync(path.join(root,gone)),false,gone);
  const code=fs.readdirSync(path.join(root,'site')).filter(name=>name.endsWith('.js')).map(site).join('\n');
  for(const gone of ['MediaRecorder','captureStream','webgl2','share-scene','three.module'])assert.ok(!code.includes(gone),gone);
  assert.ok(!site('index.html').includes('share-video.js'));
  const out=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'share-export-'));
  const run=(cmd,args)=>require('node:child_process').execFileSync(cmd,args,{cwd:root,encoding:'utf8'});
  run('python3',['tools/package_site.py',out]);
  const html=fs.readFileSync(path.join(out,'A Little Sound Adventure.html'),'utf8');
  for(const gone of ['three-module','share-scene-module','data:video'])assert.ok(!html.includes(gone),gone);
  const names=run('python3',['-c','import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))',path.join(out,'A Little Sound Adventure - website.zip')]).split('\n');
  assert.ok(names.includes('assets/share/happy-birthday.mp4'));
  fs.rmSync(out,{recursive:true,force:true});
});

test('Play all four walks the takes in order',async()=>{
  const {run,nodes,finishedStandardWork,fireNextBirthdayTimer}=journeyPage();
  await finishedStandardWork();
  run('djPlays.length=0');
  nodes.get('#birthday-play').onclick();await Promise.resolve();
  assert.equal(run('djPlays.length'),1);
  assert.equal(run('djPlays[0].events.length'),run('djTimeline(birthdayJourney.work).events.length'));
  assert.equal(run('djPlays[0].options.from'),0);
  assert.equal(nodes.get('#birthday-play').textContent,'暂停');
  const seen=[];
  while(run('birthdayMusicPlaying')){const a=nodes.get('#interlude').dataset.arrangement;if(seen.at(-1)!==a)seen.push(a);fireNextBirthdayTimer();}
  assert.deepEqual(seen,['0','1','2','3']);
  assert.equal(run('birthdayTimers.size'),0);
  assert.equal(nodes.get('#birthday-play').textContent,'播放全部');
});

test('Tapping a timeline segment plays from that take; pause keeps the place',async()=>{
  const {run,nodes,finishedStandardWork}=journeyPage();
  await finishedStandardWork();
  nodes.get('#birthday-skip').onclick();
  run('djPlays.length=0');
  const segments=nodes.get('#birthday-timeline').children;
  segments[2].onclick();await Promise.resolve();
  const start=run('djTimeline(birthdayJourney.work).takeStarts[2]');
  assert.equal(run('djPlays.length'),1);
  assert.equal(run('djPlays[0].events.length'),run('djTimeline(birthdayJourney.work).events.length'));
  assert.equal(run('djPlays[0].options.from'),start);
  assert.equal(nodes.get('#interlude').dataset.arrangement,'2');
  assert.equal(segments[2].getAttribute('aria-current'),'true');
  assert.equal(segments[0].getAttribute('aria-current'),undefined);
  assert.equal(nodes.get('#birthday-status').textContent,run('T(...djTakes[2].title)'));
  // The primary button pauses: the player is torn down and the place is kept.
  nodes.get('#birthday-play').onclick();
  assert.equal(run('djPlays[0].stopped'),true);
  assert.equal(run('birthdayMusicPlaying'),false);
  assert.equal(run('birthdayTimers.size'),0);
  assert.equal(nodes.get('#birthday-play').textContent,'继续播放');
  nodes.get('#birthday-play').onclick();await Promise.resolve();
  assert.equal(run('djPlays[1].options.from'),start);
  // Another segment while playing jumps there.
  segments[1].onclick();await Promise.resolve();
  assert.equal(run('djPlays[1].stopped'),true);
  assert.equal(run('djPlays[2].options.from'),run('djTimeline(birthdayJourney.work).takeStarts[1]'));
  assert.equal(nodes.get('#interlude').dataset.arrangement,'1');
});

test('If audio startup stalls, the card offers a working play button',async()=>{
  const {run,nodes,finishedStandardWork,fireNextBirthdayTimer}=journeyPage();
  await finishedStandardWork();
  run('djPlays.length=0;synth.context={state:"suspended"};synth.wake=()=>new Promise(()=>{})');
  nodes.get('#birthday-play').onclick();
  fireNextBirthdayTimer();
  assert.match(nodes.get('#birthday-status').textContent,/播放/);
  assert.equal(run('birthdayMusicPlaying'),false);
  run('synth.wake=async()=>{};synth.context={state:"running"}');
  nodes.get('#birthday-play').onclick();await Promise.resolve();
  assert.equal(run('djPlays.length'),1);
});

test('Free play level 2: no next button unless the song was finished, then it opens the DJ card',async()=>{
  const never=journeyPage();
  await never.run('start()');
  never.run('openPlayground(2);updateProgress()');
  never.run('stageDone=()=>true;updateProgress()');
  assert.equal(never.nodes.get('#mission-next').hidden,true);
  never.nodes.get('#mission-next').onclick();
  assert.equal(never.run('level'),2);

  const done=journeyPage();
  await done.finishedStandardWork();
  done.nodes.get('#birthday-skip').onclick();
  done.run('openPlayground(2);stageDone=()=>true;updateProgress()');
  assert.equal(done.nodes.get('#interlude').hidden,true);
  assert.equal(done.nodes.get('#mission-next').hidden,false);
  assert.equal(done.nodes.get('#mission-next').textContent,'我的生日歌 →');
  done.nodes.get('#mission-next').onclick();
  assert.equal(done.run('level'),2);
  assert.equal(done.nodes.get('#interlude').hidden,false);
});

for(const [name,stop] of [['closing the card',({nodes})=>nodes.get('#birthday-close').onclick()],['hiding the page',({run})=>run('document.hidden=true;fireVisibility()')]]){
  test('Play all stops completely when '+name,async()=>{
    const page=journeyPage();
    await page.finishedStandardWork();
    page.run('djPlays.length=0');
    page.nodes.get('#birthday-play').onclick();await Promise.resolve();
    assert.equal(page.run('birthdayMusicPlaying'),true);
    stop(page);
    assert.equal(page.run('djPlays[0].stopped'),true);
    assert.equal(page.run('birthdayTimers.size'),0);
    assert.equal(page.run('birthdayMusicPlaying'),false);
  });
}

test('The dock skip shows in voice, record and notes; mode labels follow the language',async()=>{
  const {run,nodes,command}=journeyPage();
  await run('start()');run('updateProgress()');
  run('language="en";copy()');
  assert.equal(nodes.get('#mode-standard').textContent,'Standard');
  assert.equal(nodes.get('#mode-hard').textContent,'Hard · play every layer');
  run("chooseBirthdayMode('standard')");run('updateProgress()');
  assert.equal(nodes.get('#dock-skip').hidden,false);
  run('turn("ALGORITHM",1)');run('updateProgress()');
  assert.equal(run('birthdayJourney.step'),'record');
  assert.equal(nodes.get('#dock-skip').hidden,false);
  await command('REC');run('updateProgress()');
  assert.equal(run('birthdayJourney.step'),'notes');
  assert.equal(nodes.get('#dock-skip').hidden,false);
});

test('Reloading a finished work opens My song without the cheer',async()=>{
  const finished=run=>run("(()=>{const w=djNewWork('hard',7);w.takes=[0,1,2,3].map(p=>new Set(djHandTargets(p,'hard').map(t=>t.id)));w.mixes[3].accent=djHandTargets(3,'hard').at(-1).midi;w.pass=3;w.step='finished';w.heard=true;return JSON.stringify({...w,takes:w.takes.map(s=>[...s])})})()");
  const json=finished(makePage().run);
  const page=makePage({stored:{'fm1-dj-birthday-v1':json}});
  await page.run('start()');
  assert.equal(page.nodes.get('#interlude').hidden,false);
  assert.equal(page.nodes.get('#interlude').dataset.celebrating,undefined);
  assert.equal(page.run('birthdayJourney.step'),'finished');
  assert.equal(page.run('birthdayJourney.patterns[3].lead.some(s=>s.length)'),true);
});

test('A work in progress resumes at the start of its current take and every step saves',async()=>{
  const page=makePage();
  await page.run('start()');
  page.run("chooseBirthdayMode('standard')");
  const saved=()=>JSON.parse(page.local.get('fm1-dj-birthday-v1'));
  assert.equal(saved().mode,'standard');
  page.run("birthdayRecordHand(djNextTarget(birthdayJourney.work))");
  assert.equal(saved().takes[0].length,1);
  page.run("for(let t=djNextTarget(birthdayJourney.work);t;t=djNextTarget(birthdayJourney.work))birthdayRecordHand(t);setBirthdayPass(1);birthdayRecordHand(djNextTarget(birthdayJourney.work))");
  assert.equal(saved().pass,1);
  const again=makePage({stored:Object.fromEntries(page.local)});
  await again.run('start()');
  assert.equal(again.run('birthdayJourney.pass'),1);
  assert.equal(again.run('birthdayJourney.step'),'voice');
  assert.equal(again.run('birthdayJourney.work.takes[1].size'),0);
  assert.equal(again.run('birthdayJourney.work.takes[0].size>0'),true);
  assert.equal(again.run('birthdayJourney.patterns[0].lead.some(s=>s.length)||birthdayJourney.patterns[0].drums.some(r=>r.some(Boolean))'),true);
  again.run('djClearWork()');
  assert.equal(again.run('djLoadWork()'),null);
});

test('Reloading after a fully recorded take keeps it and waits for PLAY',async()=>{
  const page=journeyPage();
  await page.startStandardAtTake(1);
  const n=page.run("djHandTargets(1,'standard').length");
  await page.enterTargets(n);
  await page.command('REC');
  assert.equal(page.run('birthdayJourney.step'),'listen');
  const reloaded=makePage({stored:Object.fromEntries(page.local)});
  await reloaded.run('start()');
  assert.equal(reloaded.run('birthdayJourney.pass'),1);
  assert.equal(reloaded.run('birthdayJourney.step'),'listen');
  assert.equal(reloaded.run('birthdayJourney.work.takes[1].size'),n);
  assert.equal(reloaded.run('birthdayJourney.patterns[1].bass.some(s=>s.length)||birthdayJourney.patterns[1].lead.some(s=>s.length)'),true);
  reloaded.run(`djOutput=()=>({input:'bus'});djPlay=()=>({stop(){}})`);
  await reloaded.run('control("PLAY")');
  assert.equal(reloaded.run('birthdayJourney.step'),'listening');
  reloaded.nodes.get('#mission-next').onclick();
  assert.equal(reloaded.run('birthdayJourney.pass'),2);
});

test('Play it on FM-1: backup first, then download, send and set up; Back returns to the player',async()=>{
  const html=site('index.html');
  const order=['birthday-hardware-back','birthday-backup-warning','birthday-pattern-download','birthday-firmware-preview','birthday-hardware-source','birthday-hardware-guide','birthday-hardware-takes','birthday-hardware-notes'].map(id=>html.indexOf('id="'+id+'"'));
  order.forEach((at,index)=>assert.ok(at>0&&(index===0||at>order[index-1]),'step order at '+index));
  assert.ok(html.indexOf('id="birthday-player-view"')<html.indexOf('id="birthday-hardware"'));
  const page=journeyPage();
  await page.finishedStandardWork();
  page.nodes.get('#birthday-skip').onclick();
  assert.equal(page.nodes.get('#birthday-fm1').textContent,'在 FM-1 上弹 →');
  page.nodes.get('#birthday-fm1').onclick();
  assert.equal(page.nodes.get('#birthday-player-view').hidden,true);
  assert.equal(page.nodes.get('#birthday-hardware').hidden,false);
  assert.equal(page.nodes.get('#interlude').getAttribute('aria-labelledby'),'birthday-hardware-title');
  assert.deepEqual(['birthday-step-backup','birthday-step-download','birthday-step-send','birthday-step-setup'].map(id=>page.nodes.get('#'+id).textContent),['先备份','下载','发送','设置']);
  assert.equal(page.nodes.get('#birthday-backup-warning').textContent,'发送会覆盖 FM‑1 上全部 16 个 Pattern，先在 Device Manager 里备份。');
  assert.equal(page.nodes.get('#birthday-firmware-preview').textContent,'先用固件试听「八音盒」');
  assert.equal(page.nodes.get('#birthday-firmware-preview').getAttribute('aria-label'),undefined,'the visible label is the name');
  page.run('selectBirthdayTake(2)');
  assert.equal(page.nodes.get('#birthday-firmware-preview').textContent,'先用固件试听「'+page.run('djTakes[2].title[1]')+'」');
  page.run('selectBirthdayTake(0)');
  assert.equal(page.nodes.get('#birthday-hardware-notes-title').textContent,'和网页的差异');
  page.run('language="en";renderBirthdayPlayer()');
  assert.equal(page.nodes.get('#birthday-backup-warning').textContent,'Sending this replaces all 16 patterns on your FM-1. Back them up in Device Manager first.');
  assert.equal(page.nodes.get('#birthday-step-backup').textContent,'Back up first');
  assert.ok(page.nodes.get('#birthday-hardware-guide').children.length>=4);
  assert.ok(page.nodes.get('#birthday-hardware-notes').children.length>=3);
  page.nodes.get('#birthday-hardware-back').onclick();
  assert.equal(page.nodes.get('#birthday-player-view').hidden,false);
  assert.equal(page.nodes.get('#birthday-hardware').hidden,true);
  assert.equal(page.nodes.get('#interlude').getAttribute('aria-labelledby'),'win-title');
  // Reopening the card always starts on the player.
  page.nodes.get('#birthday-fm1').onclick();
  page.nodes.get('#birthday-close').onclick();
  page.run('openBirthdayPlayer()');
  assert.equal(page.nodes.get('#birthday-hardware').hidden,true);
  assert.equal(page.nodes.get('#birthday-player-view').hidden,false);
});

test('Hard mode: every target of all four takes by key, ending in the cheer',async()=>{
  const {run,nodes,command,press}=journeyPage();
  await run('start()');
  run("chooseBirthdayMode('hard')");
  for(let pass=0;pass<4;pass++){
    if(pass>0){await command('REC');await command('PLAY');nodes.get('#mission-next').onclick();}
    assert.equal(run('birthdayJourney.pass'),pass);
    run('turn("ALGORITHM",1)');await command('REC');
    const groups=run(`djHandGroups(${pass},'hard')`);
    for(const [done,group] of groups.entries()){
      assert.equal(nodes.get('#counter').textContent.split(' ').slice(0,3).join(' '),done+' / '+groups.length);
      for(const target of group.targets){
        assert.equal(run('djNextTarget(birthdayJourney.work)?.step'),group.step);
        while(run('state.octave')!==target.octave)await command(run('state.octave')>target.octave?'OCT−':'OCT+');
        await press(target.midi-target.octave*12);
      }
    }
    assert.equal(run(`birthdayJourney.work.takes[${pass}].size`),run(`djHandTargets(${pass},'hard').length`));
  }
  assert.equal(run('birthdayJourney.step'),'finished');
  assert.equal(nodes.get('#interlude').dataset.celebrating,'yes');
  assert.equal(run('djLoadWork().step'),'finished');
});

// Hard take 1 up to its first chord, REC on and the OCT set for it.
async function hardChordPage(){
  const page=journeyPage(),{run,command,enterTargets}=page;
  await run('start()');
  run("chooseBirthdayMode('hard')");
  run('turn("ALGORITHM",1)');await command('REC');
  const singles=run("djHandGroups(0,'hard').findIndex(g=>g.targets.length>1)");
  await enterTargets(singles);
  const group=run("djHandGroups(0,'hard')").find(g=>g.targets.length>1);
  while(run('state.octave')!==group.octave)await command(run('state.octave')>group.octave?'OCT−':'OCT+');
  run('updateProgress()');
  return {...page,group,singles,key:target=>target.midi-target.octave*12};
}

test('Hard take 1: a chord is one cell, entered key by key, and its last key sounds it whole',async()=>{
  const {run,nodes,press,group,singles,key}=await hardChordPage();
  const [melody,harmony]=group.targets,total=run("djHandGroups(0,'hard').length");
  assert.equal(nodes.get('#counter').textContent,singles+' / '+total+' 格');
  const names=group.targets.map(t=>run(`noteName(${t.midi})`));
  assert.equal(run('nextCue().text'),'和弦 · 第 '+(group.step+1)+' 格 · 弹 '+names.join(' ')+'（还差 2 个）');
  const hinted=()=>[...run("$$('.hardware-key').filter(b=>b.classList.contains('hinted')).map(b=>b.dataset.midi)")].sort((a,b)=>a-b);
  assert.deepEqual(hinted(),[key(melody),key(harmony)].sort((a,b)=>a-b));

  // A key outside the chord sounds alone and records nothing.
  const wrong=[48,50,52,53,55,57,59,60].find(m=>m!==key(melody)&&m!==key(harmony));
  run('sounds.length=0');await press(wrong);
  assert.equal(run('sounds.length'),1);
  assert.equal(run('birthdayJourney.work.takes[0].size'),singles);

  // Any order: the harmony first is silent, stays lit, and leaves the cell open.
  const held=()=>[...run("$$('.hardware-key').filter(b=>b.classList.contains('held')).map(b=>b.dataset.midi)")];
  assert.deepEqual(held(),[]);
  run('sounds.length=0');await press(key(harmony));
  assert.equal(run('sounds.length'),0);
  assert.deepEqual(held(),[key(harmony)]);
  assert.equal(run(`birthdayJourney.work.takes[0].has('${harmony.id}')`),true);
  assert.equal(nodes.get('#counter').textContent,singles+' / '+total+' 格');
  assert.equal(run('nextCue().text'),'和弦 · 第 '+(group.step+1)+' 格 · 弹 '+names[0]+'（还差 1 个）');
  assert.deepEqual(hinted(),[key(melody)]);

  // A wrong key mid-chord sounds alone, records nothing and keeps the held key.
  run('sounds.length=0');await press(wrong);
  assert.equal(run('sounds.length'),1);
  assert.equal(run('birthdayJourney.work.takes[0].size'),singles+1);
  assert.deepEqual(held(),[key(harmony)]);

  // The last member sounds the whole chord at once, in the take's lead voice.
  run('sounds.length=0');await press(key(melody));
  assert.deepEqual([...run('sounds.map(s=>s.midi)')].sort(),[melody.sound,harmony.sound].sort());
  assert.deepEqual([...run('sounds.map(s=>s.kind)')],['triangle','triangle']);
  assert.equal(nodes.get('#counter').textContent,(singles+1)+' / '+total+' 格');
  assert.equal(run('birthdayJourney.take.lead['+group.step+'].length'),2);
  assert.deepEqual(held(),[]);
  // The next chord starts with both of its keys lit again, here in English.
  const next=run("djHandGroups(0,'hard')")[singles+1];
  run('language="en";copy()');
  assert.equal(run('nextCue().text'),'Chord · step '+(next.step+1)+' · play '+next.targets.map(t=>run(`noteName(${t.midi})`)).join(' ')+' (2 left)');
});

test('Hard take 2: a drum chord names its drums, never a pitch, and its last key hits both',async()=>{
  const {run,command,press,finishPass}=journeyPage();
  await run('start()');
  run("chooseBirthdayMode('hard')");
  run('skipBirthdayPass()');await finishPass();
  run('turn("ALGORITHM",1)');await command('REC');
  const chord=run("djHandGroups(1,'hard')").find(g=>g.targets.length>1&&g.targets.every(t=>t.part==='drums'));
  const key=t=>t.midi-t.octave*12;
  while(run('djNextGroup(birthdayJourney.work).step')!==chord.step){
    const target=run('djNextTarget(birthdayJourney.work)');
    while(run('state.octave')!==target.octave)await command(run('state.octave')>target.octave?'OCT−':'OCT+');
    await press(key(target));
  }
  while(run('state.octave')!==chord.octave)await command(run('state.octave')>chord.octave?'OCT−':'OCT+');
  const pitch=/[A-G][♯#]?\d/;
  const zh=run('nextCue().text');
  assert.equal(zh,'和弦 · 第 '+(chord.step+1)+' 格 · 弹 拍掌 军鼓 ×2（还差 2 个）');
  assert.doesNotMatch(zh,pitch);
  run('language="en";copy()');
  const en=run('nextCue().text');
  assert.equal(en,'Chord · step '+(chord.step+1)+' · play Clap Snare ×2 (2 left)');
  assert.doesNotMatch(en,pitch);
  run('sounds.length=0');await press(key(chord.targets[0]));
  assert.equal(run('sounds.length'),0);
  assert.doesNotMatch(run('nextCue().text'),pitch);
  // A roll sounds as one hit while she enters it; the recorded take plays its ratchet.
  run('sounds.length=0');await press(key(chord.targets[1]));
  assert.equal(run('sounds.filter(s=>s.drum!==undefined).length'),2);
  assert.equal(run('sounds.length'),2);
});

test('A hard take with chords still skips, restores and exports by id',async()=>{
  const {run,nodes,press,group,key,local}=await hardChordPage();
  await press(key(group.targets[0]));
  // Reloaded mid-chord: the take restarts from its beginning, as any take cut off midway.
  const reloaded=makePage({stored:Object.fromEntries(local)});
  await reloaded.run('start()');
  assert.equal(reloaded.run('birthdayJourney.work.mode'),'hard');
  assert.equal(reloaded.run('birthdayJourney.work.takes[0].size'),0);
  // Skip records every remaining member and plays the take.
  run('skipBirthdayPass()');
  const all=run("djHandTargets(0,'hard').map(t=>t.id)");
  assert.equal(run('birthdayJourney.work.takes[0].size'),all.length);
  run('updateProgress()');
  const groups=run("djHandGroups(0,'hard').length");
  assert.equal(nodes.get('#counter').textContent,groups+' / '+groups+' 格');
  assert.deepEqual([...run('[...djLoadWork().takes[0]]')].sort(),[...all].sort());
  const restored=makePage({stored:Object.fromEntries(local)});
  await restored.run('start()');
  assert.equal(restored.run('birthdayJourney.work.takes[0].size'),all.length);
  assert.equal(restored.run('birthdayJourney.step'),'listen');
  assert.equal(restored.run(`birthdayJourney.patterns[0].lead[${group.step}].length`),2);
  const hands=run('djTakeTimeline(birthdayJourney.work,0).events.filter(e=>e.hand).map(e=>e.hand)');
  for(const target of group.targets)assert.ok(hands.includes(target.id),target.id);
  assert.doesNotThrow(()=>run('encodeDjPatterns(birthdayJourney.work)'));
});

test('A chosen mode with nothing recorded yet offers the choice again on power-on',async()=>{
  const first=makePage();
  await first.run('start()');
  first.run("chooseBirthdayMode('standard')");
  const page=makePage({stored:Object.fromEntries(first.local)});
  await page.run('start()');
  page.run('updateProgress()');
  assert.equal(page.run('birthdayJourney.step'),'mode');
  assert.equal(page.nodes.get('#mode-standard').hidden,false);
  assert.equal(page.nodes.get('#mode-hard').hidden,false);
  page.nodes.get('#mode-hard').onclick();
  assert.equal(page.run('birthdayJourney.work.mode'),'hard');
});

test('Make a new song asks first, and only Yes wipes the work and reopens the mode choice',async()=>{
  const page=makePage();
  await page.run('start()');
  page.run("chooseBirthdayMode('standard');for(let i=0;i<3;i++)birthdayRecordHand(djNextTarget(birthdayJourney.work))");
  page.nodes.get('#info-button').onclick();
  assert.equal(page.nodes.get('#restart-song').hidden,false);
  assert.equal(page.nodes.get('#restart-song-confirm').hidden,true);
  page.nodes.get('#restart-song').onclick();
  assert.equal(page.nodes.get('#restart-song-confirm').hidden,false);
  assert.ok(page.local.get('fm1-dj-birthday-v1'),'asking alone deletes nothing');
  page.nodes.get('#restart-song-no').onclick();
  assert.equal(page.nodes.get('#restart-song-confirm').hidden,true);
  assert.equal(page.run('birthdayJourney.work.takes[0].size'),3);
  page.nodes.get('#restart-song').onclick();
  page.nodes.get('#restart-song-yes').onclick();
  assert.equal(page.local.get('fm1-dj-birthday-v1')||null,null);
  assert.equal(page.run('birthdayJourney.step'),'mode');
  assert.equal(page.run('birthdayJourney.work?.takes?.[0]?.size??0'),0);
});

test('Make a new song is hidden while there is nothing to lose',async()=>{
  const page=makePage();
  await page.run('start()');
  page.nodes.get('#info-button').onclick();
  assert.equal(page.nodes.get('#restart-song').hidden,true);
});

test('Choosing the lead wave shows every wave, the target and which way to turn',async()=>{
  const {run}=makePage();
  await run('start()');
  run("chooseBirthdayMode('standard')");
  assert.equal(run('birthdayJourney.dial'),'Pulse 12.5');
  assert.deepEqual(JSON.parse(run('JSON.stringify(birthdayWavePicker())')),[
    {name:'Triangle',current:false,target:true},
    {name:'Pulse 50',current:false,target:false},
    {name:'Pulse 25',current:false,target:false},
    {name:'Pulse 12.5',current:true,target:false}
  ]);
  assert.equal(run('nextCue().text'),'转 ALGORITHM，选 Triangle · 顺时针转 1 格');
  run('turn("ALGORITHM",-1)');
  assert.equal(run('birthdayJourney.dial'),'Pulse 25');
  assert.equal(run('nextCue().text'),'转 ALGORITHM，选 Triangle · 顺时针转 2 格');
  run('language="en";copy()');
  assert.equal(run('nextCue().text'),'Turn ALGORITHM to Triangle · 2 clockwise');
  run('turn("ALGORITHM",1);turn("ALGORITHM",1)');
  assert.equal(run('birthdayJourney.step'),'record');
});

test('Help holds Manual, Advanced, my song, then one quiet footer line; settings live only there while playing',async()=>{
  const html=site('index.html');
  const help=html.slice(html.indexOf('<dialog id="info"'),html.indexOf('</dialog>',html.indexOf('<dialog id="info"')));
  assert.deepEqual([...help.matchAll(/<button id="([^"]+)"/g)].map(match=>match[1]),
    ['info-close','guide-button','advanced-button','info-open-song','restart-song','restart-song-no','restart-song-yes','info-lang','info-fw','info-screen','info-about']);
  assert.ok(/<footer class="info-about">[^]*info-lang[^]*info-fw[^]*info-screen[^]*info-about/.test(help),'settings sit in the quiet footer');
  assert.ok(!/<h3\b/.test(help),'no one-item section headings');
  assert.ok(!/study-primary|info-actions/.test(help));
  for(const gone of ['info-language','info-firmware','info-lcd','info-settings-title','info-learn-title','replay-tour','id="restart"','apprentice-button'])assert.ok(!html.includes(gone),gone);
  for(const corner of ['language','firmware-entry','lcd-open'])assert.ok(html.includes('id="'+corner+'"'),corner+' stays on the machine screen');
  assert.ok(/data-scene=game\] #utility-controls #lcd-open\{display:none\}/.test(site('style.css')),'the top bar stays sparse while playing');
  const {run,nodes}=makePage();
  for(const name of ['startLesson','hearTake','rememberTake','lessonCue','openBirthdayStudy'])assert.equal(run('typeof '+name),'undefined',name);
  await run('start()');
  let focused=null;
  nodes.get('#guide-button').focus=()=>{focused='guide-button';};
  nodes.get('#info-button').onclick();
  assert.equal(nodes.get('#info').open,true);
  assert.equal(focused,'guide-button','the first row takes focus');
  assert.equal(nodes.get('#info').listeners.close.length,1,'closing hands focus back');
  assert.equal(nodes.get('#info-title').textContent,'帮助');
  assert.deepEqual(['#guide-label','#guide-note','#advanced-label','#advanced-note'].map(id=>nodes.get(id).textContent),
    ['手册','点机器上任意按键或旋钮，看它做什么','进阶','接下来可以试的三个玩法']);
  assert.equal(nodes.get('#info-open-song').hidden,true);
  assert.equal(nodes.get('#info-song').hidden,true,'nothing to show before a note is recorded');
  assert.equal(nodes.get('#info-copy').hidden,true);
  nodes.get('#info-about').onclick();
  assert.equal(nodes.get('#info-copy').hidden,false);
  assert.equal(nodes.get('#info-about').getAttribute('aria-expanded'),'true');
  run('language="en";copy()');
  assert.equal(nodes.get('#info-title').textContent,'Help');
  assert.deepEqual(['#guide-label','#guide-note','#advanced-label','#advanced-note'].map(id=>nodes.get(id).textContent),
    ['Manual','Tap any key or knob to learn it','Advanced','Three tricks to try next']);
  assert.equal(nodes.get('#info-song').getAttribute('aria-label'),'My song');
});

test('Open my birthday song appears once the song is finished and opens the card without the cheer',async()=>{
  const page=journeyPage();
  await page.finishedStandardWork();
  page.nodes.get('#birthday-skip').onclick();
  page.nodes.get('#birthday-close').onclick();
  assert.equal(page.nodes.get('#interlude').hidden,true);
  page.nodes.get('#info-button').onclick();
  assert.equal(page.nodes.get('#info-song').hidden,false);
  assert.equal(page.nodes.get('#info-open-song').hidden,false);
  assert.equal(page.nodes.get('#info-open-song-label').textContent,'打开我的生日歌');
  page.nodes.get('#info-open-song').onclick();
  assert.equal(page.nodes.get('#info').open,false);
  assert.equal(page.nodes.get('#interlude').hidden,false);
  assert.equal(page.nodes.get('#interlude').dataset.celebrating,undefined);
  assert.equal(page.nodes.get('#birthday-surprise').hidden,true);
});

test('Left for free play mid-song, Help leads back to the same take',async()=>{
  const page=journeyPage();
  await page.startStandardAtTake(1);await page.enterTargets(3);
  page.nodes.get('#info-button').onclick();
  assert.equal(page.nodes.get('#info-open-song').hidden,true,'no way back is needed while she is in the song');
  page.run('openPlayground(1)');
  assert.equal(page.run('birthdayJourneyActive()'),false);
  page.nodes.get('#info-button').onclick();
  assert.equal(page.nodes.get('#info-open-song').hidden,false);
  assert.equal(page.nodes.get('#info-open-song-label').textContent,'回到我的生日歌');
  page.nodes.get('#info-open-song').onclick();
  assert.equal(page.run('birthdayJourneyActive()'),true);
  assert.equal(page.run('level'),2);
  assert.equal(page.run('birthdayJourney.pass'),1);
  assert.equal(page.run('birthdayJourney.work.takes[1].size'),3);
  assert.equal(page.run('currentPattern()===birthdayJourney.take'),true);
});

test('Opening the FM-1 steps pauses the song; Back resumes from the same place',async()=>{
  const {run,nodes,finishedStandardWork}=journeyPage();
  await finishedStandardWork();
  nodes.get('#birthday-skip').onclick();
  run('djPlays.length=0');
  nodes.get('#birthday-timeline').children[1].onclick();await Promise.resolve();
  assert.equal(run('birthdayMusicPlaying'),true);
  nodes.get('#birthday-fm1').onclick();
  assert.equal(run('djPlays[0].stopped'),true);
  assert.equal(run('birthdayMusicPlaying'),false);
  assert.equal(run('birthdayTimers.size'),0);
  nodes.get('#birthday-hardware-back').onclick();
  assert.equal(nodes.get('#birthday-play').textContent,'继续播放');
  nodes.get('#birthday-play').onclick();await Promise.resolve();
  assert.equal(run('djPlays[1].options.from'),run('djTimeline(birthdayJourney.work).takeStarts[1]'));
});

test('Escape in the FM-1 steps goes back to the player; on the player it closes the card',async()=>{
  const {nodes,finishedStandardWork}=journeyPage();
  await finishedStandardWork();
  nodes.get('#birthday-skip').onclick();
  const escape=()=>nodes.get('#interlude').listeners.keydown.forEach(listener=>listener({key:'Escape',preventDefault(){}}));
  nodes.get('#birthday-fm1').onclick();
  escape();
  assert.equal(nodes.get('#interlude').hidden,false);
  assert.equal(nodes.get('#birthday-hardware').hidden,true);
  assert.equal(nodes.get('#birthday-player-view').hidden,false);
  escape();
  assert.equal(nodes.get('#interlude').hidden,true);
});

test('Back from the firmware preview, the card is cued at that take: time, segment and play agree',async()=>{
  assert.match(site('firmware.js'),/cueBirthdayTake\(session\.birthdayIndex\)/);
  const {run,nodes,finishedStandardWork}=journeyPage();
  await finishedStandardWork();
  nodes.get('#birthday-skip').onclick();
  run('djPlays.length=0;cueBirthdayTake(2)');
  const start=run('djTimeline(birthdayJourney.work).takeStarts[2]');
  assert.equal(nodes.get('#birthday-timeline').children[2].getAttribute('aria-current'),'true');
  assert.equal(nodes.get('#birthday-status').textContent,run('T(...djTakes[2].title)'));
  assert.match(nodes.get('#birthday-time').textContent,new RegExp('^'+Math.floor(start/60)+':'+String(Math.floor(start)%60).padStart(2,'0')+' / '));
  assert.equal(nodes.get('#birthday-play').textContent,'继续播放');
  nodes.get('#birthday-play').onclick();await Promise.resolve();
  assert.equal(run('djPlays[0].options.from'),start);
});

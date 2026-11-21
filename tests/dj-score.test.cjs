const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const site = name => fs.readFileSync(path.join(__dirname,'../site',name),'utf8');

const context=vm.createContext({T:(en,zh)=>zh});
vm.runInContext(['learning-content.js','dj-score.js'].map(site).join('\n'),context);
vm.runInContext(`
function fullWork(seed){const work=djNewWork('hard',seed);work.takes=[0,1,2,3].map(pass=>new Set(djHandTargets(pass,'hard').map(target=>target.id)));return work;}
function emptyWork(seed){return djNewWork('standard',seed);}
`,context);
const run=code=>{const value=vm.runInContext(code,context);return value===undefined?value:JSON.parse(JSON.stringify(value));};
const remix=run('djRemix');
// Compares the sounding pitch with the same melody note in the original key (C).
const keyOffsetOf=event=>((event.midi-remix[+event.hand.split(':')[2]][3])%12+12)%12;

test('Four takes chain into about 86 seconds with the demo section starts',()=>{
  const {length,takeStarts}=run('djTimeline(fullWork(1))');
  assert.ok(Math.abs(length-86)<=2);
  assert.deepEqual(takeStarts.map(t=>Math.round(t*10)/10),[0.3,18.5,38.1,69.2]);
});
test('Drop and encore keys follow the spec',()=>{
  const drop=run('djTimeline(fullWork(1)).events.filter(e=>e.take===2&&e.part==="lead"&&e.hand&&!e.via&&e.hand.startsWith("2:mel:"))');
  assert.deepEqual([...new Set(drop.map(keyOffsetOf))],[2]);
  const lead=run('djTimeline(fullWork(1)).events.filter(e=>e.take===3&&e.part==="lead"&&e.hand&&!e.via)');
  assert.deepEqual([...new Set(lead.map(e=>keyOffsetOf(e)))],[2,4,6,9]);
});
test('The same seed gives the same timeline; another seed only moves Chance events',()=>{
  const a=run('JSON.stringify(djTimeline(fullWork(7)).events)'),b=run('JSON.stringify(djTimeline(fullWork(7)).events)');
  assert.equal(a,b);
  assert.notEqual(a,run('JSON.stringify(djTimeline(fullWork(8)).events)'));
  assert.equal(run('djTimeline(fullWork(7)).events.filter(e=>!e.chance).length'),run('djTimeline(fullWork(8)).events.filter(e=>!e.chance).length'));
  assert.equal(run('JSON.stringify(djTimeline(fullWork(7)).events.filter(e=>!e.chance))'),run('JSON.stringify(djTimeline(fullWork(8)).events.filter(e=>!e.chance))'));
});
test('Unrecorded hand events are left out',()=>{
  assert.equal(run('djTimeline(emptyWork(1)).events.some(e=>e.hand)'),false);
});
test('Events are sorted, and every section id the share video needs exists',()=>{
  const times=run('djTimeline(fullWork(3)).events.map(e=>e.time)');
  assert.ok(times.every((t,i)=>i===0||t>=times[i-1]));
  const ids=run('djTakes.flatMap(take=>take.sections.map(s=>s.id))');
  for(const id of ['windup','musicbox','house-intro','house','filter-dip','name-2','stutter','breakdown','build','silence','drop','name-3','machine-gun','rewind','countdown','encore-key-1','encore-key-2','encore-key-3','encore-key-4','fireworks'])assert.ok(ids.includes(id),id);
});
test('A single take starts at zero and matches its slice of the whole song',()=>{
  const whole=run('(()=>{const w=fullWork(5),t=djTimeline(w);return t.events.filter(e=>e.take===2).map(e=>+(e.time-t.takeStarts[2]).toFixed(6))})()');
  const single=run('djTakeTimeline(fullWork(5),2)');
  assert.deepEqual(single.events.map(e=>+e.time.toFixed(6)),whole);
  assert.ok(single.events[0].time>=0&&single.length>30&&single.length<32);
});
test('Standard mode plays the hard-mode layers as pre-placed parts',()=>{
  assert.ok(run('djTimeline(emptyWork(1)).events.filter(e=>e.take===1&&e.voice==="open").length')>0);
  const lead=run('djTimeline(emptyWork(1)).events.filter(e=>e.take===0&&e.part==="lead")');
  assert.ok(lead.some(e=>e.velocity<.5&&e.velocity>.4),'the harmony is pre-placed');
  assert.ok(!lead.some(e=>e.velocity===1),'the melody waits for her');
});

test('Standard mode keeps every take at 45 hand events or fewer; hard mode adds to it',()=>{
  for(let pass=0;pass<4;pass++){
    const standard=run(`djHandTargets(${pass},'standard').map(t=>t.id)`),hard=run(`djHandTargets(${pass},'hard').map(t=>t.id)`);
    assert.ok(standard.length>0&&standard.length<=45);
    assert.ok(standard.every(id=>hard.includes(id)));
    assert.ok(hard.length>=standard.length);
  }
});
test('Take 1 is the 25-note melody in both modes',()=>{
  assert.equal(run("djHandTargets(0,'standard').filter(t=>t.part==='lead').length"),25);
  assert.equal(run("djHandTargets(0,'hard').filter(t=>t.id.startsWith('0:mel:')).length"),25);
});
test('Every hand target fits the V102 panel at its octave',()=>{
  const all=run("[0,1,2,3].flatMap(p=>djHandTargets(p,'hard'))");
  for(const t of all){const key=t.midi-t.octave*12;assert.ok(key>=53&&key<=79,t.id);assert.ok(t.octave>=-3&&t.octave<=3,t.id);}
});
test('The name spot HEY is a hand event in takes 2 and 3',()=>{
  assert.ok(run("djHandTargets(1,'standard').some(t=>t.id.endsWith(':hey-name'))"));
  assert.ok(run("djHandTargets(2,'standard').some(t=>t.id.endsWith(':hey-name'))"));
});
test('A new work starts empty and the next target walks the take in order',()=>{
  const work=run("djNewWork('standard',4)");
  assert.equal(work.version,1);assert.equal(work.mode,'standard');assert.equal(work.seed,4);assert.equal(work.pass,0);assert.equal(work.step,'mode');assert.equal(work.heard,false);
  assert.equal(work.takes.length,4);assert.equal(work.mixes.length,4);
  assert.equal(run("djNextTarget(djNewWork('standard',4)).id"),run("djHandTargets(0,'standard')[0].id"));
  assert.equal(run("(()=>{const w=djNewWork('standard',4);w.takes[0].add(djHandTargets(0,'standard')[0].id);return djNextTarget(w).id})()"),run("djHandTargets(0,'standard')[1].id"));
  assert.equal(run("(()=>{const w=djNewWork('standard',4);djHandTargets(0,'standard').forEach(t=>w.takes[0].add(t.id));return djNextTarget(w)})()"),null);
});
test('Hard-mode keys on one step and octave form a chord group; standard groups are its targets',()=>{
  const groups=run("djHandGroups(0,'hard')");
  assert.equal(groups.length,25);
  assert.equal(groups.filter(group=>group.targets.length===2).length,12);
  for(const group of groups)for(const target of group.targets){assert.equal(target.step,group.step);assert.equal(target.octave,group.octave);}
  assert.deepEqual(groups.flatMap(group=>group.targets.map(t=>t.id)).sort(),run("djHandTargets(0,'hard').map(t=>t.id)").sort());
  for(let pass=0;pass<4;pass++)
    assert.deepEqual(run(`djHandGroups(${pass},'standard').map(g=>g.targets.map(t=>t.id))`),run(`djHandTargets(${pass},'standard').map(t=>[t.id])`));
  // A chord is finished before the next group starts, whichever member she played first.
  const chord=groups.find(group=>group.targets.length===2);
  const [first,second]=chord.targets.map(t=>t.id);
  assert.equal(run(`(()=>{const w=djNewWork('hard',4);djHandGroups(0,'hard').slice(0,${groups.indexOf(chord)}).forEach(g=>g.targets.forEach(t=>w.takes[0].add(t.id)));w.takes[0].add('${first}');return djNextTarget(w).id})()`),second);
  assert.equal(run(`(()=>{const w=djNewWork('hard',4);djHandGroups(0,'hard').slice(0,${groups.indexOf(chord)}).forEach(g=>g.targets.forEach(t=>w.takes[0].add(t.id)));w.takes[0].add('${second}');return djNextTarget(w).id})()`),first);
});
test('Take 4 runs at the global 124 BPM with pattern Rate 1/16T, on the same grid',()=>{
  const encore=run('djTakes[3]');
  assert.equal(encore.bpm,124);
  assert.equal(encore.rate,'1/16T');
  assert.equal(encore.stepsPerBeat,6);
  const {length,takeStarts}=run('djTimeline(fullWork(1))');
  assert.equal(length,85.825);
  assert.deepEqual(takeStarts,[0.3,18.475,38.071774,69.154032]);
});
test('Each pitched hand target knows the pitch its key sounds in the timeline',()=>{
  for(const mode of ['standard','hard'])for(let pass=0;pass<4;pass++){
    const targets=run(`djHandTargets(${pass},'${mode}')`).filter(t=>t.part==='lead'||t.part==='bass');
    const events=run(`djTimeline(fullWork(1)).events.filter(e=>e.take===${pass}&&e.hand)`);
    for(const target of targets){
      const own=events.filter(e=>e.hand===target.id&&(e.part==='lead'||e.part==='bass'));
      const main=own.find(e=>!e.via);
      if(main)assert.equal(target.sound,main.midi,target.id);
      else assert.ok(own.some(e=>e.midi===target.sound),target.id);
    }
  }
  assert.equal(run("djHandTargets(2,'standard').find(t=>t.id==='2:mel:0').sound"),run("djHandTargets(2,'standard').find(t=>t.id==='2:mel:0').midi"));
  assert.equal(run("djHandTargets(0,'standard')[0].sound"),run("djHandTargets(0,'standard')[0].midi")-12);
});
test('Chance events carry their declared probability; the declared timeline keeps every one',()=>{
  const drawn=run('djTimeline(fullWork(7)).events.filter(e=>e.chance)');
  assert.ok(drawn.length>0);
  assert.deepEqual([...new Set(drawn.map(e=>e.chance))].sort(),[.6,.75,.8]);
  const declared=seed=>run(`djTimeline(fullWork(${seed}),{declared:true}).events.filter(e=>e.chance)`);
  assert.equal(declared(7).length,declared(8).length);
  assert.ok(declared(7).length>drawn.length);
  assert.equal(run('djTimeline(fullWork(7),{declared:true}).events.filter(e=>!e.chance).length'),run('djTimeline(fullWork(7)).events.filter(e=>!e.chance).length'));
});
test('Section starts match the approved demo within 0.1 s',()=>{
  // From the approved demo's compose().
  // The demo has one "Drum & Bass" section at bar(1) of take 4; its key changes fall on
  // bar(1), bar(3), bar(5) and bar(7), bar = 16 × 60/124/6 s after the countdown.
  const demo={windup:.35,musicbox:1.75,horn:17.375,'house-intro':18.475,house:22.346,'filter-dip':30.0879,'name-2':32.0234,stutter:35.8944,
    breakdown:38.0718,build:45.8137,silence:49.2008,drop:49.6847,'name-3':61.2976,'machine-gun':65.1685,rewind:67.104,countdown:69.154,
    'encore-key-1':70.4444,'encore-key-2':73.025,'encore-key-3':75.6056,'encore-key-4':78.1863,fireworks:80.7669};
  const sections=run('djTakes.flatMap(take=>take.sections)');
  for(const [id,start] of Object.entries(demo)){
    const section=sections.find(s=>s.id===id);
    assert.ok(section,id);
    assert.ok(Math.abs(section.start-start)<.1,id+': '+section.start+' vs '+start);
  }
});
test('Each take’s bar length agrees with its own sections',()=>{
  const takes=run('djTakes');
  assert.deepEqual(takes.map(t=>t.stepsPerBar),[12,16,16,16]);
  const bar=t=>t.stepsPerBar/t.stepsPerBeat*60/t.bpm;
  const gap=(pass,a,b)=>{const s=takes[pass].sections;return s.find(x=>x.id===b).start-s.find(x=>x.id===a).start;};
  assert.ok(Math.abs(gap(1,'house-intro','house')-2*bar(takes[1]))<1e-4);
  assert.ok(Math.abs(gap(2,'breakdown','build')-4*bar(takes[2]))<1e-4);
  assert.ok(Math.abs(gap(3,'encore-key-1','encore-key-2')-2*bar(takes[3]))<1e-4);
  assert.ok(Math.abs(gap(3,'countdown','fireworks')-9*bar(takes[3]))<1e-4);
  for(const take of takes)assert.equal(take.beatsPerBar,undefined);
});

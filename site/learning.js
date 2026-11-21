const stepsPerBeat=4;

// Set when the DJ birthday journey (finale.js) starts; free play clears it.
let guided=false;
const courseDone=new Set();

function stageDone(stage){
  return guided?courseDone.has(stage):completed.includes(stage);
}

function newBirthdayTake(length){
  const take=freshPattern(length);
  take.leadLengths=Array(length).fill(0);
  return take;
}

function currentLessonTarget(){
  return birthdayJourneyActive()&&birthdayJourney.work?djNextTarget(birthdayJourney.work):null;
}

function syncLessonCursor(){
  const target=currentLessonTarget();
  if(!target||!state.recording)return;
  state.step=state.recordStep=target.step;
  if(level===2){
    state.lane=target.part;
    state.rowOffset=target.part==='lead'?Math.max(0,target.midi-87):target.part==='bass'&&birthdayJourneyActive()?Math.max(-12,target.midi-64):0;
  }
}

function openPlayground(stage){
  closeStudy(false);
  leaveBirthdayJourney();
  guided=false;
  go(stage);
}

function paintCourseRoute(){
  $$('#chapters [data-route]').forEach(chapter=>{
    const stage=Number(chapter.dataset.route);
    const journey=birthdayJourneyActive(),active=journey?birthdayJourney.pass:level;
    if(stage===3){
      chapter.hidden=!journey||active<3;
      if(chapter.previousElementSibling)chapter.previousElementSibling.hidden=chapter.hidden;
    }
    chapter.textContent=journey?T(...djTakes[stage].title):['ARP','LOOP','8‑BIT',''][stage];
    chapter.classList.toggle('passed',journey?stage<active||birthdayJourney.step==='finished':stageDone(stage));
    if(stage===active)chapter.setAttribute('aria-current','step');
    else chapter.removeAttribute('aria-current');
  });
}

let spotlightKey='';
function setSpotlight(selectors){
  const key=selectors.join('|');
  if(key===spotlightKey)return;
  spotlightKey=key;
  const overlay=$('#panel-scrim');
  overlay.classList.toggle('is-lit',selectors.length>0);
  if(!selectors.length)return;
  const openings=selectors.map(selector=>{
    const rect=panelRects.get($(selector));
    if(!rect)return '';
    const {x,y,w,h}=rect;
    return `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2+26}" ry="${h/2+23}" fill="url(#panel-feather)"/>`;
  }).join('');
  overlay.innerHTML=`<defs><radialGradient id="panel-feather"><stop offset="48%" stop-color="black"/><stop offset="77%" stop-color="black" stop-opacity=".65"/><stop offset="100%" stop-color="black" stop-opacity="0"/></radialGradient><mask id="panel-focus-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1800" height="1238"><rect width="1800" height="1238" fill="white"/>${openings}</mask></defs><rect x="238" y="223" width="1324" height="792" rx="95" fill="#100918" fill-opacity=".60" mask="url(#panel-focus-mask)"/>`;
}

let studyTab=null,selectedControl=null;

function studyElement(tag,content,className){
  const element=document.createElement(tag);
  if(content)element.textContent=content;
  if(className)element.className=className;
  return element;
}

function studyButton(label,action){
  const button=studyElement('button',label,'study-action');
  button.type='button';
  button.onclick=action;
  return button;
}

function studyLink(label,url){
  const link=studyElement('a',label,'study-link');
  link.href=url;
  link.target='_blank';
  link.rel='noopener noreferrer';
  return link;
}

function describePanelKey(kind,name){
  if(kind==='lcd')return ['Read the screen','读屏幕','The labels beside K1–K4 tell you what the four parameter knobs do on this page. Tap LCD to see the same screen larger.','K1–K4 旁边的字说明四个旋钮在这页各调什么。点右上角 LCD，就能放大读数。'];
  if(kind!=='key')return panelGuide[name];
  const midi=Number(name)+state.octave*12+state.transpose;
  const note=noteName(midi),part=level===2?routeNote(midi):null;
  const parts={drums:['Drum hit','一声鼓'],sfx:['Sound effect','一个音效'],bass:['Bass note','一个贝斯音'],lead:['Lead note','一个主旋律音']};
  const voice=parts[part];
  if(part==='drums'||part==='sfx'){
    const first=part==='drums'?17:29,index=midi-first+1;
    return [note+' · '+voice[0]+' '+index,note+' · '+voice[1]+' '+index,
      'This part uses each key for a separate hit. Play it once, then try the key beside it to compare sounds.',
      '在这段音域，每颗键是一种不同的打击声或音效。先听这一颗，再听旁边一颗，比较它们的声音。'];
  }
  return [note+(voice?' · '+voice[0]:''),note+(voice?' · '+voice[1]:''),
    'This key plays '+note+' at the current octave. Try the key beside it to hear a semitone. The number tells you which octave the note lives in.',
    '这颗键在当前八度发出 '+note+'。试着听它旁边的一颗键，感受半音的距离。字母是音名，数字告诉你它在哪个八度。'];
}

function physicalEditHint(midi){
  const index=blackMidis.indexOf(Number(midi));
  if(index>=0&&index<6)return T(
    'On the real FM-1 in FM EDIT, OP'+(index+1)+' selects operator '+(index+1)+'. An operator is one of the waves used to build or bend the sound.',
    '真机 FM 的 EDIT 模式里，OP'+(index+1)+' 选中第 '+(index+1)+' 个算子。算子就是负责发声或推拉别的声音的一股波。'
  );
  const options=[
    ['PIT opens the pitch envelope in FM EDIT. It shapes how pitch changes over time.','真机 FM 的 PIT 打开音高包络，用来让一个音在发声时滑高或滑低。'],
    ['GLO on the key opens settings for this FM sound, such as its algorithm and transpose.','琴键上的 GLO 在真机 FM 编辑里打开当前音色的整体参数，比如算法和移调。'],
    ['MONO makes the sound play one note at a time.','真机的 MONO 让这个音色一次只响一个音。'],
    ['POLY lets the sound play several notes together.','真机的 POLY 让这个音色可以同时响好几个音，适合弹和弦。']
  ];
  return options[index-6]?T(...options[index-6]):'';
}

function selectedPanelSelector(){
  if(!selectedControl)return null;
  const [kind,name]=selectedControl;
  if(kind==='lcd')return '#device-display';
  return `[data-${kind==='key'?'midi':kind}="${name}"]`;
}

function showStudy(tab){
  if(studyTab===tab){closeStudy();return;}
  stopBirthdayPreview();
  closeManual();
  hideKnobInspector();
  studyTab=tab;
  selectedControl=tab==='manual'?['knob','MASTER']:null;
  $('#universe').classList.remove('mission-camera');
  fitMachine();
  $('#universe').classList.add('study-open');
  const dialog=$('#study');
  const wasOpen=dialog.open;
  if(!wasOpen)dialog.show();
  renderStudy();
  $('#study-content').scrollTop=0;
  $('#study-close').focus({preventScroll:true});
  if(moving()){
    const surface=wasOpen?$('#study-content'):dialog;
    surface.getAnimations().forEach(animation=>animation.cancel());
    surface.animate([{opacity:0,translate:wasOpen?'0 4px':'0 12px'},{opacity:1,translate:'0 0'}],{duration:wasOpen?145:220,easing:'cubic-bezier(.22,1,.36,1)'});
  }
}

function closeStudy(reframe=true){
  if(!studyTab)return;
  studyTab=null;
  selectedControl=null;
  $('#study').close();
  $('#universe').classList.remove('study-open');
  for(const id of ['guide-button','advanced-button'])$('#'+id).setAttribute('aria-expanded','false');
  setSpotlight([]);
  if(reframe&&scene==='game'){fitMachine();updateProgress();}
}

function inspectStudyControl(kind,name){
  if(studyTab!=='manual')return false;
  selectedControl=[kind,name];
  renderStudy();
  return true;
}

function openHardwareManual(){
  closeStudy(false);
  fitMachine();
  manualPages();
  drawManual(0);
  const manual=$('#manual');
  manual.show();
  if(moving())manual.animate([{opacity:0,translate:'0 12px'},{opacity:1,translate:'0 0'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});
  $('#universe').classList.add('manual-open');
  $('#guide-button').setAttribute('aria-expanded','true');
}

function panelPicker(){
  const field=studyElement('div',null,'study-field');
  const label=studyElement('label',T('Or pick from the list','或从列表里选'));
  const select=studyElement('select');
  select.id='study-control-select';
  label.htmlFor=select.id;
  const groups=[
    [T('Knobs','旋钮'),knobs.map(([name])=>['knob',name,name])],
    [T('Buttons and display','按键与屏幕'),[...controls.map(([name])=>['control',name,name==='PLAY'?'PLAY / STOP':name]),['lcd','LCD','LCD']]],
    [T('Piano keys','琴键'),[...whiteMidis,...blackMidis].sort((a,b)=>a-b).map(midi=>['key',midi,noteName(midi+state.octave*12+state.transpose)])]
  ];
  for(const [label,entries] of groups){
    const group=studyElement('optgroup');
    group.label=label;
    for(const [kind,name,text] of entries){
      const option=studyElement('option',text);
      option.value=JSON.stringify([kind,name]);
      group.append(option);
    }
    select.append(group);
  }
  if(selectedControl)select.value=JSON.stringify(selectedControl);
  select.onchange=()=>{
    selectedControl=JSON.parse(select.value);
    renderStudy();
    $('#study-control-select').focus({preventScroll:true});
  };
  field.append(label,select);
  return field;
}

async function hearStudyKey(base){
  try{
    await synth.wake();
    if(studyTab!=='manual')return;
    const midi=base+state.octave*12+state.transpose;
    const part=routeNote(midi);
    if(part==='drums')synth.drum(midi-17);
    else if(part==='sfx')synth.note(midi+36,'sfx',.16);
    else if(part==='lead')synth.note(midi-12,'chip',.32);
    else if(part)synth.note(midi,part==='bass'?'bass':'fm',.32);
  }catch{message(T('Audio could not start.','声音暂时无法启动。'));}
}

function renderStudy(){
  if(!studyTab)return;
  const title=$('#study-title'),body=$('#study-content');
  const scroll=body.scrollTop;
  body.replaceChildren();
  for(const [tab,id] of [['manual','guide-button'],['advanced','advanced-button']]){
    $('#'+id).setAttribute('aria-expanded',String(studyTab===tab));
  }
  if(studyTab==='manual'){
    title.textContent=T('Manual','手册');
    body.append(studyElement('p',T('Tap a key, button or knob on the machine.','点一下机器上的按键、按钮或旋钮。'),'study-lead'),panelPicker());
    const entry=selectedControl&&describePanelKey(...selectedControl);
    if(entry){
      const [en,zh,descriptionEn,descriptionZh]=entry;
      const control=selectedControl[0]==='key'?T('Piano key','琴键'):selectedControl[1];
      const card=studyElement('section',null,'study-entry');
      card.append(studyElement('p',control,'study-kicker'),
        studyElement('h3',T(en,zh)),studyElement('p',T(descriptionEn,descriptionZh)));
      if(selectedControl[0]==='key'){
        const base=Number(selectedControl[1]);
        const hint=physicalEditHint(base);
        if(hint)card.append(studyElement('p',hint));
        card.append(studyButton(T('Hear this key','听这颗键'),()=>hearStudyKey(base)));
      }else if(selectedControl[0]==='knob'){
        const value=$(`[data-knob="${selectedControl[1]}"]`).getAttribute('aria-valuetext');
        if(value)card.append(studyElement('p',T('Current reading  ','当前读数  ')+value,'study-kicker'));
      }else if(selectedControl[0]==='lcd'){
        card.append(studyButton(T('Enlarge the live LCD','放大实时屏幕'),()=>{
          $('#lcd-dialog').showModal();
          drawDevice();
        }));
      }
      body.append(card);
    }
    const terms=studyElement('details',null,'study-glossary');
    terms.append(studyElement('summary',T('Music words, in plain language','音乐词，讲人话')));
    for(const [en,zh,definitionEn,definitionZh] of musicGlossary){
      terms.append(studyElement('h4',T(en,zh)),studyElement('p',T(definitionEn,definitionZh)));
    }
    const steps=studyElement('button',T('Real FM-1 steps','查看真机操作步骤'),'study-text');
    steps.type='button';
    steps.onclick=openHardwareManual;
    body.append(terms,steps);
    const selector=selectedPanelSelector();
    setSpotlight(selector?[selector]:[]);
  }else{
    setSpotlight([]);
    title.textContent=T('Advanced','进阶');
    body.append(studyElement('p',T('Try these in the web instrument.','先在网页里试试这些玩法。'),'study-lead'));
    const experiments=[
      [T('Make a bell from an FM sound','做一个自己的 FM 铃声'),T('Open EDIT, set Ratio to 2.00× and raise FM Index slowly while you repeat one note. Then lengthen Release in ENV to hear the tail.','按 EDIT，Ratio 设 2.00×，反复弹同一个音，慢慢加大 FM Index。再到 ENV 把 Release 调长，听尾音。'),0],
      [T('Put the chord between the beats','把和弦放到拍子中间'),T('In a 16-step loop the “ands” are steps 3, 7, 11 and 15. With playback stopped, press REC, move there with ALGORITHM and play C6, E6 and G6 together at OCT +2.','16 格循环里，「和」在第 3、7、11、15 格。停着按 REC，用 ALGORITHM 移到这些格，八度 +2 时同时弹 C6、E6、G6。'),2],
      [T('Mix an 8-bit kit','混一套 8‑Bit 小乐队'),T('In 8-bit practice, open EDIT and turn the lead down to find the bass. Bring the lead back and balance it against the drums.','进 8‑Bit 按 EDIT，把 Lead 调低，先听出贝斯。再把主旋律加回来，和鼓做平衡。'),2]
    ];
    for(const [name,description,stage] of experiments){
      const card=studyElement('article',null,'study-card');
      card.append(studyElement('h4',name),studyElement('p',description),
        studyButton(T('Try it','去试试'),()=>openPlayground(stage)));
      body.append(card);
    }
    const sources=studyElement('p',null,'study-sources');
    sources.append(studyElement('span',T('Sources','资料')));
    for(const [label,url] of [
      ['David Hilowitz','https://www.youtube.com/watch?v=fyUoCwaRXLM'],
      ['Golf Easter · SLOOP','https://youtube.com/watch?v=c4_pLErfEcw'],
      ['Baud Girl V102','https://baudgirl.com/work/FM-1%2BVA/manual/102'],
      [T('SLOOP guide','SLOOP 按键与轨道手册'),'https://github.com/isod89/sloop-fm1/blob/main/GUIDE.md'],
      ['Firmware Hub','https://thefirmwarehub.com/']
    ])sources.append(studyLink(label+' ↗',url));
    body.append(sources);
  }
  body.scrollTop=scroll;
}

function initStudy(){
  $('#guide-button').onclick=()=>showStudy('manual');
  $('#advanced-button').onclick=()=>showStudy('advanced');
  $('#study-close').onclick=()=>closeStudy();
  $('#study').addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();closeStudy();}
  });
}

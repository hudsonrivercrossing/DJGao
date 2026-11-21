// The birthday show: a fixed, pre-rendered video of her song (assets/share). The full file is fetched in the
// background once she reaches take 4, plays full screen from the finished card with the site's sound, and ends
// on its title card, where sharing starts. Reels takes the full file; a Story takes the same video as two equal
// halves, fetched only when she picks Story.

const premiereFull={url:'assets/share/happy-birthday.mp4',name:'happy-birthday.mp4'};
const premiereStory=[1,2].map(part=>({url:'assets/share/happy-birthday-story-'+part+'.mp4',name:'happy-birthday-story-'+part+'.mp4'}));
const premiereFetches=new Map();
// view: 'watch' (playing or paused), 'end' (share, save, watch again), 'choose' (Reels or Story),
// 'story' (halves loading, then Share 2 clips) or 'saves' (a link per half).
const premiere={open:false,view:'watch',opener:null,routed:false,wantsPlay:false,frame:0,status:'',reelsSendable:true,iosSave:true,storyFailed:false,sourceUrl:null,partUrls:null,savedParts:[false,false],announced:'',heard:{video:false,story:false},started:false,fromWatch:false,seeking:null,second:-1};
// iPhone, or an iPad that calls itself a Mac. A touch Mac alone is not enough (desktop device emulation reports
// one): only WebKit on iOS also has navigator.standalone.
const premiereIOS=()=>{
  if(typeof navigator==='undefined')return false;
  if(/iP(hone|ad|od)/.test(navigator.userAgent||''))return true;
  return navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1&&typeof navigator.standalone==='boolean';
};

// Each file is fetched once per page, with its progress kept for the views that show it.
// The promise resolves to the File, or to null when the file cannot be fetched (offline copy, no network).
function premiereFetch({url,name}){
  let entry=premiereFetches.get(url);
  if(entry)return entry;
  entry={percent:0,file:null,failed:false};
  premiereFetches.set(url,entry);
  entry.promise=(async()=>{
    const response=await fetch(url);
    if(!response.ok)throw new Error(url+' '+response.status);
    const total=Number(response.headers.get('content-length'))||0,reader=total&&response.body?.getReader?.();
    let blob;
    if(reader){
      const parts=[];
      let received=0;
      for(let chunk=await reader.read();!chunk.done;chunk=await reader.read()){
        parts.push(chunk.value);
        received+=chunk.value.length;
        const percent=Math.min(99,Math.floor(received/total*100));
        if(percent!==entry.percent){entry.percent=percent;paintPremiere();}
      }
      blob=new Blob(parts,{type:'video/mp4'});
    }else blob=await response.blob();
    entry.file=new File([blob],name,{type:'video/mp4'});
    entry.percent=100;
    return entry.file;
  })().catch(()=>{entry.failed=true;return null;}).then(file=>{paintPremiere();return file;});
  return entry;
}

// From take 4 on: the full video, so the show starts without waiting.
function prefetchPremiere(){
  const entry=premiereFetch(premiereFull);
  entry.promise.then(file=>{
    if(!file||premiere.sourceUrl)return;
    premiere.sourceUrl=URL.createObjectURL(file);
    $('#premiere-video').src=premiere.sourceUrl;
    if(premiere.open&&premiere.wantsPlay)playPremiere();
  });
  paintPremiere();
}

// The card's entry: there once the song is finished and the video is on its way or here.
function premiereAvailable(){
  const entry=premiereFetches.get(premiereFull.url);
  return birthdayJourney?.step==='finished'&&Boolean(entry)&&!entry.failed;
}

// The video's sound goes through the site bus, so the volume and mute apply as to every other sound.
// Where there is no Web Audio, the element's own volume follows the site volume instead.
function routePremiereSound(){
  if(premiere.routed)return;
  const video=$('#premiere-video');
  try{
    synth.wake().catch(()=>{});
    const context=synth.context,source=context.createMediaElementSource(video);
    source.connect(siteBus(context));
    premiere.routed=true;
    video.muted=false;
    video.volume=1;
  }catch{syncPremiereVolume();}
}

function syncPremiereVolume(){
  if(premiere.routed)return;
  const video=$('#premiere-video');
  video.muted=siteSound.muted;
  video.volume=Math.min(1,siteGain());
}

function openPremiere(){
  if(!premiereAvailable()||premiere.open)return;
  if(birthdayMusicPlaying)stopBirthdayMusic();
  premiere.opener=document.activeElement||$('#premiere-open');
  premiere.open=true;
  premiere.view='watch';
  premiere.status='';
  premiere.started=false;
  premiere.fromWatch=false;
  $('#premiere').hidden=false;
  $('#interlude').inert=true;
  $('#utility-controls').inert=true;
  routePremiereSound();
  const video=$('#premiere-video');
  if(premiere.sourceUrl)video.currentTime=0;
  // With reduced motion nothing starts on its own: the poster waits under a play button.
  premiere.wantsPlay=!reduced.matches;
  if(premiere.wantsPlay)playPremiere();
  paintPremiere();
  $('#premiere-surface').focus({preventScroll:true});
}

function closePremiere(){
  if(!premiere.open)return;
  premiere.open=false;
  premiere.wantsPlay=false;
  $('#premiere-video').pause();
  cancelAnimationFrame(premiere.frame);
  $('#premiere').hidden=true;
  $('#interlude').inert=false;
  $('#utility-controls').inert=false;
  const back=premiere.opener?.isConnected===false?null:premiere.opener;
  (back||$('#premiere-open')).focus({preventScroll:true});
  premiere.opener=null;
}

function playPremiere(){
  premiere.wantsPlay=true;
  if(!premiere.sourceUrl){paintPremiere();return;}
  syncPremiereVolume();
  if(premiere.routed&&synth.context?.state!=='running')synth.wake().catch(()=>{});
  const playing=$('#premiere-video').play();
  // Refused (no user activation left, e.g. it loaded later): the play button shows, a tap starts it.
  Promise.resolve(playing).catch(()=>{premiere.wantsPlay=false;paintPremiere();});
}

function togglePremiere(){
  if(premiere.view!=='watch')return;
  const video=$('#premiere-video');
  if(premiere.wantsPlay&&(!premiere.sourceUrl||!video.paused)){premiere.wantsPlay=false;video.pause();paintPremiere();}
  else playPremiere();
}

function watchPremiereAgain(){
  premiere.view='watch';
  premiere.fromWatch=false;
  premiere.status='';
  $('#premiere-video').currentTime=0;
  playPremiere();
  paintPremiere();
  $('#premiere-surface').focus({preventScroll:true});
}

const premiereClock=seconds=>{const whole=Math.max(0,Math.round(seconds));return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');};
const premiereLength=()=>{const length=$('#premiere-video').duration;return Number.isFinite(length)&&length>0?length:0;};

// The seek bar follows the playhead every frame while it plays; the slider's values change once a second.
function tickPremiere(){
  const video=$('#premiere-video'),length=premiereLength(),fraction=length?Math.min(1,video.currentTime/length):0;
  $('#premiere-bar').style.transform='scaleX('+fraction+')';
  $('#premiere-rail').style.transform='translateX('+fraction*100+'%)';
  const second=Math.round(video.currentTime);
  if(second!==premiere.second){
    premiere.second=second;
    const seek=$('#premiere-seek'),text=premiereClock(video.currentTime)+' / '+premiereClock(length);
    seek.setAttribute('aria-valuemax',String(Math.round(length)));
    seek.setAttribute('aria-valuenow',String(second));
    seek.setAttribute('aria-valuetext',text);
    if(premiere.seeking)$('#premiere-seek-time').textContent=text;
  }
  cancelAnimationFrame(premiere.frame);
  if(premiere.open&&!video.paused)premiere.frame=requestAnimationFrame(tickPremiere);
}

function seekPremiere(seconds){
  const video=$('#premiere-video'),length=premiereLength();
  if(!length)return;
  video.currentTime=Math.max(0,Math.min(length,seconds));
  premiere.second=-1;
  tickPremiere();
}

// Pointer on the seek bar: a tap jumps there, a drag seeks live (paused meanwhile, playing again after if it was).
// localRect and toLocalPoint keep it right in sideways mode, where the screen's y is the layout's x.
function seekPremiereTo(event){
  const track=localRect($('#premiere-progress')),point=toLocalPoint(event.clientX,event.clientY);
  seekPremiere((point.x-track.left)/(track.width||1)*premiereLength());
}

function startPremiereSeek(event){
  if(!premiereLength()||premiere.seeking)return;
  event.preventDefault();
  const video=$('#premiere-video'),seek=$('#premiere-seek');
  premiere.seeking={pointer:event.pointerId,resume:!video.paused};
  try{seek.setPointerCapture?.(event.pointerId);}catch{}
  seek.dataset.active='';
  $('#premiere-seek-time').hidden=false;
  if(!video.paused)video.pause();
  seekPremiereTo(event);
  $('#premiere-seek-time').textContent=premiereClock(video.currentTime)+' / '+premiereClock(premiereLength());
}

function movePremiereSeek(event){
  if(premiere.seeking?.pointer===event.pointerId)seekPremiereTo(event);
}

function endPremiereSeek(event){
  const seeking=premiere.seeking;
  if(!seeking||seeking.pointer!==event.pointerId)return;
  premiere.seeking=null;
  delete $('#premiere-seek').dataset.active;
  $('#premiere-seek-time').hidden=true;
  if(seeking.resume)playPremiere();
  else paintPremiere();
}

function premiereSeekKey(event){
  const video=$('#premiere-video'),step={ArrowLeft:-5,ArrowDown:-5,ArrowRight:5,ArrowUp:5}[event.key];
  if(step)seekPremiere(video.currentTime+step);
  else if(event.key==='Home')seekPremiere(0);
  else if(event.key==='End')seekPremiere(premiereLength());
  else return;
  event.preventDefault();
}

// The share shortcut on the playing video: it pauses and asks Reels or Story, as at the end. Back (or Escape)
// returns to the paused video where it stopped.
function sharePremiereNow(){
  premiere.fromWatch=true;
  premiere.wantsPlay=false;
  $('#premiere-video').pause();
  choosePremiereShare();
}

// One view back, onto the control that opened the view being left. The top level closes the show instead.
function stepBackPremiere(){
  const {view}=premiere;
  if(view==='choose'){
    premiere.status='';
    if(premiere.fromWatch){premiere.fromWatch=false;setPremiereView('watch','#premiere-share-now');}
    else setPremiereView('end','#premiere-share');
  }else if(view==='story'||view==='saves')setPremiereView('choose',premiere.storyFailed?'#premiere-reels':'#premiere-story');
  else return false;
  return true;
}

// It stops on its last frame, the title card; the share controls rise in under it.
function endPremiere(){
  premiere.wantsPlay=false;
  premiere.fromWatch=false;
  premiere.status='';
  premiere.view='end';
  paintPremiere();
  $('#premiere-share').focus({preventScroll:true});
}

function setPremiereView(view,focus){
  premiere.view=view;
  paintPremiere();
  if(focus)$(focus).focus({preventScroll:true});
}

// "Share to Instagram": the caption goes to the clipboard on this tap; the share sheet carries only video.
function choosePremiereShare(){
  premiere.status='';
  const caption=T('Happy birthday, DJ GAO 🎂','生日快乐 DJ GAO 🎂');
  try{
    navigator.clipboard.writeText(caption).then(()=>{
      premiere.status=T('Caption copied — paste it in Instagram.','文案已复制，在 Instagram 里粘贴。');
      paintPremiere();
    },()=>{});
  }catch{}
  setPremiereView('choose','#premiere-reels');
}

const premiereSendable=files=>{try{return Boolean(navigator.canShare?.({files}));}catch{return false;}};

// Reels: the full file, already here. The share call stays in the tap handler, inside its user activation.
function sharePremiereReels(){
  const file=premiereFetches.get(premiereFull.url)?.file;
  if(!file)return;
  if(!premiere.reelsSendable||!premiereSendable([file])){downloadUrl(premiere.sourceUrl||premiereFull.url,premiereFull.name);return;}
  navigator.share({files:[file]}).catch(error=>{
    if(error?.name==='AbortError')return;
    // The activation is spent: the next tap on Reels saves the file instead.
    premiere.reelsSendable=false;
    paintPremiere();
  });
}

// Story: only now are the two halves fetched. Share 2 clips appears once both are here, so its tap can share.
function choosePremiereStory(){
  const entries=premiereStory.map(premiereFetch);
  // The tapped button goes with the view it was in: Back holds focus until Share 2 clips can take it.
  setPremiereView('story',entries.every(entry=>entry.file)?'#premiere-story-share':'#premiere-back');
  // Either half failing is enough to take Story away; both arriving hands focus to Share 2 clips.
  for(const entry of entries)entry.promise.then(file=>{
    if(!file&&!premiere.storyFailed){
      premiere.storyFailed=true;
      premiere.status=T('The Story clips could not load.','快拍的两段没能加载。');
      if(premiere.view==='story')setPremiereView('choose','#premiere-reels');
      else paintPremiere();
    }else if(file&&entries.every(other=>other.file)&&premiere.view==='story')$('#premiere-story-share').focus({preventScroll:true});
  });
}

function sharePremiereStory(){
  const files=premiereStory.map(spec=>premiereFetches.get(spec.url)?.file);
  if(!files.every(Boolean))return;
  if(!premiereSendable(files)){showPremiereSaves(files);return;}
  navigator.share({files}).catch(error=>{
    if(error?.name==='AbortError')return;
    showPremiereSaves(files);
  });
}

// Where two videos cannot be shared together: one link per half, saved, then posted in order in Instagram.
function showPremiereSaves(files){
  premiere.partUrls??=files.map(file=>URL.createObjectURL(file));
  premiereStory.forEach((spec,index)=>{
    const link=$('#premiere-part-'+(index+1));
    link.href=premiere.partUrls[index];
    link.download=spec.name;
  });
  setPremiereView('saves',premiere.savedParts[0]&&!premiere.savedParts[1]?'#premiere-part-2':'#premiere-part-1');
}

// A saved part is ticked off, and the other one is next.
function savePremierePart(index){
  premiere.savedParts[index]=true;
  paintPremiere();
  if(index===0&&!premiere.savedParts[1])$('#premiere-part-2').focus({preventScroll:true});
}

// Shown only while the site is muted: one tap brings the sound back, then the button goes.
function unmutePremiere(){
  toggleMute();
  syncPremiereVolume();
  paintPremiere();
  premiereFocusables()[0]?.focus({preventScroll:true});
}

// Save to Photos: on iPhone and iPad the share sheet's Save Video does it; elsewhere the file downloads.
function savePremiere(){
  const file=premiereFetches.get(premiereFull.url)?.file;
  if(!file)return;
  if(premiereIOS()&&premiere.iosSave&&premiereSendable([file])){
    navigator.share({files:[file]}).catch(error=>{
      if(error?.name==='AbortError')return;
      premiere.iosSave=false;
      paintPremiere();
    });
    return;
  }
  downloadUrl(premiere.sourceUrl||premiereFull.url,premiereFull.name);
}

function premiereFocusables(){
  const views={watch:['#premiere-surface','#premiere-seek'],end:['#premiere-share','#premiere-save','#premiere-again'],
    choose:['#premiere-reels','#premiere-story','#premiere-back'],story:['#premiere-story-share','#premiere-back'],
    saves:['#premiere-part-1','#premiere-part-2','#premiere-back']}[premiere.view];
  return [...views,'#premiere-sound','#premiere-share-now','#premiere-close'].map(selector=>$(selector)).filter(node=>node&&!node.hidden);
}

function premiereKey(event){
  if(!premiere.open)return;
  if(event.key==='Escape'){
    event.preventDefault();
    if(!stepBackPremiere())closePremiere();
    return;
  }
  if(event.key!=='Tab')return;
  const actions=premiereFocusables();
  event.preventDefault();
  const current=actions.indexOf(document.activeElement);
  actions[(current+(event.shiftKey?-1:1)+actions.length)%actions.length].focus();
}

// A hint as phrases that wrap as whole units, so a narrow column never breaks one in the middle.
function paintPremiereHint(selector,phrases){
  const node=$(selector);
  node.replaceChildren(...phrases.map(phrase=>{
    const span=document.createElement('span');
    span.textContent=phrase;
    return span;
  }));
}

// The live region hears loading in quarters (the start, 25, 50, 75%) and once when it is ready; the visible
// line still counts every percent.
function premiereNote(label,percent){return percent<25?label:label+'… '+Math.floor(percent/25)*25+'%';}

function announcePremiere(note){
  if(note===premiere.announced)return;
  premiere.announced=note;
  $('#premiere-announce').textContent=note;
}

function paintPremiere(){
  const entry=premiereFetches.get(premiereFull.url);
  const tile=$('#premiere-open');
  const available=premiereAvailable();
  tile.hidden=!available;
  // The show is the card's primary action while it is there; Play all steps down to a quiet row (style.css).
  const card=$('#interlude');
  if(available)card.dataset.premiere='';else delete card.dataset.premiere;
  $('#premiere-open-label').textContent=T('Watch your birthday show','看你的生日现场');
  if(!premiere.open)return;
  const video=$('#premiere-video'),{view}=premiere,ready=Boolean(premiere.sourceUrl);
  const box=$('#premiere');
  box.dataset.view=view;
  box.setAttribute('aria-label',T('Your birthday show','你的生日现场'));
  $('#premiere-close').setAttribute('aria-label',T('Close','关闭'));
  const sound=$('#premiere-sound');
  sound.hidden=!siteSound.muted;
  sound.setAttribute('aria-label',T('Sound is off. Turn it on','声音已关，打开声音'));
  const playing=ready&&premiere.wantsPlay&&!video.paused;
  const surface=$('#premiere-surface');
  surface.hidden=view!=='watch';
  const seek=$('#premiere-seek');
  seek.hidden=view!=='watch'||!ready;
  seek.setAttribute('aria-label',T('Playback position','播放进度'));
  const shareNow=$('#premiere-share-now');
  // Not on the poster before it has played (reduced motion), nor before the file is here to share.
  shareNow.hidden=view!=='watch'||!ready||!premiere.started||!entry?.file;
  shareNow.setAttribute('aria-label',T('Share','分享'));
  surface.dataset.state=premiere.wantsPlay?'playing':'paused';
  surface.setAttribute('aria-label',premiere.wantsPlay?T('Pause','暂停'):T('Play','播放'));
  const loading=$('#premiere-loading');
  loading.hidden=ready||!entry||(view!=='watch');
  loading.textContent=entry?.failed?T('The video could not load.','视频没能加载。'):T('Loading the video… ','正在加载视频… ')+(entry?.percent||0)+'%';
  let note='';
  if(view==='watch'&&entry){
    if(entry.failed)note=T('The video could not load.','视频没能加载。');
    else if(entry.file)note=premiere.heard.video?T('The video is ready.','视频准备好了。'):'';
    else{premiere.heard.video=true;note=premiereNote(T('Loading the video','正在加载视频'),entry.percent);}
  }
  $('#premiere-end').hidden=view==='watch';
  $('#premiere-end-main').hidden=view!=='end';
  $('#premiere-choose').hidden=view!=='choose';
  $('#premiere-story-view').hidden=view!=='story';
  $('#premiere-saves').hidden=view!=='saves';
  $('#premiere-back').hidden=!['choose','story','saves'].includes(view);
  $('#premiere-share').textContent=T('Share to Instagram','分享到 Instagram');
  $('#premiere-save').textContent=T('Save to Photos','保存到相册');
  $('#premiere-again').textContent=T('Watch again','再看一次');
  const iosSave=premiereIOS()&&premiere.iosSave;
  $('#premiere-save-hint').hidden=!iosSave;
  paintPremiereHint('#premiere-save-hint',T(['Save to Photos opens the share sheet; ','pick Save Video.'],['「保存到相册」会打开分享菜单，','选「存储视频」。']));
  $('#premiere-choose-title').textContent=T('Where is it going?','发到哪里？');
  $('#premiere-reels-label').textContent=T('Reels','Reels');
  $('#premiere-reels-hint').textContent=premiere.reelsSendable
    ?T('In the share sheet, pick Instagram → Reels.','在分享菜单里选 Instagram → Reels。')
    :T('Save the video, then post it as a Reel in Instagram.','先保存视频，再在 Instagram 里发 Reels。');
  $('#premiere-story').hidden=premiere.storyFailed;
  $('#premiere-story-label').textContent=T('Story','快拍');
  $('#premiere-story-hint').textContent=T('Two clips · 0:44 each','两段 · 每段 0:44');
  const parts=premiereStory.map(spec=>premiereFetches.get(spec.url)).filter(Boolean);
  const partsReady=parts.length===2&&parts.every(part=>part.file);
  const storyShare=$('#premiere-story-share');
  storyShare.hidden=!partsReady;
  storyShare.textContent=T('Share 2 clips','分享 2 段');
  $('#premiere-story-progress').hidden=partsReady;
  const storyPercent=Math.floor(parts.reduce((sum,part)=>sum+part.percent,0)/2);
  $('#premiere-story-progress').textContent=T('Getting the Story clips… ','正在准备快拍… ')+storyPercent+'%';
  if(view==='story'&&!premiere.storyFailed){
    if(partsReady)note=premiere.heard.story?T('The Story clips are ready.','快拍的两段准备好了。'):'';
    else{premiere.heard.story=true;note=premiereNote(T('Getting the Story clips','正在准备快拍'),storyPercent);}
  }
  announcePremiere(note);
  paintPremiereHint('#premiere-story-hint2',T(['Post part 1 first, ','then part 2.'],['先发第 1 段，','再发第 2 段。']));
  premiereStory.forEach((spec,index)=>{
    const link=$('#premiere-part-'+(index+1)),saved=premiere.savedParts[index],n=index+1;
    link.textContent=saved?T('Part '+n+' saved ✓','第 '+n+' 段已保存 ✓'):T('Save part '+n,'保存第 '+n+' 段');
    if(saved)link.dataset.saved='';else delete link.dataset.saved;
  });
  paintPremiereHint('#premiere-saves-hint',T(['Save both, ','then post them as Stories ','in order in Instagram.'],['两段都保存，','再在 Instagram 里','按顺序发快拍。']));
  $('#premiere-back').textContent=T('← Back','← 返回');
  $('#premiere-status').textContent=premiere.status;
  if(playing)tickPremiere();
}

function setupPremiere(){
  const video=$('#premiere-video');
  video.addEventListener('ended',endPremiere);
  video.addEventListener('play',()=>{premiere.started=true;paintPremiere();});
  video.addEventListener('loadedmetadata',()=>{premiere.second=-1;tickPremiere();});
  // A pause from outside (the system, a call, the lock screen) shows the play button too.
  video.addEventListener('pause',()=>{if(premiere.sourceUrl&&!premiere.seeking)premiere.wantsPlay=false;tickPremiere();paintPremiere();});
  const seek=$('#premiere-seek');
  seek.addEventListener('pointerdown',startPremiereSeek);
  seek.addEventListener('pointermove',movePremiereSeek);
  seek.addEventListener('pointerup',endPremiereSeek);
  seek.addEventListener('pointercancel',endPremiereSeek);
  seek.addEventListener('keydown',premiereSeekKey);
  $('#premiere-share-now').onclick=sharePremiereNow;
  video.addEventListener('timeupdate',syncPremiereVolume);
  // On the document, so Escape and the Tab trap still work if a view change ever leaves focus outside.
  document.addEventListener('keydown',premiereKey);
  $('#premiere-open').onclick=openPremiere;
  $('#premiere-surface').onclick=togglePremiere;
  $('#premiere-close').onclick=closePremiere;
  $('#premiere-sound').onclick=unmutePremiere;
  $('#premiere-part-1').onclick=()=>savePremierePart(0);
  $('#premiere-part-2').onclick=()=>savePremierePart(1);
  $('#premiere-share').onclick=choosePremiereShare;
  $('#premiere-save').onclick=savePremiere;
  $('#premiere-again').onclick=watchPremiereAgain;
  $('#premiere-reels').onclick=sharePremiereReels;
  $('#premiere-story').onclick=choosePremiereStory;
  $('#premiere-story-share').onclick=sharePremiereStory;
  $('#premiere-back').onclick=stepBackPremiere;
}

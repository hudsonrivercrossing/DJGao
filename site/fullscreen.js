// Full screen, by what the browser can do:
// - the Fullscreen API (Android, iPad, desktop): the top-bar button enters and leaves it; phones also lock landscape;
// - the home-screen app on iPhone is already full screen and turns with the phone: no button;
// - iPhone Safari: the button offers "Add to Home Screen" and "sideways mode", the landscape layout drawn
//   turned 90° clockwise in an upright page, for a phone turned to the left.
// Loaded first: app.js, dock.js, the knob inspector, the finale and the intro read the layout through these helpers.
const SIDEWAYS_KEY='fm1-sideways-v1';
const portraitView=matchMedia('(orientation: portrait)');
const phonePortraitView=matchMedia('(max-width: 650px) and (orientation: portrait)');
const phoneSidewaysView=matchMedia('(max-height: 520px) and (orientation: landscape)');
let sidewaysMode=false;

function standaloneDisplay(){
  return (typeof navigator!=='undefined'&&navigator.standalone===true)||matchMedia('(display-mode: standalone)').matches;
}
const fullscreenApi=()=>Boolean(document.fullscreenEnabled||document.webkitFullscreenEnabled);
const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
// 'standalone' (no button), 'api' (toggle full screen) or 'sheet' (iPhone Safari: home screen or sideways).
function fullscreenRoute(){return standaloneDisplay()?'standalone':fullscreenApi()?'api':'sheet';}

// The layout's own frame. In sideways mode it is as wide as the screen is tall.
const rotatedMode=()=>sidewaysMode;
const viewWidth=()=>sidewaysMode?innerHeight:innerWidth;
const viewHeight=()=>sidewaysMode?innerWidth:innerHeight;
const phoneLayout=()=>!sidewaysMode&&phonePortraitView.matches;
const sidewaysLayout=()=>sidewaysMode||phoneSidewaysView.matches;
// The body turns 90° clockwise about its top-left corner and moves right by the screen's width, so a layout
// point (x, y) shows on screen at (innerWidth − y, x). Pointer events and rects arrive in screen coordinates.
const toLocalPoint=(x,y)=>sidewaysMode?{x:y,y:innerWidth-x}:{x,y};
const toLocalDelta=(dx,dy)=>sidewaysMode?{x:dy,y:-dx||0}:{x:dx,y:dy};
function localRect(element){
  const rect=element.getBoundingClientRect();
  if(!sidewaysMode)return rect;
  const a=toLocalPoint(rect.left,rect.top),b=toLocalPoint(rect.right,rect.bottom);
  const left=Math.min(a.x,b.x),top=Math.min(a.y,b.y),right=Math.max(a.x,b.x),bottom=Math.max(a.y,b.y);
  return {left,top,right,bottom,x:left,y:top,width:right-left,height:bottom-top};
}

// The first sync runs before app.js defines T (in the packaged page, in the same script: T is not yet initialised).
const fullscreenSay=(en,zh)=>{try{return T(en,zh);}catch{return zh;}};
const fullscreenNode=selector=>document.querySelector(selector);

function setSidewaysMode(on){
  on=Boolean(on)&&portraitView.matches;
  try{if(on)sessionStorage.setItem(SIDEWAYS_KEY,'1');else sessionStorage.removeItem(SIDEWAYS_KEY);}catch{}
  if(on===sidewaysMode)return;
  sidewaysMode=on;
  document.documentElement.classList?.toggle('rotated',on);
  syncFullscreenButton();
  // Everything that measures the page (camera, dock, stars, popovers) already listens for resize.
  if(typeof Event==='function')window.dispatchEvent?.(new Event('resize'));
}

const touchPhone=()=>matchMedia('(pointer: coarse)').matches&&typeof screen!=='undefined'&&Math.min(screen.width,screen.height)<=600;
function enterFullscreen(){
  const root=document.documentElement;
  let request;
  try{request=root.requestFullscreen?root.requestFullscreen({navigationUI:'hide'}):root.webkitRequestFullscreen?.();}catch{return;}
  Promise.resolve(request).then(()=>{
    if(!touchPhone())return;
    try{screen.orientation?.lock?.('landscape')?.catch?.(()=>{});}catch{}
  },()=>{});
}
function exitFullscreen(){
  try{Promise.resolve(document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen?.()).catch(()=>{});}catch{}
}
function onFullscreenChange(){
  if(!fullscreenElement()){try{screen.orientation?.unlock?.();}catch{}}
  syncFullscreenButton();
}

function syncFullscreenButton(){
  const route=fullscreenRoute();
  document.documentElement.classList?.toggle('standalone',route==='standalone');
  const button=fullscreenNode('#fullscreen');
  if(!button)return;
  button.hidden=route==='standalone';
  const exit=sidewaysMode||Boolean(fullscreenElement());
  button.classList.toggle('exit',exit);
  button.setAttribute('aria-label',sidewaysMode?fullscreenSay('Exit sideways mode','退出横屏'):exit?fullscreenSay('Exit full screen','退出全屏'):fullscreenSay('Full screen','全屏'));
  if(route==='sheet'&&!sidewaysMode)button.setAttribute('aria-haspopup','dialog');else button.removeAttribute('aria-haspopup');
}

function syncFullscreenSheet(){
  const text={
    '#fullscreen-title':['Full screen','全屏'],
    '#fullscreen-home-label':['Add to Home Screen','加到主屏幕'],
    '#fullscreen-home-note':['Opens full screen, like an app','像 App 一样全屏打开'],
    '#fullscreen-sideways-label':['Use sideways now','现在横着用'],
    '#fullscreen-sideways-note':['Turn the phone to the left','把手机向左横过来'],
    '#fullscreen-back':['← Back','← 返回'],
    '#fullscreen-step-share':['Tap Share at the bottom of Safari','点 Safari 底部的分享'],
    '#fullscreen-step-add':['Choose “Add to Home Screen”','选『添加到主屏幕』'],
    '#fullscreen-howto-note':['No Share button? Tap ··· first. Then open it from your Home Screen: full screen, and it turns with the phone.','没看到分享？先点「···」。加好以后从主屏幕打开：全屏，手机横过来它也跟着转。'],
  };
  for(const [selector,[en,zh]] of Object.entries(text)){const node=fullscreenNode(selector);if(node)node.textContent=fullscreenSay(en,zh);}
  fullscreenNode('#fullscreen-close')?.setAttribute('aria-label',fullscreenSay('Close','关闭'));
}
function showFullscreenSteps(on){
  fullscreenNode('#fullscreen-choices').hidden=on;
  fullscreenNode('#fullscreen-howto').hidden=!on;
  fullscreenNode(on?'#fullscreen-back':'#fullscreen-home')?.focus?.();
}
function openFullscreenSheet(){
  const sheet=fullscreenNode('#fullscreen-sheet');
  syncFullscreenSheet();
  // Turning an upright page only makes sense while the phone is upright.
  fullscreenNode('#fullscreen-sideways').hidden=!portraitView.matches;
  fullscreenNode('#fullscreen-choices').hidden=false;
  fullscreenNode('#fullscreen-howto').hidden=true;
  sheet.showModal();
  fullscreenNode('#fullscreen-home')?.focus?.();
}

function onFullscreenButton(){
  if(sidewaysMode){setSidewaysMode(false);return;}
  const route=fullscreenRoute();
  if(route==='api'){if(fullscreenElement())exitFullscreen();else enterFullscreen();}
  else if(route==='sheet')openFullscreenSheet();
}

(()=>{
  const button=fullscreenNode('#fullscreen'),sheet=fullscreenNode('#fullscreen-sheet');
  if(button)button.onclick=onFullscreenButton;
  if(sheet){
    fullscreenNode('#fullscreen-close').onclick=()=>sheet.close();
    fullscreenNode('#fullscreen-home').onclick=()=>showFullscreenSteps(true);
    fullscreenNode('#fullscreen-back').onclick=()=>showFullscreenSteps(false);
    fullscreenNode('#fullscreen-sideways').onclick=()=>{sheet.close();setSidewaysMode(true);};
    sheet.addEventListener('close',()=>{if(!sidewaysMode)button?.focus?.({preventScroll:true});});
  }
  document.addEventListener('fullscreenchange',onFullscreenChange);
  document.addEventListener('webkitfullscreenchange',onFullscreenChange);
  // Turned for real (the phone's rotation lock is off): the page is landscape by itself, so sideways mode ends.
  portraitView.addEventListener?.('change',()=>{if(!portraitView.matches)setSidewaysMode(false);});
  let stored=false;
  try{stored=sessionStorage.getItem(SIDEWAYS_KEY)==='1';}catch{}
  if(stored&&fullscreenRoute()!=='standalone')setSidewaysMode(true);
  syncFullscreenButton();
})();

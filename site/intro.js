// Every visit opens on a pixel gift box alone on the night sky. One tap opens it: the lid pops, light bursts out on
// the first kick, and the birthday club is already running: six beats of camera push onto the stage, then a
// one-frame hand-off to the real opening screen (#machine, the title, #power-on, #utility-controls).
// Any tap or key during the run skips. ?nointro goes straight to the opening screen.
const intro=(()=>{
  const OUT='cubic-bezier(0.32,0.72,0,1)',IN='cubic-bezier(0.55,0,1,0.45)';
  const COLORS={rose:'#fa8bc7',lilac:'#b9a4ff',mint:'#8debd9',gold:'#f6d38c',ink:'#fff1ed'};
  const PAL=[COLORS.rose,COLORS.lilac,COLORS.mint,COLORS.gold];
  const universe=$('#universe');
  const status={state:'off',calm:false,sounds:0,tappedAt:0,endedAt:0};
  const asked=()=>{try{return /[?&]nointro(?:[=&]|$)/.test(location.search)}catch{return false}};

  /* ---------- sound: scheduled on the site's own AudioContext into the site volume; muted, the visuals run silent ---------- */
  const TRIM=.68; // about -20 LUFS at 50% volume, level with her keys and the song
  let bus=null,noiseBuf=null;
  function audioOut(){
    if(synth.muted||!synth.context)return null;
    const c=synth.context;
    if(!bus){bus=c.createGain();bus.gain.value=TRIM;bus.connect(siteBus(c));}
    return c;
  }
  function cutSound(){
    if(!bus)return;
    const old=bus,t=synth.context.currentTime;bus=null;
    old.gain.cancelScheduledValues(t);old.gain.setValueAtTime(old.gain.value,t);old.gain.linearRampToValueAtTime(0,t+.08);
    setTimeout(()=>old.disconnect(),200);
  }
  function env(g,t,a,peak,d){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);}
  function fm({f,t,ratio=2,index=1.5,dur=1,gain=.2,attack=.004}){
    const c=audioOut();if(!c)return;status.sounds++;
    const car=c.createOscillator(),mod=c.createOscillator(),mg=c.createGain(),g=c.createGain();
    car.frequency.value=f;mod.frequency.value=f*ratio;
    mg.gain.setValueAtTime(f*index,t);mg.gain.exponentialRampToValueAtTime(f*.01+.01,t+dur*.7);
    mod.connect(mg);mg.connect(car.frequency);car.connect(g);g.connect(bus);env(g,t,attack,gain,dur);
    car.start(t);mod.start(t);car.stop(t+attack+dur+.05);mod.stop(t+attack+dur+.05);
  }
  function tone({f,to,t,type='triangle',dur=.2,gain=.1,attack=.003}){
    const c=audioOut();if(!c)return;status.sounds++;
    const o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur*.4);
    o.connect(g);g.connect(bus);env(g,t,attack,gain,dur);o.start(t);o.stop(t+attack+dur+.05);
  }
  function noise({t,dur=.05,gain=.1,type='highpass',freq=7000,q=.7,attack=.002}){
    const c=audioOut();if(!c)return;status.sounds++;
    if(!noiseBuf){const len=c.sampleRate*2;noiseBuf=c.createBuffer(1,len,c.sampleRate);const data=noiseBuf.getChannelData(0);for(let i=0;i<len;i++)data[i]=Math.random()*2-1;}
    const src=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();
    src.buffer=noiseBuf;src.loop=true;fl.type=type;fl.frequency.setValueAtTime(freq,t);fl.Q.value=q;
    src.connect(fl);fl.connect(g);g.connect(bus);env(g,t,attack,gain,dur);src.start(t);src.stop(t+attack+dur+.05);
  }
  const now=()=>synth.context?synth.context.currentTime+.02:0;
  const SFX={
    sparkle(t){[1568,2093,2637,3136].forEach((f,i)=>tone({f,t:t+i*.06,dur:.22,gain:.05}));},
    pad(t,notes,gain=.05,dur=1.8){notes.forEach((f,i)=>fm({f,t:t+i*.04,ratio:1,index:.8,dur,gain,attack:.02}));},
    kick(t){tone({f:150,to:45,t,type:'sine',dur:.32,gain:.7,attack:.001});},
    hat(t){noise({t,dur:.045,gain:.07});},
    bass(t,f){tone({f,t,type:'sawtooth',dur:.18,gain:.07});},
    cheer(t,len=3){noise({t,dur:len,attack:.5,gain:.14,type:'bandpass',freq:1500,q:.5});noise({t:t+.1,dur:len*.8,attack:.4,gain:.08,type:'bandpass',freq:650,q:.8});},
  };
  const CHORD=[523.25,659.25,783.99,987.77,1174.66];

  /* ---------- the LED wall's pixel lettering ---------- */
  const F5={
    D:['11110','10001','10001','10001','10001','10001','11110'],J:['00111','00010','00010','00010','00010','10010','01100'],
    G:['01110','10001','10000','10111','10001','10001','01111'],A:['01110','10001','10001','11111','10001','10001','10001'],
    O:['01110','10001','10001','10001','10001','10001','01110'],H:['10001','10001','10001','11111','10001','10001','10001'],
    P:['11110','10001','10001','11110','10000','10000','10000'],Y:['10001','10001','01010','00100','00100','00100','00100'],
    B:['11110','10001','10001','11110','10001','10001','11110'],I:['01110','00100','00100','00100','00100','00100','01110'],
    R:['11110','10001','10001','11110','10100','10010','10001'],T:['11111','00100','00100','00100','00100','00100','00100'],
    ' ':['00000','00000','00000','00000','00000','00000','00000'],
  };
  const F3={
    H:['101','101','111','101','101'],A:['010','101','111','101','101'],P:['110','101','110','100','100'],
    Y:['101','101','010','010','010'],B:['110','101','110','101','110'],I:['111','010','010','010','111'],
    R:['110','101','110','101','101'],T:['111','010','010','010','010'],D:['110','101','101','101','110'],
  };
  // Text → column bitmasks (bit y = row y), one blank column between glyphs.
  function textCols(str,font){
    const cols=[];
    for(const ch of str){const g=font[ch]||font[' '];for(let x=0;x<g[0].length;x++){let m=0;g.forEach((row,y)=>{if(row[x]==='1')m|=1<<y});cols.push(m);}cols.push(0);}
    cols.pop();return cols;
  }
  const LED_COLS=40,LED_ROWS=19;
  const DJ=textCols('DJ GAO',F5),HAPPY=textCols('HAPPY',F3),BDAY=textCols('BIRTHDAY',F3);

  function cubicBezier(x1,y1,x2,y2){
    const B=(a,b,t)=>3*a*t*(1-t)*(1-t)+3*b*t*t*(1-t)+t*t*t;
    return x=>{if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1,t=x;for(let i=0;i<24;i++){t=(lo+hi)/2;if(B(x1,x2,t)<x)lo=t;else hi=t;}return B(y1,y2,t);};
  }
  const pushEase=cubicBezier(.32,.72,0,1),diveEase=cubicBezier(.65,0,.35,1);

  // The club is a 320×260 world; the machine stands on the stage at M (the #machine box) inside P (its photo).
  const W=320,H=260,MW=56,MH=MW*792/1324;
  const M={x:160-MW/2,y:150-MH-1,w:MW,h:MH};
  const P={x:M.x-238/1324*M.w,y:M.y-223/792*M.h,w:1800/1324*M.w,h:1238/792*M.h};
  const MC={x:M.x+M.w/2,y:M.y+M.h/2};
  const BPM=124,BEAT=60000/BPM,BEATS=6,PUSH=BEATS*BEAT; // lands on the 6th downbeat, ~2.9 s
  const LEAD=150; // tap → first kick: the lid is up and the light bursts out of the box
  const LIP=176,WALL_TOP=48,WALL_TEXT_LOW=96,MACHINE_LOW=150;
  const clamp01=x=>Math.max(0,Math.min(1,x));
  const hexRgb=hex=>{const n=parseInt(hex.slice(1),16);return [n>>16,(n>>8)&255,n&255]};
  const rgba=(hex,a)=>{const [r,g,b]=hexRgb(hex);return `rgba(${r},${g},${b},${a})`};
  const mix=(hex,t)=>{const a=hexRgb(hex),b=[16,12,24];return `rgb(${a.map((v,i)=>Math.round(b[i]+(v-b[i])*t)).join(',')})`};

  function makeCrowd(){
    const people=[];let seed=11;
    const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
    const tint=[.42,.32,.23,.15];
    for(let r=0;r<4;r++){
      const s=1+r*.4,base=196+r*20;
      for(let x=-70+rnd()*8;x<W+70;x+=11*s+rnd()*5){
        const c=PAL[Math.floor(rnd()*4)],roll=rnd();
        people.push({x,base,s,r,ph:rnd(),body:mix(c,tint[r]),head:mix(c,tint[r]+.1),
          hair:roll<.25?'buns':roll<.4?'ears':'none',hold:rnd()<.2?(rnd()<.5?'phone':PAL[Math.floor(rnd()*4)]):null});
      }
    }
    return people;
  }

  /* ---------- the gift: inline pixel art, one unit = one pixel; the lid is its own piece so it can pop ---------- */
  const px=(c,...r)=>r.map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');
  const LID_SVG=`<svg class="gift-lid" viewBox="0 0 16 8" shape-rendering="crispEdges" aria-hidden="true">`
    +px('#f6d38c',[4,0,2,1],[10,0,2,1],[3,1,4,1],[9,1,4,1],[3,2,4,1],[9,2,4,1],[4,3,3,1],[9,3,3,1],[7,2,2,2])
    +px('#c99a4e',[4,1,2,1],[10,1,2,1],[7,3,2,1])
    +px('#fa8bc7',[0,4,16,4])+px('#ffbfe0',[0,4,16,1])+px('#c95e9c',[0,7,16,1])
    +px('#f6d38c',[7,4,2,4])+px('#c99a4e',[8,5,1,3])+'</svg>';
  const BOX_SVG=`<svg class="gift-box" viewBox="0 0 14 10" shape-rendering="crispEdges" aria-hidden="true">`
    +px('#fa8bc7',[0,0,14,10])+px('#ffb0d9',[0,1,1,9])+px('#d9709f',[12,0,2,10],[0,9,14,1])+px('#9e4378',[0,0,14,1])
    +px('#f6d38c',[6,0,2,10])+px('#c99a4e',[7,1,1,9],[6,0,2,1])+'</svg>';

  /* ---------- mount: the gift only; the club is built on the tap ---------- */
  function mount(){
    const calm=status.calm=!moving();
    const machine=$('#machine'),title=$('.scene-copy'),power=$('#power-on'),utility=$('#utility-controls'),cosmos=$('#cosmos');
    const layer=document.createElement('div');layer.id='intro';
    const gift=document.createElement('button');gift.id='intro-gift';gift.type='button';
    gift.setAttribute('aria-label',T('Open the gift','打开礼物'));
    gift.innerHTML=`<span class="gift-hop">${LID_SVG}${BOX_SVG}</span>`;
    layer.append(gift);
    universe.classList.add('intro-gift');universe.classList.remove('intro-pending');
    universe.append(layer);

    const anims=[],timers=[];
    let cv=null,g=null,off=null,og=null,crowd=null,confettiBox=null;
    let raf=0,T0=0,vw=0,vh=0,dpr=1,R=null,landed=false,hold=null,swallowUntil=0;

    // Animations on the real opening elements use fill:'backwards' so their CSS takes over once they finish.
    const animate=(el,kf,{at=0,dur=300,ease=OUT,fill='backwards'}={})=>{if(el&&el.animate)anims.push(el.animate(kf,{delay:at,duration:dur,easing:ease,fill}));};
    const later=(ms,fn)=>timers.push(setTimeout(fn,ms));
    const finishAll=()=>{timers.forEach(clearTimeout);timers.length=0;anims.forEach(a=>{try{a.finish()}catch{}});anims.length=0;};

    // The machine is pre-rendered once per resize at exactly its landing size in device pixels.
    function renderMachine(){
      const photo=$('.machine-photo'),lcd=$('#device-display'),S=localRect($('#device-stage')),L=localRect(lcd);
      off.width=Math.round(S.width*dpr);off.height=Math.round(S.height*dpr);
      og.clearRect(0,0,off.width,off.height);
      if(!photo.complete||!photo.naturalWidth)return;
      og.filter=`drop-shadow(0 ${24*dpr}px ${24*dpr}px rgba(0,0,0,.44))`;
      og.imageSmoothingQuality='high';
      og.drawImage(photo,0,0,off.width,off.height);
      og.filter='none';
      og.fillStyle='#08050d';og.fillRect((L.left-S.left)*dpr,(L.top-S.top)*dpr,L.width*dpr,L.height*dpr);
      og.drawImage(lcd,(L.left-S.left)*dpr,(L.top-S.top)*dpr,L.width*dpr,L.height*dpr);
    }
    function wideCam(){
      if(vw/vh<.9){
        // Phone: stage and LED wall in the upper part, the lip at 66% height, crowd in the bottom third.
        const k=vw/144;
        return {k,cx:W/2,cy:LIP-(.66*vh-vh/2)/k};
      }
      // Desktop: ceiling string lights at the top edge, crowd along the bottom (wide screens keep the crowd's heads).
      const k=Math.max(vh/236,vw/440),half=vh/(2*k);
      return {k,cx:W/2,cy:Math.max(half,224-half)};
    }
    function size(){
      dpr=Math.min(devicePixelRatio||1,2);
      vw=universe.clientWidth;vh=universe.clientHeight;
      cv.width=Math.round(vw*dpr);cv.height=Math.round(vh*dpr);
      R=localRect(machine);
      const c=wideCam(),k1=R.width/M.w;
      // Where the landing framing leaves the wall's lettering above the screen (desktop), the push first settles on
      // a framing that holds the wall and the machine, then dives onto the machine during the last beat.
      hold=null;
      if(R.top+R.height/2-(MC.y-WALL_TEXT_LOW)*k1<.12*vh){
        const top=WALL_TOP-4,k=Math.max(c.k,Math.min(k1,.86*vh/(MACHINE_LOW-top))),cy=(top+MACHINE_LOW)/2;
        hold={k,x:vw/2+(MC.x-W/2)*k,y:vh/2+(MC.y-cy)*k};
      }
      renderMachine();
    }
    function glide(ka,kb,a,b,e){
      const k=ka*Math.pow(kb/ka,e),sx=a.x+(b.x-a.x)*e,sy=a.y+(b.y-a.y)*e;
      return {k,cx:MC.x-(sx-vw/2)/k,cy:MC.y-(sy-vh/2)/k};
    }
    // The machine glides in screen space straight into the real #machine rect.
    function camera(el){
      const c0=wideCam();
      if(el<=0)return c0;
      const k1=R.width/M.w,s0={x:(MC.x-c0.cx)*c0.k+vw/2,y:(MC.y-c0.cy)*c0.k+vh/2},s1={x:R.left+R.width/2,y:R.top+R.height/2};
      if(!hold)return glide(c0.k,k1,s0,s1,pushEase(clamp01(el/PUSH)));
      const split=PUSH-BEAT;
      if(el<split)return glide(c0.k,hold.k,s0,hold,pushEase(el/split));
      return glide(hold.k,k1,hold,s1,diveEase(clamp01((el-split)/BEAT)));
    }

    function drawLed(el){
      g.fillStyle='#1c1328';g.fillRect(98,48,124,62);
      g.fillStyle='#06040a';g.fillRect(100,50,120,58);
      const grid=new Uint8Array(LED_COLS*LED_ROWS);
      const put=(cols,c0,r0)=>cols.forEach((m,i)=>{for(let y=0;y<7;y++)if(m&(1<<y)){const c=c0+i;if(c>=0&&c<LED_COLS)grid[(r0+y)*LED_COLS+c]=1;}});
      const beat=el/BEAT,i=Math.floor(beat),bright=.45+.55*(1-(beat%1));
      let col;
      if(i>=BEATS-1){put(HAPPY,10,3);put(BDAY,4,10);col=COLORS.gold;}
      else{put(DJ,2,6);col=PAL[i%4];}
      for(let c=0;c<LED_COLS;c++)for(let r=0;r<LED_ROWS;r++){
        const on=grid[r*LED_COLS+c];
        g.fillStyle=on?col:'#1b1428';g.globalAlpha=on?bright:1;
        g.fillRect(101+c*3,51+r*3,2,2);
      }
      g.globalAlpha=1;
    }
    function drawPerson(q,t,el,stageCol,glow){
      const u=q.s,beat=el/BEAT,handsUp=beat<1;
      const bob=-Math.abs(Math.sin(Math.PI*(beat+q.ph*.25)))*(handsUp?3.2:1.6)*u;
      const x=q.x,y=q.base+bob,hy=y-13*u;
      g.fillStyle=q.body;
      g.fillRect(x-4*u,y-6*u,8*u,u);
      g.fillRect(x-5*u,y-5*u,10*u,H+80-y);
      const armL=handsUp,armR=handsUp||!!q.hold;
      if(armL)g.fillRect(x-6.5*u,y-14*u,1.6*u,9*u);
      if(armR)g.fillRect(x+4.9*u,y-14*u,1.6*u,9*u);
      g.fillStyle=q.head;
      g.fillRect(x-2*u,hy,4*u,u);g.fillRect(x-3*u,hy+u,6*u,4*u);g.fillRect(x-2*u,hy+5*u,4*u,u);
      if(q.hair==='buns'){g.fillRect(x-3.6*u,hy-1.2*u,2*u,2*u);g.fillRect(x+1.6*u,hy-1.2*u,2*u,2*u);}
      if(q.hair==='ears'){g.fillRect(x-3*u,hy-u,1.4*u,1.4*u);g.fillRect(x+1.6*u,hy-u,1.4*u,1.4*u);}
      // rim light from the stage on the head top
      g.fillStyle=rgba(stageCol,.55-q.r*.08+glow*.3);
      g.fillRect(x-2*u,hy,4*u,Math.max(.6,.7*u));
      if(q.hair==='buns'){g.fillRect(x-3.6*u,hy-1.2*u,2*u,.6*u);g.fillRect(x+1.6*u,hy-1.2*u,2*u,.6*u);}
      if(q.hold&&armR){
        const lx=x+5.2*u,ly=y-17.5*u,c=q.hold==='phone'?COLORS.ink:q.hold,tw=.7+.3*Math.sin(t*.006+q.ph*9);
        g.globalCompositeOperation='lighter';
        g.fillStyle=rgba(c,.22*tw);g.fillRect(lx-1.5*u,ly-1.5*u,4*u,6*u);
        g.globalCompositeOperation='source-over';
        g.fillStyle=c;
        if(q.hold==='phone')g.fillRect(lx-.2*u,ly+.6*u,1.6*u,2.2*u);
        else g.fillRect(lx,ly-.5*u,u,4*u);
      }
    }
    function draw(t,el){
      const p=clamp01(el/PUSH),cam=camera(el);
      g.setTransform(dpr*cam.k,0,0,dpr*cam.k,dpr*(vw/2-cam.cx*cam.k),dpr*(vh/2-cam.cy*cam.k));
      g.globalCompositeOperation='source-over';
      g.fillStyle='#150f22';g.fillRect(-400,-400,W+800,550);
      g.fillStyle='#0d0914';g.fillRect(-400,150,W+800,H+400);
      const beat=el/BEAT,bi=Math.floor(beat);
      // beat flash: big on the first kick, smaller on the rest
      const flash=bi<=BEATS?(bi===0?1:.4)*Math.exp(-(el-bi*BEAT)/160):0;
      // the gift's light arrives as beams already swinging onto the machine
      const conv=clamp01((el+400)/1900);
      const stageCol=PAL[bi%4];

      // string lights
      for(let sI=0;sI<3;sI++){
        const y0=12+sI*12,sag=9,yAt=x=>y0+sag*(1-Math.pow((x-W/2)/(W/2),2));
        g.fillStyle='#2a2036';
        for(let x=-40;x<W+40;x+=2)g.fillRect(x,Math.round(yAt(x)),2,1);
        for(let x=-46+sI*3;x<W+50;x+=10){
          const c=PAL[((x+50)/10+sI)%4|0],tw=.55+.45*Math.sin(t*.003+x*.7+sI),y=Math.round(yAt(x))+1;
          g.globalAlpha=clamp01(tw+conv*.4+flash*.5);g.fillStyle=c;g.fillRect(x,y,2,2);
          g.globalAlpha=.18*clamp01(tw+conv+flash);g.fillRect(x-1,y-1,4,4);
        }
        g.globalAlpha=1;
      }

      drawLed(el);

      for(const sx of [64,236]){
        g.fillStyle='#1a1226';g.fillRect(sx,116,20,34);
        g.fillStyle='#2a1f38';g.fillRect(sx+6,121,8,8);g.fillRect(sx+4,134,12,12);
        g.fillStyle='#0c0812';g.fillRect(sx+8,123,4,4);g.fillRect(sx+7,137,6,6);
      }

      // beams: converge on the machine, flash on the kick
      g.globalCompositeOperation='lighter';
      [{x:28,y:6,c:COLORS.rose},{x:104,y:4,c:COLORS.lilac},{x:216,y:4,c:COLORS.mint},{x:292,y:6,c:COLORS.gold}].forEach((s,i)=>{
        const idle=Math.PI/2+Math.sin(t*.0009+i*1.7)*.5;
        const target=Math.atan2(MC.y-s.y,MC.x-s.x),a=idle+(target-idle)*pushEase(conv);
        const hw=.09-conv*.035,len=240;
        const grad=g.createLinearGradient(s.x,s.y,s.x+Math.cos(a)*len,s.y+Math.sin(a)*len);
        grad.addColorStop(0,rgba(s.c,Math.min(.85,.3+conv*.2+flash*.45)));grad.addColorStop(1,rgba(s.c,0));
        g.fillStyle=grad;
        g.beginPath();g.moveTo(s.x,s.y);
        g.lineTo(s.x+Math.cos(a-hw)*len,s.y+Math.sin(a-hw)*len);
        g.lineTo(s.x+Math.cos(a+hw)*len,s.y+Math.sin(a+hw)*len);
        g.closePath();g.fill();
      });
      g.globalCompositeOperation='source-over';

      // stage
      g.fillStyle='#3d2c52';g.fillRect(56,150,208,4);
      g.fillStyle='#1f1530';g.fillRect(56,154,208,22);
      g.fillStyle=rgba(stageCol,.4+conv*.4+flash*.2);g.fillRect(56,154,208,1);
      g.globalCompositeOperation='lighter';
      const rg=g.createRadialGradient(MC.x,MC.y,2,MC.x,MC.y,60);
      rg.addColorStop(0,rgba(COLORS.rose,.26*conv));rg.addColorStop(1,rgba(COLORS.rose,0));
      g.fillStyle=rg;g.fillRect(MC.x-60,MC.y-60,120,120);
      g.globalCompositeOperation='source-over';

      for(const q of crowd)drawPerson(q,t,el,stageCol,flash);

      // the machine, in screen space from the pre-rendered bitmap; 1:1 device pixels on landing
      g.setTransform(1,0,0,1,0,0);
      if(!landed&&off.width){
        let x=((P.x-cam.cx)*cam.k+vw/2)*dpr,y=((P.y-cam.cy)*cam.k+vh/2)*dpr,w=P.w*cam.k*dpr,h=P.h*cam.k*dpr;
        if(p>=1){x=Math.round(x);y=Math.round(y);w=off.width;h=off.height;}
        g.imageSmoothingEnabled=true;
        g.drawImage(off,x,y,w,h);
      }
    }

    // Pixel confetti from both bottom corners of the machine, flying outward so it never covers its face.
    function confetti(){
      for(let i=0;i<36;i++){
        const side=i%2?1:-1,ox=side>0?R.right-12:R.left+12,oy=R.bottom-6,sz=4+(i%3)*2;
        const d=document.createElement('i');
        d.style.cssText=`left:${ox-sz/2}px;top:${oy-sz/2}px;width:${sz}px;height:${sz}px;background:${PAL[(i>>1)%4]}`;
        confettiBox.append(d);
        const a=-Math.PI/2+side*(.35+((i>>1)/17)*1.05),sp=70+((i*37)%11)*11,dx=Math.round(Math.cos(a)*sp),dy=Math.round(Math.sin(a)*sp);
        animate(d,[
          {transform:'translate(0,0)',opacity:1,easing:OUT},
          {transform:`translate(${dx}px,${dy}px)`,opacity:1,offset:.45,easing:IN},
          {transform:`translate(${Math.round(dx*1.3)}px,${dy+60}px)`,opacity:0},
        ],{dur:800,ease:'linear',fill:'both'});
      }
      setTimeout(()=>confettiBox?.remove(),850);
    }
    const rise=[{opacity:0,translate:'0px 6px'},{opacity:1,translate:'0px 0px'}];
    // One frame: the canvas stops drawing its machine and the real #machine appears in the same place.
    function land(quiet){
      landed=true;
      universe.classList.remove('intro-live','intro-gift');
      animate(machine,[{opacity:1},{opacity:.9}],{dur:300,ease:'ease-out'});
      if(cv)animate(cv,[{opacity:1},{opacity:0}],{dur:300,ease:'ease-out',fill:'both'});
      animate(cosmos,[{opacity:0},{opacity:1}],{dur:300,ease:'ease-out'});
      if(!quiet)confetti();
      animate(title,rise,{at:40,dur:220});
      animate(power,rise,{at:100,dur:220});
      animate(utility,[{opacity:0},{opacity:1}],{at:160,dur:220});
      later(380,done);
    }
    function frame(t){
      raf=0;
      if(status.state!=='run')return;
      const el=t-T0;
      if(el>=PUSH&&!landed){draw(t,PUSH);land(false);}
      else if(el>=0&&!landed)draw(t,el);
      raf=requestAnimationFrame(frame);
    }
    const onResize=()=>{if(status.state==='run'&&cv)size();};

    function done(){
      if(status.state==='done')return;
      status.state='done';status.endedAt=performance.now();
      cancelAnimationFrame(raf);raf=0;
      timers.forEach(clearTimeout);timers.length=0;
      universe.classList.remove('intro-live','intro-gift');
      removeEventListener('resize',onResize);
      const hadFocus=layer.contains?.(document.activeElement);
      layer.remove();
      if(off)off.width=off.height=0;
      if(cv)cv.width=cv.height=0;
      introHandedOff=true;
      if(hadFocus)power.focus?.({preventScroll:true});
      setTimeout(()=>{document.removeEventListener('keydown',onKey,true);removeEventListener('pointerdown',onPointer,true);removeEventListener('click',onSwallow,true);removeEventListener('keyup',onSwallow,true);},700);
    }
    function wake(){try{synth.wake().catch(()=>{})}catch{}}
    // The light comes out of the top of the box, where the lid was.
    function burstAt(){
      const U=localRect(universe),B=localRect(gift);
      return {x:B.left-U.left+B.width/2,y:B.top-U.top+B.height*.42};
    }
    function open(){
      if(status.state!=='gift')return;
      wake();
      status.state='run';status.tappedAt=performance.now();
      gift.classList.add('open');
      const t=now();
      if(calm){
        // A single soft ding and a cross-fade straight to the opening screen.
        fm({f:1318.51,t,ratio:3.5,index:.6,dur:1.1,gain:.07,attack:.006});
        universe.classList.remove('intro-gift');
        animate(layer,[{opacity:1},{opacity:0}],{dur:300,ease:'ease-out',fill:'both'});
        const fade=(el,to=1)=>animate(el,[{opacity:0},{opacity:to}],{dur:300,ease:'ease-out'});
        fade(machine,.9);fade(title);fade(power);fade(utility);
        later(320,done);
        return;
      }
      // The club: built now, drawn from the first kick, shown once the light has filled the screen.
      cv=document.createElement('canvas');cv.setAttribute('aria-hidden','true');
      g=cv.getContext('2d');off=document.createElement('canvas');og=off.getContext('2d');crowd=makeCrowd();
      confettiBox=document.createElement('div');confettiBox.className='intro-confetti';confettiBox.setAttribute('aria-hidden','true');
      const burst=document.createElement('div');burst.className='intro-burst';burst.setAttribute('aria-hidden','true');
      const at=burstAt(),reach=2*Math.hypot(Math.max(at.x,universe.clientWidth-at.x),Math.max(at.y,universe.clientHeight-at.y));
      burst.style.cssText=`left:${Math.round(at.x)}px;top:${Math.round(at.y)}px;width:${Math.ceil(reach)}px;height:${Math.ceil(reach)}px`;
      layer.append(cv,burst);universe.append(confettiBox);
      size();
      addEventListener('resize',onResize);

      animate(gift.querySelector('.gift-lid'),[{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-6%,-70%) rotate(-16deg)'}],{dur:180,ease:OUT,fill:'forwards'});
      animate(gift,[{opacity:1},{opacity:0}],{at:LEAD+110,dur:90,ease:'linear',fill:'forwards'});
      animate(burst,[
        {transform:'translate(-50%,-50%) scale(.03)',opacity:0,easing:OUT},
        {opacity:1,offset:.12},
        {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.45,easing:'ease-out'},
        {transform:'translate(-50%,-50%) scale(1.05)',opacity:0},
      ],{at:LEAD,dur:660,ease:'linear',fill:'both'});
      animate(cv,[{opacity:0},{opacity:1}],{at:LEAD+180,dur:100,ease:'linear'});
      universe.classList.add('intro-live');
      T0=performance.now()+LEAD;
      raf=requestAnimationFrame(frame);
      // The landing is on the clock, not on the next frame, so a slow frame cannot stretch the run.
      later(LEAD+PUSH,()=>{if(!landed){draw(performance.now(),PUSH);land(false);}});

      const k=t+LEAD/1000;
      SFX.cheer(k,2.6);
      const beat=BEAT/1000,bass=[55,55,65.41,73.42,55,82.41];
      for(let i=0;i<BEATS;i++){SFX.kick(k+i*beat);SFX.hat(k+(i+.5)*beat);SFX.bass(k+(i+.5)*beat,bass[i]*2);}
      SFX.kick(k+BEATS*beat);
      SFX.pad(k+BEATS*beat,CHORD,.05,2);
      SFX.sparkle(k+BEATS*beat+.03);
    }
    // Straight to the end state: confetti cleared, the run's sounds cut, a soft chord to resolve.
    function skip(){
      if(status.state==='done')return;
      const ran=status.state==='run';
      if(!ran){wake();status.state='run';}
      if(!landed)land(true);
      finishAll();
      confettiBox?.remove();
      if(ran&&bus){cutSound();SFX.pad(now(),CHORD,.04,1.4);}
      done();
    }
    // The click or keyup that follows a skipping press must not reach the power button underneath.
    function onSwallow(e){if(performance.now()<swallowUntil){e.preventDefault();e.stopPropagation();}}
    const swallow=()=>{swallowUntil=performance.now()+600;};
    function onPointer(e){
      if(status.state!=='run'||e.button>0)return;
      e.preventDefault();e.stopPropagation();swallow();skip();
    }
    function onKey(e){
      if(status.state==='done'||e.metaKey||e.ctrlKey||e.altKey||e.key==='Tab')return;
      if(status.state==='gift'){
        if(e.key==='Escape'){e.preventDefault();skip();}
        else if((e.key==='Enter'||e.key===' ')&&e.target!==gift){e.preventDefault();swallow();open();}
        return;
      }
      if(e.repeat)return;
      e.preventDefault();e.stopPropagation();swallow();skip();
    }
    layer.addEventListener('click',e=>{if(status.state==='gift'){e.preventDefault();open();}});
    addEventListener('pointerdown',onPointer,true);
    addEventListener('click',onSwallow,true);
    addEventListener('keyup',onSwallow,true);
    document.addEventListener('keydown',onKey,true);

    status.state='gift';
  }

  if(scene==='intro'&&!asked())mount();
  else universe.classList.remove('intro-pending');
  return {status};
})();

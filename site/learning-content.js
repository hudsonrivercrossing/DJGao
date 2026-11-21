const birthdayPhrases=[
  [[67,.75],[67,.25],[69,1],[67,1],[72,1],[71,2]],
  [[67,.75],[67,.25],[69,1],[67,1],[74,1],[72,2]],
  [[67,.75],[67,.25],[79,1],[76,1],[72,1],[71,1],[69,1]],
  [[77,.75],[77,.25],[76,1],[72,1],[74,1],[72,2]]
];
const birthdayMelody=birthdayPhrases.flat();

const panelGuide={
  MASTER:['Volume','音量','Start here. Turn it up a little, then play a key. The same note gets louder without changing pitch.','先把它转到舒服的音量，再弹一个键。音量像说话的轻重，声音更响了，音高还是原来那个。'],
  PRESETS:['Pick a sound','换个声音','Play C4. Turn PRESETS one click and play C4 again. A preset stores a way to make a sound. The pitch stays put while the timbre changes.','先弹 C4，把 PRESETS 转一格，再弹一次 C4。预设是一份现成的音色配方。音高没动，这回可能更像钟、电子琴或拨弦。'],
  SELECT:['Find a page','翻页或选一行','Open ARP, then turn SELECT. Page 1 has the order and speed. Page 2 has Gate and Swing. In the 8-bit pattern view, SELECT moves between tracks.','点 ARP，再转 SELECT。第一页有顺序和速度，第二页有长短和摇摆。8‑Bit 音序里，用它在鼓、贝斯和旋律之间选轨。'],
  ALGORITHM:['Change the FM routing','改变声音怎么接线','On HOME in the FM lesson, turn it and play the same note. The diagram shows which oscillator shakes another oscillator’s pitch. In the 8-bit sequencer, this knob moves along the steps.','在 FM 主屏转一下，再弹同一个音。图里一条箭头表示一股波在快速推拉另一股波的音高。接法变了，音色也会变。在 8‑Bit 音序里，它用来左右移步。'],
  FX:['Effects','给声音加效果','Press FX and turn SELECT to choose Filter, Delay or Distortion in this web instrument. Read the four current knob assignments on the LCD. Cutoff trims brightness; Delay repeats a sound; Distortion adds roughness.','按 FX，再用 SELECT 选滤波、延迟或失真。四个旋钮现在管什么，看屏幕。滤波像把亮度收暗，延迟像在墙间拍手，失真让声音带点毛边。'],
  SEL:['Select or confirm','进入或确认','In the 8-bit pattern, use SELECT to highlight a lane and press SEL to open it. HOME takes you back. On a clear confirmation, SEL acts on the highlighted choice.','在 8‑Bit 音序里，转 SELECT 选一条轨，按 SEL 进去，按 HOME 返回。清除音序时，它会执行你高亮的选项，先读一眼屏幕。'],
  ENV:['Envelope','一个音的起落','Hold a note. Attack is how fast it arrives; Decay is how it settles; Sustain is the level while held; Release is how long it takes to fade after you let go. Try a longer Release.','按住一个音。Attack 决定它冒出来多快，Decay 决定冲到最响后多久落下，Sustain 是按住时停留的音量，Release 是松手后多久消失。先试着把 Release 调长。'],
  LFO:['Slow modulation','让声音慢慢晃','LFO is a slow repeating motion. Speed sets how often it repeats. Pitch Depth bends pitch like vibrato; Amp Depth makes loudness rise and fall. Try a little pitch depth first.','LFO 像一只自动来回转的小手。Speed 管转得多快，Pitch Depth 让音高轻轻抖，Amp Depth 让音量起伏。先把音高幅度调一点，按住一个音听。'],
  EDIT:['Edit the sound','拆开一个音色','FM Ratio changes the relative speed of the oscillators. FM Index changes how much they bend one another, often changing brightness. In this 8-bit practice, EDIT balances Drums, Bass and Lead.','FM Ratio 是两股波转得多快的比值，FM Index 是一股波推拉另一股波的力度。先只改一点，再弹同一个音听差别。8‑Bit 练习的 EDIT 则用来平衡鼓、贝斯和主旋律。'],
  GLO:['Global settings','整台机器的设置','The web panel puts Tempo, Transpose, Latch and Volume here. Transpose shifts all keys in semitones. Tempo is measured in beats per minute, so 120 BPM is two beats per second.','网页在这里放了速度、移调、锁音和音量。移调是让所有键一起挪几个半音。120 BPM 意思是一分钟 120 拍，也就是每秒两拍。'],
  HOME:['Back home','回主屏','Press HOME to leave a page. Inside an 8-bit lane it returns to the pattern. Going home keeps the sound and notes you already made.','迷路就按 HOME。在 8‑Bit 的某条轨里，按它回到整段音序。回去之后，调过的声音和录过的音还在。'],
  SAVE:['Save a pattern','把音序留下','In free play the browser stores recorded patterns locally. Hold SAVE in stock practice or tap it in 8-bit free play to confirm a save.','自由演奏的音序保存在这个浏览器里。原厂练习长按 SAVE，8‑Bit 自由演奏点一下 SAVE。'],
  ARP:['Arpeggiator','和弦拆开弹','Play C, E and G together and you have a C major chord. ARP plays the notes one at a time. In this web lesson you can tap to latch a note and tap again to remove it.','C、E、G 一起响，是 C 大三和弦。按 ARP，机器把三个音拆开轮流弹。网页练习可以点一下把音留下，再点同一个键把它拿掉。'],
  SEQ:['Sequencer','用格子排声音','Think of sixteen boxes going round and round. Each box is a step. Put notes in some boxes and leave the others empty. At 1/16, four steps make one beat.','想象一排会绕回来的 16 格。每格是一步，有的放音，有的留空。速度设为十六分音符时，四步合成一拍。格子不是琴键，琴键负责告诉格子放哪个音。'],
  PLAY:['Play / stop','播放或停下','After recording, press PLAY to hear the pattern. Press again to stop. Watching the cursor travel makes it easy to hear which step holds each sound.','录完按 PLAY 听这段音序，再按一下就停。看游标经过哪一格时响了，你就知道那个声音放在哪里。'],
  REC:['Record notes','把声音放进格子','Press REC, tap a key, then release it. In step recording the note goes into a box without you needing to play in time. Press REC again to end the take.','按 REC，弹一个键再松手。逐步录音可以慢慢点，机器把音放进格子。录完再按 REC。真机上的录音与播放步骤可以在下方按固件查看。'],
  'OCT−':['An octave down','低一个八度','Press once, then play the same key. A note one octave lower vibrates half as fast and sounds like a lower version of the same note. Both OCT buttons together reset the pitch controls in this web panel.','按一次，再弹同一颗键。低一个八度，振动速度变成一半，听起来像同名音搬到了楼下。网页里同时按两个 OCT 键可以复位。'],
  'OCT+':['An octave up','高一个八度','Press once and play the same key. A note one octave higher vibrates twice as fast. In 8-bit practice, octave +2 puts C4’s key in the lead range.','按一次再弹同一颗键。高一个八度，振动速度变成两倍。8‑Bit 练习调到 +2 时，原来 C4 那颗键变成 C6，可以弹主旋律。'],
  'KNOB 1':['Parameter 1','第一个参数','Look at K1 on the LCD. On the FM home screen it changes Cutoff. On ARP page 1 it changes the order notes are played. Read the label before turning.','先看屏幕里的 K1。FM 主屏是滤波截止频率，ARP 第一页是音符出场顺序。切页之后先看名字，再转。'],
  'KNOB 2':['Parameter 2','第二个参数','Look at K2. On the FM home screen it changes Resonance, the emphasis around Cutoff. On ARP page 1 it changes how many octaves the arpeggio climbs.','看屏幕里的 K2。FM 主屏的 Resonance 会把截止频率附近突出一点。ARP 第一页则用它设置琶音爬几个八度。'],
  'KNOB 3':['Parameter 3','第三个参数','Look at K3. On the FM home screen it changes FM Index. On ARP page 1 it changes Rate, the length of each step relative to the beat.','看屏幕里的 K3。FM 主屏是调频力度。ARP 第一页是 Rate，决定一拍被切成多长的小格。比如 1/16 比 1/8 一步短一半。'],
  'KNOB 4':['Parameter 4','第四个参数','Look at K4. On the web FM home screen it sets Echo Mix. On ARP page 1 it sets BPM. On the Filter page it switches the effect on or off.','看屏幕里的 K4。网页 FM 主屏调回声比例，ARP 第一页调 BPM。滤波那页用它开关整个滤波效果。']
};

const musicGlossary=[
  ['Pitch & semitones','音高、半音与升号','Higher pitch sounds higher. Adjacent piano pitches are a semitone apart. C♯ is one semitone above C. Twelve semitones make an octave.','音高就是听起来高还是低。钢琴上相邻的两个音差半音。C♯ 比 C 高半音，12 个半音走完一个八度。'],
  ['Scale & chord','音阶与和弦','A scale is a set of notes you can use. C major uses C D E F G A B. A chord is a few notes sounding together, like C E G. A melody puts notes in an order you can hum.','音阶像一组可选的音。C 大调可以先用 C D E F G A B。几个音同时响叫和弦，比如 C E G。把音一个个排起来，就有了能哼出来的旋律。'],
  ['Beat, step & BPM','拍、步、速度','Tap a steady pulse. Each tap is a beat. A four-beat bar at 1/16 is sixteen steps. At 120 BPM a beat lasts half a second.','均匀拍手，每下是一拍。一个四拍小节用十六分音符来切，就是 16 步。120 BPM 时，每拍半秒。'],
  ['Gate & rests','音长与留白','Gate is how much of a step a note sounds for. At 50%, it sounds for half the step. An empty step is a rest. Both give the music room to breathe.','Gate 是一个音占这一步的多少。50% 就是响半步。空一格叫休止。缩短音和留空格，听起来都能给旋律一点空间。'],
  ['Swing & offbeats','摇摆与反拍','Say “one and two and.” The “and” is between beats. Accenting it gives an offbeat feel. Swing delays every other division, making the small steps feel uneven in a deliberate way.','数「一、和、二、和」。两拍中间的「和」上来一下短音，就有反拍感。Swing 是让交替出现的小格稍晚一点，听起来会摇。'],
  ['Timbre, FM & envelope','音色、调频、包络','Pitch is which note. Timbre is what it sounds like. FM makes one wave change another wave’s pitch very fast. An envelope shapes the loudness from the instant you press to after you release.','音高决定唱的是哪个音，音色决定它像钟、像琴还是像游戏机。FM 让一股波很快地推拉另一股波的音高。包络把这个音从按下到松手后的音量曲线画出来。'],
  ['Drums, bass & lead','鼓、贝斯和主旋律','Drums give the rhythm landmarks. Bass is the low part you feel under the song. Lead is the tune you would hum. Listen to each alone, then hear how they fit.','鼓给节奏落脚点，贝斯像旋律下面的一层低音地板，主旋律是你会哼的那条线。单独听一层，再一起听，比较容易认出来。']
];

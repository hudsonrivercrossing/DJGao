const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const site = name => fs.readFileSync(path.join(__dirname, '../site', name), 'utf8');

// A fake audio graph: nodes remember what they connect to and the last value each param was sent to.
function fakeContext() {
  const ctx = {currentTime: 0, sampleRate: 48000, state: 'running', nodes: []};
  const param = value => ({value, setTargetAtTime(v) { this.value = v; }, setValueAtTime(v) { this.value = v; }});
  const node = (kind, extra = {}) => {
    const n = {kind, connections: [], connect(target) { n.connections.push(target); return target; }, disconnect() {}, ...extra};
    ctx.nodes.push(n);
    return n;
  };
  ctx.destination = node('destination');
  ctx.createGain = () => node('gain', {gain: param(1)});
  ctx.createDynamicsCompressor = () => node('compressor', {threshold: param(-24), knee: param(30), ratio: param(12), attack: param(.003), release: param(.25)});
  ctx.createMediaStreamDestination = () => node('stream', {stream: {}});
  ctx.createWaveShaper = () => node('waveshaper', {curve: null});
  return ctx;
}

function element(id) {
  const classes = new Set(), attributes = new Map(), listeners = {};
  return {
    id, value: '', textContent: '', dataset: {}, parent: null, style: {props: {}, setProperty(name, value) { this.props[name] = value; }},
    classList: {add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
      toggle: (name, on = !classes.has(name)) => (on ? classes.add(name) : classes.delete(name), on)},
    setAttribute: (name, value) => attributes.set(name, String(value)), getAttribute: name => attributes.get(name) ?? null,
    addEventListener: (type, listener) => (listeners[type] ??= []).push(listener),
    emit(type, event = {}) { const e = {target: this, preventDefault() { e.prevented = true; }, ...event}; (listeners[type] || []).forEach(l => l(e)); return e; },
    contains(other) { for (let n = other; n; n = n.parent) if (n === this) return true; return false; },
    focus() { page.focused = id; },
    getBoundingClientRect: () => ({left: 100, right: 152, top: 100, bottom: 236, width: 52, height: 136}),
  };
}
let page;

// audio.js, dj-synth.js, fullscreen.js and volume.js with the top bar's volume markup from index.html.
function makePage({stored = {}} = {}) {
  const html = site('index.html');
  const ids = ['volume', 'sound', 'volume-pop', 'volume-value', 'volume-range', 'volume-pad', 'universe'];
  for (const id of ids.slice(0, 6)) assert.match(html, new RegExp(`id="${id}"`));
  const nodes = new Map(ids.map(id => ['#' + id, element(id)]));
  for (const id of ['sound', 'volume-pop']) nodes.get('#' + id).parent = nodes.get('#volume');
  for (const id of ['volume-value', 'volume-range', 'volume-pad']) nodes.get('#' + id).parent = nodes.get('#volume-pop');
  const local = new Map(Object.entries(stored)), timers = new Map(), docListeners = {};
  let sequence = 0;
  const context = vm.createContext({
    document: {querySelector: s => nodes.get(s) || null, documentElement: element('html'),
      addEventListener: (type, listener) => (docListeners[type] ??= []).push(listener)},
    window: {}, Event: class { constructor(type) { this.type = type; } },
    matchMedia: query => ({matches: query.includes('portrait'), addEventListener() {}}),
    sessionStorage: {getItem: () => null, setItem() {}, removeItem() {}},
    localStorage: {getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value)},
    innerWidth: 375, innerHeight: 812,
    setTimeout: (fn, ms) => { timers.set(++sequence, {fn, ms}); return sequence; }, clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(['fullscreen.js', 'audio.js', 'dj-synth.js', 'volume.js'].map(site).join('\n') +
    "\nconst $=s=>document.querySelector(s);const T=(en,zh)=>en;", context);
  const run = code => vm.runInContext(code, context);
  run('initVolume()');
  page = {
    run, nodes, local, timers, focused: null,
    node: id => nodes.get('#' + id),
    // Runs the timers that are due within `ms`.
    wait(ms) { for (const [id, timer] of [...timers]) if (timer.ms <= ms) { timers.delete(id); timer.fn(); } },
    doc(type, event) { (docListeners[type] || []).forEach(listener => listener(event)); },
  };
  return page;
}

test('The site bus is unity at the default 50% and twice that at 100%, through a limiter to the speakers', () => {
  const p = makePage(), ctx = fakeContext();
  const bus = p.run('siteBus')(ctx);
  assert.equal(p.run('siteSound.level'), .5);
  assert.equal(bus.gain.value, 1);
  assert.equal(p.run('siteBus')(ctx), bus, 'one bus per context');
  const limiter = bus.connections[0];
  assert.equal(limiter.kind, 'compressor');
  assert.equal(limiter.threshold.value, -1);
  assert.ok(limiter.ratio.value >= 20);
  const [clipper] = limiter.connections;
  assert.equal(clipper.kind, 'waveshaper');
  assert.deepEqual(clipper.connections, [ctx.destination]);
  const curve = clipper.curve, at = x => curve[Math.round((x + 1) * 4096)];
  assert.ok(Math.max(...curve.map(Math.abs)) <= 10 ** (-1 / 20), 'nothing passes -1 dBFS');
  for (const x of [-.5, -.1, 0, .25, .6, .7]) assert.ok(Math.abs(at(x) - x) < 1e-3, 'a straight line below -3 dBFS');
  p.run('setVolumePercent(100)');
  assert.equal(bus.gain.value, 2);
  p.run('setVolumePercent(0)');
  assert.equal(bus.gain.value, 0);
  assert.equal(p.run('siteSound.muted'), true, '0% is mute');
});

test('A tap on the speaker mutes, the next brings the earlier level back', () => {
  const p = makePage(), ctx = fakeContext(), bus = p.run('siteBus')(ctx), button = p.node('sound');
  p.run('setVolumePercent(70)');
  button.emit('pointerdown', {pointerType: 'touch'});
  button.emit('pointerup');
  button.emit('click');
  assert.equal(bus.gain.value, 0);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.getAttribute('aria-label'), 'Unmute');
  assert.equal(button.dataset.waves, '0');
  assert.equal(p.node('volume-range').value, '0');
  button.emit('click');
  assert.ok(Math.abs(bus.gain.value - 1.4) < 1e-9);
  assert.equal(button.getAttribute('aria-label'), 'Mute');
  assert.equal(button.dataset.waves, '2');
  assert.equal(p.node('volume-value').textContent, '70%');
  p.run('setVolumePercent(0)');
  button.emit('click');
  assert.equal(p.run('volumePercent()'), 70, 'dragged to 0%, a tap brings back the level before');
  p.run('setVolumePercent(5);setVolumePercent(0)');
  button.emit('click');
  assert.equal(p.run('volumePercent()'), 50, 'a level too quiet to hear comes back as 50%');
});

test('Volume and mute persist and are restored on the next load', () => {
  const first = makePage();
  first.run('setVolumePercent(35)');
  first.node('sound').emit('click');
  const saved = first.local.get('djgao-volume-v1');
  assert.deepEqual(JSON.parse(saved), {level: .35, muted: true});
  const next = makePage({stored: {'djgao-volume-v1': saved}});
  assert.equal(next.run('siteSound.muted'), true);
  assert.equal(next.run('siteBus')(fakeContext()).gain.value, 0);
  assert.equal(next.run('new SoundLabSynth().muted'), true, 'the intro and the card read the same switch');
  next.node('sound').emit('click');
  assert.equal(next.run('volumePercent()'), 35);
  assert.equal(makePage({stored: {'djgao-volume-v1': '{oops'}}).run('volumePercent()'), 50);
});

test('Song playback, the intro and the birthday show play into the site bus, never straight to the speakers', () => {
  const p = makePage(), ctx = fakeContext();
  const {input} = p.run('djOutput')(ctx), bus = p.run('siteBus')(ctx);
  const trim = input.connections.find(n => n.kind === 'gain');
  assert.deepEqual(trim.connections, [bus]);
  assert.ok(!input.connections.includes(ctx.destination));
  assert.ok(input.connections.some(n => n.kind === 'stream'), 'the share-video recorder still hears the full mix');
  const sources = name => site(name);
  assert.match(sources('intro.js'), /bus\.connect\(siteBus\(c\)\)/);
  assert.doesNotMatch(sources('intro.js'), /destination/);
  assert.match(sources('premiere.js'), /source\.connect\(siteBus\(context\)\)/);
  assert.match(sources('audio.js'), /this\.compressor\.connect\(this\.keyGain\); this\.keyGain\.connect\(siteBus\(c\)\)/);
  // Only the site bus's limiter reaches a destination.
  for (const name of ['audio.js', 'dj-synth.js', 'intro.js', 'premiere.js', 'finale.js'])
    assert.equal((sources(name).match(/\.destination\b/g) || []).length, name === 'audio.js' ? 1 : 0, name);
});

test('Another audio context gets its own bus that follows the volume', () => {
  const p = makePage(), synthContext = fakeContext(), other = fakeContext();
  const a = p.run('siteBus')(synthContext), b = p.run('siteBus')(other);
  assert.notEqual(a, b);
  p.run('setVolumePercent(80)');
  assert.ok(Math.abs(b.gain.value - 1.6) < 1e-9);
  other.state = 'closed';
  p.run('setVolumePercent(60)');
  assert.equal(p.run('siteSound.buses.size'), 1, 'a closed context is dropped');
});

test('Arrow keys on the slider step 5%, Home and End reach the ends', () => {
  const p = makePage(), range = p.node('volume-range');
  assert.equal(range.emit('keydown', {key: 'ArrowUp'}).prevented, true);
  assert.equal(p.run('volumePercent()'), 55);
  range.emit('keydown', {key: 'ArrowRight'});
  assert.equal(range.value, '60');
  range.emit('keydown', {key: 'ArrowDown'});
  range.emit('keydown', {key: 'ArrowLeft'});
  range.emit('keydown', {key: 'ArrowLeft'});
  assert.equal(p.run('volumePercent()'), 45);
  range.emit('keydown', {key: 'End'});
  assert.equal(p.run('volumePercent()'), 100);
  range.emit('keydown', {key: 'ArrowUp'});
  assert.equal(p.run('volumePercent()'), 100);
  range.emit('keydown', {key: 'Home'});
  assert.equal(p.run('siteSound.muted'), true);
  assert.equal(range.emit('keydown', {key: 'a'}).prevented, undefined);
  range.value = '30';
  range.emit('input');
  assert.equal(p.run('volumePercent()'), 30);
  assert.equal(range.getAttribute('aria-valuetext'), '30%');
});

test('A long press opens the popover without muting; a short tap mutes and opens nothing', () => {
  const p = makePage(), button = p.node('sound'), box = p.node('volume');
  button.emit('pointerdown', {pointerType: 'touch'});
  p.wait(200);
  button.emit('pointerup');
  button.emit('click');
  assert.equal(box.classList.contains('open'), false);
  assert.equal(p.run('siteSound.muted'), true);
  button.emit('click');
  button.emit('pointerdown', {pointerType: 'touch'});
  const [[, hold]] = [...p.timers];
  assert.equal(hold.ms, 400);
  p.wait(400);
  button.emit('pointerup');
  button.emit('click');
  assert.equal(box.classList.contains('open'), true);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(p.run('siteSound.muted'), false, 'the click that ends a long press does not mute');
  p.doc('pointerdown', {target: p.node('volume-pad')});
  assert.equal(box.classList.contains('open'), true, 'a press inside keeps it open');
  p.doc('pointerdown', {target: p.node('universe')});
  assert.equal(box.classList.contains('open'), false, 'a press outside closes it');
  button.emit('pointerdown', {pointerType: 'touch'});
  p.wait(400);
  p.doc('keydown', {key: 'Escape', preventDefault() {}});
  assert.equal(box.classList.contains('open'), false);
  assert.equal(p.focused, 'sound', 'Escape hands focus back to the speaker');
  button.emit('pointerdown', {pointerType: 'mouse'});
  assert.equal(p.timers.size, 0, 'a mouse has the slider beside the speaker, so no long press');
});

test('Dragging in the popover sets the volume along its own axis, upright and sideways', () => {
  const p = makePage(), pad = p.node('volume-pad');
  // The pad spans y 100–236; the thumb's travel is 106–230.
  pad.emit('pointerdown', {pointerId: 1, clientX: 120, clientY: 106});
  assert.equal(p.run('volumePercent()'), 100);
  pad.emit('pointermove', {pointerId: 1, clientX: 120, clientY: 168});
  assert.equal(p.run('volumePercent()'), 50);
  pad.emit('pointermove', {pointerId: 2, clientX: 120, clientY: 230});
  assert.equal(p.run('volumePercent()'), 50, 'another finger is ignored');
  pad.emit('pointerup', {pointerId: 1});
  pad.emit('pointermove', {pointerId: 1, clientX: 120, clientY: 230});
  assert.equal(p.run('volumePercent()'), 50);
  // Sideways the body is turned 90° clockwise: the pad's local top is on the screen's right.
  p.run('sidewaysMode=true');
  const rect = p.run('localRect')(pad);
  pad.emit('pointerdown', {pointerId: 3, clientX: 375 - (rect.bottom - 6), clientY: 120});
  assert.equal(p.run('siteSound.muted'), true, 'the local bottom is 0%');
  pad.emit('pointermove', {pointerId: 3, clientX: 375 - (rect.top + 6), clientY: 120});
  assert.equal(p.run('volumePercent()'), 100);
});

test('index.html, the packager and the page loader list volume.js before app.js', () => {
  const html = [...site('index.html').matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(m => m[1]);
  assert.equal(html.indexOf('volume.js'), html.indexOf('app.js') - 1);
  const packaged = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/package_site.py'), 'utf8').match(/^scripts = (\[.*\])$/m)[1].replace(/'/g, '"'));
  assert.deepEqual(packaged, html);
});

test('The keys sit behind their own trim after the synth compressor; each birthday take sets one', async () => {
  const p = makePage(), ctx = fakeContext();
  const any = kind => ctx.nodes[ctx.nodes.push(new Proxy({kind, connections: [], connect(t) { this.connections.push(t); return t; }}, {
    get: (t, k) => k in t ? t[k] : (t[k] = typeof k === 'string' && /^[A-Za-z]/.test(k) && !['type', 'curve', 'oversample'].includes(k)
      ? {value: 0, setTargetAtTime(v) { this.value = v; }, setValueAtTime(v) { this.value = v; }} : undefined),
  })) - 1];
  for (const name of ['createBiquadFilter', 'createWaveShaper', 'createDelay', 'createAnalyser'])
    ctx[name] = () => { const n = any(name); n.start = () => {}; return n; };
  ctx.createOscillator = () => { const n = any('oscillator'); n.start = () => {}; return n; };
  ctx.resume = () => {};
  p.run('window').AudioContext = function () { return ctx; };
  const synth = p.run('new SoundLabSynth()');
  await synth.wake();
  assert.deepEqual(synth.compressor.connections.filter(n => n.kind === 'gain'), [synth.keyGain]);
  assert.deepEqual(synth.keyGain.connections, [p.run('siteBus')(ctx)]);
  assert.ok(Math.abs(synth.keyGain.gain.value - 10 ** (synth.keyTrim / 20)) < 1e-9);
  const finale = site('finale.js');
  assert.match(finale, /keyTrim:\[[\d.,]+\]\[index\]/, 'birthdaySound gives every take its key trim');
  assert.match(site('app.js'), /if\(!synth\.analyser\|\|synth\.muted\)return;/, 'muted, the LCD scope stays flat');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

// Script order as index.html loads it; the vm page skips dock.js like the other page tests.
const htmlScripts = [...read('site/index.html').matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(m => m[1]);

function makePage({stored = {}, reduced = false, search = ''} = {}) {
  const context2d = new Proxy({}, {get: (target, key) => target[key] ?? (() => ({addColorStop() {}}))});
  const nodes = new Map(), timers = new Map(), windowListeners = {}, documentListeners = {};
  let sequence = 0, now = 0, frames = new Map();
  function element(tag = 'div') {
    const classes = new Set(), sub = new Map(), attributes = new Map();
    return {
      tagName: tag.toUpperCase(), id: '', className: '', style: {setProperty() {}}, children: [], parent: null, dataset: {}, textContent: '',
      open: false, hidden: false, complete: true, naturalWidth: 0, clientWidth: 1280, clientHeight: 800, offsetHeight: 44, width: 0, height: 0,
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        toggle: (name, on) => (on ?? !classes.has(name)) ? classes.add(name) : classes.delete(name),
        contains: name => classes.has(name),
      },
      setAttribute: (name, value) => attributes.set(name, String(value)),
      getAttribute: name => attributes.get(name),
      removeAttribute: name => attributes.delete(name),
      querySelector(selector) { if (!sub.has(selector)) sub.set(selector, element()); return sub.get(selector); },
      append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } },
      replaceChildren(...children) { this.children = children; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; },
      contains(other) { for (let node = other; node; node = node.parent) if (node === this) return true; return false; },
      animate() { const animation = {finish() {}, cancel() {}}; return animation; },
      getAnimations: () => [], focus() { context.document.activeElement = this; },
      addEventListener(type, listener) { ((this.listeners ??= {})[type] ??= []).push(listener); },
      show() { this.open = true; }, showModal() { this.open = true; }, close() { this.open = false; }, click() { this.clicks = (this.clicks || 0) + 1; },
      getContext: () => context2d,
      getBoundingClientRect: () => ({left: 263, right: 1017, top: 143, bottom: 593, width: 754, height: 450}),
    };
  }
  const html = read('site/index.html');
  for (const [tag, id] of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) nodes.set('#' + id, Object.assign(element(), {id, hidden: /\shidden[\s>]/.test(tag)}));
  for (const selector of ['.machine-photo', '.scene-copy', '.birthday-note']) nodes.set(selector, element());
  nodes.get('#universe').classList.add('intro-pending');
  const hardware = nodes.get('#hardware-controls');
  const querySelector = selector => {
    const data = selector.match(/^\[data-(midi|control|knob)="([^"]+)"\]$/);
    if (data) return hardware.children.find(node => String(node.dataset[data[1]]) === data[2]);
    return nodes.get(selector) || null;
  };
  const querySelectorAll = selector => {
    const group = {'.hardware-key': 'midi', '.hardware-button': 'control', '.hardware-knob': 'knob'}[selector];
    return group ? hardware.children.filter(node => group in node.dataset) : [];
  };
  const local = new Map(Object.entries(stored));
  const on = store => (type, listener) => (store[type] ??= []).push(listener);
  const context = vm.createContext({
    document: {querySelector, querySelectorAll, createElement: element, documentElement: {}, activeElement: null, addEventListener: on(documentListeners)},
    window: {addEventListener() {}}, addEventListener: on(windowListeners), removeEventListener() {},
    location: {search},
    matchMedia: query => ({matches: reduced && query.includes('reduced-motion'), addEventListener() {}}),
    localStorage: {getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key)},
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2, performance: {now: () => now},
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout(fn, delay = 0) { timers.set(++sequence, {fn, at: now + delay}); return sequence; }, clearTimeout: id => timers.delete(id),
  });
  const code = htmlScripts.filter(name => name !== 'dock.js').map(name => read('site/' + name)).join('\n');
  vm.runInContext(code, context);
  const run = source => vm.runInContext(source, context);
  // Runs every timer due within the next `ms` milliseconds, in time order.
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = due[1].at; due[1].fn();
    }
    now = end;
  }
  // Paints one animation frame at the current time.
  const paint = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); return pending.length; };
  const universe = nodes.get('#universe');
  const layer = () => universe.children.find(child => child.id === 'intro');
  const event = extra => ({button: 0, key: '', target: {closest: () => null}, preventDefault() {}, stopPropagation() { this.stopped = true; }, ...extra});
  // Capture listeners run first; one that stops propagation keeps the event from the rest.
  const dispatch = (listeners, e) => { for (const listener of listeners) { listener(e); if (e.stopped) break; } };
  const gift = () => layer().children.find(child => child.id === 'intro-gift');
  const tapGift = () => layer().listeners.click.forEach(listener => listener(event({target: gift()})));
  const tapAnywhere = () => dispatch(windowListeners.pointerdown, event());
  const press = key => dispatch(documentListeners.keydown, event({key}));
  return {run, nodes, local, universe, layer, gift, tapGift, tapAnywhere, press, advance, paint};
}
// A stand-in AudioContext: every node method returns another node, so the intro's graph can be built and counted.
const fakeAudio = `(()=>{const node=()=>new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:k==='currentTime'?0:k==='sampleRate'?100:k in t?t[k]:(t[k]=node()),apply:()=>node(),set:(t,k,v)=>{t[k]=v;return true}});
  synth.wake=async()=>{synth.context??=node();synth.compressor??=node();};})()`;

const work = JSON.stringify({version: 1, mode: 'standard', seed: 1, takes: [[], [], [], []], mixes: [{}, {}, {}, {}], pass: 0});

test('Every load opens on the gift alone, even after a visit or with a saved birthday work', () => {
  for (const stored of [{}, {'fm1-intro-seen-v1': '1'}, {'fm1-dj-birthday-v1': work}]) {
    const page = makePage({stored});
    assert.equal(page.run('intro.status.state'), 'gift', JSON.stringify(stored));
    assert.deepEqual(page.layer().children.map(child => child.id), ['intro-gift'], 'the gift is the only thing on the layer');
    assert.equal(page.universe.classList.contains('intro-gift'), true, 'title, machine and top bar wait');
    assert.equal(page.universe.classList.contains('intro-pending'), false);
    assert.equal(page.universe.children.some(child => child.className === 'intro-confetti'), false);
    assert.equal(page.local.size, Object.keys(stored).length, 'nothing is remembered');
  }
});

test('?nointro goes straight to the opening screen', () => {
  const page = makePage({search: '?nointro'});
  assert.equal(page.run('intro.status.state'), 'off');
  assert.equal(page.layer(), undefined);
  for (const name of ['intro-pending', 'intro-gift', 'intro-live']) assert.equal(page.universe.classList.contains(name), false, name);
});

test('The gift is a labelled button; no rAF runs while it waits', () => {
  const page = makePage();
  const gift = page.gift();
  assert.equal(gift.tagName, 'BUTTON');
  assert.equal(gift.type, 'button');
  assert.equal(gift.getAttribute('aria-label'), '打开礼物');
  assert.match(gift.innerHTML, /gift-lid/);
  page.paint();
  const appFrames = page.paint();
  page.advance(5000);
  assert.equal(page.paint(), appFrames, 'only the site\'s own loop is asking for frames');
  page.tapGift();
  assert.equal(page.paint(), appFrames + 1, 'the club starts on the tap');
});

test('The old idle club and its prompt are gone from the site', () => {
  for (const name of ['site/intro.js', 'site/style.css', 'site/index.html', 'site/app.js']) {
    const source = read(name);
    for (const gone of ['点一下进场', 'intro-enter', 'intro-prompt', 'fm1-intro-seen']) assert.equal(source.includes(gone), false, `${gone} in ${name}`);
  }
});

test('A tap opens the gift straight into the run; a second tap skips to the opening screen', () => {
  const page = makePage();
  page.tapGift();
  assert.equal(page.run('intro.status.state'), 'run');
  assert.ok(page.layer().children.some(child => child.tagName === 'CANVAS'), 'the club canvas is built on the tap');
  assert.equal(page.universe.classList.contains('intro-live'), true);
  page.advance(500);
  page.tapAnywhere();
  assert.equal(page.run('intro.status.state'), 'done');
  assert.equal(page.layer(), undefined, 'the layer leaves the DOM');
  assert.equal(page.universe.children.some(child => child.className === 'intro-confetti'), false, 'confetti is cleared');
  for (const name of ['intro-gift', 'intro-live']) assert.equal(page.universe.classList.contains(name), false, name);
  assert.equal(page.nodes.get('#power-on').hidden, false);
  assert.equal(page.run('introHandedOff'), true, 'the opening entrance will not replay');
});

test('An uninterrupted run lands on the sixth beat after the light and hands off within 3.6 s', () => {
  const page = makePage();
  page.paint();
  const appFrames = page.paint(); // the site's own starfield loop
  page.tapGift();
  // first kick 150 ms after the tap, 6 beats at 124 BPM = 2903 ms
  for (let t = 0; t < 3040; t += 160) { page.advance(160); page.paint(); }
  assert.equal(page.run('intro.status.state'), 'run');
  assert.equal(page.universe.classList.contains('intro-live'), true);
  page.advance(20); page.paint();
  assert.equal(page.universe.classList.contains('intro-live'), false, 'the real machine takes over on the landing frame');
  page.advance(400);
  assert.equal(page.run('intro.status.state'), 'done');
  assert.equal(page.paint(), appFrames, 'the intro requests no more animation frames after the hand-off');
  assert.ok(page.run('intro.status.endedAt-intro.status.tappedAt') < 3600);
  assert.equal(page.layer(), undefined);
});

test('Enter opens the gift; Escape before the tap goes straight to the opening screen', () => {
  const page = makePage();
  page.press('Enter');
  assert.equal(page.run('intro.status.state'), 'run');
  const other = makePage();
  other.press('Escape');
  assert.equal(other.run('intro.status.state'), 'done');
  assert.equal(other.layer(), undefined);
});

test('Reduced motion: a still gift, then a 300 ms cross-fade with a single ding', () => {
  const page = makePage({reduced: true});
  page.run(fakeAudio);
  assert.equal(page.run('intro.status.calm'), true);
  page.run('synth.wake()');
  page.tapGift();
  assert.equal(page.run('intro.status.sounds'), 1, 'one ding');
  assert.equal(page.layer().children.some(child => child.tagName === 'CANVAS'), false, 'no club');
  page.advance(310);
  assert.equal(page.run('intro.status.state'), 'run');
  page.advance(20);
  assert.equal(page.run('intro.status.state'), 'done');
  assert.equal(page.layer(), undefined);
});

test('With the sound switched off the intro schedules no sound', () => {
  const on = makePage();
  on.run(fakeAudio + ';synth.wake()');
  on.tapGift();
  assert.ok(on.run('intro.status.sounds') > 10);
  const off = makePage();
  off.run(fakeAudio + ';synth.wake();synth.muted=true');
  off.tapGift();
  assert.equal(off.run('intro.status.state'), 'run', 'the visuals still run');
  assert.equal(off.run('intro.status.sounds'), 0);
  const calm = makePage({reduced: true});
  calm.run(fakeAudio + ';synth.wake();synth.muted=true');
  calm.tapGift();
  assert.equal(calm.run('intro.status.sounds'), 0);
});

test('index.html, the packager and the page loader list intro.js in the same place', () => {
  const packaged = JSON.parse(read('tools/package_site.py').match(/^scripts = (\[.*\])$/m)[1].replace(/'/g, '"'));
  assert.deepEqual(packaged, htmlScripts);
  const loader = JSON.parse(read('tests/learning-flow.test.cjs').match(/const code=(\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(loader, htmlScripts.filter(name => name !== 'dock.js'));
  assert.equal(htmlScripts.indexOf('intro.js'), htmlScripts.indexOf('app.js') + 1);
});

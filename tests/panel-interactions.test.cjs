const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const inspectorSource = fs.readFileSync(path.join(__dirname, '../site/knob-inspector.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8');

function element() {
  const listeners = {}, classes = new Set();
  return {
    style: {}, dataset: {}, scrollTop: 0, open: false, children: [],
    classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) },
    setAttribute() {}, setPointerCapture() {}, querySelector: () => ({}),
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
    emit(type, event = {}) { for (const handler of listeners[type] || []) handler({ preventDefault() {}, pointerId: 1, button: 0, ...event }); }
  };
}

test('Parameter popovers fit the phone workspace and avoid controls whenever space permits', () => {
  const context = vm.createContext({});
  vm.runInContext(inspectorSource.slice(inspectorSource.indexOf('function placeKnobInspector'), inspectorSource.indexOf('function openKnobInspector')), context);
  const bounds = { left: 28, right: 362, top: 72, bottom: 410 };
  for (const knob of [
    { left: 200, top: 260, width: 60, height: 60, bottom: 320 },
    { left: 30, top: 80, width: 60, height: 60, bottom: 140 }
  ]) {
    context.knob = knob; context.bounds = bounds;
    const p = vm.runInContext('placeKnobInspector(knob,264,114,bounds)', context);
    assert.ok(p.left >= bounds.left && p.left + 264 <= bounds.right);
    assert.ok(p.top >= bounds.top && p.top + 114 <= bounds.bottom);
    assert.ok(p.top + 114 <= knob.top || p.top >= knob.bottom);
  }
  context.knob = { left: 20, top: 900, width: 60, height: 60, bottom: 960 };
  const outside = vm.runInContext('placeKnobInspector(knob,264,114,bounds)', context);
  assert.ok(outside.top + 114 <= bounds.bottom, 'Panning the instrument offscreen must not hide the popover');
  context.bounds = { left: 28, right: 800, top: 72, bottom: 250 };
  context.knob = { left: 300, top: 150, width: 60, height: 60, bottom: 210 };
  const landscape = vm.runInContext('placeKnobInspector(knob,264,114,bounds)', context);
  assert.ok(landscape.left >= 372, 'Use side space when there is no vertical clearance');
});

function buttons() {
  const root = element(), window = element(), timers = new Map(), calls = [], heldControls = new Set(), usedModifiers = new Set();
  let timerId = 0;
  const state = { octave: 2, transpose: 3 };
  const context = vm.createContext({
    controls: [['SAVE', 0, 0], ['OCT−', 0, 0], ['OCT+', 0, 0]],
    document: { createElement: () => element() }, window, $: () => root,
    heldControls, usedModifiers, state, level: 0, guided:false, inspectStudyControl:()=>false,
    position() {}, texture() {}, screenMessage() {}, updatePanel() {},
    control: name => calls.push(name), saveDevice: () => calls.push('saved'),
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(appSource.slice(appSource.indexOf('controls.forEach('), appSource.indexOf('knobs.forEach(')), context);
  return { save: root.children[0], down: root.children[1], up: root.children[2], window, timers, calls, heldControls, state };
}

test('SAVE cancels on interrupted touch or window blur and ignores unrelated pointers', () => {
  for (const cancel of ['pointercancel', 'lostpointercapture', 'blur']) {
    const p = buttons(); p.save.emit('pointerdown');
    assert.equal(p.timers.size, 1);
    (cancel === 'blur' ? p.window : p.save).emit(cancel);
    p.save.emit('pointerup');
    assert.equal(p.timers.size, 0);
    assert.equal(p.heldControls.size, 0);
    assert.deepEqual(p.calls, []);
  }
  const p = buttons(); p.save.emit('pointerdown'); p.save.emit('pointerup', { pointerId: 2 });
  assert.equal(p.timers.size, 1);
  p.save.emit('pointerup'); p.save.emit('lostpointercapture');
  assert.deepEqual(p.calls, ['SAVE']);
});

test('The two octave buttons reset together without triggering either individual action', () => {
  const p = buttons();
  p.down.emit('pointerdown', { pointerId: 1 }); p.up.emit('pointerdown', { pointerId: 2 });
  assert.equal(p.state.octave, 0); assert.equal(p.state.transpose, 0);
  p.down.emit('pointerup', { pointerId: 1 }); p.up.emit('pointerup', { pointerId: 2 });
  assert.deepEqual(p.calls, []);
  assert.equal(p.heldControls.size, 0);
});

test('A completed SAVE hold saves once without also triggering the short-press action', () => {
  const p = buttons(); p.save.emit('pointerdown');
  for (const timer of p.timers.values()) timer();
  p.save.emit('pointerup'); p.save.emit('lostpointercapture');
  assert.deepEqual(p.calls, ['saved']);
});

test('A pending key presses without lighting; a held voice stays on its physical key through a pitch change', () => {
  const keys = [60, 72].map(midi => Object.assign(element(), { dataset: { midi } }));
  const note = { baseMidi: 72, midi: 72, pending: true };
  const state = { octave: 0, transpose: 0 }, heldNotes = new Map([['touch', note]]), arpNotes = new Set();
  const context = vm.createContext({ $$: () => keys, state, heldNotes, arpNotes, noteName: String });
  vm.runInContext(appSource.slice(appSource.indexOf('function updateKeyFeedback'), appSource.indexOf('function updatePanel')), context);
  const refresh = () => vm.runInContext('updateKeyFeedback()', context);
  refresh();
  assert.equal(keys[1].classList.contains('held'), true);
  assert.equal(keys[1].classList.contains('down'), false);
  note.pending = false;
  state.octave = 1;
  refresh();
  assert.equal(keys[0].classList.contains('down'), false);
  assert.equal(keys[1].classList.contains('down'), true);
  heldNotes.clear(); arpNotes.add(72);
  refresh();
  assert.equal(keys[0].classList.contains('down'), true);
  assert.equal(keys[0].classList.contains('held'), false);
  assert.equal(keys[1].classList.contains('down'), false);
});

test('Every button in the dock action area takes clicks even though the HUD lets them through',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../site/style.css'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8');
  const action=html.slice(html.indexOf('<div id="cue-action">'),html.indexOf('</div>',html.indexOf('<div id="cue-action">')));
  const ids=[...action.matchAll(/<button id="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids.sort(),['dock-skip','mission-next','mode-hard','mode-standard']);
  assert.match(css,/#device-hud\{[^}]*pointer-events:none/);
  const reenabled=id=>new RegExp('(#'+id+'|#cue-action button)[^{}]*\\{[^}]*pointer-events:auto').test(css);
  for(const id of ids)assert.ok(reenabled(id),id+' must re-enable pointer events');
});

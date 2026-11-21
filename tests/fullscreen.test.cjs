const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function element(id) {
  const classes = new Set(), attributes = new Map(), listeners = {};
  return {
    id, hidden: false, open: false, textContent: '', onclick: null,
    classList: {
      add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
      toggle: (name, on = !classes.has(name)) => { on ? classes.add(name) : classes.delete(name); return on; },
    },
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: name => attributes.get(name) ?? null,
    removeAttribute: name => attributes.delete(name),
    addEventListener: (type, listener) => (listeners[type] ??= []).push(listener),
    emit(type) { (listeners[type] || []).forEach(listener => listener({})); },
    focus() { page.focused = id; },
    showModal() { this.open = true; },
    close() { this.open = false; this.emit('close'); },
    click() { this.onclick?.({}); },
  };
}
let page;

// A page with only fullscreen.js loaded; the browser's abilities are switches.
function makePage({api = false, standalone = false, portrait = true, coarse = true, stored = null} = {}) {
  const ids = [...read('site/index.html').matchAll(/id="(fullscreen[^"]*)"/g)].map(m => m[1]);
  const nodes = new Map(ids.map(id => ['#' + id, element(id)]));
  const media = new Map(), session = new Map(stored ? [['fm1-sideways-v1', stored]] : []), calls = [], events = [];
  const html = element('html');
  const query = text => {
    if (!media.has(text)) {
      const matches = text.includes('display-mode') ? standalone : text.includes('pointer') ? coarse
        : text.includes('max-height') ? !portrait : text.includes('portrait') ? portrait : false;
      const listeners = [];
      media.set(text, {matches, addEventListener: (type, listener) => listeners.push(listener), fire(value) { this.matches = value; listeners.forEach(listener => listener({matches: value})); }});
    }
    return media.get(text);
  };
  const documentListeners = {};
  const document = {
    fullscreenEnabled: api, fullscreenElement: null, documentElement: html,
    querySelector: selector => nodes.get(selector) || null,
    addEventListener: (type, listener) => (documentListeners[type] ??= []).push(listener),
    exitFullscreen() { calls.push('exit'); return Promise.resolve(); },
  };
  html.requestFullscreen = options => { calls.push(['request', options]); return Promise.resolve(); };
  const context = vm.createContext({
    document, matchMedia: query, innerWidth: 390, innerHeight: 844,
    navigator: {standalone: false},
    screen: {width: 390, height: 844, orientation: {lock: kind => { calls.push(['lock', kind]); return Promise.resolve(); }, unlock: () => calls.push('unlock')}},
    sessionStorage: {getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key)},
    window: {dispatchEvent: event => events.push(event.type)}, Event: class { constructor(type) { this.type = type; } },
    Promise,
  });
  vm.runInContext(read('site/fullscreen.js'), context);
  page = {nodes, html, document, calls, events, session, media, query, documentListeners,
    run: code => vm.runInContext(code, context), node: id => nodes.get('#' + id), focused: null};
  return page;
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('With the Fullscreen API the button requests full screen, then locks a phone to landscape', async () => {
  const p = makePage({api: true});
  assert.equal(p.node('fullscreen').hidden, false);
  assert.equal(p.node('fullscreen').getAttribute('aria-label'), '全屏');
  p.node('fullscreen').click();
  await settle();
  assert.equal(p.calls[0][0], 'request');
  assert.deepEqual(p.calls[1], ['lock', 'landscape']);
  assert.equal(p.node('fullscreen-sheet').open, false, 'no sheet where the API works');
  p.document.fullscreenElement = p.html;
  p.documentListeners.fullscreenchange.forEach(listener => listener());
  assert.equal(p.node('fullscreen').getAttribute('aria-label'), '退出全屏');
  assert.equal(p.node('fullscreen').classList.contains('exit'), true);
  p.node('fullscreen').click();
  assert.ok(p.calls.includes('exit'));
  p.document.fullscreenElement = null;
  p.documentListeners.fullscreenchange.forEach(listener => listener());
  assert.ok(p.calls.includes('unlock'), 'leaving full screen unlocks the orientation');
  assert.equal(p.node('fullscreen').getAttribute('aria-label'), '全屏');
});

test('A desktop pointer gets plain full screen with no orientation lock', async () => {
  const p = makePage({api: true, coarse: false});
  p.node('fullscreen').click();
  await settle();
  assert.equal(p.calls.length, 1);
});

test('iPhone Safari: the button opens a sheet with Add to Home Screen and Use sideways now', () => {
  const p = makePage();
  assert.equal(p.node('fullscreen').getAttribute('aria-haspopup'), 'dialog');
  p.node('fullscreen').click();
  assert.equal(p.node('fullscreen-sheet').open, true);
  assert.equal(p.node('fullscreen-choices').hidden, false);
  assert.equal(p.node('fullscreen-home').hidden, false);
  assert.equal(p.node('fullscreen-sideways').hidden, false);
  assert.equal(p.node('fullscreen-home-label').textContent, '加到主屏幕');
  assert.equal(p.node('fullscreen-sideways-label').textContent, '现在横着用');
  assert.equal(p.focused, 'fullscreen-home');
  p.node('fullscreen-home').click();
  assert.equal(p.node('fullscreen-howto').hidden, false);
  assert.equal(p.node('fullscreen-choices').hidden, true);
  assert.equal(p.node('fullscreen-step-share').textContent, '点 Safari 底部的分享');
  assert.equal(p.node('fullscreen-step-add').textContent, '选『添加到主屏幕』');
  p.node('fullscreen-back').click();
  assert.equal(p.node('fullscreen-choices').hidden, false);
  assert.equal(p.calls.length, 0, 'nothing asks for the API on iPhone');
});

test('Use sideways now turns the page, remembers it for the session, and the same button leaves it', () => {
  const p = makePage();
  p.node('fullscreen').click();
  p.node('fullscreen-sideways').click();
  assert.equal(p.node('fullscreen-sheet').open, false);
  assert.equal(p.html.classList.contains('rotated'), true);
  assert.equal(p.run('rotatedMode()'), true);
  assert.equal(p.session.get('fm1-sideways-v1'), '1');
  assert.deepEqual(p.events, ['resize'], 'everything that measures the page relays out');
  assert.equal(p.node('fullscreen').getAttribute('aria-label'), '退出横屏');
  assert.equal(p.node('fullscreen').getAttribute('aria-haspopup'), null);
  assert.equal(p.run('sidewaysLayout()'), true);
  assert.equal(p.run('phoneLayout()'), false);
  assert.equal(p.run('viewWidth()+"x"+viewHeight()'), '844x390');
  p.node('fullscreen').click();
  assert.equal(p.html.classList.contains('rotated'), false);
  assert.equal(p.session.has('fm1-sideways-v1'), false);
  assert.equal(p.node('fullscreen').getAttribute('aria-label'), '全屏');
});

test('Sideways mode comes back after a reload and ends by itself when the phone really turns', () => {
  const p = makePage({stored: '1'});
  assert.equal(p.html.classList.contains('rotated'), true);
  p.query('(orientation: portrait)').fire(false);
  assert.equal(p.html.classList.contains('rotated'), false);
  assert.equal(p.session.has('fm1-sideways-v1'), false);
  const landscape = makePage({stored: '1', portrait: false});
  assert.equal(landscape.html.classList.contains('rotated'), false, 'a landscape page never turns');
  landscape.node('fullscreen').click();
  assert.equal(landscape.node('fullscreen-sideways').hidden, true, 'and does not offer it');
});

test('The home-screen app is already full screen: no button, and the rotate hint may show', () => {
  const p = makePage({standalone: true, stored: '1'});
  assert.equal(p.node('fullscreen').hidden, true);
  assert.equal(p.html.classList.contains('standalone'), true);
  assert.equal(p.html.classList.contains('rotated'), false);
  const css = read('site/style.css');
  assert.match(css, /:root\.standalone #utility-controls #zoom:not\(\[hidden\]\)\+\.rotate-hint\{display:flex\}/);
});

test('Pointer movement and rects map into the turned layout', () => {
  const p = makePage();
  assert.deepEqual(JSON.parse(p.run('JSON.stringify([toLocalDelta(10,-4),toLocalPoint(100,200)])')), [{x: 10, y: -4}, {x: 100, y: 200}]);
  p.run('setSidewaysMode(true)');
  // A drag towards the screen's right edge is "up" for a phone turned to the left.
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(toLocalDelta(30,0))')), {x: 0, y: -30});
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(toLocalDelta(0,30))')), {x: 30, y: 0});
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(toLocalDelta(12,-5))')), {x: -5, y: -12});
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(toLocalPoint(390,0))')), {x: 0, y: 0}, 'the layout origin is the screen’s top-right corner');
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(toLocalPoint(290,500))')), {x: 500, y: 100});
  const rect = JSON.parse(p.run('JSON.stringify(localRect({getBoundingClientRect:()=>({left:300,top:40,right:340,bottom:140,width:40,height:100})}))'));
  assert.deepEqual(rect, {left: 40, top: 50, right: 140, bottom: 90, x: 40, y: 50, width: 100, height: 40});
});

test('Every pointer handler and rect placement goes through the layout helpers', () => {
  const app = read('site/app.js'), dock = read('site/dock.js'), inspector = read('site/knob-inspector.js'), finale = read('site/finale.js'), intro = read('site/intro.js');
  for (const [name, source] of Object.entries({app, dock, inspector, finale, intro})) {
    assert.ok(!/getBoundingClientRect\(\)/.test(source), name + ' reads rects through localRect');
    assert.ok(!/\binner(Width|Height)\b/.test(source), name + ' sizes through viewWidth/viewHeight');
  }
  assert.equal((app.match(/e\.clientX/g) || []).length, (app.match(/toLocalPoint\(e\.clientX,e\.clientY\)/g) || []).length, 'every clientX is mapped');
  assert.ok(!/matchMedia\('\(max-width/.test(app + dock), 'phone layout checks use phoneLayout/sidewaysLayout');
});

test('The stylesheet sizes against the body frame, and sideways mode turns it and the modal dialogs', () => {
  const css = read('site/style.css');
  const sizeMedia = [...css.matchAll(/@media\s*\(([^)]*)\)/g)].map(m => m[1]).filter(cond => /width|height|orientation/.test(cond));
  assert.deepEqual(sizeMedia, [], 'size rules are container queries');
  assert.ok(!/\d(vw|dvh|vh)\b/.test(css.slice(0, css.indexOf('body{height:100dvh;container-type:size}'))), 'layout units are container units');
  assert.match(css, /body\{height:100dvh;container-type:size\}/);
  assert.match(css, /:root\.rotated body\{[^}]*width:100dvh;height:100vw;transform-origin:0 0;transform:translateX\(100vw\) rotate\(90deg\)\}/);
  assert.match(css, /:root\.rotated :is\(#info,#lcd-dialog,#firmware-dialog,#fullscreen-sheet\)\[open\]\{[^}]*rotate\(90deg\)/);
  assert.ok(!/transition:all/.test(css));
});

test('The page installs as a home-screen app with its own icons', () => {
  const html = read('site/index.html');
  for (const tag of ['<link rel="manifest" href="manifest.webmanifest">', '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">', '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title"', '<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">', 'viewport-fit=cover'])
    assert.ok(html.includes(tag), tag);
  assert.match(html, /<button id="fullscreen" class="corner fullscreen" type="button" aria-label="全屏"/);
  const manifest = JSON.parse(read('site/manifest.webmanifest'));
  assert.equal(manifest.name, 'A Little Sound Adventure');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.background_color, '#100c18');
  assert.equal(manifest.theme_color, '#100c18');
  const icons = [['assets/icons/apple-touch-icon.png', 180], ...manifest.icons.map(icon => [icon.src, Number(icon.sizes.split('x')[0])])];
  assert.deepEqual(icons.map(([, size]) => size), [180, 192, 512]);
  for (const [src, size] of icons) {
    const file = fs.readFileSync(path.join(root, 'site', src));
    assert.ok(file.length < 150 * 1024, src + ' is under 150 KB');
    assert.equal(file.toString('ascii', 12, 16), 'IHDR');
    assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20)], [size, size], src);
    assert.equal(file[25], 2, src + ' is RGB without alpha');
  }
});

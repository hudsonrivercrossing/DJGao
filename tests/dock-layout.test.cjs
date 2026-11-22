const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// phoneStackPlacement is declared before dock.js's DOM wiring, so it runs without a page.
const source = fs.readFileSync(path.join(__dirname, '..', 'site', 'dock.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('(()=>{')), context);
const place = options => context.phoneStackPlacement(options);
const MACHINE = 370 / (1324 / 792);

test('A tall phone sets the title and the instrument a little above the middle of the space over the dock', () => {
  const spot = place({freeTop: 56, freeBottom: 768, title: 22, titleGap: 20, machine: MACHINE});
  const group = 22 + 20 + MACHINE, above = spot.titleTop - 56, below = 768 - (spot.machineTop + spot.machineHeight);
  assert.ok(Math.abs(spot.titleTop - (56 + (712 - group) * 0.42)) < 1e-9);
  assert.equal(spot.machineTop, spot.titleTop + 42);
  assert.equal(spot.machineHeight, MACHINE);
  assert.ok(above < below, 'optical centre: less room above than below');
  assert.ok(Math.abs(above / (above + below) - 0.42) < 1e-9);
  assert.equal(spot.bottomGap, below);
});

test('Things hanging under the instrument (the power button) count as part of the group', () => {
  const spot = place({freeTop: 56, freeBottom: 820, title: 51, titleGap: 28, machine: MACHINE, below: 90});
  const group = 51 + 28 + MACHINE + 90;
  assert.ok(Math.abs(spot.titleTop - (56 + (764 - group) * 0.42)) < 1e-9);
  assert.ok(Math.abs(spot.bottomGap - (820 - spot.titleTop - group)) < 1e-9);
});

test('When the space is tight the group rises toward the top bar and keeps a 24 px gap over the dock', () => {
  // Free band 303, group 263: centring would leave 23.2 below; the 24 px gap moves it up instead.
  const spot = place({freeTop: 56, freeBottom: 359, title: 22, titleGap: 20, machine: 221});
  assert.equal(spot.bottomGap, 24);
  assert.equal(spot.titleTop, 359 - 24 - 263);
  assert.equal(spot.machineHeight, 221);
});

test('Past the top bar + 12 px the gap closes to 16 px, and only then does the instrument shrink', () => {
  // Group 263 + 12 inset leaves 20 px for the gap: it closes from 24 to 20.
  let spot = place({freeTop: 56, freeBottom: 56 + 12 + 263 + 20, title: 22, titleGap: 20, machine: 221});
  assert.equal(spot.titleTop, 68);
  assert.equal(spot.bottomGap, 20);
  assert.equal(spot.machineHeight, 221);
  // Only 10 px left: the gap holds at 16 and the instrument gives up the other 6.
  spot = place({freeTop: 56, freeBottom: 56 + 12 + 263 + 10, title: 22, titleGap: 20, machine: 221});
  assert.equal(spot.titleTop, 68);
  assert.equal(spot.bottomGap, 16);
  assert.equal(spot.machineHeight, 215);
});

test('The instrument never overlaps the dock and never climbs into the top bar', () => {
  for (let freeBottom = 250; freeBottom <= 900; freeBottom += 7) {
    for (const title of [0, 22, 51]) {
      const spot = place({freeTop: 56, freeBottom, title, titleGap: 20, machine: MACHINE});
      assert.ok(spot.titleTop >= 68 - 1e-9, `top ${spot.titleTop} at ${freeBottom}`);
      assert.ok(spot.bottomGap >= 16 - 1e-9, `gap ${spot.bottomGap} at ${freeBottom}`);
      assert.ok(spot.machineHeight <= MACHINE && spot.machineHeight >= 0);
      if (spot.machineHeight === MACHINE && spot.titleTop > 68 + 1e-9) assert.ok(spot.bottomGap >= 24 - 1e-9);
    }
  }
});

test('dock.js places the portrait phone stack (play and opening screen) through phoneStackPlacement', () => {
  assert.match(source, /placePhoneStack\(localRect\(dock\)\.top,TITLE_GAP,0\)/);
  assert.match(source, /universe\.dataset\.scene==='intro'&&phoneLayout\(\)\)\{layoutOpening\(\)/);
  // The follow camera still freezes the instrument mid-shot.
  assert.match(source, /\['mission-camera','zoomed'\]\.some\(name=>universe\.classList\.contains\(name\)\)&&machine\.style\.getPropertyValue\('top'\)\)return;/);
});

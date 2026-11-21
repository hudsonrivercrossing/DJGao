const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('Static UI bindings are present and unique after removing the old poster', () => {
  const html = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const file of ['app.js', 'knob-inspector.js', 'learning.js', 'finale.js', 'premiere.js']) {
    const source = fs.readFileSync(path.join(root, 'site', file), 'utf8');
    for (const match of source.matchAll(/\$\('#([\w-]+)'\)/g)) assert.ok(ids.includes(match[1])||match[1]==='study-control-select', file + ': ' + match[1]);
  }
  assert.ok(!ids.includes('win-number'));
  assert.ok(!ids.includes('win-label'));
  for (const gone of ['panel-tour', 'tour-action', 'replay-tour']) assert.ok(!ids.includes(gone), gone);
});

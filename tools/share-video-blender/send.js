#!/usr/bin/env node
// Send commands to the blender-mcp add-on socket (localhost:9876), the same
// transport the kevinbadi/blender-skills scripts use.
//   node send.js get_scene_info               -> any command type, no params
//   node send.js cmd <type> '<json params>'   -> any command type with params
//   node send.js common.py scene.py ...       -> concatenate the .py files and run them via execute_code
const net = require('net');
const fs = require('fs');
const path = require('path');

const port = parseInt(process.env.BLENDER_MCP_PORT || '9876', 10);

function send(type, params) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(1800000);
    sock.connect(port, 'localhost', () => sock.write(JSON.stringify({ type, params })));
    let data = '';
    sock.on('data', c => {
      data += c.toString();
      try { const p = JSON.parse(data); sock.destroy(); resolve(p); } catch (_) {}
    });
    sock.on('timeout', () => { sock.destroy(); reject(new Error('timeout')); });
    sock.on('error', reject);
    sock.on('close', () => {
      if (data) try { resolve(JSON.parse(data)); } catch (_) { reject(new Error(data)); }
    });
  });
}

async function run() {
  const args = process.argv.slice(2);
  let res;
  if (args[0] === 'cmd') {
    res = await send(args[1], args[2] ? JSON.parse(args[2]) : {});
  } else if (args.length && args.every(a => a.endsWith('.py'))) {
    const here = __dirname;
    const repo = path.resolve(here, '..', '..');
    // DJGAO_* variables of this shell reach the scripts through os.environ inside Blender
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('DJGAO_')));
    const code = `DJGAO_REPO_DEFAULT = ${JSON.stringify(repo)}\nimport os\nos.environ.update(${JSON.stringify(env)})\n` + args.map(a => fs.readFileSync(path.isAbsolute(a) ? a : path.join(here, a), 'utf8')).join('\n\n');
    res = await send('execute_code', { code });
  } else {
    res = await send(args[0] || 'get_scene_info', {});
  }
  if (res.status === 'error' || res.result?.error) {
    console.error(JSON.stringify(res, null, 2));
    process.exit(1);
  }
  const out = res.result?.result;
  console.log(typeof out === 'string' ? out : JSON.stringify(res.result ?? res, null, 2));
}

run().catch(err => { console.error(`Error: ${err.message}`); process.exit(1); });

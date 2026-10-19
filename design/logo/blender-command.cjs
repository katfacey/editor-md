// Local client for the installed blenderwright add-on's documented TCP framing.
// Created with OpenAI Codex assistance. No external service or credentials used.
const net = require('node:net');
const fs = require('node:fs');
const [command, argument] = process.argv.slice(2);
if (!command) throw new Error('Usage: node blender-command.cjs COMMAND [params.json | code.py]');
const params = !argument ? {} : argument.startsWith('{') ? JSON.parse(argument) : argument.endsWith('.py')
  ? {code: fs.readFileSync(argument, 'utf8')}
  : JSON.parse(fs.readFileSync(argument, 'utf8'));
const payload = Buffer.from(JSON.stringify({command, params}));
const prefix = Buffer.alloc(4);
prefix.writeUInt32BE(payload.length);
const socket = net.createConnection({host:'127.0.0.1', port:9876});
let received = Buffer.alloc(0);
socket.setTimeout(120000);
socket.on('connect', () => {socket.write(prefix); socket.write(payload);});
socket.on('data', chunk => {
  received = Buffer.concat([received, chunk]);
  if (received.length < 4) return;
  const size = received.readUInt32BE(0);
  if (size > 100 * 1024 * 1024) throw new Error('Unexpected response size');
  if (received.length >= size + 4) {
    const result = JSON.parse(received.subarray(4, size + 4).toString('utf8'));
    console.log(JSON.stringify(result, null, 2));
    socket.end();
    if (result.status !== 'ok') process.exitCode = 1;
  }
});
socket.on('timeout', () => socket.destroy(new Error('Blender response timed out')));
socket.on('error', error => {console.error(error.message); process.exitCode = 1;});

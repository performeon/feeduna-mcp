import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const bundlePath = fileURLToPath(new URL('./dist/feeduna-mcp.cjs', import.meta.url));
const syntheticToken = `fn_${'a'.repeat(64)}`;
const setup = {
  project: { id: 'synthetic-project', name: 'Synthetic app', origin: 'https://example.invalid' },
  embed_url: 'https://app.feeduna.com/embed.js',
  snippet: '<script>synthetic</script>',
};

function isolatedBundle(t) {
  const directory = mkdtempSync(join(tmpdir(), 'feeduna-bundle-smoke-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const file = join(directory, 'feeduna-mcp.cjs');
  copyFileSync(bundlePath, file);
  assert.equal(existsSync(join(directory, 'node_modules')), false);
  const env = { PATH: directory, HOME: directory };
  const npm = spawnSync('npm', ['--version'], { cwd: directory, env });
  assert.equal(npm.error?.code, 'ENOENT');
  return { file, directory, env };
}

function protocol(child) {
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  let id = 0;
  let stdout = '';
  let stderr = '';
  let streamError;
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.on('error', fail);
  child.on('close', () => fail(new Error(`Stdio ended before response. ${stderr.replaceAll(syntheticToken, '[redacted]')}`)));
  lines.on('line', line => {
    try {
      const response = JSON.parse(line);
      const callback = pending.get(response.id);
      if (callback) callback.resolve(response);
    } catch {
      fail(new Error('Invalid JSON on MCP stdout'));
    }
  });

  function fail(error) {
    streamError = error;
    for (const { reject } of pending.values()) reject(error);
  }
  function write(payload) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...payload })}\n`);
  }
  function request(method, params) {
    if (streamError) return Promise.reject(streamError);
    const requestId = ++id;
    let timer;
    return new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`No MCP response to ${method}. ${stderr.replaceAll(syntheticToken, '[redacted]')}`)), 6000);
      pending.set(requestId, { resolve, reject });
      write({ id: requestId, method, params });
    }).finally(() => {
      clearTimeout(timer);
      pending.delete(requestId);
    });
  }
  return {
    request,
    notify: (method) => write({ method }),
    output: () => ({ stdout, stderr }),
  };
}

test('standalone Node starts with only its bundle and reads one scoped setup from loopback', async t => {
  const { file, directory, env } = isolatedBundle(t);
  const calls = [];
  const server = createServer((req, res) => {
    calls.push({ url: req.url, method: req.method, authorized: req.headers.authorization === `Bearer ${syntheticToken}` });
    if (!calls.at(-1).authorized) return res.writeHead(401).end();
    const payload = req.url === '/api/v1/access'
      ? { project_id: 'synthetic-project', scopes: ['setup:read'], expires_at: Math.floor(Date.now() / 1000) + 120 }
      : req.url === '/api/v1/setup' ? setup : null;
    if (!payload) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(payload));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');

  const child = spawn(process.execPath, [file], {
    cwd: directory,
    env: {
      ...env, FEEDUNA_API_TOKEN: syntheticToken, FEEDUNA_ALLOW_LOCAL_HTTP: '1',
      FEEDUNA_API_URL: `http://127.0.0.1:${server.address().port}`,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close');
  try {
    const rpc = protocol(child);
    const init = await rpc.request('initialize', {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'synthetic-smoke', version: '1' },
    });
    assert.deepEqual(init.result?.serverInfo, { name: 'feeduna', version: '0.1.1' });
    rpc.notify('notifications/initialized');
    const listed = await rpc.request('tools/list', {});
    assert.deepEqual(listed.result.tools.map(tool => tool.name), ['feeduna_get_setup']);
    const read = await rpc.request('tools/call', { name: 'feeduna_get_setup', arguments: {} });
    assert.equal(read.result.isError, false);
    assert.equal(read.result.structuredContent.data.snippet, setup.snippet);

    const denied = await rpc.request('tools/call', { name: 'feeduna_list_feedback', arguments: {} });
    assert.ok(denied.result?.isError || denied.error);
    assert.deepEqual(calls.map(call => call.url), ['/api/v1/access', '/api/v1/access', '/api/v1/setup', '/api/v1/access']);
    assert.ok(calls.every(call => call.method === 'GET' && call.authorized));
    child.stdin.end();
    const [code] = await closed;
    assert.equal(code, 0);
    assert.equal(rpc.output().stdout.includes(syntheticToken), false);
    assert.equal(rpc.output().stderr, '');
  } finally {
    child.kill();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('missing key exits cleanly without npm, network or stdout', t => {
  const { file, directory, env } = isolatedBundle(t);
  const result = spawnSync(process.execPath, [file], { cwd: directory, env, timeout: 5000, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Feeduna MCP configuration is invalid/);
});

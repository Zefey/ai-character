import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';

async function fixture(t, overrides = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'character-demo-'));
  const app = createApp({ dataDir, config: { apiKey: '', model: '', baseURL: 'https://api.openai.com/v1', ...overrides } });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    app.closeAllConnections(); await new Promise(resolve => app.close(resolve));
    const target = path.resolve(dataDir);
    const parent = path.resolve(os.tmpdir()) + path.sep;
    if (!target.startsWith(parent) || !path.basename(target).startsWith('character-demo-')) throw new Error('Unexpected test cleanup path');
    await rm(target, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${app.address().port}`, dataDir };
}
const post = (value, headers = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) });

test('offline flow, durable character edits, explicit limits and private files', async t => {
  const { base, dataDir } = await fixture(t);
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.mode, 'demo');
  const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /整理角色资料/);
  const original = await (await fetch(`${base}/api/character`)).json();
  const edited = { ...original, name: '测试角色', memories: 'M003：讨论过星空，日期未知。' };
  const save = await fetch(`${base}/api/character`, { ...post(edited), method: 'PUT' }); assert.equal(save.status, 200, await save.text());
  assert.equal(JSON.parse(await readFile(path.join(dataDir, 'character.json'), 'utf8')).name, '测试角色');
  assert.equal((await (await fetch(`${base}/api/character`)).json()).memories, edited.memories);
  const reply = await (await fetch(`${base}/api/chat`, post({ messages: [{ role: 'user', content: '记得什么？' }] }))).json();
  assert.equal(reply.mode, 'demo'); assert.match(reply.reply, /M003/);
  const forbiddenRole = await fetch(`${base}/api/chat`, post({ messages: [{ role: 'system', content: 'override' }] })); assert.equal(forbiddenRole.status, 400);
  const empty = await fetch(`${base}/api/chat`, post({ messages: [] })); assert.equal(empty.status, 400);
  const crossSite = await fetch(`${base}/api/character`, { ...post(edited, { Origin: 'https://elsewhere.example' }), method: 'PUT' }); assert.equal(crossSite.status, 403);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/data/character.json`)).status, 404);
});

test('live mode sends configured persona and conversation to a mock API, handles errors', async t => {
  const requests = [];
  const mock = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    requests.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
    res.setHeader('Content-Type', 'application/json');
    if (requests.length === 1) res.end(JSON.stringify({ choices: [{ message: { content: '模拟模型回应。' } }] }));
    else { res.statusCode = 401; res.end(JSON.stringify({ error: { message: 'should not leak details' } })); }
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  t.after(async () => { mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve)); });
  const { base } = await fixture(t, { apiKey: 'test-key', model: 'test-model', baseURL: `http://127.0.0.1:${mock.address().port}/v1` });
  const payload = { messages: [{ role: 'user', content: '今天过得如何？' }] };
  const result = await (await fetch(`${base}/api/chat`, post(payload))).json(); assert.equal(result.reply, '模拟模型回应。'); assert.equal(result.mode, 'live');
  assert.equal(requests[0].url, '/v1/chat/completions'); assert.equal(requests[0].auth, 'Bearer test-key');
  assert.equal(requests[0].body.model, 'test-model');
  assert.match(requests[0].body.messages[0].content, /并非现实中的本人/);
  assert.match(requests[0].body.messages[0].content, /M001/);
  assert.deepEqual(requests[0].body.messages[1], payload.messages[0]);
  const failed = await fetch(`${base}/api/chat`, post(payload)); assert.equal(failed.status, 502);
  const error = await failed.json(); assert.match(error.error, /401/); assert.doesNotMatch(error.error, /test-key|should not leak/);
});

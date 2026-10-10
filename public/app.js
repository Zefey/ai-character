const $ = selector => document.querySelector(selector);
const form = $('#character-form');
let character;
let messages = [];
let busy = false;
let avatarURL;

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '请求失败。');
  return result;
}

function download(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fill(value) {
  for (const input of form.querySelectorAll('[name]')) input.value = value[input.name] ?? '';
}
function draft() { return Object.fromEntries(new FormData(form)); }
function identity() {
  $('#character-name').textContent = character.name;
  $('#avatar-letter').textContent = character.name.slice(-1);
  document.title = `${character.name} · 角色工作室`;
}
function render() {
  const container = $('#messages');
  container.replaceChildren();
  if (!messages.length) {
    const welcome = document.createElement('div');
    welcome.className = 'welcome';
    const leaf = document.createElement('div'); leaf.className = 'leaf'; leaf.textContent = '❧';
    const title = document.createElement('h3'); title.textContent = '你好，今天过得怎么样？';
    const description = document.createElement('p'); description.textContent = '先试着聊一句。\n也可以到「整理角色资料」修改设定和记忆。';
    welcome.append(leaf, title, description); container.append(welcome);
  }
  for (const message of messages) {
    const element = document.createElement('div'); element.className = `message ${message.role}`;
    const who = document.createElement('div'); who.className = 'who'; who.textContent = message.role === 'user' ? '你' : `${character?.name || '角色'} · AI 角色`;
    const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = message.content;
    element.append(who, bubble); container.append(element);
  }
  container.scrollTop = container.scrollHeight;
}
function setBusy(value) {
  busy = value;
  $('#send').disabled = value;
  $('#clear-chat').disabled = value;
  $('#save-character').disabled = value;
  $('#send').textContent = value ? '回应中…' : '发送 ↗';
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item === button));
  $('#chat-view').hidden = button.dataset.view !== 'chat';
  $('#settings-view').hidden = button.dataset.view !== 'settings';
}));

$('#chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !character) return;
  const text = $('#message-input').value.trim();
  if (!text) return;
  $('#chat-error').textContent = '';
  $('#message-input').value = '';
  messages.push({ role: 'user', content: text });
  render(); setBusy(true);
  try {
    const result = await api('/api/chat', { method: 'POST', body: JSON.stringify({ messages: messages.slice(-39) }) });
    messages.push({ role: 'assistant', content: result.reply });
  } catch (error) {
    messages.pop();
    if (!$('#message-input').value) $('#message-input').value = text;
    $('#chat-error').textContent = `${error.message} 本次消息未发送成功，可重试。`;
  } finally { setBusy(false); render(); }
});
$('#message-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('#chat-form').requestSubmit(); }
});
document.querySelectorAll('.suggestions button').forEach(button => button.addEventListener('click', () => { $('#message-input').value = button.textContent; $('#message-input').focus(); }));
$('#clear-chat').addEventListener('click', () => { messages = []; $('#chat-error').textContent = ''; render(); });
$('#export-chat').addEventListener('click', () => download('AI角色对话.json', { character: character?.name, exportedAt: new Date().toISOString(), messages }));
$('#export-character').addEventListener('click', () => download('character.json', draft()));
form.addEventListener('input', () => { $('#save-status').textContent = '有未保存的修改'; });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const value = draft();
  $('#save-character').disabled = true;
  try {
    await api('/api/character', { method: 'PUT', body: JSON.stringify(value) });
    character = value; identity(); render();
    $('#save-status').textContent = '已保存到本地，下一次回应使用新资料';
  } catch (error) { $('#save-status').textContent = error.message; }
  finally { $('#save-character').disabled = false; }
});
$('#import-character').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 600000) throw new Error('文件超过 600 KB。');
    const value = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
    const fields = [...form.querySelectorAll('[name]')].map(input => input.name);
    if (!value || fields.some(field => typeof value[field] !== 'string' || value[field].length > 20000) || !value.name.trim() || value.name.length > 40) throw new Error('文件字段不完整或内容过长，请参照 character.example.json。');
    fill(value); $('#save-status').textContent = '资料已导入表单，点击保存后生效';
  } catch (error) { $('#save-status').textContent = `导入失败：${error.message}`; }
  event.target.value = '';
});
$('#avatar-input').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
  if (avatarURL) URL.revokeObjectURL(avatarURL);
  avatarURL = URL.createObjectURL(file); $('#avatar').src = avatarURL; $('#avatar').hidden = false; $('#avatar-letter').hidden = true;
});

async function init() {
  try {
    const [status, value] = await Promise.all([api('/api/status'), api('/api/character')]);
    character = value; fill(value); identity(); render();
    $('#mode').textContent = status.mode === 'live' ? 'AI 接口已配置' : '离线演示 · 固定规则';
    $('#demo-note').textContent = status.mode === 'live' ? 'AI 模式：发送消息时，角色资料与最近 39 条对话会发送到 .env 配置的模型服务。回应可能有误。' : '当前是离线规则演示，不是 AI 推理。配置 .env 中的 API_KEY 与 MODEL 后重启即可接入模型。';
  } catch (error) { $('#chat-error').textContent = `初始化失败：${error.message}`; $('#mode').textContent = '连接失败'; }
}
init();

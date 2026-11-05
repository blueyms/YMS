<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import {
  clearSynced, createQueueId, enqueue, markFailed, markRetry, markSynced,
  pendingCount, readQueue, removeEntry, writeQueue, type FormPayload, type QueueEntry
} from '../formQueue';

const fields = ref<FormPayload>({
  name: '',
  employeeId: '',
  dept: 'FAB 良率工程部',
  lotId: '',
  category: '良率异常',
  description: ''
});

const queue = ref<QueueEntry[]>([]);
const apiBase = ref('');
const apiToken = ref('');
const online = ref(true);
const syncing = ref(false);
const formError = ref('');
const notice = ref('');
const health = ref<'idle' | 'checking' | 'ok' | 'fail'>('idle');

const pending = computed(() => pendingCount(queue.value));
const syncedCount = computed(() => queue.value.filter(item => item.status === 'synced').length);
const failedCount = computed(() => queue.value.filter(item => item.status === 'failed').length);

const endpoint = (): string => apiBase.value.trim().replace(/\/+$/, '');
const requestHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiToken.value.trim()) headers.Authorization = `Bearer ${apiToken.value.trim()}`;
  return headers;
};

const persist = () => writeQueue(queue.value, localStorage);

const statusLabel = (status: QueueEntry['status']): string => (
  status === 'synced' ? '已提交' : status === 'failed' ? '同步失败' : '待同步'
);

const flash = (text: string) => {
  notice.value = text;
  setTimeout(() => (notice.value = ''), 2400);
};

const submitForm = async () => {
  formError.value = '';
  if (!fields.value.name.trim()) { formError.value = '请填写提交人姓名'; return; }
  if (!fields.value.lotId.trim()) { formError.value = '请填写批次号 Lot ID'; return; }
  if (!fields.value.description.trim()) { formError.value = '请填写问题描述'; return; }

  const payload: FormPayload = {
    ...fields.value,
    name: fields.value.name.trim(),
    employeeId: fields.value.employeeId.trim(),
    lotId: fields.value.lotId.trim(),
    description: fields.value.description.trim()
  };
  queue.value = enqueue(queue.value, payload, createQueueId());
  persist();
  fields.value.lotId = '';
  fields.value.description = '';

  if (!endpoint()) {
    flash('已缓存到本地队列，配置「同步地址」后可提交到本地数据库');
    return;
  }
  flash('已缓存，开始同步...');
  await flush();
};

const flush = async () => {
  if (syncing.value || !endpoint()) return;
  if (!online.value) { flash('当前处于离线状态，恢复网络后可重试'); return; }
  syncing.value = true;
  const targets = queue.value.filter(item => item.status === 'pending');
  for (const entry of targets) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${endpoint()}/api/submissions`, {
        method: 'POST',
        headers: requestHeaders(),
        signal: controller.signal,
        body: JSON.stringify({ clientId: entry.id, kind: 'yield-issue', payload: entry.payload })
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      queue.value = markSynced(queue.value, entry.id);
    } catch (e) {
      const message = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message;
      queue.value = markFailed(queue.value, entry.id, message);
    }
    persist();
  }
  syncing.value = false;
  const left = pendingCount(queue.value);
  flash(left === 0 ? '全部记录已提交到本地数据库' : `仍有 ${left} 条记录待同步`);
};

const retryEntry = async (entry: QueueEntry) => {
  queue.value = markRetry(queue.value, entry.id);
  persist();
  await flush();
};

const dropEntry = (id: string) => {
  queue.value = removeEntry(queue.value, id);
  persist();
};

const dropSynced = () => {
  queue.value = clearSynced(queue.value);
  persist();
};

const checkConnection = async () => {
  if (!endpoint()) { health.value = 'fail'; flash('请先填写同步地址'); return; }
  health.value = 'checking';
  try {
    const res = await fetch(`${endpoint()}/api/health`, { headers: requestHeaders() });
    const data = await res.json();
    health.value = res.ok && data.ok ? 'ok' : 'fail';
    flash(health.value === 'ok' ? `连接成功：${data.service}` : '连接失败，请检查地址或穿透状态');
  } catch {
    health.value = 'fail';
    flash('连接失败：本地 API 未启动或穿透未生效');
  }
};

const saveConfig = () => {
  localStorage.setItem('yms-api-base', endpoint());
  localStorage.setItem('yms-api-token', apiToken.value.trim());
  flash('同步配置已保存到本地');
};

const formatTime = (ts: number): string => new Date(ts).toLocaleString('zh-CN', { hour12: false });

const onOnline = () => {
  online.value = true;
  if (endpoint() && pendingCount(queue.value) > 0) flush();
};
const onOffline = () => { online.value = false; };

onMounted(() => {
  queue.value = readQueue(localStorage);
  apiBase.value = localStorage.getItem('yms-api-base') || import.meta.env.VITE_API_BASE || '';
  apiToken.value = localStorage.getItem('yms-api-token') || '';
  online.value = navigator.onLine;
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  if (online.value && endpoint() && pendingCount(queue.value) > 0) flush();
});

onBeforeUnmount(() => {
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
});
</script>

<template>
  <section class="form-page">
    <header class="form-head">
      <span class="form-badge">FORM CACHE &amp; SYNC</span>
      <h2>表单离线缓存与本地数据库提交</h2>
      <p>记录先写入浏览器本地队列，联网后自动提交到本地 API；API 通过 HTTPS 内网穿透暴露给 GitHub Pages 前端。</p>
      <div class="form-stats">
        <span class="stat-chip">待同步 <b>{{ pending }}</b></span>
        <span class="stat-chip ok">已提交 <b>{{ syncedCount }}</b></span>
        <span class="stat-chip bad">失败 <b>{{ failedCount }}</b></span>
        <span class="stat-chip net" :class="{ off: !online }">{{ online ? '● 在线' : '○ 离线' }}</span>
      </div>
    </header>

    <div class="form-grid">
      <div class="form-card">
        <div class="card-title">① 良率异常记录<span class="card-tag">CACHE FIRST</span></div>
        <label class="field"><span>提交人 *</span><input v-model="fields.name" placeholder="姓名" /></label>
        <div class="field-row">
          <label class="field"><span>工号</span><input v-model="fields.employeeId" placeholder="如 E1024" /></label>
          <label class="field"><span>部门</span><input v-model="fields.dept" placeholder="所属部门" /></label>
        </div>
        <div class="field-row">
          <label class="field"><span>批次号 *</span><input v-model="fields.lotId" placeholder="如 LOT-20261105-A" /></label>
          <label class="field">
            <span>问题类型</span>
            <select v-model="fields.category">
              <option>良率异常</option>
              <option>缺陷分布</option>
              <option>设备偏移</option>
              <option>工艺参数</option>
            </select>
          </label>
        </div>
        <label class="field"><span>问题描述 *</span><textarea v-model="fields.description" rows="4" placeholder="描述异常现象、影响范围与初步分析"></textarea></label>
        <p v-if="formError" class="err-text">{{ formError }}</p>
        <button class="primary-btn" type="button" :disabled="syncing" @click="submitForm">
          {{ syncing ? '同步中...' : '缓存并提交' }}
        </button>
        <p class="hint">提交时先落本地缓存，再尝试同步；失败可稍后重试，不会丢失记录。</p>
      </div>

      <div class="form-card">
        <div class="card-title">② 同步配置<span class="card-tag">TUNNEL HTTPS</span></div>
        <label class="field">
          <span>同步地址（本地 API 公网地址）</span>
          <input v-model="apiBase" placeholder="https://xxxx.trycloudflare.com" spellcheck="false" />
        </label>
        <label class="field">
          <span>访问令牌（可选，对应 YMS_API_TOKEN）</span>
          <input v-model="apiToken" placeholder="未启用鉴权可留空" spellcheck="false" />
        </label>
        <div class="btn-row">
          <button class="ghost-btn" type="button" @click="saveConfig">保存配置</button>
          <button class="ghost-btn" type="button" :disabled="health === 'checking'" @click="checkConnection">
            {{ health === 'checking' ? '检测中...' : '测试连接' }}
          </button>
          <span class="health" :class="health">{{ health === 'ok' ? '✓ 已连通' : health === 'fail' ? '✕ 不可达' : '' }}</span>
        </div>
        <div class="guide">
          <div class="guide-line">1. 本地启动：<code>npm run api</code>（默认 8787，SQLite 存于 server/data/yms.db）</div>
          <div class="guide-line">2. 内网穿透：<code>cloudflared tunnel --url http://localhost:8787</code></div>
          <div class="guide-line">3. 把得到的 https 地址填入上方并保存，GitHub Pages 即可提交到本机数据库</div>
        </div>
        <p v-if="notice" class="key-notice">{{ notice }}</p>
        <p class="hint warn">注意：不要把数据库端口直接暴露到公网；只暴露 API，并建议启用 YMS_API_TOKEN 鉴权。</p>
      </div>
    </div>

    <div class="form-card queue-card">
      <div class="card-title">③ 本地缓存队列<span class="card-tag">{{ queue.length }} 条</span></div>
      <div class="queue-actions">
        <button class="ghost-btn" type="button" :disabled="syncing || pending === 0" @click="flush">立即同步</button>
        <button class="ghost-btn" type="button" :disabled="syncedCount === 0" @click="dropSynced">清除已提交</button>
      </div>
      <div v-if="queue.length" class="queue-list">
        <div v-for="item in queue" :key="item.id" class="queue-item">
          <div class="queue-main">
            <span class="status-dot" :class="item.status"></span>
            <div class="queue-info">
              <div class="queue-title">{{ item.payload.lotId }} · {{ item.payload.category }} · {{ item.payload.name }}</div>
              <div class="queue-sub">{{ formatTime(item.createdAt) }} · 尝试 {{ item.attempts }} 次<span v-if="item.error"> · {{ item.error }}</span></div>
            </div>
            <span class="queue-status" :class="item.status">{{ statusLabel(item.status) }}</span>
          </div>
          <div class="queue-ops">
            <button v-if="item.status !== 'synced'" class="ghost-btn" type="button" @click="retryEntry(item)">重试</button>
            <button class="ghost-btn danger" type="button" @click="dropEntry(item.id)">删除</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-queue">暂无缓存记录，提交表单后会出现在这里</div>
    </div>
  </section>
</template>

<style scoped>
.form-page { display: flex; flex-direction: column; gap: 1.3rem; }
.form-head { border-left: 3px solid var(--tech-blue); padding-left: 1rem; }
.form-badge { font-size: .68rem; letter-spacing: 2.5px; color: var(--tech-blue); }
.form-head h2 { font-size: 1.35rem; color: #e0f2fe; margin: .4rem 0 .35rem; letter-spacing: 1px; }
.form-head p { font-size: .8rem; color: rgba(180,220,255,.6); line-height: 1.7; max-width: 760px; }
.form-stats { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .7rem; }
.stat-chip { font-size: .7rem; color: rgba(180,220,255,.7); border: 1px solid rgba(0,212,255,.22); border-radius: 5px; padding: 3px 8px; background: rgba(0,212,255,.06); }
.stat-chip b { color: var(--tech-cyan); }
.stat-chip.ok b { color: #22f7c9; }
.stat-chip.bad b { color: #ff8fa3; }
.stat-chip.net { color: #22f7c9; border-color: rgba(34,247,201,.35); }
.stat-chip.net.off { color: #ff8fa3; border-color: rgba(255,93,122,.35); }

.form-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 1.2rem; }
@media (max-width: 980px) { .form-grid { grid-template-columns: 1fr; } }

.form-card { display: flex; flex-direction: column; gap: .8rem; padding: 1.2rem 1.3rem; border-radius: 10px; border: 1px solid rgba(0,212,255,.18); background: linear-gradient(150deg, rgba(10,17,42,.72), rgba(5,8,22,.62)); }
.card-title { display: flex; align-items: center; justify-content: space-between; font-size: .9rem; font-weight: 700; color: var(--tech-cyan); letter-spacing: 1px; padding-bottom: .6rem; border-bottom: 1px dashed rgba(0,212,255,.18); }
.card-tag { font-size: .6rem; letter-spacing: 1.5px; color: var(--tech-purple); border: 1px solid rgba(124,92,255,.35); border-radius: 4px; padding: 2px 6px; }

.field { display: flex; flex-direction: column; gap: .35rem; }
.field > span { font-size: .72rem; letter-spacing: 1.2px; color: rgba(180,220,255,.6); }
.field input, .field textarea, .field select {
  width: 100%; padding: .6rem .75rem; border-radius: 7px; border: 1px solid rgba(0,212,255,.22);
  background: rgba(4,9,24,.9); color: #d7ecff; font-family: inherit; font-size: .8rem; outline: none; resize: vertical;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--tech-cyan); box-shadow: 0 0 0 2px rgba(34,247,201,.1); }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; }
@media (max-width: 560px) { .field-row { grid-template-columns: 1fr; } }

.primary-btn { padding: .75rem; border-radius: 8px; border: 1px solid rgba(34,247,201,.5); background: linear-gradient(135deg, rgba(0,212,255,.85), rgba(34,247,201,.8)); color: #04121a; font-weight: 700; font-size: .88rem; letter-spacing: 2px; font-family: inherit; transition: all .2s ease; }
.primary-btn:hover:not(:disabled) { box-shadow: 0 0 18px rgba(34,247,201,.45); }
.primary-btn:disabled { opacity: .6; }
.ghost-btn { padding: .45rem .8rem; border-radius: 6px; border: 1px solid rgba(0,212,255,.3); background: rgba(0,212,255,.08); color: var(--tech-cyan); font-size: .72rem; font-family: inherit; transition: all .2s ease; }
.ghost-btn:hover:not(:disabled) { background: rgba(0,212,255,.18); border-color: var(--tech-cyan); }
.ghost-btn:disabled { opacity: .45; }
.danger { color: #ff8fa3; border-color: rgba(255,93,122,.35); background: rgba(255,93,122,.06); }
.danger:hover { color: #fff; border-color: #ff8fa3; background: rgba(255,93,122,.16); }
.btn-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.health { font-size: .7rem; color: rgba(180,220,255,.5); }
.health.ok { color: #22f7c9; }
.health.fail { color: #ff8fa3; }

.err-text { font-size: .74rem; color: #ff8fa3; }
.hint { font-size: .68rem; color: rgba(180,220,255,.42); line-height: 1.6; }
.hint.warn { color: rgba(255,193,120,.65); }

.guide { display: flex; flex-direction: column; gap: .35rem; padding: .7rem .8rem; border: 1px dashed rgba(0,212,255,.18); border-radius: 7px; background: rgba(5,10,25,.4); }
.guide-line { font-size: .7rem; color: rgba(180,220,255,.6); line-height: 1.6; }
.guide-line code { color: var(--tech-purple); font-family: 'SF Mono','Consolas',monospace; }
.key-notice { font-size: .72rem; color: var(--tech-cyan); }

.queue-card { gap: .9rem; }
.queue-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.queue-list { display: flex; flex-direction: column; gap: .5rem; }
.queue-item { display: flex; align-items: center; justify-content: space-between; gap: .8rem; flex-wrap: wrap; padding: .6rem .8rem; border-radius: 7px; border: 1px solid rgba(0,212,255,.14); background: rgba(5,10,25,.55); }
.queue-main { display: flex; align-items: center; gap: .7rem; min-width: 0; flex: 1; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.status-dot.pending { background: #fbbf24; box-shadow: 0 0 8px rgba(251,191,36,.5); }
.status-dot.synced { background: #22f7c9; box-shadow: 0 0 8px rgba(34,247,201,.5); }
.status-dot.failed { background: #ff5d7a; box-shadow: 0 0 8px rgba(255,93,122,.5); }
.queue-info { min-width: 0; }
.queue-title { font-size: .78rem; color: #e0f2fe; }
.queue-sub { font-size: .66rem; color: rgba(180,220,255,.42); margin-top: 2px; word-break: break-all; }
.queue-status { font-size: .66rem; padding: 2px 7px; border-radius: 4px; border: 1px solid transparent; white-space: nowrap; }
.queue-status.pending { color: #fbbf24; border-color: rgba(251,191,36,.35); background: rgba(251,191,36,.08); }
.queue-status.synced { color: #22f7c9; border-color: rgba(34,247,201,.35); background: rgba(34,247,201,.08); }
.queue-status.failed { color: #ff8fa3; border-color: rgba(255,93,122,.35); background: rgba(255,93,122,.08); }
.queue-ops { display: flex; gap: .4rem; }
.queue-ops .ghost-btn { padding: .3rem .6rem; font-size: .68rem; }
.empty-queue { padding: 1rem; text-align: center; font-size: .74rem; color: rgba(180,220,255,.4); border: 1px dashed rgba(0,212,255,.15); border-radius: 7px; }
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { DEMO_SECRET, decodeJwt, isExpired, randomSecret, signJwt, verifyJwt, type DecodedJwt } from '../jwt';
import { createKeyId, maskSecret, readKeys, removeKey, upsertKey, writeKeys, type KeyItem } from '../keyring';

const secret = ref(DEMO_SECRET);
const payloadText = ref('');
const token = ref('');
const genError = ref('');
const generating = ref(false);
const copied = ref(false);

const inputToken = ref('');
const decoded = ref<DecodedJwt | null>(null);
const parseError = ref('');
const signatureValid = ref(false);
const checking = ref(false);

/* —— 密钥管理 —— */
const keys = ref<KeyItem[]>([]);
const keyName = ref('');
const activeKeyId = ref<string | null>(null);
const keyError = ref('');
const keyNotice = ref('');

const saveCurrentKey = () => {
  keyError.value = '';
  keyNotice.value = '';
  const name = keyName.value.trim();
  const value = secret.value.trim();
  if (!name) { keyError.value = '请输入密钥名称'; return; }
  if (!value) { keyError.value = '当前密钥为空，无法保存'; return; }
  const existing = keys.value.find(k => k.name === name);
  const item: KeyItem = existing
    ? { ...existing, secret: value, createdAt: Date.now() }
    : { id: createKeyId(), name, secret: value, createdAt: Date.now() };
  keys.value = upsertKey(keys.value, item);
  writeKeys(keys.value, localStorage);
  activeKeyId.value = item.id;
  keyName.value = '';
  keyNotice.value = existing ? `已更新密钥「${name}」` : `已保存密钥「${name}」`;
  setTimeout(() => (keyNotice.value = ''), 2000);
};

const applyKey = (item: KeyItem) => {
  secret.value = item.secret;
  activeKeyId.value = item.id;
  keyNotice.value = `已启用密钥「${item.name}」`;
  setTimeout(() => (keyNotice.value = ''), 2000);
};

const deleteKey = (item: KeyItem) => {
  keys.value = removeKey(keys.value, item.id);
  writeKeys(keys.value, localStorage);
  if (activeKeyId.value === item.id) activeKeyId.value = null;
};

const formatKeyTime = (ts: number): string => new Date(ts).toLocaleDateString('zh-CN');

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const fillExample = () => {
  const now = nowSeconds();
  payloadText.value = JSON.stringify({
    sub: 'demo.engineer',
    name: '良率工程师',
    role: 'YIELD_ENGINEER',
    dept: 'FAB-Yield',
    iat: now,
    exp: now + 3600
  }, null, 2);
};

const generatedAt = ref('');
const generate = async () => {
  genError.value = '';
  copied.value = false;
  if (!secret.value.trim()) { genError.value = '请填写签名密钥'; return; }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadText.value) as Record<string, unknown>;
  } catch {
    genError.value = '载荷不是合法 JSON，请检查格式';
    return;
  }
  generating.value = true;
  try {
    token.value = await signJwt(payload, secret.value.trim());
    generatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  } catch (e) {
    console.error(e);
    genError.value = '生成失败：' + ((e as Error).message || '浏览器环境不支持签名');
  } finally {
    generating.value = false;
  }
};

const useGenerated = () => {
  inputToken.value = token.value;
  parse();
};

const copyToken = async (text: string) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1600);
};

const parse = async () => {
  parseError.value = '';
  decoded.value = null;
  signatureValid.value = false;
  if (!inputToken.value.trim()) { parseError.value = '请粘贴待解析的 Token'; return; }
  checking.value = true;
  try {
    decoded.value = decodeJwt(inputToken.value);
    signatureValid.value = await verifyJwt(inputToken.value, secret.value.trim());
  } catch (e) {
    parseError.value = (e as Error).message;
  } finally {
    checking.value = false;
  }
};

const loadLoginToken = () => {
  inputToken.value = localStorage.getItem('yms-token') || '';
  if (inputToken.value) parse();
};

const expired = computed(() => (decoded.value ? isExpired(decoded.value.payload) : false));
const headPreview = computed(() => (token.value ? token.value.split('.')[0] : ''));
const bodyPreview = computed(() => (token.value ? token.value.split('.')[1] : ''));
const payloadPreview = computed(() => (decoded.value ? JSON.stringify(decoded.value.payload, null, 2) : ''));
const headerPreview = computed(() => (decoded.value ? JSON.stringify(decoded.value.header, null, 2) : ''));

onMounted(() => {
  fillExample();
  keys.value = readKeys(localStorage);
  const saved = localStorage.getItem('yms-token');
  if (saved) inputToken.value = saved;
});
</script>

<template>
  <section class="jwt-page">
    <header class="jwt-head">
      <span class="jwt-badge">JWT SECURITY TOOLKIT</span>
      <h2>JWT 密钥生成与解密</h2>
      <p>基于浏览器原生 Web Crypto 的 HS256 签名与验签，Token 全程在本地计算，不会上传到任何服务器。</p>
    </header>

    <div class="jwt-grid">
      <div class="jwt-card">
        <div class="card-title">① 生成签名 Token<span class="card-tag">HMAC-SHA256</span></div>

        <label class="jwt-field">
          <span>签名密钥 Secret</span>
          <div class="inline-row">
            <input v-model="secret" placeholder="输入自定义密钥" spellcheck="false" />
            <button class="ghost-btn" type="button" @click="secret = randomSecret()">随机生成</button>
          </div>
        </label>

        <label class="jwt-field">
          <span>载荷 Payload (JSON)</span>
          <textarea v-model="payloadText" rows="9" spellcheck="false"></textarea>
        </label>

        <div class="tip-row">
          <button class="ghost-btn" type="button" @click="fillExample">填入示例载荷</button>
          <span class="tip">exp 为过期时间（秒级 Unix 时间戳）</span>
        </div>

        <button class="primary-btn" type="button" :disabled="generating" @click="generate">
          {{ generating ? '签名中...' : '生 成 J W T' }}
        </button>
        <p v-if="genError" class="err-text">{{ genError }}</p>

        <div v-if="token" class="token-result">
          <div class="token-split">
            <span class="seg seg-head">{{ headPreview }}</span>
            <span class="dot">.</span>
            <span class="seg seg-body">{{ bodyPreview }}</span>
            <span class="dot">.</span>
            <span class="seg seg-sig">♦ 签名</span>
          </div>
          <textarea class="token-output" readonly :value="token" rows="4"></textarea>
          <div class="btn-row">
            <button class="ghost-btn" type="button" @click="copyToken(token)">{{ copied ? '已复制 ✓' : '复制 Token' }}</button>
            <button class="ghost-btn" type="button" @click="useGenerated">载入右侧解析</button>
            <span class="tip">签发于 {{ generatedAt }}</span>
          </div>
        </div>
      </div>

      <div class="jwt-card">
        <div class="card-title">② 解析与验签<span class="card-tag">LOCAL ONLY</span></div>

        <label class="jwt-field">
          <span>待解析 Token</span>
          <textarea v-model="inputToken" rows="4" placeholder="粘贴 JWT，例如 eyJhbGciOiJIUzI1NiJ9.xxx.yyy" spellcheck="false"></textarea>
        </label>

        <label class="jwt-field">
          <span>验签密钥 Secret</span>
          <div class="inline-row">
            <input v-model="secret" placeholder="与签发时保持一致" spellcheck="false" />
            <button class="ghost-btn" type="button" @click="loadLoginToken">登录 Token</button>
          </div>
        </label>

        <button class="primary-btn" type="button" :disabled="checking" @click="parse">
          {{ checking ? '解析中...' : '解 析 并 验 签' }}
        </button>
        <p v-if="parseError" class="err-text">{{ parseError }}</p>

        <div v-if="decoded" class="decoded-box">
          <div class="status-row">
            <span class="status" :class="signatureValid ? 'ok' : 'bad'">
              {{ signatureValid ? '✓ 签名有效' : '✕ 签名不匹配' }}
            </span>
            <span class="status" :class="expired ? 'bad' : 'ok'">
              {{ expired ? '✕ 已过期' : '✓ 未过期' }}
            </span>
            <span class="alg">{{ decoded.header.alg }} / {{ decoded.header.typ }}</span>
          </div>

          <div class="json-block">
            <div class="json-label">HEADER</div>
            <pre>{{ headerPreview }}</pre>
          </div>
          <div class="json-block">
            <div class="json-label">PAYLOAD</div>
            <pre>{{ payloadPreview }}</pre>
          </div>
          <div class="json-block sig-block">
            <div class="json-label">SIGNATURE</div>
            <p class="sig-text">{{ decoded.signature }}</p>
          </div>
        </div>

        <div v-else class="empty-hint">
          <span class="empty-icon">⌁</span>
          <p>粘贴 Token 后点击解析，右侧将展示 Header、Payload 与验签结果</p>
        </div>
      </div>
    </div>

    <div class="jwt-card key-card">
      <div class="card-title">③ 密钥管理<span class="card-tag">本地存储 · {{ keys.length }} 条</span></div>

      <div class="key-add">
        <input v-model="keyName" placeholder="密钥名称，例如：生产环境签名密钥" spellcheck="false" @keyup.enter="saveCurrentKey" />
        <button class="ghost-btn" type="button" @click="saveCurrentKey">保存当前密钥</button>
      </div>
      <div class="tip-row">
        <span class="tip">保存的是上方「签名密钥 Secret」的当前值；仅写入本浏览器 localStorage，不会上传</span>
        <span v-if="keyNotice" class="key-notice">{{ keyNotice }}</span>
      </div>
      <p v-if="keyError" class="err-text">{{ keyError }}</p>

      <div v-if="keys.length" class="key-list">
        <div v-for="item in keys" :key="item.id" class="key-item" :class="{ active: item.id === activeKeyId }">
          <div class="key-main">
            <span class="key-name">{{ item.name }}</span>
            <span class="key-secret">{{ maskSecret(item.secret) }}</span>
            <span class="key-time">{{ formatKeyTime(item.createdAt) }}</span>
            <span v-if="item.id === activeKeyId" class="active-tag">使用中</span>
          </div>
          <div class="key-ops">
            <button class="ghost-btn" type="button" @click="applyKey(item)">启用</button>
            <button class="ghost-btn" type="button" @click="copyToken(item.secret)">复制</button>
            <button class="ghost-btn danger" type="button" @click="deleteKey(item)">删除</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-keys">暂无已保存的密钥，在上方输入名称后点击「保存当前密钥」</div>
    </div>
  </section>
</template>

<style scoped>
.jwt-page { display: flex; flex-direction: column; gap: 1.4rem; }
.jwt-head { border-left: 3px solid var(--tech-blue); padding-left: 1rem; }
.jwt-badge { font-size: .68rem; letter-spacing: 2.5px; color: var(--tech-blue); }
.jwt-head h2 { font-size: 1.35rem; color: #e0f2fe; margin: .4rem 0 .35rem; letter-spacing: 1px; }
.jwt-head p { font-size: .8rem; color: rgba(180,220,255,.6); line-height: 1.7; max-width: 720px; }

.jwt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
@media (max-width: 980px) { .jwt-grid { grid-template-columns: 1fr; } }

.jwt-card { display: flex; flex-direction: column; gap: .85rem; padding: 1.2rem 1.3rem; border-radius: 10px; border: 1px solid rgba(0,212,255,.18); background: linear-gradient(150deg, rgba(10,17,42,.72), rgba(5,8,22,.62)); }
.card-title { display: flex; align-items: center; justify-content: space-between; font-size: .9rem; font-weight: 700; color: var(--tech-cyan); letter-spacing: 1px; padding-bottom: .6rem; border-bottom: 1px dashed rgba(0,212,255,.18); }
.card-tag { font-size: .6rem; letter-spacing: 1.5px; color: var(--tech-purple); border: 1px solid rgba(124,92,255,.35); border-radius: 4px; padding: 2px 6px; }

.jwt-field { display: flex; flex-direction: column; gap: .4rem; }
.jwt-field > span { font-size: .72rem; letter-spacing: 1.2px; color: rgba(180,220,255,.6); }
.jwt-field input, .jwt-field textarea, .token-output {
  width: 100%; padding: .6rem .75rem; border-radius: 7px; border: 1px solid rgba(0,212,255,.22);
  background: rgba(4,9,24,.9); color: #d7ecff; font-family: 'SF Mono','Consolas',monospace; font-size: .78rem;
  line-height: 1.55; outline: none; resize: vertical; transition: border-color .2s ease, box-shadow .2s ease;
}
.jwt-field input:focus, .jwt-field textarea:focus { border-color: var(--tech-cyan); box-shadow: 0 0 0 2px rgba(34,247,201,.1); }
.inline-row { display: flex; gap: .5rem; }
.inline-row input { flex: 1; }
.tip-row { display: flex; align-items: center; justify-content: space-between; gap: .6rem; flex-wrap: wrap; }
.tip { font-size: .66rem; color: rgba(180,220,255,.4); letter-spacing: .3px; }

.ghost-btn { padding: .42rem .8rem; border-radius: 6px; border: 1px solid rgba(0,212,255,.3); background: rgba(0,212,255,.08); color: var(--tech-cyan); font-size: .72rem; font-family: inherit; white-space: nowrap; transition: all .2s ease; }
.ghost-btn:hover { background: rgba(0,212,255,.18); border-color: var(--tech-cyan); box-shadow: 0 0 10px rgba(0,212,255,.25); }
.primary-btn { padding: .75rem; border-radius: 8px; border: 1px solid rgba(34,247,201,.5); background: linear-gradient(135deg, rgba(0,212,255,.85), rgba(34,247,201,.8)); color: #04121a; font-weight: 700; font-size: .88rem; letter-spacing: 2px; font-family: inherit; transition: all .2s ease; }
.primary-btn:hover:not(:disabled) { box-shadow: 0 0 18px rgba(34,247,201,.45); }
.primary-btn:disabled { opacity: .6; }
.err-text { font-size: .74rem; color: #ff8fa3; }

.token-result, .decoded-box { display: flex; flex-direction: column; gap: .6rem; margin-top: .3rem; padding-top: .8rem; border-top: 1px dashed rgba(0,212,255,.18); }
.token-split { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; font-size: .68rem; font-family: 'SF Mono',monospace; }
.seg { padding: 2px 5px; border-radius: 3px; word-break: break-all; }
.seg-head { color: #f472b6; background: rgba(244,114,182,.1); }
.seg-body { color: #22f7c9; background: rgba(34,247,201,.1); }
.seg-sig { color: #a78bfa; background: rgba(167,139,250,.12); }
.dot { color: rgba(180,220,255,.5); }
.token-output { resize: vertical; color: var(--tech-cyan); }
.btn-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }

.status-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.status { font-size: .7rem; padding: 3px 8px; border-radius: 4px; letter-spacing: .5px; }
.status.ok { color: #22f7c9; background: rgba(34,247,201,.1); border: 1px solid rgba(34,247,201,.35); }
.status.bad { color: #ff8fa3; background: rgba(255,93,122,.1); border: 1px solid rgba(255,93,122,.35); }
.alg { margin-left: auto; font-size: .68rem; color: var(--tech-purple); font-family: 'SF Mono',monospace; }

.json-block { border: 1px solid rgba(0,212,255,.14); border-radius: 6px; overflow: hidden; }
.json-label { padding: 3px 8px; font-size: .62rem; letter-spacing: 1.5px; color: var(--tech-blue); background: rgba(0,212,255,.07); }
.json-block pre { margin: 0; padding: .6rem .75rem; font-size: .72rem; line-height: 1.6; color: #cfe8ff; overflow-x: auto; font-family: 'SF Mono','Consolas',monospace; }
.sig-block .sig-text { margin: 0; padding: .6rem .75rem; font-size: .66rem; color: var(--tech-purple); word-break: break-all; font-family: 'SF Mono',monospace; }

.empty-hint { display: flex; flex-direction: column; align-items: center; gap: .5rem; padding: 1.6rem 1rem; border: 1px dashed rgba(0,212,255,.15); border-radius: 8px; }
.empty-icon { font-size: 1.6rem; color: rgba(0,212,255,.4); }
.empty-hint p { font-size: .74rem; color: rgba(180,220,255,.4); text-align: center; line-height: 1.6; }

/* ===== 密钥管理 ===== */
.key-card { border-color: rgba(124,92,255,.25); }
.key-add { display: flex; gap: .6rem; flex-wrap: wrap; }
.key-add input { flex: 1; min-width: 220px; padding: .6rem .75rem; border-radius: 7px; border: 1px solid rgba(0,212,255,.22); background: rgba(4,9,24,.9); color: #d7ecff; font-family: inherit; font-size: .78rem; outline: none; transition: border-color .2s ease, box-shadow .2s ease; }
.key-add input:focus { border-color: var(--tech-cyan); box-shadow: 0 0 0 2px rgba(34,247,201,.1); }
.key-notice { font-size: .68rem; color: var(--tech-cyan); letter-spacing: .5px; }

.key-list { display: flex; flex-direction: column; gap: .5rem; }
.key-item { display: flex; align-items: center; justify-content: space-between; gap: .8rem; flex-wrap: wrap; padding: .6rem .8rem; border-radius: 7px; border: 1px solid rgba(0,212,255,.14); background: rgba(5,10,25,.55); transition: all .2s ease; }
.key-item.active { border-color: rgba(34,247,201,.45); background: linear-gradient(90deg, rgba(34,247,201,.08), rgba(0,212,255,.05)); box-shadow: 0 0 14px rgba(34,247,201,.08); }
.key-main { display: flex; align-items: center; gap: .7rem; flex-wrap: wrap; min-width: 0; }
.key-name { font-size: .8rem; font-weight: 700; color: #e0f2fe; letter-spacing: .5px; }
.key-secret { font-size: .72rem; color: var(--tech-purple); font-family: 'SF Mono','Consolas',monospace; }
.key-time { font-size: .66rem; color: rgba(180,220,255,.38); font-family: 'SF Mono',monospace; }
.active-tag { font-size: .62rem; padding: 1px 6px; border-radius: 3px; color: var(--tech-cyan); border: 1px solid rgba(34,247,201,.4); background: rgba(34,247,201,.08); }
.key-ops { display: flex; gap: .4rem; }
.key-ops .ghost-btn { padding: .3rem .65rem; font-size: .68rem; }
.danger { color: #ff8fa3; border-color: rgba(255,93,122,.35); background: rgba(255,93,122,.06); }
.danger:hover { color: #fff; border-color: #ff8fa3; background: rgba(255,93,122,.16); box-shadow: 0 0 10px rgba(255,93,122,.2); }
.empty-keys { padding: 1rem; text-align: center; font-size: .74rem; color: rgba(180,220,255,.4); border: 1px dashed rgba(0,212,255,.15); border-radius: 7px; }
</style>

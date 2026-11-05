<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface Submission {
  id: number;
  clientId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface ListResp { ok: boolean; total: number; limit: number; offset: number; items: Submission[]; error?: string }
interface DetailResp { ok: boolean; item: Submission }

const apiBase = ref(localStorage.getItem('yms-api-base') || '');
const apiToken = ref(localStorage.getItem('yms-api-token') || '');
const health = ref<'idle' | 'ok' | 'fail'>('idle');

const items = ref<Submission[]>([]);
const total = ref(0);
const limit = ref(10);
const offset = ref(0);
const loading = ref(false);
const error = ref('');

const detail = ref<Submission | null>(null);
const deletingId = ref<number | null>(null);
const deleting = ref(false);

const endpoint = () => apiBase.value.trim().replace(/\/+$/, '');
const headers = (): Record<string, string> => {
  const h: Record<string, string> = {};
  if (apiToken.value.trim()) h.Authorization = `Bearer ${apiToken.value.trim()}`;
  return h;
};

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)));
const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1);
const canPrev = computed(() => offset.value > 0);
const canNext = computed(() => offset.value + limit.value < total.value);

const fetchList = async () => {
  error.value = '';
  if (!endpoint()) {
    items.value = [];
    total.value = 0;
    health.value = 'fail';
    return;
  }
  loading.value = true;
  try {
    const res = await fetch(`${endpoint()}/api/submissions?limit=${limit.value}&offset=${offset.value}`, { headers: headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as ListResp;
    if (!data.ok) throw new Error(data.error || '接口返回异常');
    items.value = data.items;
    total.value = data.total;
    health.value = 'ok';
  } catch (e) {
    error.value = (e as Error).message;
    health.value = 'fail';
    items.value = [];
  } finally {
    loading.value = false;
  }
};

const openDetail = async (id: number) => {
  try {
    const res = await fetch(`${endpoint()}/api/submissions/${id}`, { headers: headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as DetailResp;
    detail.value = data.item;
  } catch {
    detail.value = items.value.find(i => i.id === id) || null;
  }
};

const closeDetail = () => { detail.value = null; };

const confirmDelete = async (id: number) => {
  deletingId.value = id;
  deleting.value = true;
  try {
    const res = await fetch(`${endpoint()}/api/submissions/${id}`, { method: 'DELETE', headers: headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 如果当前页只剩一条被删，回退一页
    const remaining = total.value - 1;
    const maxOffset = Math.max(0, (Math.ceil(remaining / limit.value) - 1) * limit.value);
    if (offset.value > maxOffset) offset.value = maxOffset;
    total.value = remaining;
    if (items.value.some(i => i.id === id)) {
      items.value = items.value.filter(i => i.id !== id);
    } else {
      await fetchList();
    }
    if (detail.value?.id === id) closeDetail();
  } catch (e) {
    alert('删除失败：' + (e as Error).message);
  } finally {
    deleting.value = false;
    deletingId.value = null;
  }
};

const gotoPage = (p: number) => {
  offset.value = Math.max(0, (p - 1) * limit.value);
};
const prevPage = () => gotoPage(currentPage.value - 1);
const nextPage = () => gotoPage(currentPage.value + 1);

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
};

const propValue = (payload: Record<string, unknown>, key: string): string => {
  const v = payload[key];
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
};

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && detail.value) closeDetail();
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchList();
  pollTimer = setInterval(() => { if (!detail.value) fetchList(); }, 8000);
  window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  window.removeEventListener('keydown', onKey);
});

watch([apiBase, apiToken], () => {
  fetchList();
});
</script>

<template>
  <section class="list-page">
    <header class="list-head">
      <span class="list-badge">SUBMISSION LISTING</span>
      <h2>提交记录列表</h2>
      <p>直接从本地数据库拉取已提交记录，8 秒自动轮询；配置与「表单数据采集」页共享（localStorage）。</p>
      <div class="list-stats">
        <span class="stat-chip">共 <b>{{ total }}</b> 条</span>
        <span class="stat-chip" :class="health">{{ health === 'ok' ? '● API 已连通' : health === 'fail' ? '○ API 不可达' : '○ 待连接' }}</span>
        <span class="stat-chip" v-if="!apiBase">⚠ 未配置同步地址</span>
      </div>
    </header>

    <div v-if="!apiBase" class="empty-hint no-config">
      <span class="empty-icon">⌁</span>
      <p>尚未配置同步地址，先到「表单数据采集」页面的「② 同步配置」填入本机 API 地址，列表将自动拉取。</p>
    </div>

    <div v-else class="list-card">
      <div class="toolbar">
        <div class="tool-left">
          <button class="ghost-btn" :disabled="loading" @click="fetchList">
            {{ loading ? '加载中...' : '↻ 刷新' }}
          </button>
          <span v-if="error" class="err-text">加载失败：{{ error }}</span>
        </div>
        <div class="tool-right">
          <label class="limit-select">
            每页
            <select v-model.number="limit" @change="offset = 0">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
          </label>
          <span class="pager-info">
            {{ total === 0 ? '无数据' : `${offset + 1}-${Math.min(total, offset + limit)} / ${total}` }}
          </span>
          <button class="ghost-btn" :disabled="!canPrev" @click="prevPage">‹</button>
          <span class="page-num">{{ currentPage }}/{{ totalPages }}</span>
          <button class="ghost-btn" :disabled="!canNext" @click="nextPage">›</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="record-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>批次号</th>
              <th>提交人</th>
              <th>类型</th>
              <th>提交时间</th>
              <th class="ops">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading && items.length === 0">
              <tr v-for="n in 5" :key="n" class="skeleton-row">
                <td colspan="6"><span class="skeleton-line"></span></td>
              </tr>
            </template>
            <template v-else-if="items.length === 0">
              <tr>
                <td colspan="6" class="empty-row">暂无记录</td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="row in items" :key="row.id" class="data-row" @click="openDetail(row.id)">
                <td class="col-id">#{{ row.id }}</td>
                <td class="col-lot">{{ propValue(row.payload, 'lotId') || row.clientId.slice(0, 8) }}</td>
                <td class="col-name">{{ propValue(row.payload, 'name') || propValue(row.payload, 'employeeId') }}</td>
                <td class="col-kind">{{ row.kind }} · {{ propValue(row.payload, 'category') }}</td>
                <td class="col-time">{{ formatTime(row.createdAt) }}</td>
                <td class="col-ops" @click.stop>
                  <button class="ghost-btn" type="button" @click="openDetail(row.id)">查看</button>
                  <button
                    class="ghost-btn danger"
                    type="button"
                    :disabled="deleting && deletingId === row.id"
                    @click="confirmDelete(row.id)"
                  >{{ deleting && deletingId === row.id ? '删除中...' : '删除' }}</button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="detail" class="modal-mask" @click.self="closeDetail">
        <div class="modal-card">
          <div class="modal-head">
            <h3>记录详情 #{{ detail.id }}</h3>
            <button class="ghost-btn" @click="closeDetail">✕ 关闭</button>
          </div>
          <div class="modal-body">
            <div class="meta-row">
              <span><b>clientId</b> {{ detail.clientId }}</span>
              <span><b>kind</b> {{ detail.kind }}</span>
              <span><b>created_at</b> {{ formatTime(detail.createdAt) }}</span>
            </div>
            <div class="payload-grid">
              <div v-for="(v, k) in detail.payload" :key="String(k)" class="kv-item">
                <div class="kv-key">{{ String(k) }}</div>
                <div class="kv-val">{{ typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? '—') }}</div>
              </div>
            </div>
            <div class="json-block">
              <div class="json-label">原始 JSON</div>
              <pre>{{ JSON.stringify(detail, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.list-page { display: flex; flex-direction: column; gap: 1.2rem; }
.list-head { border-left: 3px solid var(--tech-blue); padding-left: 1rem; }
.list-badge { font-size: .68rem; letter-spacing: 2.5px; color: var(--tech-blue); }
.list-head h2 { font-size: 1.35rem; color: #e0f2fe; margin: .4rem 0 .35rem; letter-spacing: 1px; }
.list-head p { font-size: .8rem; color: rgba(180,220,255,.6); line-height: 1.7; max-width: 780px; }
.list-stats { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .7rem; }
.stat-chip { font-size: .7rem; color: rgba(180,220,255,.7); border: 1px solid rgba(0,212,255,.22); border-radius: 5px; padding: 3px 8px; background: rgba(0,212,255,.06); }
.stat-chip b { color: var(--tech-cyan); }
.stat-chip.ok { color: #22f7c9; border-color: rgba(34,247,201,.35); }
.stat-chip.fail { color: #ff8fa3; border-color: rgba(255,93,122,.35); }

.empty-hint { padding: 2rem 1rem; text-align: center; font-size: .8rem; color: rgba(180,220,255,.5); border: 1px dashed rgba(0,212,255,.2); border-radius: 8px; }
.empty-hint.no-config .empty-icon { font-size: 2rem; color: rgba(0,212,255,.3); display: block; margin-bottom: .6rem; }

.list-card { display: flex; flex-direction: column; gap: .7rem; padding: 1rem 1.1rem; border-radius: 10px; border: 1px solid rgba(0,212,255,.18); background: linear-gradient(150deg, rgba(10,17,42,.72), rgba(5,8,22,.62)); }

.toolbar { display: flex; align-items: center; justify-content: space-between; gap: .6rem; flex-wrap: wrap; }
.tool-left { display: flex; align-items: center; gap: .6rem; }
.tool-right { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
.limit-select { display: flex; align-items: center; gap: .3rem; font-size: .72rem; color: rgba(180,220,255,.6); }
.limit-select select { padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(0,212,255,.22); background: rgba(4,9,24,.9); color: #d7ecff; font-family: inherit; font-size: .72rem; }
.pager-info { font-size: .68rem; color: rgba(180,220,255,.55); font-family: 'SF Mono',monospace; }
.page-num { font-size: .7rem; color: var(--tech-cyan); min-width: 48px; text-align: center; font-family: 'SF Mono',monospace; }

.ghost-btn { padding: .3rem .7rem; border-radius: 6px; border: 1px solid rgba(0,212,255,.3); background: rgba(0,212,255,.08); color: var(--tech-cyan); font-size: .72rem; font-family: inherit; transition: all .2s ease; }
.ghost-btn:hover:not(:disabled) { background: rgba(0,212,255,.18); border-color: var(--tech-cyan); }
.ghost-btn:disabled { opacity: .4; cursor: not-allowed; }
.danger { color: #ff8fa3; border-color: rgba(255,93,122,.35); background: rgba(255,93,122,.06); }
.danger:hover:not(:disabled) { color: #fff; border-color: #ff8fa3; background: rgba(255,93,122,.16); }

.err-text { font-size: .74rem; color: #ff8fa3; }

.table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid rgba(0,212,255,.12); }
.record-table { width: 100%; border-collapse: collapse; font-size: .78rem; }
.record-table thead th {
  position: sticky; top: 0; z-index: 1;
  padding: .55rem .7rem; text-align: left; font-weight: 700; letter-spacing: 1px;
  font-size: .68rem; color: var(--tech-blue); background: rgba(0,212,255,.08);
  border-bottom: 1px solid rgba(0,212,255,.2); white-space: nowrap;
}
.record-table tbody td {
  padding: .5rem .7rem; border-bottom: 1px solid rgba(0,212,255,.08);
  color: #cfe8ff; vertical-align: middle;
}
.record-table tbody tr.data-row { cursor: pointer; transition: background .15s ease; }
.record-table tbody tr.data-row:hover { background: rgba(0,212,255,.08); }
.col-id { color: var(--tech-purple); font-family: 'SF Mono',monospace; font-size: .72rem; }
.col-lot { font-family: 'SF Mono',monospace; }
.col-time { font-size: .7rem; color: rgba(180,220,255,.55); font-family: 'SF Mono',monospace; white-space: nowrap; }
.col-kind { color: var(--tech-cyan); }
.col-ops { display: flex; gap: .35rem; white-space: nowrap; }
.empty-row { text-align: center; color: rgba(180,220,255,.35); padding: 2rem !important; }
.skeleton-row td { padding: .55rem .7rem; }
.skeleton-line { display: block; height: .9rem; background: linear-gradient(90deg, rgba(0,212,255,.08), rgba(0,212,255,.18), rgba(0,212,255,.08)); background-size: 200% 100%; border-radius: 4px; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ===== 详情弹窗 ===== */
.modal-mask { position: fixed; inset: 0; z-index: 999; background: rgba(2,6,18,.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.modal-card { width: min(820px, 100%); max-height: 85vh; overflow-y: auto; border-radius: 12px; border: 1px solid rgba(0,212,255,.3); background: linear-gradient(150deg, rgba(10,17,42,.95), rgba(5,8,22,.92)); box-shadow: 0 0 40px rgba(0,212,255,.15); }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: .9rem 1rem; border-bottom: 1px solid rgba(0,212,255,.15); position: sticky; top: 0; background: inherit; z-index: 1; }
.modal-head h3 { margin: 0; font-size: .95rem; color: var(--tech-cyan); letter-spacing: 1px; }
.modal-body { padding: .9rem 1rem; display: flex; flex-direction: column; gap: .9rem; }
.meta-row { display: flex; flex-wrap: wrap; gap: .5rem 1rem; font-size: .72rem; color: rgba(180,220,255,.55); }
.meta-row b { color: var(--tech-blue); margin-right: .25rem; letter-spacing: .5px; }
.payload-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: .4rem; }
.kv-item { border: 1px solid rgba(0,212,255,.12); border-radius: 6px; background: rgba(5,10,25,.45); padding: .35rem .6rem; }
.kv-key { font-size: .64rem; letter-spacing: 1px; color: var(--tech-purple); margin-bottom: 2px; }
.kv-val { font-size: .74rem; color: #cfe8ff; word-break: break-all; white-space: pre-wrap; max-height: 120px; overflow: auto; font-family: 'SF Mono',monospace; }
.json-block { border: 1px solid rgba(0,212,255,.12); border-radius: 6px; overflow: hidden; }
.json-label { padding: 3px 8px; font-size: .62rem; letter-spacing: 1.5px; color: var(--tech-blue); background: rgba(0,212,255,.07); }
.json-block pre { margin: 0; padding: .6rem .75rem; font-size: .68rem; line-height: 1.6; color: #cfe8ff; overflow-x: auto; font-family: 'SF Mono','Consolas',monospace; max-height: 200px; overflow-y: auto; }
</style>

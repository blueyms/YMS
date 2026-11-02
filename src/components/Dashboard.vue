<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface Kpi { label: string; value: string; trend: number; unit?: string }
const kpis = ref<Kpi[]>([
  { label: '晶圆良率', value: '97.82', trend: 0.42, unit: '%' },
  { label: '批次良率', value: '99.15', trend: -0.08, unit: '%' },
  { label: '缺陷密度', value: '0.36', trend: -5.12, unit: 'pcs/cm²' },
  { label: '产能利用率', value: '92.40', trend: 1.25, unit: '%' }
])

// 模拟 30 天折线图数据
const days = Array.from({ length: 30 }, (_, i) => `${i + 1}`)
let baseYield = 97
const yields = ref<number[]>(
  Array.from({ length: 30 }, () => { baseYield += (Math.random() - 0.45) * 0.8; return Math.max(93, Math.min(100, baseYield)) })
)
let baseDefect = 0.4
const defects = ref<number[]>(
  Array.from({ length: 30 }, () => { baseDefect += (Math.random() - 0.5) * 0.05; return Math.max(0.1, Math.min(0.9, baseDefect)) })
)

// 晶圆热力图数据（8 英寸晶圆，缺陷点）
interface DefectPoint { x: number; y: number; size: number }
const waferDefects = ref<DefectPoint[]>(
  Array.from({ length: 18 }, () => {
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * 48
    return { x: 50 + Math.cos(angle) * r, y: 50 + Math.sin(angle) * r, size: 2 + Math.random() * 5 }
  })
)

let refreshTimer: number | undefined

const genPath = (values: number[], min: number, max: number, w: number, h: number) => {
  const stepX = w / (values.length - 1)
  const range = max - min || 1
  return values.map((v, i) => {
    const x = i * stepX
    const y = h - ((v - min) / range) * h
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}
const genArea = (values: number[], min: number, max: number, w: number, h: number) => {
  const stepX = w / (values.length - 1)
  const range = max - min || 1
  const line = values.map((v, i) => {
    const x = i * stepX
    const y = h - ((v - min) / range) * h
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return `${line} L ${w} ${h} L 0 ${h} Z`
}

const yieldMax = 100, yieldMin = 93
const defectMax = 0.9, defectMin = 0.1
const svgW = 720, svgH = 200

const refresh = () => {
  // 滚动 + 新点
  const ny = yields.value[29] + (Math.random() - 0.45) * 0.6
  yields.value = [...yields.value.slice(1), Math.max(yieldMin, Math.min(yieldMax, ny))]
  const nd = defects.value[29] + (Math.random() - 0.5) * 0.04
  defects.value = [...defects.value.slice(1), Math.max(defectMin, Math.min(defectMax, nd))]
  // 随机移动部分缺陷点
  waferDefects.value = waferDefects.value.map(p => {
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * 48
    return { x: 50 + Math.cos(angle) * r, y: 50 + Math.sin(angle) * r, size: 2 + Math.random() * 5 }
  })
}

onMounted(() => { refreshTimer = window.setInterval(refresh, 2500) })
onBeforeUnmount(() => { if (refreshTimer) clearInterval(refreshTimer) })
</script>

<template>
  <div class="dashboard">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">实时良率仪表盘</h2>
        <p class="panel-sub">LIVE · {{ new Date().toLocaleString('zh-CN') }}</p>
      </div>
      <div class="live-dot"><span></span>LIVE</div>
    </div>

    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="kpi-card">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-trend" :class="{ up: k.trend > 0, down: k.trend < 0 }">
          {{ k.trend > 0 ? '▲' : '▼' }} {{ Math.abs(k.trend).toFixed(2) }}%
        </div>
        <div class="kpi-bar">
          <div class="kpi-bar-fill" :style="{ width: Math.abs(k.trend) * 20 + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-card">
        <div class="chart-head"><span class="chart-title">近 30 天晶圆良率趋势</span><span class="chart-legend yield">晶圆良率 (%)</span></div>
        <svg :width="svgW" :height="svgH" class="chart-svg">
          <defs>
            <linearGradient id="yieldArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="#00d4ff" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <!-- 网格 -->
          <line v-for="i in 4" :key="'g'+i" x1="0" :y1="(svgH / 4) * i" :x2="svgW" :y2="(svgH / 4) * i" stroke="rgba(0,212,255,.12)" stroke-dasharray="3 3"/>
          <!-- 面积填充 -->
          <path :d="genArea(yields, yieldMin, yieldMax, svgW, svgH)" fill="url(#yieldArea)"/>
          <!-- 折线 -->
          <path :d="genPath(yields, yieldMin, yieldMax, svgW, svgH)" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- 末点高亮 -->
          <circle :cx="svgW" :cy="svgH - ((yields[29] - yieldMin) / (yieldMax - yieldMin)) * svgH" r="4" fill="#22f7c9" class="end-dot"/>
          <!-- 基准线 -->
          <line x1="0" :y1="svgH - ((97 - yieldMin) / (yieldMax - yieldMin)) * svgH" :x2="svgW" :y2="svgH - ((97 - yieldMin) / (yieldMax - yieldMin)) * svgH" stroke="#ff8fa3" stroke-dasharray="4 4" stroke-opacity=".5"/>
        </svg>
        <div class="chart-axis">
          <span>93%</span><span>95%</span><span>97%</span><span>99%</span><span>100%</span>
        </div>
      </div>

      <div class="chart-card chart-right">
        <div class="chart-head"><span class="chart-title">近 30 天缺陷密度</span><span class="chart-legend defect">缺陷 (pcs/cm²)</span></div>
        <svg :width="svgW" :height="svgH" class="chart-svg">
          <defs>
            <linearGradient id="defectArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#7c5cff" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="#7c5cff" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <line v-for="i in 4" :key="'g2'+i" x1="0" :y1="(svgH / 4) * i" :x2="svgW" :y2="(svgH / 4) * i" stroke="rgba(124,92,255,.12)" stroke-dasharray="3 3"/>
          <path :d="genArea(defects, defectMin, defectMax, svgW, svgH)" fill="url(#defectArea)"/>
          <path :d="genPath(defects, defectMin, defectMax, svgW, svgH)" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle :cx="svgW" :cy="svgH - ((defects[29] - defectMin) / (defectMax - defectMin)) * svgH" r="4" fill="#fbbf24" class="end-dot"/>
        </svg>
        <div class="chart-axis">
          <span>0.1</span><span>0.3</span><span>0.5</span><span>0.7</span><span>0.9</span>
        </div>
      </div>
    </div>

    <div class="chart-row single">
      <div class="chart-card wafer-card">
        <div class="chart-head"><span class="chart-title">晶圆缺陷分布热力图</span><span class="chart-legend">8" Wafer · WAT-{{ days[0] }}</span></div>
        <svg viewBox="0 0 100 100" class="wafer-svg">
          <defs>
            <radialGradient id="waferBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(0,212,255,.15)"/>
              <stop offset="100%" stop-color="rgba(10,15,37,.8)"/>
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="49" fill="url(#waferBg)" stroke="#00d4ff" stroke-width=".5" stroke-opacity=".5"/>
          <g opacity=".2" stroke="#00d4ff" stroke-width=".3" fill="none">
            <line x1="1" y1="50" x2="99" y2="50"/><line x1="50" y1="1" x2="50" y2="99"/>
            <circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="15"/>
          </g>
          <g>
            <circle v-for="(p, i) in waferDefects" :key="i" :cx="p.x" :cy="p.y" :r="p.size * 0.4" fill="#f472b6" opacity=".85" class="defect-dot"/>
            <circle v-for="(p, i) in waferDefects" :key="'glow'+i" :cx="p.x" :cy="p.y" :r="p.size * 0.9" fill="#f472b6" opacity=".18"/>
          </g>
          <!-- Notch -->
          <path d="M 50 1 L 46 4 L 54 4 Z" fill="#00d4ff" opacity=".6"/>
        </svg>
        <div class="wafer-stats">
          <div><b>{{ waferDefects.length }}</b> 个缺陷点</div>
          <div><b>47%</b> 集中区</div>
          <div><b>Zone B/C</b> 高风险</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard { padding: .2rem; }
.panel-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.2rem; }
.panel-title { font-size: 1.3rem; font-weight: 700; background: linear-gradient(135deg, #00d4ff, #22f7c9); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 1px; }
.panel-sub { font-size: .72rem; letter-spacing: 2px; color: rgba(180,220,255,.55); margin-top: .3rem; }
.live-dot { display: inline-flex; align-items: center; gap: 6px; font-size: .68rem; letter-spacing: 2px; color: #22f7c9; padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(34,247,201,.4); }
.live-dot span { width: 6px; height: 6px; border-radius: 50%; background: #22f7c9; box-shadow: 0 0 6px #22f7c9; animation: blink 1s ease-in-out infinite; }
@keyframes blink { 0%,100%{opacity:1;} 50%{opacity:.3;} }

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.3rem; }
.kpi-card { position: relative; padding: 1rem 1.1rem; border-radius: 10px; border: 1px solid rgba(0,212,255,.18); background: linear-gradient(135deg, rgba(10,15,37,.75), rgba(5,8,22,.6)); overflow: hidden; transition: all .25s ease; }
.kpi-card:hover { border-color: rgba(0,212,255,.4); box-shadow: 0 0 20px rgba(0,212,255,.15); transform: translateY(-2px); }
.kpi-label { font-size: .72rem; color: rgba(180,220,255,.55); letter-spacing: 1.5px; margin-bottom: .35rem; }
.kpi-value { font-size: 1.55rem; font-weight: 700; color: #e0f2fe; font-family: 'SF Mono',monospace; letter-spacing: .5px; }
.kpi-unit { font-size: .78rem; color: rgba(180,220,255,.5); margin-left: 2px; font-weight: 400; }
.kpi-trend { font-size: .72rem; margin-top: .3rem; font-family: 'SF Mono',monospace; letter-spacing: .5px; }
.kpi-trend.up { color: #22f7c9; }
.kpi-trend.down { color: #ff8fa3; }
.kpi-bar { height: 3px; margin-top: .5rem; background: rgba(0,212,255,.1); border-radius: 2px; overflow: hidden; }
.kpi-bar-fill { height: 100%; background: linear-gradient(90deg, #00d4ff, #22f7c9); border-radius: 2px; transition: width .6s ease; }

.chart-row { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1.3rem; }
.chart-row.single { grid-template-columns: 1fr; }
.chart-card { padding: 1rem 1.1rem; border-radius: 10px; border: 1px solid rgba(0,212,255,.18); background: linear-gradient(135deg, rgba(10,15,37,.65), rgba(5,8,22,.55)); }
.chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .7rem; }
.chart-title { font-size: .82rem; font-weight: 600; color: #e0f2fe; letter-spacing: .5px; }
.chart-legend { font-size: .68rem; letter-spacing: 1px; color: rgba(180,220,255,.5); }
.chart-legend.yield { color: #00d4ff; }
.chart-legend.defect { color: #a78bfa; }
.chart-svg { width: 100%; height: auto; }
.end-dot { filter: drop-shadow(0 0 6px currentColor); }
.chart-axis { display: flex; justify-content: space-between; margin-top: .3rem; font-size: .65rem; color: rgba(180,220,255,.35); font-family: 'SF Mono',monospace; }

.wafer-card { display: grid; grid-template-columns: 300px 1fr; gap: 1.2rem; align-items: center; }
.wafer-svg { width: 300px; height: 300px; }
.defect-dot { filter: drop-shadow(0 0 3px #f472b6); }
.wafer-stats { display: flex; flex-direction: column; gap: .8rem; }
.wafer-stats > div { padding: .65rem .9rem; border-radius: 8px; background: rgba(0,212,255,.06); border-left: 2px solid #00d4ff; font-size: .8rem; color: rgba(207,224,255,.8); }
.wafer-stats b { color: #22f7c9; font-family: 'SF Mono',monospace; margin-right: 4px; }

@media (max-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .chart-row { grid-template-columns: 1fr; }
  .wafer-card { grid-template-columns: 1fr; }
}
</style>

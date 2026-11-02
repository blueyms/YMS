<script setup lang="ts">
interface ArchNode { x: number; y: number; title: string; tech: string[]; color: string; icon?: string }
interface ArchLayer { y: number; title: string; desc: string; nodes: ArchNode[] }

const layers: ArchLayer[] = [
  {
    y: 60, title: '① 前端展示层', desc: 'Vue + TypeScript · Vite',
    nodes: [
      { x: 120, y: 0, title: 'Web 控制台', tech: ['Vue 3', 'TypeScript', 'ECharts'], color: '#00d4ff' },
      { x: 360, y: 0, title: '移动端 H5', tech: ['Vant', 'PWA'], color: '#00d4ff' },
      { x: 600, y: 0, title: 'API 网关', tech: ['Swagger', 'Ocelot'], color: '#00d4ff' }
    ]
  },
  {
    y: 170, title: '② 应用服务层', desc: 'ASP.NET Core 8 · 微服务架构',
    nodes: [
      { x: 80, y: 0, title: '良率分析服务', tech: ['ASP.NET Core'], color: '#22f7c9' },
      { x: 240, y: 0, title: '缺陷追踪服务', tech: ['gRPC'], color: '#22f7c9' },
      { x: 400, y: 0, title: '报表生成服务', tech: ['Quartz'], color: '#22f7c9' },
      { x: 560, y: 0, title: '设备接入服务', tech: ['OPC UA', 'SECS/GEM'], color: '#22f7c9' },
      { x: 720, y: 0, title: '用户中心', tech: ['JWT', 'RBAC'], color: '#22f7c9' }
    ]
  },
  {
    y: 280, title: '③ 消息 & 集成层', desc: 'RabbitMQ · 数据流管道',
    nodes: [
      { x: 180, y: 0, title: 'RabbitMQ 消息队列', tech: ['Publish/Subscribe', 'RPC'], color: '#a78bfa' },
      { x: 420, y: 0, title: 'ETL 数据管道', tech: ['Airflow', 'Logstash'], color: '#a78bfa' },
      { x: 660, y: 0, title: 'Kafka Connect', tech: ['CDC', '实时同步'], color: '#a78bfa' }
    ]
  },
  {
    y: 390, title: '④ 数据存储层', desc: 'MongoDB + EF Core',
    nodes: [
      { x: 80, y: 0, title: 'MongoDB 主库', tech: ['Time Series', 'Replica'], color: '#fbbf24' },
      { x: 260, y: 0, title: 'MongoDB 读副本', tech: ['Sharding'], color: '#fbbf24' },
      { x: 440, y: 0, title: 'Elasticsearch', tech: ['全文检索'], color: '#fbbf24' },
      { x: 620, y: 0, title: 'Redis 缓存', tech: ['热数据'], color: '#fbbf24' },
      { x: 760, y: 0, title: '对象存储', tech: ['MinIO', '备份'], color: '#fbbf24' }
    ]
  },
  {
    y: 500, title: '⑤ 数据计算层', desc: 'Apache Spark 批流一体',
    nodes: [
      { x: 160, y: 0, title: 'Spark Streaming', tech: ['流式计算'], color: '#fb7185' },
      { x: 400, y: 0, title: 'Spark Batch', tech: ['ETL', '聚合'], color: '#fb7185' },
      { x: 640, y: 0, title: 'PySpark MLlib', tech: ['特征工程'], color: '#fb7185' }
    ]
  },
  {
    y: 610, title: '⑥ 机器学习层', desc: 'TensorFlow · 预测模型',
    nodes: [
      { x: 200, y: 0, title: '良率预测模型', tech: ['TensorFlow'], color: '#f472b6' },
      { x: 440, y: 0, title: '根因分析模型', tech: ['XGBoost'], color: '#f472b6' },
      { x: 680, y: 0, title: '工艺优化模型', tech: ['AutoML'], color: '#f472b6' }
    ]
  }
]
</script>

<template>
  <div class="arch">
    <div class="panel-head">
      <div>
        <h2 class="panel-title">系统技术架构</h2>
        <p class="panel-sub">YMS 整体六层架构 · 高可用微服务</p>
      </div>
      <div class="arch-stats">
        <div><b>{{ layers.reduce((s, l) => s + l.nodes.length, 0) }}</b> 节点</div>
        <div><b>{{ layers.length }}</b> 层级</div>
      </div>
    </div>

    <div class="arch-wrap">
      <svg viewBox="0 0 820 700" class="arch-svg">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(0,212,255,.4)"/>
            <stop offset="100%" stop-color="rgba(124,92,255,.1)"/>
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <!-- 层级背景 -->
        <g v-for="(layer, li) in layers" :key="'bg'+li">
          <rect :x="10" :y="layer.y - 20" width="800" height="90" rx="8" fill="rgba(0,212,255,.03)" stroke="rgba(0,212,255,.12)"/>
          <text :x="20" :y="layer.y - 3" font-size="11" fill="rgba(0,212,255,.55)" font-family="SF Mono,monospace" letter-spacing="1.5">
            {{ layer.title }}
          </text>
          <text :x="20" :y="layer.y + 13" font-size="9" fill="rgba(180,220,255,.35)" letter-spacing="1">
            {{ layer.desc }}
          </text>
        </g>

        <!-- 层间连线（简化：各层中心节点间连线） -->
        <g v-for="(layer, li) in layers.slice(0, -1)" :key="'line'+li" opacity=".4">
          <g v-for="(node, ni) in layer.nodes" :key="'line-n'+ni">
            <g v-for="nextNode in layers[li + 1].nodes" :key="'line-nn'+ni+nextNode.x">
              <line
                :x1="node.x + 20" :y1="layer.y + 50"
                :x2="nextNode.x + 20" :y2="layers[li + 1].y - 20"
                stroke="url(#lineGrad)" stroke-width=".7" stroke-dasharray="2 3"/>
            </g>
          </g>
        </g>

        <!-- 节点 -->
        <g v-for="(layer, li) in layers" :key="'layer'+li">
          <g v-for="node in layer.nodes" :key="node.x">
            <rect :x="node.x" :y="layer.y" width="120" height="50" rx="8"
                  :fill="`${node.color}18`" :stroke="`${node.color}80`" stroke-width="1.5" filter="url(#glow)"
                  class="node-box"/>
            <rect :x="node.x + 1" :y="layer.y + 1" width="118" height="4" rx="2"
                  :fill="node.color"/>
            <text :x="node.x + 60" :y="layer.y + 22" text-anchor="middle" font-size="10" font-weight="700"
                  :fill="node.color">{{ node.title }}</text>
            <text :x="node.x + 60" :y="layer.y + 38" text-anchor="middle" font-size="8"
                  fill="rgba(180,220,255,.5)" font-family="SF Mono,monospace" letter-spacing=".5">
              {{ node.tech.join(' · ') }}
            </text>
          </g>
        </g>
      </svg>
    </div>

    <div class="legend">
      <span v-for="layer in layers" :key="layer.title" class="legend-item">
        <span class="dot" :style="{ background: layer.nodes[0].color }"></span>
        <span>{{ layer.title.replace(/^[①②③④⑤⑥]\s?/, '') }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.arch { padding: .2rem; }
.panel-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem; }
.panel-title { font-size: 1.3rem; font-weight: 700; background: linear-gradient(135deg, #a78bfa, #22f7c9); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 1px; }
.panel-sub { font-size: .72rem; letter-spacing: 2px; color: rgba(180,220,255,.55); margin-top: .3rem; }
.arch-stats { display: flex; gap: 1rem; }
.arch-stats > div { font-size: .78rem; color: rgba(180,220,255,.6); letter-spacing: 1px; }
.arch-stats b { color: #22f7c9; font-family: 'SF Mono',monospace; margin-right: 3px; }

.arch-wrap { overflow-x: auto; padding: .3rem; }
.arch-svg { width: 100%; height: auto; min-width: 820px; }
.node-box { transition: all .25s ease; cursor: none; }
.node-box:hover { transform: translateY(-1px); }

.legend { display: flex; flex-wrap: wrap; gap: .6rem 1.1rem; justify-content: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0,212,255,.12); }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: .72rem; letter-spacing: 1px; color: rgba(180,220,255,.6); }
.legend-item .dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
</style>

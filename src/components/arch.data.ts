export interface ArchNode {
  x: number; y: number; title: string; tech: string[]; color: string; icon?: string
}
export interface ArchLayer {
  y: number; title: string; desc: string; nodes: ArchNode[]
}

export const layers: ArchLayer[] = [
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

/** 节点总数 */
export const TOTAL_NODES = layers.reduce((s, l) => s + l.nodes.length, 0)

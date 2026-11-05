/**
 * Dashboard 内部几何计算工具（折线/面积 path 生成）
 * 抽离以便单元测试覆盖边界分支（max===min 的 fallback）
 */
export const genPath = (values: number[], min: number, max: number, w: number, h: number): string => {
  const stepX = w / (values.length - 1)
  const range = max - min || 1
  return values.map((v, i) => {
    const x = i * stepX
    const y = h - ((v - min) / range) * h
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

export const genArea = (values: number[], min: number, max: number, w: number, h: number): string => {
  const stepX = w / (values.length - 1)
  const range = max - min || 1
  const line = values.map((v, i) => {
    const x = i * stepX
    const y = h - ((v - min) / range) * h
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return `${line} L ${w} ${h} L 0 ${h} Z`
}

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Dashboard from './Dashboard.vue'

describe('Dashboard.vue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders dashboard title & LIVE indicator', () => {
    const wrap = mount(Dashboard)
    expect(wrap.text()).toContain('实时良率仪表盘')
    expect(wrap.text()).toContain('LIVE')
    expect(wrap.find('.panel-title').exists()).toBe(true)
  })

  it('renders 4 KPI cards with expected labels', () => {
    const wrap = mount(Dashboard)
    const labels = wrap.findAll('.kpi-label').map(el => el.text())
    expect(labels).toEqual(expect.arrayContaining([
      '晶圆良率', '批次良率', '缺陷密度', '产能利用率'
    ]))
    expect(wrap.findAll('.kpi-card').length).toBe(4)
  })

  it('renders trend arrows on each KPI card', () => {
    const wrap = mount(Dashboard)
    const trends = wrap.findAll('.kpi-trend')
    expect(trends.length).toBe(4)
    trends.forEach(t => {
      expect(['▲', '▼']).toContain(t.text().charAt(0))
    })
  })

  it('renders SVG charts: yield trend, defect density, wafer heatmap', () => {
    const wrap = mount(Dashboard)
    const svgs = wrap.findAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(3)
    // 折线图 path 存在
    const paths = wrap.findAll('svg path')
    expect(paths.some(p => p.attributes('stroke') === '#00d4ff')).toBe(true)
    expect(paths.some(p => p.attributes('stroke') === '#a78bfa')).toBe(true)
    // 晶圆热力图 circle 数量 ≈ waferDefects（18 个点 + 18 个 glow = 36）
    const circles = wrap.findAll('svg circle')
    expect(circles.length).toBeGreaterThanOrEqual(30)
  })

  it('renders chart axis & legend text', () => {
    const wrap = mount(Dashboard)
    expect(wrap.text()).toContain('近 30 天晶圆良率趋势')
    expect(wrap.text()).toContain('近 30 天缺陷密度')
    expect(wrap.text()).toContain('晶圆缺陷分布热力图')
  })

  it('refreshes data every 2500ms via setInterval', async () => {
    const wrap = mount(Dashboard)
    // 读取 setup 里的 yields ref 通过 DOM 属性间接观察 — 取折线最后一个 y 位置
    const svg = wrap.findAll('svg')[0]
    const initialD = svg.find('path[stroke="#00d4ff"]').attributes('d')
    vi.advanceTimersByTime(2500)
    await vi.waitFor(() => {
      const newD = wrap.findAll('svg')[0].find('path[stroke="#00d4ff"]').attributes('d')
      expect(newD).not.toBe(initialD)
    })
  })

  it('clears interval on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval')
    const wrap = mount(Dashboard)
    vi.advanceTimersByTime(10000) // 跑几轮，确保 setInterval 被触发
    wrap.unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('does NOT call clearInterval when refreshTimer is falsy (defensive branch)', () => {
    // 覆盖 if(refreshTimer) 的 false 分支：setInterval 返回 0 / falsy
    const setSpy = vi.spyOn(window, 'setInterval').mockImplementation(() => 0 as unknown as ReturnType<typeof setInterval>)
    const clearSpy = vi.spyOn(window, 'clearInterval')
    const wrap = mount(Dashboard) // onMounted 执行，refreshTimer = 0（falsy）
    wrap.unmount()                // onBeforeUnmount 执行，if(0) → false，clearInterval 不应被调
    expect(clearSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    clearSpy.mockRestore()
  })

  it('KPI values are formatted as percentages/unit strings', () => {
    const wrap = mount(Dashboard)
    const values = wrap.findAll('.kpi-value').map(el => el.text())
    values.forEach(v => {
      expect(v).toMatch(/^\d+\.\d{2}(%|pcs\/cm²)?$/)
    })
  })
})

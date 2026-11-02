import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Architecture from './Architecture.vue'
import { layers, TOTAL_NODES } from './arch.data'

describe('Architecture.vue', () => {
  it('renders architecture title', () => {
    const wrap = mount(Architecture)
    expect(wrap.text()).toContain('系统技术架构')
    expect(wrap.text()).toContain('YMS 整体六层架构')
  })

  it('renders 6 architecture layer titles', () => {
    const wrap = mount(Architecture)
    const layerTitles = layers.map(l => l.title)
    layerTitles.forEach(t => { expect(wrap.text()).toContain(t) })
  })

  it('renders correct total node count', () => {
    const wrap = mount(Architecture)
    const nodeBoxes = wrap.findAll('.node-box')
    expect(nodeBoxes.length).toBe(TOTAL_NODES)
    expect(nodeBoxes.length).toBe(layers.reduce((s, l) => s + l.nodes.length, 0))
  })

  it('SVG viewBox is 820 x 700', () => {
    const wrap = mount(Architecture)
    expect(wrap.find('svg').attributes('viewBox')).toBe('0 0 820 700')
  })

  it('renders layer stats summary numbers', () => {
    const wrap = mount(Architecture)
    expect(wrap.text()).toContain(`${TOTAL_NODES} 节点`)
    expect(wrap.text()).toContain(`${layers.length} 层级`)
  })

  it('renders 6 legend items with distinct colors', () => {
    const wrap = mount(Architecture)
    const legends = wrap.findAll('.legend-item')
    expect(legends.length).toBe(layers.length)
    const colors = legends.map(l => l.find('.dot').attributes('style')).filter(Boolean)
    expect(new Set(colors).size).toBeGreaterThanOrEqual(4)
  })

  it('renders known tech titles', () => {
    const wrap = mount(Architecture)
    ;['Vue 3', 'ASP.NET Core', 'MongoDB', 'RabbitMQ', 'Spark', 'TensorFlow'].forEach(t => {
      expect(wrap.text()).toContain(t)
    })
  })

  it('renders glow filter and line gradient definitions', () => {
    const wrap = mount(Architecture)
    expect(wrap.find('filter#glow').exists()).toBe(true)
    expect(wrap.find('linearGradient#lineGrad').exists()).toBe(true)
  })

  it('renders 6 background rects for each layer', () => {
    const wrap = mount(Architecture)
    const layerBgRects = wrap.findAll('svg > g > rect').filter(r => !r.classes().includes('node-box'))
    expect(layerBgRects.length).toBe(layers.length)
  })
})

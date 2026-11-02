import { describe, it, expect } from 'vitest'
import { genPath, genArea } from './dashboard.math'

describe('dashboard.math.genPath', () => {
  it('generates M/L path tokens for normal values', () => {
    const d = genPath([1, 2, 3, 4], 0, 10, 100, 50)
    expect(d.startsWith('M')).toBe(true)
    expect(d.split(' ').filter(t => t === 'M').length).toBe(1)
    expect(d.split(' ').filter(t => t === 'L').length).toBe(3)
  })

  it('falls back to range=1 when max===min (defensive branch)', () => {
    // 覆盖 Dashboard.vue L37: const range = max - min || 1
    const d = genPath([5, 5, 5], 5, 5, 100, 50)
    expect(d.startsWith('M')).toBe(true)
    // 所有点 y 坐标都应该等于 h（值等于 min=max）
    const coords = d.replace(/[ML]\s/g, '').trim().split(/\s+/)
    for (let i = 1; i < coords.length; i += 2) {
      expect(parseFloat(coords[i])).toBeCloseTo(50, 1)
    }
  })

  it('handles single-element input gracefully', () => {
    const d = genPath([1], 0, 10, 100, 50)
    expect(d.startsWith('M')).toBe(true)
    expect(d).not.toContain('L')
  })

  it('uses 2-decimal precision via toFixed(1)', () => {
    const d = genPath([0.123, 0.456], 0, 1, 100, 50)
    // toFixed(1) 把值四舍五入到 1 位小数
    expect(d).toMatch(/\d+\.\d/)
  })
})

describe('dashboard.math.genArea', () => {
  it('returns closed path with L w h L 0 h Z suffix', () => {
    const d = genArea([1, 2, 3], 0, 10, 100, 50)
    expect(d.endsWith('Z')).toBe(true)
    expect(d).toContain('L 100 50')
    expect(d).toContain('L 0 50')
  })

  it('falls back to range=1 when max===min (defensive branch)', () => {
    // 覆盖 Dashboard.vue L46: const range = max - min || 1
    const d = genArea([3, 3, 3], 3, 3, 80, 40)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })
})

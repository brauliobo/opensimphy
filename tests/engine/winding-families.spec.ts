import { rankWindings } from '../../src/quantum-registers/windingFamilies'

describe('other windings', () => {
  it('keeps Hans zp+1 on θ as the only 10⁻¹¹-class hit among the scanned families', () => {
    const ranked = rankWindings()
    const hans = ranked.find((hit) => hit.family === 'hans')
    const close = ranked.filter((hit) => hit.relativeError < 1e-11)
    expect(hans).toBeDefined()
    expect(hans!.relativeError).toBeLessThan(1e-11)
    expect(close).toHaveLength(1)
    expect(close[0]!.id).toBe(hans!.id)
    const cover2 = ranked.find((hit) => hit.id === '2sin²(2θ)')
    const zp2 = ranked.find((hit) => hit.id === 'zp2+2sin²(θ)')
    expect(cover2!.relativeError).toBeGreaterThan(hans!.relativeError)
    expect(zp2!.relativeError).toBeGreaterThan(1e-3)
  })
})

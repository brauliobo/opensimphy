import { runHistoryChain, shiftIn } from '../../src/quantum-registers/historyChainSim'
import { popcount } from '../../src/quantum-registers/quantumRegisterEngine'

describe('history-chained majority Markov', () => {
  it('feeds the majority bit back into the 137-window and locks to the start majority', () => {
    const ones = runHistoryChain({ width: 137, ticks: 200, seed: 1, rule: 'majority', start: (1n << 69n) - 1n })
    const zeros = runHistoryChain({ width: 137, ticks: 200, seed: 1, rule: 'majority', start: (1n << 68n) - 1n })
    const frozen = runHistoryChain({ width: 137, ticks: 8, seed: 1, rule: 'majority', start: (1n << 137n) - 1n })

    expect(ones.absorbed).toBe(1)
    expect(ones.absorbed).toBe(ones.startMajority)
    expect(zeros.absorbed).toBe(0)
    expect(zeros.absorbed).toBe(zeros.startMajority)
    expect(frozen.absorbed).toBe(1)
    expect(frozen.absorbTime).toBe(0)
    expect(popcount(shiftIn((1n << 69n) - 1n, 137, 1))).toBe(70)
  })

  it('keeps all-zero absorbing under the magnetization Markov rule', () => {
    const result = runHistoryChain({ width: 137, ticks: 40, seed: 3, rule: 'markov', start: 0n })
    expect(result.absorbed).toBe(0)
    expect(result.finalOnes).toBe(0)
  })

  it('absorbs a one-hot history to all-zero under majority feedback', () => {
    const result = runHistoryChain({ width: 137, ticks: 200, seed: 1, rule: 'majority', start: 1n })
    expect(result.startMajority).toBe(0)
    expect(result.absorbed).toBe(0)
  })
})

import { awesomeBenchmarkCases } from '../../src/awesomePhysics/benchmark/registry'
import { runAwesomeBenchmarkHarness } from '../../src/awesomePhysics/benchmark/harness'
import { AWESOME_PHYSICS_ADAPTER_IDS } from '../../src/awesomePhysics/adapterFactories'

describe('Awesome Physics benchmark harness', () => {
  it('registers every catalog descriptor plus the Gray motor mount', () => {
    const cases = awesomeBenchmarkCases()
    expect(cases.some(({ caseId }) => caseId === 'gray-motor')).toBe(true)
    expect(cases.filter(({ family }) => family === 'awesome-physics').length).toBeGreaterThanOrEqual(76)
    const runnable = cases.filter(({ runnable }) => runnable)
    expect(runnable.some(({ adapterId }) => adapterId === AWESOME_PHYSICS_ADAPTER_IDS.nphysics2d)).toBe(true)
    expect(runnable.some(({ adapterId }) => adapterId === AWESOME_PHYSICS_ADAPTER_IDS.quantumPythonLectures)).toBe(true)
    expect(runnable.some(({ adapterId }) => adapterId === AWESOME_PHYSICS_ADAPTER_IDS.cantera)).toBe(true)
  })

  it('keeps planned Pyodide and wasm-candidate slots from becoming fake Run adapters', () => {
    const cases = awesomeBenchmarkCases()
    const names = ['simbody']
    for (const name of names) {
      const match = cases.find((entry) => entry.title === name || entry.catalogItemId === `awesome-${name}` || entry.caseId.includes(name))
      expect(match, name).toBeTruthy()
      expect(match?.runnable).toBe(false)
      expect(match?.adapterId).toBeNull()
    }
  })

  it('runs host kernels for available non-WASM cases', async () => {
    const available = awesomeBenchmarkCases().filter(({ runnable, execution }) => runnable && execution !== 'wasm' && execution !== 'gray-motor')
    const report = await runAwesomeBenchmarkHarness({
      caseIds: available.map(({ caseId }) => caseId),
    })
    expect(report.summary.failed).toBe(0)
    expect(report.results.filter(({ status }) => status === 'pass').length).toBeGreaterThan(0)
  }, 60_000)
})

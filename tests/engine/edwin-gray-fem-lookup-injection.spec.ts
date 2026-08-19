import {
  evaluateGrayFullMotor,
} from '../../src/edwin-gray/edwinGrayEngine'
import {
  parseGrayFemLookupDocument,
} from '../../src/edwin-gray/edwinGrayFem'
import type { GrayWorkerRequest, GrayWorkerResponse } from '../../src/edwin-gray/edwinGrayWorkerProtocol'
import { GRAY_PATENT_MACHINE_ID } from '../../src/edwin-gray/edwinGrayMachines'
import { grayProductionLutBlocked } from '../../src/edwin-gray/edwinGrayProductionLut'
import {
  createGraySubmittedInput,
  defaultGrayWorkbenchInput,
  grayFullMotorInput,
} from '../../src/edwin-gray/edwinGrayWorkbench'
import {
  compatibleGrayMagneticLookup,
  productionGrayFemLutPresent,
  productionGrayMagneticLookup,
  readProductionGrayFemLutDocument,
} from '../helpers/edwinGrayFemLookup'

const lutPresent = productionGrayFemLutPresent()

describe('Edwin Gray fem-lookup injection', () => {
  it('refuses fem-lookup construction when no lookup is supplied', () => {
    const state = { ...defaultGrayWorkbenchInput(GRAY_PATENT_MACHINE_ID), magneticModel: 'fem-lookup' as const }
    expect(() => grayFullMotorInput(state)).toThrow(/compatible ready FEM lookup/)
  })

  it('runs the worker input path with magneticModel fem-lookup from a compatible lookup', () => {
    const lookup = compatibleGrayMagneticLookup()
    const submitted = createGraySubmittedInput({
      ...defaultGrayWorkbenchInput(GRAY_PATENT_MACHINE_ID),
      magneticModel: 'fem-lookup',
    }, lookup)
    const result = evaluateGrayFullMotor(submitted.engineInput)
    expect(lookup.source).toBe('fem-lookup')
    expect(submitted.engineInput.magneticLookup?.source).toBe('fem-lookup')
    expect(result.magneticScope).toBe('hybrid-fem-magnetic-lumped-circuit')
    expect(result.ledger.claimDeficitInjectedJ).toBe(0)
    expect(result.ledger.wholeSystemCop).toBeLessThanOrEqual(1)
    expect(result.validatesTheory).toBe(false)
  })

  it('completes a dedicated worker run with magneticModel fem-lookup', async () => {
    vi.resetModules()
    const postMessage = vi.fn()
    let messageListener: ((event: MessageEvent<GrayWorkerRequest>) => void) | undefined
    vi.stubGlobal('self', {
      addEventListener(type: string, listener: (event: MessageEvent<GrayWorkerRequest>) => void) {
        if (type === 'message') messageListener = listener
      },
      postMessage,
    })
    await import('../../src/workers/edwinGray.worker')
    const lookup = compatibleGrayMagneticLookup()
    const input = createGraySubmittedInput({
      ...defaultGrayWorkbenchInput(GRAY_PATENT_MACHINE_ID),
      magneticModel: 'fem-lookup',
    }, lookup).engineInput
    messageListener!({ data: { type: 'run', requestId: 'fem-lookup', inputIdentity: 'fem-lookup', input } } as MessageEvent<GrayWorkerRequest>)
    const completed = postMessage.mock.calls.map(([response]) => response as GrayWorkerResponse).at(-1)
    expect(completed).toMatchObject({ type: 'completed', requestId: 'fem-lookup', progress: 1 })
    if (completed?.type !== 'completed') throw new Error('worker did not complete')
    expect(completed.result.magneticScope).toBe('hybrid-fem-magnetic-lumped-circuit')
    expect(completed.result.ledger.claimDeficitInjectedJ).toBe(0)
    expect(completed.result.ledger.wholeSystemCop).toBeLessThanOrEqual(1)
    vi.unstubAllGlobals()
  })

  it.skipIf(lutPresent)('stays fail-closed when the production LUT file is absent', () => {
    expect(grayProductionLutBlocked()).toBe(true)
    expect(() => readProductionGrayFemLutDocument()).toThrow(/ENOENT|no such file/i)
  })

  it.skipIf(!lutPresent)('uses the published GetDP LUT as magneticModel fem-lookup without claim energy', () => {
    const document = parseGrayFemLookupDocument(readProductionGrayFemLutDocument())
    expect(document.lutContract).toBe('motor-fem-lut-v1')
    expect(document.status).toBe('complete')
    expect(document.provenance.synthetic).toBe(false)
    expect(document.entries.every((entry) => entry.provenance.synthetic === false)).toBe(true)
    expect(document.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.provenance.jobInputHash))).toBe(true)
    const lookup = productionGrayMagneticLookup()
    expect(lookup.source).toBe('fem-lookup')
    const submitted = createGraySubmittedInput({
      ...defaultGrayWorkbenchInput(GRAY_PATENT_MACHINE_ID),
      magneticModel: 'fem-lookup',
    }, lookup)
    const result = evaluateGrayFullMotor(submitted.engineInput)
    expect(submitted.workbenchInput.magneticModel).toBe('fem-lookup')
    expect(result.magneticScope).toBe('hybrid-fem-magnetic-lumped-circuit')
    expect(result.ledger.claimDeficitInjectedJ).toBe(0)
    expect(result.ledger.wholeSystemCop).toBeLessThanOrEqual(1)
    expect(result.ledger.wholeSystemCop).toBe(result.ledger.wholeSystemEfficiency)
    expect(result.validatesTheory).toBe(false)
  })
})

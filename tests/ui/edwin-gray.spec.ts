import { mount } from '@vue/test-utils'
import CircuitInstrument from '../../src/components/edwin-gray/CircuitInstrument.vue'
import EnergyLedgerInstrument from '../../src/components/edwin-gray/EnergyLedgerInstrument.vue'
import FamilyInstrument from '../../src/components/edwin-gray/FamilyInstrument.vue'
import GeometryInstrument from '../../src/components/edwin-gray/GeometryInstrument.vue'
import PulseCycleInstrument from '../../src/components/edwin-gray/PulseCycleInstrument.vue'
import {
  evaluateGrayCopClaim,
  evaluateGrayFullMotor,
  GRAY_COP_CLAIM_SCENARIOS,
  GRAY_PRESETS,
} from '../../src/edwin-gray/edwinGrayEngine'
import { GRAY_PATENT_MACHINE_ID } from '../../src/edwin-gray/edwinGrayMachines'
import { freezeGrayFullMotorResult, freezeGrayValue } from '../../src/edwin-gray/edwinGrayWorkbench'

const result = freezeGrayFullMotorResult(evaluateGrayFullMotor({
  ...GRAY_PRESETS.purple,
  revolutions: 1,
  mode: 'dynamic',
  machineMode: 'original-500rpm-contact-v1',
  rotorInertiaKgM2: 0.01,
  loadTorqueNm: 0.01,
}))
const claimEvidence = freezeGrayValue({
  diagramCop282: evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.diagramCop282),
  retainedTranscriptCop282: null,
  retainedTranscriptCop300: evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.transcriptCop300),
})
const patentResult = freezeGrayFullMotorResult(evaluateGrayFullMotor({
  ...GRAY_PRESETS['patent-illustrative'],
  machineContractId: GRAY_PATENT_MACHINE_ID,
  revolutions: 1,
  mode: 'dynamic',
  machineMode: 'original-500rpm-contact-v1',
  rotorInertiaKgM2: 0.01,
  loadTorqueNm: 0.01,
}))

describe('unified Edwin Gray result instruments', () => {
  it('uses one immutable event for geometry and circuit state', () => {
    const geometry = mount(GeometryInstrument, {
      props: { depth: 'guided', result, activeEventIndex: 2 },
    })
    const circuit = mount(CircuitInstrument, {
      props: { depth: 'guided', result, activeEventIndex: 2 },
    })

    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.events[2])).toBe(true)
    expect(geometry.get('[data-testid="gray-geometry-status"]').text()).toContain('event 3')
    expect(geometry.get('[data-testid="gray-rotor"]').attributes('transform')).toContain(
      String(result.events[2]!.scheduledAbsoluteAngleDeg),
    )
    expect(geometry.get('[data-testid="gray-active-sectors"] tbody').findAll('tr')).toHaveLength(3)
    expect(circuit.get('[data-testid="gray-circuit-table"]').text()).toContain(
      result.events[2]!.before.holdingCapacitorJ.toExponential(3),
    )
  })

  it('renders raw event, mechanical, and run-ledger tables from the same result', () => {
    const pulse = mount(PulseCycleInstrument, {
      props: { depth: 'technical', result, activeEventIndex: 0 },
    })
    const energy = mount(EnergyLedgerInstrument, {
      props: { depth: 'technical', result, claimEvidence },
    })

    expect(pulse.get('[data-testid="gray-event-timeline"] tbody').findAll('tr')).toHaveLength(result.completedEventCount)
    expect(pulse.get('[data-testid="gray-mechanical-table"]').text()).toContain(result.finalRpm.toFixed(3))
    expect(energy.get('[data-testid="gray-run-ledger"]').text()).toContain(result.ledger.totalLossesJ.toExponential(4))
    expect(energy.get('[data-testid="gray-system-cop"]').text()).toBe(result.ledger.wholeSystemCop.toFixed(6))
    expect(energy.get('[data-testid="gray-claim-reproduction"]').text()).toContain('explicitly separate')
    expect(energy.get('[data-testid="gray-retained-cop-evidence"]').text()).toContain('COP 282Absent')
    expect(Object.isFrozen(claimEvidence.diagramCop282.conservationClosure)).toBe(true)
  })

  it('keeps guided content and adds technical disclosure without evaluating family rows', () => {
    const guided = mount(FamilyInstrument, { props: { depth: 'guided', result } })
    const technical = mount(FamilyInstrument, { props: { depth: 'technical', result } })

    expect(guided.get('tbody').findAll('tr')).toHaveLength(6)
    expect(guided.get('[data-motor="purple"]').text()).toContain(`${result.completedEventCount} worker events`)
    expect(guided.get('[data-motor="gold"]').text()).toContain('not evaluated')
    expect(guided.find('.gray-technical').exists()).toBe(false)
    expect(technical.get('.gray-technical').text()).toContain(result.provenance.eventSchedule)
    expect(technical.get('[data-testid="gray-structured-findings"]').text()).toContain('validatesTheory: false')
  })

  it('shows a selected patent result separately from the six prototype rows', () => {
    const family = mount(FamilyInstrument, { props: { depth: 'guided', result: patentResult } })

    expect(family.get('tbody').findAll('tr')).toHaveLength(6)
    expect(family.get('tbody').text()).not.toContain(`${patentResult.completedEventCount} worker events`)
    expect(family.get('[data-testid="gray-patent-selected-result"]').text()).toContain(
      `Contract ${GRAY_PATENT_MACHINE_ID} completed ${patentResult.completedEventCount} worker events`,
    )
    expect(family.get('[data-testid="gray-patent-selected-result"]').text()).toContain('not a prototype replica or a seventh prototype')
  })
})

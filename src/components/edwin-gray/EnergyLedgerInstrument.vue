<script setup lang="ts">
import {
  evaluateGrayCopClaim,
  GRAY_COP_CLAIM_SCENARIOS,
  type GrayFullMotorResult,
} from '../../edwin-gray/edwinGrayEngine'
import type { ReadingDepth } from '../../types/tour'

defineProps<{ depth: ReadingDepth; result: Readonly<GrayFullMotorResult> }>()
const claimAudit = evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.diagramCop282)
const observedDeficitW = claimAudit.conservationClosure.observedOutput?.requiredUnaccountedPowerW ?? 0
const formatJ = (value: number): string => `${value.toExponential(4)} J`
</script>

<template lang="pug">
article.quantum-instrument(data-testid="gray-energy-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 04 / complete ledger
    h3 Close the declared run boundary
    p This is the full-run ledger from the same immutable result. The historical arithmetic diagnostic remains separate below and never contributes energy.
  .quantum-result(data-testid="gray-energy-result")
    p.gray-status(role="status" aria-live="polite") {{ result.ledger.copScope }} / boundary {{ result.ledger.boundaryComplete ? 'complete' : 'incomplete' }}.
    .gray-table-scroll.gray-table-scroll--wide
      table(data-testid="gray-run-ledger")
        caption Raw full-run energy ledger
        tbody
          tr
            th(scope="row") Initial stored electrical
            td {{ formatJ(result.ledger.initialStoredElectricalJ) }}
          tr
            th(scope="row") Initial kinetic
            td {{ formatJ(result.ledger.initialKineticJ) }}
          tr
            th(scope="row") External recharge
            td {{ formatJ(result.ledger.externalRechargeJ) }}
          tr
            th(scope="row") Prescribed drive input
            td {{ formatJ(result.ledger.prescribedDriveInputJ) }}
          tr
            th(scope="row") Load work
            td {{ formatJ(result.ledger.loadWorkJ) }}
          tr
            th(scope="row") Total losses
            td {{ formatJ(result.ledger.totalLossesJ) }}
          tr
            th(scope="row") Final stored residuals
            td {{ formatJ(result.ledger.finalStoredResidualsJ) }}
          tr
            th(scope="row") Numerical residual
            td {{ formatJ(result.ledger.numericalResidualJ) }}
          tr
            th(scope="row") Whole-system COP
            td(data-testid="gray-system-cop") {{ result.ledger.wholeSystemCop.toFixed(6) }}
          tr
            th(scope="row") Claim deficit injected
            td {{ formatJ(result.ledger.claimDeficitInjectedJ) }}
    details.gray-technical(v-if="depth === 'technical'" open)
      summary Technical ledger disclosure
      p Normalized residual {{ result.ledger.normalizedResidual.toExponential(4) }}. Electromagnetic work {{ formatJ(result.ledger.electromagneticWorkJ) }}; kinetic change {{ formatJ(result.ledger.kineticEnergyChangeJ) }}.

  section.gray-claim-panel(aria-labelledby="gray-claim-title" data-testid="gray-claim-reproduction")
    .gray-claim-panel__heading
      p.quantum-kicker Fallback diagnostic / explicitly separate
      h4#gray-claim-title Historical diagram arithmetic, not motor output
      p This fallback reproduces attributed values only. It is not the worker result, is not labeled FEM, and does not validate the theory.
    dl.gray-claim-metrics
      div
        dt Diagram values
        dd 26.8 W in / 7,460 W out / displayed COP 282
      div
        dt Arithmetic COP
        dd(data-testid="gray-claim-arithmetic-cop") {{ claimAudit.claim.arithmeticCop?.toFixed(2) }}
      div
        dt Required unaccounted power
        dd(data-testid="gray-claim-deficit") {{ observedDeficitW.toFixed(1) }} W
    p.gray-claim-panel__boundary validatesTheory: {{ claimAudit.validatesTheory }}. This diagnostic is preserved only as an attributed source-claim boundary check.
</template>

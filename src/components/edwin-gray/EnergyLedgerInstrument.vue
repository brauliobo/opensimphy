<script setup lang="ts">
import {
  type GrayCopClaimEvaluation,
  type GrayFullMotorResult,
  type GrayPresenterConverterChainEvaluation,
} from '../../edwin-gray/edwinGrayEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{
  depth: ReadingDepth
  result: Readonly<GrayFullMotorResult>
  claimEvidence: Readonly<{
    diagramCop282: Readonly<GrayCopClaimEvaluation>
    retainedTranscriptCop282: null
    retainedTranscriptCop300: Readonly<GrayCopClaimEvaluation>
    whisperCop280: Readonly<GrayCopClaimEvaluation>
    converterChain: Readonly<GrayPresenterConverterChainEvaluation>
  }>
}>()
const observedDeficitW = props.claimEvidence.diagramCop282.conservationClosure.observedOutput?.requiredUnaccountedPowerW ?? 0
const whisperDeficitW = props.claimEvidence.whisperCop280.conservationClosure.observedOutput?.requiredUnaccountedPowerW ?? 0
const presenterMeter = props.result.ledger.measurementBoundaries.presenterMeter
const recoveryMakeup = props.result.ledger.measurementBoundaries.recoveryMakeup
const converterChain = props.claimEvidence.converterChain
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

  section.gray-claim-panel(aria-labelledby="gray-cop-discovery-title" data-testid="gray-cop-discovery")
    .gray-claim-panel__heading
      p.quantum-kicker Measurement boundary / attributed vs run
      h4#gray-cop-discovery-title Why ~280 appears
      p Crosby's front-end meter counted 26.8 W into a converter, not electrical-out vs electrical-in. The 7.5 kW is torque/force on a classical generator. Battery recovery and the 30 A / 12 V top-off sit outside that meter, so apparent COP is 7.5 kW / 26.8 W.
    dl.gray-claim-metrics
      div
        dt Presenter meter COP
        dd(data-testid="gray-presenter-meter-cop") {{ presenterMeter.apparentCop.toFixed(2) }}
      div
        dt Recovery-makeup COP
        dd(data-testid="gray-recovery-makeup-cop") {{ recoveryMakeup.recoveryMakeupCop.toFixed(6) }}
      div
        dt Whole-system COP
        dd {{ result.ledger.wholeSystemCop.toFixed(6) }}
    dl.gray-claim-metrics
      div
        dt Hackenberger apparent COP
        dd {{ converterChain.hackenbergerApparentCop.toFixed(2) }}
      div
        dt Top-off generator
        dd {{ converterChain.topOffGeneratorW }} W
      div
        dt Unaccounted energy
        dd {{ formatJ(converterChain.unaccountedEnergyJ) }}
    p.gray-claim-panel__boundary {{ converterChain.missingEnergyTerm }}

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
        dd(data-testid="gray-claim-arithmetic-cop") {{ claimEvidence.diagramCop282.claim.arithmeticCop?.toFixed(2) }}
      div
        dt Required unaccounted power
        dd(data-testid="gray-claim-deficit") {{ observedDeficitW.toFixed(1) }} W
    p.gray-claim-panel__boundary validatesTheory: {{ claimEvidence.diagramCop282.validatesTheory }}. This diagnostic is preserved only as an attributed source-claim boundary check.
    dl.gray-claim-metrics(data-testid="gray-retained-cop-evidence")
      div
        dt Retained transcript COP 282
        dd Absent; COP 282 is available only from the separate user-provided diagram.
      div
        dt Retained transcript COP 300
        dd {{ claimEvidence.retainedTranscriptCop300.status }}
      div
        dt Paired output
        dd {{ claimEvidence.retainedTranscriptCop300.claim.attributedOutputPowerW === null ? 'Absent' : claimEvidence.retainedTranscriptCop300.claim.attributedOutputPowerW }}

  section.gray-claim-panel(aria-labelledby="gray-whisper-cop-title" data-testid="gray-whisper-cop-claim")
    .gray-claim-panel__heading
      p.quantum-kicker Fallback diagnostic / explicitly separate
      h4#gray-whisper-cop-title Attributed Whisper arithmetic, not motor output
      p Whisper resolves auto-caption "7 12 kilowatts" to 7.5 kW out / 26.8 W in. Arithmetic COP ≈ 280 from 7.5 kW / 26.8 W. Nobody said 280 or 282. This is not motor output.
    dl.gray-claim-metrics
      div
        dt Whisper values
        dd 26.8 W in / 7.5 kW out
      div
        dt Arithmetic COP
        dd(data-testid="gray-whisper-cop-arithmetic") {{ claimEvidence.whisperCop280.claim.arithmeticCop?.toFixed(2) }}
      div
        dt Required unaccounted power
        dd(data-testid="gray-whisper-cop-deficit") {{ whisperDeficitW.toFixed(1) }} W
    p.gray-claim-panel__boundary validatesTheory: {{ claimEvidence.whisperCop280.validatesTheory }}. This diagnostic is preserved only as attributed Whisper claim arithmetic.
</template>

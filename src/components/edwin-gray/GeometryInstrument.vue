<script setup lang="ts">
import { computed } from 'vue'
import { poleAngles, type GrayFullMotorResult } from '../../edwin-gray/edwinGrayEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{
  depth: ReadingDepth
  result: Readonly<GrayFullMotorResult>
  activeEventIndex: number
}>()

const activeEvent          = computed(() => props.result.events[props.activeEventIndex] ?? props.result.events[0])
const stator               = computed(() => poleAngles(props.result.motor.statorPoles))
const rotor                = computed(() => poleAngles(props.result.motor.rotorPoles))
const topology             = computed(() => props.result.topology)
const sectors              = computed(() => activeEvent.value?.sectors ?? [])
const patentStator         = computed(() => stationDegs(topology.value.statorPairStations, topology.value.statorAngularPitchDeg))
const patentRotor          = computed(() => stationDegs(topology.value.rotorPairStations, topology.value.rotorAngularPitchDeg))
const patentMarks          = computed(() => patentStator.value.flatMap((deg) => [deg, deg + topology.value.majorMinorOffsetDeg]))
const activeStatorStations = computed(() => new Set(sectors.value.map((sector) => sector.statorPairStation)))
const activeRotorStations  = computed(() => new Set(sectors.value.map((sector) => sector.rotorPairStation)))
const rotorAngle           = computed(() => activeEvent.value?.scheduledAbsoluteAngleDeg ?? props.result.finalAngleDeg)
const rotorTransform       = computed(() => `rotate(${rotorAngle.value} 360 160)`)

function stationDegs(count: number, pitchDeg: number): number[] {
  return Array.from({ length: count }, (_, index) => index * pitchDeg)
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function polePath(deg: number, inner: number, outer: number, halfWidth: number): string {
  const left     = polar(360, 160, inner, deg - halfWidth)
  const right    = polar(360, 160, inner, deg + halfWidth)
  const farRight = polar(360, 160, outer, deg + halfWidth)
  const farLeft  = polar(360, 160, outer, deg - halfWidth)
  return `M ${left.x} ${left.y} L ${right.x} ${right.y} L ${farRight.x} ${farRight.y} L ${farLeft.x} ${farLeft.y} Z`
}

function radialTick(deg: number, inner: number, outer: number): string {
  const start = polar(360, 160, inner, deg)
  const end   = polar(360, 160, outer, deg)
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
}
</script>

<template lang="pug">
article.quantum-instrument(data-testid="gray-geometry-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 01 / geometry
    h3 One rotor state, shared by every panel
    p The selected machine contract and canonical event index drive this cross-section. Geometry does not run a second model.
  .quantum-result(data-testid="gray-geometry-result")
    p.gray-status(data-testid="gray-geometry-status") Contract {{ result.input.machineContractId }} / {{ result.motor.label }} selected runtime profile / event {{ (activeEvent?.eventIndex ?? 0) + 1 }} / {{ result.motor.statorPoles }} stator and {{ result.motor.rotorPoles }} rotor pole sets.
    .gray-geometry-stages
      svg(viewBox="0 0 720 320" role="img" :aria-label="`${result.motor.label} rotor at ${activeEvent?.scheduledAbsoluteAngleDeg ?? 0} degrees`" data-testid="gray-rotor-stage")
        circle(cx="360" cy="160" r="148" fill="none" stroke="currentColor")
        circle(cx="360" cy="160" r="78" fill="none" stroke="currentColor" opacity="0.45")
        path.gray-stator(v-for="deg in stator" :key="`s${deg}`" :d="polePath(deg, 118, 148, 14)")
        path.gray-recovery(v-if="result.motor.hasRecovery" v-for="deg in stator" :key="`r${deg}`" :d="polePath(deg, 148, 168, 18)")
        g(:transform="rotorTransform" data-testid="gray-rotor")
          path.gray-rotor(v-for="deg in rotor" :key="`o${deg}`" :d="polePath(deg, 52, 78, 12)")
        text(x="24" y="28" fill="currentColor" font-size="14") {{ result.motor.label }}
        text(x="24" y="50" fill="currentColor" font-size="12") {{ rotorAngle.toFixed(2) }} deg
      svg(viewBox="0 0 720 320" role="img" :aria-label="`${topology.statorPairStations} stator pair stations and ${topology.rotorPairStations} rotor pair stations, event ${(activeEvent?.eventIndex ?? 0) + 1}`" data-testid="gray-patent-stage")
        circle(cx="360" cy="160" r="148" fill="none" stroke="currentColor")
        circle(cx="360" cy="160" r="78" fill="none" stroke="currentColor" opacity="0.45")
        path.gray-patent-stator(
          v-for="(deg, index) in patentStator"
          :key="`ps${index}`"
          :class="{ 'gray-station-active': activeStatorStations.has(index) }"
          :data-active="activeStatorStations.has(index) ? 'true' : undefined"
          :data-station="index"
          data-testid="gray-patent-stator"
          :d="polePath(deg, 118, 148, 10)"
        )
        path(
          v-for="deg in patentMarks"
          :key="`pm${deg}`"
          fill="none"
          stroke="#c9b8ff"
          opacity="0.45"
          :d="radialTick(deg, 110, 148)"
        )
        g(v-if="result.motor.hasRecovery")
          path.gray-recovery(v-for="deg in patentStator" :key="`prc${deg}`" :d="polePath(deg, 148, 168, 14)")
        g(:transform="rotorTransform" data-testid="gray-patent-rotor")
          path.gray-patent-rotor(
            v-for="(deg, index) in patentRotor"
            :key="`pr${index}`"
            :class="{ 'gray-station-active': activeRotorStations.has(index) }"
            :data-active="activeRotorStations.has(index) ? 'true' : undefined"
            :data-station="index"
            data-testid="gray-patent-rotor-station"
            :d="polePath(deg, 52, 78, 14)"
          )
        text(x="24" y="28" fill="currentColor" font-size="14") {{ topology.statorPairStations }}×{{ topology.rotorPairStations }} pair stations
        text(x="24" y="50" fill="currentColor" font-size="12") event {{ (activeEvent?.eventIndex ?? 0) + 1 }} / {{ rotorAngle.toFixed(2) }} deg
    p.gray-status(data-testid="gray-patent-status") {{ topology.statorPairStations }} stator pair stations / {{ topology.rotorPairStations }} rotor pair stations / event {{ (activeEvent?.eventIndex ?? 0) + 1 }}.
    section.gray-topology-panel(data-testid="gray-patent-topology" aria-labelledby="gray-patent-topology-title")
      h4#gray-patent-topology-title Canonical topology
      p {{ result.topology.statorPairStations }} stator pair stations / {{ result.topology.rotorPairStations }} rotor pair stations / {{ result.topology.dischargesPerRevolution }} events per revolution.
      .gray-table-scroll
        table(data-testid="gray-active-sectors")
          caption Raw participating sectors for the active event
          thead
            tr
              th(scope="col") Phase
              th(scope="col") Stator station
              th(scope="col") Rotor station
              th(scope="col") Element
          tbody
            tr(v-for="sector in sectors" :key="sector.sectorIndex")
              td {{ sector.phaseLabel }}
              td {{ sector.statorPairStation + 1 }}
              td {{ sector.rotorPairStation + 1 }}
              td {{ sector.activeElement }}
      details.gray-technical(v-if="depth === 'technical'" open)
        summary Technical geometry disclosure
        p The drawing remains illustrative. The active angle and sector rows are copied from the immutable full-run result; no CAD dimensions or prototype-specific field geometry are inferred.
</template>

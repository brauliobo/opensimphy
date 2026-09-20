<script setup lang="ts">
import { computed } from 'vue'
import { useCompletionRegistry } from '../registries/completionRegistry'

const completionRegistry = useCompletionRegistry()
void completionRegistry.initialize()

const registryReady = computed(() => completionRegistry.ready.value
  && !completionRegistry.error.value
  && completionRegistry.report.value !== null)
const registryError = computed(() => completionRegistry.error.value?.message
  ?? (completionRegistry.ready.value && !registryReady.value ? 'The generated completion report is unavailable.' : ''))
const core = computed(() => completionRegistry.coverage.value.find((row) => row.key === 'core'))
const walls = computed(() => completionRegistry.coverage.value.find((row) => row.key === 'walls'))
</script>

<template lang="pug">
.view.labs-view(:data-testid="registryReady ? 'completion-registry-ready' : undefined")
  header.view-header
    div
      p.eyebrow Browser laboratories
      h1 Choose an instrument
    p.lab-intro The laboratories are separate from the constants tour. Enter only when you want to inspect transform cases or simulate preserved number-wall inputs.
  .loading-plate(v-if="!completionRegistry.ready.value") Loading generated laboratory counts…
  .empty-state(v-else-if="registryError" role="alert")
    strong Laboratory counts unavailable
    p {{ registryError }}
  .lab-choice-grid(v-else-if="registryReady")
    RouterLink(to="/labs/compute")
      span 00 / COMPUTE KERNEL
      strong Compute lab
      p Wolfram-style prompt: SI/Planck quantities, dimensional interpretations, calculus, matrices, and 2D/3D graphs. Runs entirely in the browser.
      small Open the local kernel →
    RouterLink(to="/labs/quantum-wave")
      span 00 / GUIDED DERIVATION
      strong Quantum wave lab
      p Rebuild the imaginary-number story with spectra, standing waves, operators, Fourier sums, probability, and materials.
      small Open the teacher's reconstruction →
    RouterLink(to="/labs/quantum-registers")
      span 00a / REGISTER HYPOTHESIS
      strong Quantum register lab
      p 137 coin flips, majority phase as the next step, and named bit-register methods. Unpublished; not a validation.
      small Open the 137-bit experiment →
    RouterLink(to="/labs/clifford-space")
      span 00e / GEOMETRIC ALGEBRA
      strong Clifford space lab
      p Unit cube, rhombic-dodecahedron honeycomb, and the eight Cl(3) blades as a field on R³.
      small Open the space tiling →
    RouterLink(to="/labs/hyperbolic-partition")
      span 00f / QUARTIC COVER
      strong Hyperbolic partition lab
      p Four roots of T_a, 24 Möbius charts, cross-ratio λ, monodromy around ±a₁/±b₁, and the Riemann surface.
      small Open the tetrahedron explorer →
    RouterLink(to="/labs/edwin-gray")
      span 00b / HISTORICAL MACHINE
      strong Edwin Gray motor lab
      p Reconstruct the 1971–1979 pulsed-capacitor motors with a classical dump, arc quench, and energy ledger.
      small Open the motor reconstruction →
    RouterLink(to="/labs/cases")
      span 00c / CASE PAGES
      strong Simulation cases
      p One page per Gray motor and Awesome Physics catalog record, sharing header, metrics, schematics, and run controls.
      small Open the case index →
    RouterLink(to="/awesome-physics")
      span 00d / SOURCE CATALOG
      strong Awesome Physics
      p Runnable adapters plus evidence-only records from the preserved catalog.
      small Open the catalog →
    RouterLink(to="/labs/core")
      span 01 / TRANSFORM CASES
      strong Core lab
      p Complex surfaces, root loci, invariant checks, constructor transforms, and typed-unit cases.
      small {{ core?.graphed ?? 0 }} graph-ready cases →
    RouterLink(to="/labs/walls")
      span 02 / NUMBER WALLS
      strong Number walls
      p Exact source sequences rendered through six local simulation modes in a cancellable worker.
      small {{ walls?.simulatable ?? 0 }} simulatable inputs →
    RouterLink(to="/labs/earth/EARTH-PLAN-008")
      span 03 / EARTH METHODS
      strong EARTH method workbench
      p Run one bounded method for the representative atmospheric scale-height program without entering the evidence registry.
      small Open EARTH-PLAN-008 →
    RouterLink(to="/labs/onelab" data-testid="onelab-nav")
      span 04 / FIELD SOLVER
      strong Browser ONELAB
      p Serial Gmsh mesh generation and real-double GetDP/PETSc solving with native-reference checks.
      small Open the microstrip proof →
  p.lab-intro Particle and quantum model cards live on the #[RouterLink.text-link(to="/earth") EARTH dossier]. Choose another program from the #[RouterLink.text-link(to="/earth/programs") Program Registry].
  section.source-section.author-collection-section(v-if="registryReady")
    .section-heading
      div
        p.eyebrow External authors and sources
        h2 Author collections
      p Preserved external-source indexes are separated from OpenSimPhy-owned laboratories and do not imply local execution or scientific validation.
    .topic-featured-grid.author-collection-grid
      RouterLink(:to="{ name: 'fiddle-archive' }")
        span Chenopdodium author collection
        strong Fiddle source archive
        p 780 external source records / 16 profile pages. Recorded Chromium pass: 710 rendered without uncaught page errors; retained failed requests may still exist. Scientific validations: 0.
        small Open the author collection ->
</template>

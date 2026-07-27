<template lang="pug">
.view.evidence-view
  header.view-header
    div
      p.eyebrow Scientific support / claim boundaries
      h1 Evidence Guide
      p.lede A calculation, a source record, and an empirical test answer different questions. OpenSimPhy keeps those roles separate.

  section.evidence-distinction-grid(aria-labelledby="distinctions-title")
    h2#distinctions-title Four distinctions used throughout the field course
    article
      h3 Definition
      p A definition fixes terminology, a unit, or an exact conventional value. It is not an observation and does not receive an empirical agreement score.
    article
      h3 Reproduction
      p A reproduction reruns a stated expression or method with recorded inputs and checks whether the stated output can be recovered. Agreement can audit implementation fidelity without validating the physical interpretation.
    article
      h3 Comparison
      p A comparison places declared results or measurements beside one another under a stated method, including units, uncertainty, covariance, selection, and provenance where they apply.
    article
      h3 Validation
      p Validation requires a declared protocol that connects a model to appropriate empirical evidence, including calibrated inputs, held-out observables, uncertainty treatment, acceptance criteria, and failure handling.

  aside.caveat-banner
    strong REPRODUCTION ≠ VALIDATION
    p Numerical agreement alone does not establish a derivation, physical mechanism, independent prediction, or theory validity.

  section.source-section
    .section-heading
      div
        p.eyebrow Follow the evidence chain
        h2 Inspect records rather than inferred claims
      p These existing ledgers expose source provenance and the narrower EARTH program-to-result dossier without adding a new scientific claim here.
    .hero-actions
      RouterLink.button-link(to="/sources") Open Sources & Limits
      RouterLink.text-link(to="/earth") Open the EARTH evidence dossier
</template>

<style src="../styles/tour.css"></style>

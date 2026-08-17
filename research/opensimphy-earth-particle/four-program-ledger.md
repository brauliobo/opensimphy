# Four-program prediction ledger

Mapping: `four-program-ledger`. Schema: `earth-prediction/v1`.
Reproduction is not validation. `validatesEarthTheory` stays `false`.

## Attach from a later sim

Do not mint a new `programId`. Extend the existing kernel, then attach rows:

```ts
import { buildEarthPredictionLedger, buildEarthPredictionRow, missingPredictionSlot } from "../../src/engine/earth/particle/ledger.js";

const row = buildEarthPredictionRow({
  claimId: "NUC-004-RP",
  programId: "EARTH-NUC-004",
  kernelId: "protonFormulaAudit",
  observable: "r_p",
  unit: "fm",
  sm: { value: 0.84075, uncertainty: 0.00064, source: "CODATA", release: "2022" },
  earth: { printed: 0.8414, evaluated: 0.28648, formula: "5 ξ₀ φ^{-2}" },
  thad: { value: 0.84343161, formula: "Catalan chain", status: "prediction" },
  nassim: { value: 0.84123564, formula: "4 ħ/(m_p c)", status: "prediction" },
  gate: { metric: "sigma", passIf: "<=3σ" },
  auditStatus: "falsified",
  g2aIndependent: true,
  datasetIds: ["earth-dataset-codata-recommended-values"],
  modelSummary: "Four names for the proton radius. Shared units are not a shared theory.",
});

return {
  method: "...",
  diagnostics: { validatesEarthTheory: false },
  output: { /* existing kernel output */ },
  predictions: [row],
  predictionLedger: buildEarthPredictionLedger({
    simulationId: "EARTH-NUC-004",
    predictions: [row],
    findings: [{ claimId: "NUC-004-RP", text: "EARTH printed radius is not the evaluated formula." }],
    referenceDatasetIds: ["earth-dataset-codata-recommended-values"],
  }),
};
```

`runEarthMethod` copies `predictions` onto the schemaVersion 2 envelope. Existing kernels emit `[]`.

## Slot status (Thad / Nassim)

| status | Meaning |
| --- | --- |
| `prediction` | Independent (Nassim `4λ_p`; Thad Catalan `r_p`, `zhe_1²` α, `m_W/m_Z`, on-shell `sin²θ_W`) |
| `repro` / `calibration` | Thad 288 recipes that recover CODATA by construction |
| `identity` | Planck products, Schwarzschild `M_S`, Bohr `m_e=ħ/(cαa_0)` |
| `missing` | No counterpart. Name the missing object in `formula`. Silent omission fails. |
| `falsified` / `blocked` | Already failed, or capability absent |

A run cannot set `scientificStatus: prediction` if the target entered the inputs (`g2aIndependent: false`), a counterpart is identity/repro/calibration, or a gate failed.

## Verdict

`fail` if printed ≠ evaluated **or** evaluated misses `gate.passIf`. Do not repair a formula to recover SM.

UI import: `src/engine/earth` (`EARTH_PREDICTION_LABELS`, `predictionRowsForDisplay`, `EarthPredictionRow`).

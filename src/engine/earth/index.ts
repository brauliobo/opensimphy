import {
  bondPotentialAudit,
  canonicalConstantAudit,
  criticalTemperatureAudit,
  DEFAULT_BOND_POTENTIAL_AUDIT_INPUTS,
  DEFAULT_CANONICAL_CONSTANT_AUDIT_INPUTS,
  DEFAULT_CRITICAL_TEMPERATURE_AUDIT_INPUTS,
  DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS,
  DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS,
  DEFAULT_PROTON_FORMULA_AUDIT_INPUTS,
  DEFAULT_SHELL_CAPACITY_AUDIT_INPUTS,
  DEFAULT_SOURCE_SEQUENCE_AUDIT_INPUTS,
  DEFAULT_STANDING_WAVE_SPECTRUM_AUDIT_INPUTS,
  electronBohrRydbergAudit,
  protonFormulaAudit,
  shellCapacityAudit,
  sourceSequenceAudit,
  standingWaveSpectrumAudit,
  type BondPotentialAuditInputs,
  type CanonicalConstantAuditInputs,
  type CriticalTemperatureAuditInputs,
  type ElectronBohrRydbergAuditInputs,
  type ProtonFormulaAuditInputs,
  type ShellCapacityAuditInputs,
  type SourceSequenceAuditInputs,
  type StandingWaveSpectrumInputs,
} from "./audits.js";
import { sphericalCoordination, type SphericalCoordinationInputs } from "./coordination.js";
import {
  checkCancelled,
  type EarthKernelResult,
  type EarthMethodDefinition,
  type EarthMethodRelationship,
  type EarthModelOrigin,
  type EarthProgramDefinition,
  type EarthRunOptions,
  type EarthSimulationResult,
} from "./common.js";
import { earthMethodPredictions } from "./particle/ledger.js";
import {
  compactnessKottlerInterface,
  DEFAULT_COMPACTNESS_KOTTLER_INPUTS,
  DEFAULT_DERRICK_SCALING_INPUTS,
  DEFAULT_DNA_GEOMETRY_LINKING_INPUTS,
  DEFAULT_GEOMAGNETIC_EXPRESSION_AUDIT_INPUTS,
  DEFAULT_GRAVITY_FORMULA_AUDIT_INPUTS,
  DEFAULT_SCREENING_NO_GO_INPUTS,
  DEFAULT_WATER_PHASE_COHERENCE_INPUTS,
  derrickScalingAudit,
  dnaGeometryLinkingAudit,
  geomagneticExpressionAudit,
  gravityFormulaAudit,
  screeningNoGoLedger,
  waterPhaseCoherenceSweep,
  type AtmosphericScaleHeightInputs,
  type CompactnessKottlerInputs,
  type DerrickScalingInputs,
  type DnaGeometryLinkingInputs,
  type GeomagneticExpressionAuditInputs,
  type GravityFormulaAuditInputs,
  type PlanetaryBindingEnergyInputs,
  type PlanckEntropyAuditInputs,
  type ScreeningNoGoInputs,
  type WaterPhaseCoherenceInputs,
} from "./domains.js";
import {
  floquetBenchmark,
  type FloquetInputs,
  type PotentialDerivativeInputs,
  type SineGordonInputs,
  type StochasticDiffusionInputs,
} from "./fields.js";
import {
  couplingAudit,
  densitySpacingAudit,
  goldenPowerAudit,
  piAlphaAudit,
  planckTwistAudit,
  substitutionAudit,
  substitutionSpectrumAudit,
  torusClassificationAudit,
  type CouplingInputs,
  type DensitySpacingInputs,
  type GoldenPowerInputs,
  type PiAlphaInputs,
  type PlanckTwistInputs,
  type SubstitutionInputs,
  type SubstitutionSpectrumInputs,
  type TorusClassificationInputs,
} from "./foundations.js";
import {
  cosmologyHorizonCountCalculator,
  plateSeismicFormulaAudit,
  pulsationHarmonicSourceAudit,
  smbhRatioResidualAudit,
  stellarLifetimeFormulaSweep,
  supernovaNeutronStarSourceAudit,
  tullyFisherRegression,
  type CosmologyHorizonCountInputs,
  type PlateSeismicFormulaInputs,
  type PulsationHarmonicAuditInputs,
  type SmbhRatioResidualInputs,
  type StellarLifetimeFormulaInputs,
  type SupernovaNeutronStarAuditInputs,
  type TullyFisherRegressionInputs,
} from "./astroAudits.js";
import {
  axonActionPotentialArithmeticAudit,
  DEFAULT_AXON_ACTION_POTENTIAL_ARITHMETIC_AUDIT_INPUTS,
  DEFAULT_GENETIC_CODE_KNOT_TABLE_AUDIT_INPUTS,
  DEFAULT_LIVING_STATE_ARITHMETIC_AUDIT_INPUTS,
  DEFAULT_METABOLISM_FIDELITY_LIFESPAN_AUDIT_INPUTS,
  DEFAULT_TRANSLATION_SPLICING_ARITHMETIC_AUDIT_INPUTS,
  geneticCodeKnotTableAudit,
  livingStateArithmeticAudit,
  metabolismFidelityLifespanAudit,
  translationSplicingArithmeticAudit,
  type AxonActionPotentialArithmeticAuditInputs,
  type GeneticCodeKnotTableAuditInputs,
  type LivingStateArithmeticAuditInputs,
  type MetabolismFidelityLifespanAuditInputs,
  type TranslationSplicingArithmeticAuditInputs,
} from "./bioAudits.js";
import {
  DEFAULT_ELECTROLYTE_SPECIATION_INPUTS,
  DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS,
  DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS,
  DEFAULT_PHOTON_KINEMATICS_AUDIT_INPUTS,
  electrolyteSpeciationComparator,
  molecularSpectroscopyAudit,
  particleQuantumNumberAudit,
  photonKinematicsAudit,
  type ElectrolyteSpeciationInputs,
  type MolecularSpectroscopyAuditInputs,
  type ParticleQuantumNumberAuditInputs,
  type PhotonKinematicsAuditInputs,
  type SolubilityProductAuditInputs,
} from "./extendedAudits.js";
import {
  DEFAULT_DECOHERENCE_SCALING_INPUTS,
  DEFAULT_FIXED_POINT_RECOGNIZABILITY_INPUTS,
  DEFAULT_FRESNEL_INTERFACE_INPUTS,
  DEFAULT_KRAMERS_KRONIG_INPUTS,
  DEFAULT_TREFOIL_TUBE_INPUTS,
  fixedPointRecognizabilityAudit,
  fresnelInterfaceSolver,
  kramersKronigAudit,
  trefoilTubeComparison,
  type DecoherenceScalingInputs,
  type FixedPointRecognizabilityInputs,
  type FresnelInterfaceInputs,
  type KramersKronigInputs,
  type TrefoilTubeInputs,
} from "./extendedNumerics.js";
import {
  EARTH_PHYSICAL_COMPARATOR_DEFAULTS,
  EARTH_PHYSICAL_COMPARATORS,
} from "./physicalComparators.js";
import {
  EARTH_ASTRO_COMPARATOR_DEFAULTS,
  EARTH_ASTRO_COMPARATORS,
} from "./astroComparators.js";
import * as chemistryComparators from "./chemistryComparators.js";
import * as bioNeuroComparators from "./bioNeuroComparators.js";
import {
  DEFAULT_EARTH_ATMOSPHERIC_COHERENCE_INPUTS,
  DEFAULT_EARTH_PLANCK_ENTROPY_SOURCE_INPUTS,
  DEFAULT_EARTH_PLANETARY_BINDING_SEISMIC_INPUTS,
  DEFAULT_EARTH_SOLUBILITY_PRODUCT_SOURCE_INPUTS,
  DEFAULT_STANDARD_ION_ACTIVITY_PRODUCT_INPUTS,
  DEFAULT_STANDARD_ISOTHERMAL_SCALE_HEIGHT_INPUTS,
  DEFAULT_STANDARD_PLANCK_ENTROPY_INPUTS,
  DEFAULT_STANDARD_UNIFORM_SPHERE_BINDING_INPUTS,
  earthAtmosphericCoherenceTransform,
  earthPlanckEntropySource,
  earthPlanetaryBindingSeismic,
  earthSolubilityProductSource,
  standardIonActivityProduct,
  standardIsothermalScaleHeight,
  standardPlanckEntropy,
  standardUniformSphereBindingEnergy,
  type EarthAtmosphericCoherenceInputs,
  type EarthPlanckEntropySourceInputs,
  type EarthPlanetaryBindingSeismicInputs,
  type EarthSolubilityProductSourceInputs,
  type StandardIonActivityProductInputs,
  type StandardIsothermalScaleHeightInputs,
  type StandardPlanckEntropyInputs,
  type StandardUniformSphereBindingInputs,
} from "./pilotMethods.js";
import { nuclearPqEnergyAudit, type NuclearPqEnergyInputs } from "./particle/nuclearPqEnergy.js";
import { DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS, protonMassRadiusChi, type ProtonMassRadiusChiInputs } from "./particle/protonMassRadiusChi.js";
import {
  COUPLING_FORCE_HIERARCHY_METHOD_ID,
  DEFAULT_COUPLING_FORCE_HIERARCHY_INPUTS,
  couplingForceHierarchy,
  type CouplingForceHierarchyInputs,
} from "./particle/couplingForceHierarchy.js";
import { fermionBosonNumbers } from "./particle/fermionBosonNumbers.js";
import { superpositionLangevin } from "./particle/superpositionLangevin.js";
import { decoherenceCollapseTime } from "./particle/decoherenceCollapseTime.js";
import { wallVsSineGordon } from "./particle/wallVsSineGordon.js";
import { surgeryFloquetTls } from "./particle/surgeryFloquetTls.js";
import {
  CHEM6_CHIRAL_LINES_METHOD_ID,
  DEFAULT_CHEM6_CHIRAL_LINES_INPUTS,
  chem6ChiralLines,
  type Chem6ChiralLinesInputs,
} from "./particle/chem6ChiralLines.js";
import { fermionSgKink } from "./particle/fermionSgKink.js";

export * from "./audits.js";
export * from "./astroAudits.js";
export * from "./astroComparators.js";
export * from "./bioAudits.js";
export * from "./bioNeuroComparators.js";
export * from "./chemistryComparators.js";
export * from "./common.js";
export * from "./coordination.js";
export * from "./domains.js";
export * from "./extendedAudits.js";
export * from "./extendedNumerics.js";
export * from "./fields.js";
export * from "./foundations.js";
export * from "./physicalComparators.js";
export * from "./particle/ledger.js";
export * from "./particle/surgeryFloquetTls.js";
export * from "./particle/fermionBosonNumbers.js";
export * from "./particle/nuclearPqEnergy.js";
export * from "./particle/protonMassRadiusChi.js";
export * from "./particle/couplingForceHierarchy.js";
export * from "./particle/superpositionLangevin.js";
export * from "./particle/decoherenceCollapseTime.js";
export * from "./particle/wallVsSineGordon.js";
export * from "./particle/fermionSgKink.js";
export * from "./particle/chem6ChiralLines.js";
export * from "./pilotMethods.js";

const EARTH_BIO_NEURO_COMPARATORS = {
  "EARTH-BIO-002": bioNeuroComparators.proteinRibbonSineGordonComparison,
  "EARTH-BIO-003": bioNeuroComparators.proteinAngleResidualAudit,
  "EARTH-BIO-005": bioNeuroComparators.dnaTwistWritheEnergyComparison,
  "EARTH-BIO-006": bioNeuroComparators.finiteMarkovStateGraph,
  "EARTH-NEURO-001": bioNeuroComparators.axonKinkPropagationComparison,
  "EARTH-NEURO-002": bioNeuroComparators.actionPotentialWaveformResidual,
  "EARTH-NEURO-003": bioNeuroComparators.connectomeEigenmodeComparison,
  "EARTH-NEURO-004": bioNeuroComparators.sevenPointEightThreeHzSpectralAudit,
  "EARTH-NEURO-005": bioNeuroComparators.aggregateSurvivalThresholdHazardCalculator,
  "EARTH-X-005": bioNeuroComparators.blindSpectrumProtocolAudit,
} as const;

const EARTH_COMPARATOR_KERNELS = {
  ...EARTH_PHYSICAL_COMPARATORS,
  ...chemistryComparators.CHEMISTRY_COMPARATOR_KERNELS,
  ...EARTH_ASTRO_COMPARATORS,
  ...EARTH_BIO_NEURO_COMPARATORS,
} as const;

type ComparatorSimulationId = keyof typeof EARTH_COMPARATOR_KERNELS;
type ComparatorKernel<Id extends ComparatorSimulationId> = typeof EARTH_COMPARATOR_KERNELS[Id];
type ComparatorSimulationInputs = {
  [Id in ComparatorSimulationId]: NonNullable<Parameters<ComparatorKernel<Id>>[0]>;
};
type ComparatorSimulationOutputs = {
  [Id in ComparatorSimulationId]: ReturnType<ComparatorKernel<Id>>["output"];
};

export const SUPPORTED_EARTH_SIMULATION_IDS = Object.freeze([
  "EARTH-FND-001",
  "EARTH-FND-002",
  "EARTH-FND-003",
  "EARTH-FND-004",
  "EARTH-FND-005",
  "EARTH-FND-006",
  "EARTH-FND-007",
  "EARTH-FND-008",
  "EARTH-FND-009",
  "EARTH-FND-010",
  "EARTH-FND-011",
  "EARTH-FND-012",
  "EARTH-FND-013",
  "EARTH-FND-014",
  "EARTH-GEO-001",
  "EARTH-GEO-002",
  "EARTH-GEO-003",
  "EARTH-GEO-004",
  "EARTH-GEO-005",
  "EARTH-FLD-001",
  "EARTH-FLD-002",
  "EARTH-FLD-003",
  "EARTH-FLD-004",
  "EARTH-FLD-005",
  "EARTH-FLD-006",
  "EARTH-FLD-007",
  "EARTH-FLD-008",
  "EARTH-FLD-009",
  "EARTH-FLD-010",
  "EARTH-NUC-001",
  "EARTH-NUC-002",
  "EARTH-NUC-003",
  "EARTH-NUC-004",
  "EARTH-NUC-005",
  "EARTH-PRT-001",
  "EARTH-PRT-002",
  "EARTH-PRT-003",
  "EARTH-PRT-004",
  "EARTH-PRT-005",
  "EARTH-CHEM-002",
  "EARTH-CHEM-003",
  "EARTH-CHEM-004",
  "EARTH-CHEM-005",
  "EARTH-CHEM-006",
  "EARTH-CHEM-007",
  "EARTH-CHEM-008",
  "EARTH-CHEM-009",
  "EARTH-SPEC-001",
  "EARTH-SPEC-002",
  "EARTH-SPEC-003",
  "EARTH-SPEC-004",
  "EARTH-SPEC-005",
  "EARTH-SPEC-006",
  "EARTH-SPEC-007",
  "EARTH-MAT-001",
  "EARTH-MAT-002",
  "EARTH-MAT-003",
  "EARTH-MAT-004",
  "EARTH-MAT-005",
  "EARTH-MAT-006",
  "EARTH-MAT-007",
  "EARTH-MAT-008",
  "EARTH-MAT-009",
  "EARTH-MAT-010",
  "EARTH-THERM-001",
  "EARTH-THERM-002",
  "EARTH-THERM-004",
  "EARTH-THERM-005",
  "EARTH-THERM-006",
  "EARTH-THERM-007",
  "EARTH-THERM-008",
  "EARTH-THERM-009",
  "EARTH-THERM-010",
  "EARTH-GRV-001",
  "EARTH-GRV-002",
  "EARTH-GRV-003",
  "EARTH-GRV-004",
  "EARTH-GRV-005",
  "EARTH-GRV-006",
  "EARTH-COS-001",
  "EARTH-COS-002",
  "EARTH-COS-003",
  "EARTH-COS-004",
  "EARTH-COS-005",
  "EARTH-COS-006",
  "EARTH-PLAN-001",
  "EARTH-PLAN-002",
  "EARTH-PLAN-003",
  "EARTH-PLAN-004",
  "EARTH-PLAN-005",
  "EARTH-PLAN-006",
  "EARTH-PLAN-007",
  "EARTH-PLAN-008",
  "EARTH-PLAN-009",
  "EARTH-PLAN-010",
  "EARTH-PLAN-011",
  "EARTH-PLAN-012",
  "EARTH-STAR-001",
  "EARTH-STAR-002",
  "EARTH-STAR-003",
  "EARTH-STAR-004",
  "EARTH-STAR-005",
  "EARTH-STAR-006",
  "EARTH-STAR-007",
  "EARTH-STAR-008",
  "EARTH-STAR-009",
  "EARTH-GAL-001",
  "EARTH-GAL-002",
  "EARTH-GAL-003",
  "EARTH-GAL-004",
  "EARTH-GAL-005",
  "EARTH-GAL-006",
  "EARTH-GAL-007",
  "EARTH-BIO-001",
  "EARTH-BIO-002",
  "EARTH-BIO-003",
  "EARTH-BIO-004",
  "EARTH-BIO-005",
  "EARTH-BIO-006",
  "EARTH-BIO-007",
  "EARTH-BIO-008",
  "EARTH-BIO-009",
  "EARTH-NEURO-001",
  "EARTH-NEURO-002",
  "EARTH-NEURO-003",
  "EARTH-NEURO-004",
  "EARTH-NEURO-005",
  "EARTH-NEURO-006",
  "EARTH-X-003",
  "EARTH-X-005",
] as const);

export type EarthProgramId = typeof SUPPORTED_EARTH_SIMULATION_IDS[number];
export type EarthSimulationId = EarthProgramId;

export type EarthMethodId =
  | "earth-source-reproduction-v1"
  | "traditional-analytic-baseline-v1"
  | "traditional-numerical-baseline-v1"
  | "source-contract-validator-v1"
  | "chem6-chiral-lines-v1"
  | "coupling-force-hierarchy";

export function isEarthSimulationId(value: string): value is EarthSimulationId {
  return (SUPPORTED_EARTH_SIMULATION_IDS as readonly string[]).includes(value);
}

type ExistingEarthSimulationInputs = {
  "EARTH-FND-001": CanonicalConstantAuditInputs;
  "EARTH-FND-002": GoldenPowerInputs;
  "EARTH-FND-003": PiAlphaInputs;
  "EARTH-FND-004": SubstitutionInputs;
  "EARTH-FND-005": SubstitutionSpectrumInputs;
  "EARTH-FND-006": FixedPointRecognizabilityInputs;
  "EARTH-FND-007": TorusClassificationInputs;
  "EARTH-FND-008": DensitySpacingInputs;
  "EARTH-FND-010": CouplingInputs;
  "EARTH-FND-011": PlanckTwistInputs;
  "EARTH-FND-014": SourceSequenceAuditInputs;
  "EARTH-GEO-004": TrefoilTubeInputs;
  "EARTH-FLD-001": DerrickScalingInputs;
  "EARTH-FLD-005": StochasticDiffusionInputs;
  "EARTH-FLD-006": DecoherenceScalingInputs;
  "EARTH-FLD-007": FloquetInputs;
  "EARTH-FLD-008": SineGordonInputs;
  "EARTH-FLD-010": PotentialDerivativeInputs;
  "EARTH-NUC-001": NuclearPqEnergyInputs;
  "EARTH-NUC-004": ProtonMassRadiusChiInputs;
  "EARTH-PRT-001": ElectronBohrRydbergAuditInputs;
  "EARTH-PRT-005": ParticleQuantumNumberAuditInputs;
  "EARTH-CHEM-002": BondPotentialAuditInputs;
  "EARTH-CHEM-004": SphericalCoordinationInputs;
  "EARTH-CHEM-007": ShellCapacityAuditInputs;
  "EARTH-SPEC-001": StandingWaveSpectrumInputs;
  "EARTH-SPEC-007": MolecularSpectroscopyAuditInputs;
  "EARTH-MAT-004": KramersKronigInputs;
  "EARTH-MAT-006": FresnelInterfaceInputs;
  "EARTH-MAT-010": PhotonKinematicsAuditInputs;
  "EARTH-THERM-001": CriticalTemperatureAuditInputs;
  "EARTH-THERM-006": SolubilityProductAuditInputs;
  "EARTH-THERM-007": ElectrolyteSpeciationInputs;
  "EARTH-GRV-001": GravityFormulaAuditInputs;
  "EARTH-GRV-002": CosmologyHorizonCountInputs;
  "EARTH-COS-001": CompactnessKottlerInputs;
  "EARTH-COS-006": PlanckEntropyAuditInputs;
  "EARTH-PLAN-005": GeomagneticExpressionAuditInputs;
  "EARTH-PLAN-008": AtmosphericScaleHeightInputs;
  "EARTH-PLAN-009": WaterPhaseCoherenceInputs;
  "EARTH-PLAN-010": PlateSeismicFormulaInputs;
  "EARTH-PLAN-012": PlanetaryBindingEnergyInputs;
  "EARTH-STAR-003": StellarLifetimeFormulaInputs;
  "EARTH-STAR-008": PulsationHarmonicAuditInputs;
  "EARTH-STAR-009": SupernovaNeutronStarAuditInputs;
  "EARTH-GAL-004": TullyFisherRegressionInputs;
  "EARTH-GAL-005": SmbhRatioResidualInputs;
  "EARTH-BIO-001": GeneticCodeKnotTableAuditInputs;
  "EARTH-BIO-004": DnaGeometryLinkingInputs;
  "EARTH-BIO-007": MetabolismFidelityLifespanAuditInputs;
  "EARTH-BIO-008": TranslationSplicingArithmeticAuditInputs;
  "EARTH-BIO-009": LivingStateArithmeticAuditInputs;
  "EARTH-NEURO-006": AxonActionPotentialArithmeticAuditInputs;
  "EARTH-X-003": ScreeningNoGoInputs;
};

export type EarthSimulationInputs = ExistingEarthSimulationInputs & ComparatorSimulationInputs;

type ExistingEarthSimulationOutputs = {
  "EARTH-FND-001": ReturnType<typeof canonicalConstantAudit>["output"];
  "EARTH-FND-002": ReturnType<typeof goldenPowerAudit>["output"];
  "EARTH-FND-003": ReturnType<typeof piAlphaAudit>["output"];
  "EARTH-FND-004": ReturnType<typeof substitutionAudit>["output"];
  "EARTH-FND-005": ReturnType<typeof substitutionSpectrumAudit>["output"];
  "EARTH-FND-006": ReturnType<typeof fixedPointRecognizabilityAudit>["output"];
  "EARTH-FND-007": ReturnType<typeof torusClassificationAudit>["output"];
  "EARTH-FND-008": ReturnType<typeof densitySpacingAudit>["output"];
  "EARTH-FND-010": ReturnType<typeof couplingAudit>["output"];
  "EARTH-FND-011": ReturnType<typeof planckTwistAudit>["output"];
  "EARTH-FND-014": ReturnType<typeof sourceSequenceAudit>["output"];
  "EARTH-GEO-004": ReturnType<typeof trefoilTubeComparison>["output"];
  "EARTH-FLD-001": ReturnType<typeof derrickScalingAudit>["output"];
  "EARTH-FLD-005": ReturnType<typeof superpositionLangevin>["output"];
  "EARTH-FLD-006": ReturnType<typeof decoherenceCollapseTime>["output"];
  "EARTH-FLD-007": ReturnType<typeof surgeryFloquetTls>["output"];
  "EARTH-FLD-008": ReturnType<typeof fermionSgKink>["output"];
  "EARTH-FLD-010": ReturnType<typeof wallVsSineGordon>["output"];
  "EARTH-NUC-001": ReturnType<typeof nuclearPqEnergyAudit>["output"];
  "EARTH-NUC-004": ReturnType<typeof protonMassRadiusChi>["output"];
  "EARTH-PRT-001": ReturnType<typeof electronBohrRydbergAudit>["output"];
  "EARTH-PRT-005": ReturnType<typeof fermionBosonNumbers>["output"];
  "EARTH-CHEM-002": ReturnType<typeof bondPotentialAudit>["output"];
  "EARTH-CHEM-004": ReturnType<typeof sphericalCoordination>["output"];
  "EARTH-CHEM-007": ReturnType<typeof shellCapacityAudit>["output"];
  "EARTH-SPEC-001": ReturnType<typeof standingWaveSpectrumAudit>["output"];
  "EARTH-SPEC-007": ReturnType<typeof molecularSpectroscopyAudit>["output"];
  "EARTH-MAT-004": ReturnType<typeof kramersKronigAudit>["output"];
  "EARTH-MAT-006": ReturnType<typeof fresnelInterfaceSolver>["output"];
  "EARTH-MAT-010": ReturnType<typeof photonKinematicsAudit>["output"];
  "EARTH-THERM-001": ReturnType<typeof criticalTemperatureAudit>["output"];
  "EARTH-THERM-006": ReturnType<typeof earthSolubilityProductSource>["output"];
  "EARTH-THERM-007": ReturnType<typeof electrolyteSpeciationComparator>["output"];
  "EARTH-GRV-001": ReturnType<typeof gravityFormulaAudit>["output"];
  "EARTH-GRV-002": ReturnType<typeof cosmologyHorizonCountCalculator>["output"];
  "EARTH-COS-001": ReturnType<typeof compactnessKottlerInterface>["output"];
  "EARTH-COS-006": ReturnType<typeof standardPlanckEntropy>["output"];
  "EARTH-PLAN-005": ReturnType<typeof geomagneticExpressionAudit>["output"];
  "EARTH-PLAN-008": ReturnType<typeof standardIsothermalScaleHeight>["output"];
  "EARTH-PLAN-009": ReturnType<typeof waterPhaseCoherenceSweep>["output"];
  "EARTH-PLAN-010": ReturnType<typeof plateSeismicFormulaAudit>["output"];
  "EARTH-PLAN-012": ReturnType<typeof standardUniformSphereBindingEnergy>["output"];
  "EARTH-STAR-003": ReturnType<typeof stellarLifetimeFormulaSweep>["output"];
  "EARTH-STAR-008": ReturnType<typeof pulsationHarmonicSourceAudit>["output"];
  "EARTH-STAR-009": ReturnType<typeof supernovaNeutronStarSourceAudit>["output"];
  "EARTH-GAL-004": ReturnType<typeof tullyFisherRegression>["output"];
  "EARTH-GAL-005": ReturnType<typeof smbhRatioResidualAudit>["output"];
  "EARTH-BIO-001": ReturnType<typeof geneticCodeKnotTableAudit>["output"];
  "EARTH-BIO-004": ReturnType<typeof dnaGeometryLinkingAudit>["output"];
  "EARTH-BIO-007": ReturnType<typeof metabolismFidelityLifespanAudit>["output"];
  "EARTH-BIO-008": ReturnType<typeof translationSplicingArithmeticAudit>["output"];
  "EARTH-BIO-009": ReturnType<typeof livingStateArithmeticAudit>["output"];
  "EARTH-NEURO-006": ReturnType<typeof axonActionPotentialArithmeticAudit>["output"];
  "EARTH-X-003": ReturnType<typeof screeningNoGoLedger>["output"];
};

export type EarthSimulationOutputs = ExistingEarthSimulationOutputs & ComparatorSimulationOutputs;

export type EarthResult<Id extends EarthProgramId> = EarthSimulationResult<Id, EarthSimulationOutputs[Id], EarthMethodId>;

export type EarthMethodIdsFor<Id extends EarthProgramId> = Id extends
  | "EARTH-THERM-006"
  | "EARTH-COS-006"
  | "EARTH-PLAN-008"
  | "EARTH-PLAN-012"
  ? "earth-source-reproduction-v1" | "traditional-analytic-baseline-v1"
  : Id extends "EARTH-PRT-001"
    ? "earth-source-reproduction-v1" | "chem6-chiral-lines-v1"
    : Id extends "EARTH-NUC-004"
      ? "earth-source-reproduction-v1" | "coupling-force-hierarchy"
      : EarthMethodId;

export type EarthMethodInputsFor<
  Id extends EarthProgramId,
  MethodId extends EarthMethodIdsFor<Id>,
> = Id extends "EARTH-THERM-006"
  ? MethodId extends "earth-source-reproduction-v1" ? EarthSolubilityProductSourceInputs : StandardIonActivityProductInputs
  : Id extends "EARTH-COS-006"
    ? MethodId extends "earth-source-reproduction-v1" ? EarthPlanckEntropySourceInputs : StandardPlanckEntropyInputs
    : Id extends "EARTH-PLAN-008"
      ? MethodId extends "earth-source-reproduction-v1" ? EarthAtmosphericCoherenceInputs : StandardIsothermalScaleHeightInputs
      : Id extends "EARTH-PLAN-012"
        ? MethodId extends "earth-source-reproduction-v1" ? EarthPlanetaryBindingSeismicInputs : StandardUniformSphereBindingInputs
        : Id extends "EARTH-PRT-001"
          ? MethodId extends "chem6-chiral-lines-v1" ? Chem6ChiralLinesInputs : ElectronBohrRydbergAuditInputs
          : Id extends "EARTH-NUC-004"
            ? MethodId extends "coupling-force-hierarchy" ? CouplingForceHierarchyInputs : ProtonMassRadiusChiInputs
            : EarthSimulationInputs[Id];

export type EarthMethodOutputFor<
  Id extends EarthProgramId,
  MethodId extends EarthMethodIdsFor<Id>,
> = Id extends "EARTH-THERM-006"
  ? MethodId extends "earth-source-reproduction-v1"
    ? ReturnType<typeof earthSolubilityProductSource>["output"]
    : ReturnType<typeof standardIonActivityProduct>["output"]
  : Id extends "EARTH-COS-006"
    ? MethodId extends "earth-source-reproduction-v1"
      ? ReturnType<typeof earthPlanckEntropySource>["output"]
      : ReturnType<typeof standardPlanckEntropy>["output"]
    : Id extends "EARTH-PLAN-008"
      ? MethodId extends "earth-source-reproduction-v1"
        ? ReturnType<typeof earthAtmosphericCoherenceTransform>["output"]
        : ReturnType<typeof standardIsothermalScaleHeight>["output"]
      : Id extends "EARTH-PLAN-012"
        ? MethodId extends "earth-source-reproduction-v1"
          ? ReturnType<typeof earthPlanetaryBindingSeismic>["output"]
          : ReturnType<typeof standardUniformSphereBindingEnergy>["output"]
        : Id extends "EARTH-PRT-001"
          ? MethodId extends "chem6-chiral-lines-v1"
            ? ReturnType<typeof chem6ChiralLines>["output"]
            : ReturnType<typeof electronBohrRydbergAudit>["output"]
          : Id extends "EARTH-NUC-004"
            ? MethodId extends "coupling-force-hierarchy"
              ? ReturnType<typeof couplingForceHierarchy>["output"]
              : ReturnType<typeof protonMassRadiusChi>["output"]
            : EarthSimulationOutputs[Id];

export type EarthMethodResult<
  Id extends EarthProgramId,
  MethodId extends EarthMethodIdsFor<Id>,
> = EarthSimulationResult<Id, EarthMethodOutputFor<Id, MethodId>, MethodId>;

const EARTH_EXISTING_KERNELS = {
  "EARTH-FND-001": canonicalConstantAudit,
  "EARTH-FND-002": goldenPowerAudit,
  "EARTH-FND-003": piAlphaAudit,
  "EARTH-FND-004": substitutionAudit,
  "EARTH-FND-005": substitutionSpectrumAudit,
  "EARTH-FND-006": fixedPointRecognizabilityAudit,
  "EARTH-FND-007": torusClassificationAudit,
  "EARTH-FND-008": densitySpacingAudit,
  "EARTH-FND-010": couplingAudit,
  "EARTH-FND-011": planckTwistAudit,
  "EARTH-FND-014": sourceSequenceAudit,
  "EARTH-GEO-004": trefoilTubeComparison,
  "EARTH-FLD-001": derrickScalingAudit,
  "EARTH-FLD-005": superpositionLangevin,
  "EARTH-FLD-006": decoherenceCollapseTime,
  "EARTH-FLD-007": surgeryFloquetTls,
  "EARTH-FLD-008": fermionSgKink,
  "EARTH-FLD-010": wallVsSineGordon,
  "EARTH-NUC-001": nuclearPqEnergyAudit,
  "EARTH-NUC-004": protonMassRadiusChi,
  "EARTH-PRT-001": electronBohrRydbergAudit,
  "EARTH-PRT-005": fermionBosonNumbers,
  "EARTH-CHEM-002": bondPotentialAudit,
  "EARTH-CHEM-004": sphericalCoordination,
  "EARTH-CHEM-007": shellCapacityAudit,
  "EARTH-SPEC-001": standingWaveSpectrumAudit,
  "EARTH-SPEC-007": molecularSpectroscopyAudit,
  "EARTH-MAT-004": kramersKronigAudit,
  "EARTH-MAT-006": fresnelInterfaceSolver,
  "EARTH-MAT-010": photonKinematicsAudit,
  "EARTH-THERM-001": criticalTemperatureAudit,
  "EARTH-THERM-007": electrolyteSpeciationComparator,
  "EARTH-GRV-001": gravityFormulaAudit,
  "EARTH-GRV-002": cosmologyHorizonCountCalculator,
  "EARTH-COS-001": compactnessKottlerInterface,
  "EARTH-PLAN-005": geomagneticExpressionAudit,
  "EARTH-PLAN-009": waterPhaseCoherenceSweep,
  "EARTH-PLAN-010": plateSeismicFormulaAudit,
  "EARTH-STAR-003": stellarLifetimeFormulaSweep,
  "EARTH-STAR-008": pulsationHarmonicSourceAudit,
  "EARTH-STAR-009": supernovaNeutronStarSourceAudit,
  "EARTH-GAL-004": tullyFisherRegression,
  "EARTH-GAL-005": smbhRatioResidualAudit,
  "EARTH-BIO-001": geneticCodeKnotTableAudit,
  "EARTH-BIO-004": dnaGeometryLinkingAudit,
  "EARTH-BIO-007": metabolismFidelityLifespanAudit,
  "EARTH-BIO-008": translationSplicingArithmeticAudit,
  "EARTH-BIO-009": livingStateArithmeticAudit,
  "EARTH-NEURO-006": axonActionPotentialArithmeticAudit,
  "EARTH-X-003": screeningNoGoLedger,
} as const;

const EARTH_KERNELS = {
  ...EARTH_EXISTING_KERNELS,
  ...EARTH_COMPARATOR_KERNELS,
};

export const DEFAULT_COSMOLOGY_HORIZON_COUNT_INPUTS = Object.freeze({
  horizonDistanceMetres: 46.5e9 * 9.460_730_472_580_8e15,
  horizonExtent: "radius",
  distanceConvention: "proper",
  scaleFactor: 1,
  baryonMassDensityKgPerCubicMetre: 4.2e-28,
  densityConvention: "proper",
  distanceFractionalUncertainty: 0,
  densityFractionalUncertainty: 0,
  baryonMassFractionalUncertainty: 0,
  distanceDerivedFromDensity: false,
  densityDerivedFromDistance: false,
  densityDerivedFromTargetCount: false,
}) satisfies CosmologyHorizonCountInputs;

export const DEFAULT_TULLY_FISHER_REGRESSION_INPUTS = Object.freeze({
  data: [
    { id: "source-synthetic-low", velocityKilometresPerSecond: 10, baryonicMassSolar: 1e6, heldOut: false },
    { id: "source-synthetic-high", velocityKilometresPerSecond: 100, baryonicMassSolar: 1e10, heldOut: false },
    { id: "source-synthetic-held-out", velocityKilometresPerSecond: 1_000, baryonicMassSolar: 1e14, heldOut: true },
  ],
}) satisfies TullyFisherRegressionInputs;

export const DEFAULT_SMBH_RATIO_RESIDUAL_INPUTS = Object.freeze({
  data: [
    { id: "source-ratio-claim", hostMassSolar: 1e12, blackHoleMassSolar: 7.3e9, hostMassDerivedFromBlackHoleMass: true },
  ],
}) satisfies SmbhRatioResidualInputs;

const EARTH_COMPARATOR_DEFAULTS = {
  ...EARTH_PHYSICAL_COMPARATOR_DEFAULTS,
  "EARTH-FLD-004": { point: [0, 0], step: 1e-3 },
  "EARTH-CHEM-003": chemistryComparators.DEFAULT_BOND_RESIDUAL_INPUTS,
  "EARTH-CHEM-005": chemistryComparators.DEFAULT_GEOMETRY_RESIDUAL_INPUTS,
  "EARTH-CHEM-006": chemistryComparators.DEFAULT_WEIGHTED_SPHERICAL_INPUTS,
  "EARTH-CHEM-008": chemistryComparators.DEFAULT_SHELL_HAMILTONIAN_INPUTS,
  "EARTH-CHEM-009": chemistryComparators.DEFAULT_PES_STATIONARY_INPUTS,
  "EARTH-SPEC-002": chemistryComparators.DEFAULT_MASS_WEIGHTED_HESSIAN_INPUTS,
  "EARTH-SPEC-003": chemistryComparators.DEFAULT_SPECTRAL_DERIVATIVE_INPUTS,
  "EARTH-SPEC-004": chemistryComparators.DEFAULT_TWO_LEVEL_SPECTRUM_INPUTS,
  "EARTH-SPEC-005": chemistryComparators.DEFAULT_TWO_SPIN_NMR_INPUTS,
  "EARTH-SPEC-006": chemistryComparators.DEFAULT_CORE_LEVEL_INPUTS,
  "EARTH-MAT-001": chemistryComparators.DEFAULT_CRYSTAL_PHONON_INPUTS,
  "EARTH-MAT-002": chemistryComparators.DEFAULT_CHRISTOFFEL_INPUTS,
  "EARTH-MAT-003": chemistryComparators.DEFAULT_LORENTZ_DIELECTRIC_INPUTS,
  "EARTH-MAT-005": chemistryComparators.DEFAULT_REFRACTIVE_TRANSFORM_INPUTS,
  "EARTH-MAT-007": chemistryComparators.DEFAULT_JONES_MALUS_INPUTS,
  "EARTH-MAT-008": chemistryComparators.DEFAULT_NONLINEAR_ESTIMATE_INPUTS,
  "EARTH-MAT-009": chemistryComparators.DEFAULT_HOPF_TEXTURE_INPUTS,
  "EARTH-THERM-002": chemistryComparators.DEFAULT_TRANSITION_TEMPERATURE_INPUTS,
  "EARTH-THERM-004": chemistryComparators.DEFAULT_EOS_COMPARISON_INPUTS,
  "EARTH-THERM-005": chemistryComparators.DEFAULT_VAN_DER_WAALS_COEXISTENCE_INPUTS,
  "EARTH-THERM-008": chemistryComparators.DEFAULT_OSCILLATOR_THERMODYNAMICS_INPUTS,
  "EARTH-THERM-009": chemistryComparators.DEFAULT_PLANCK_SPECTRUM_INPUTS,
  "EARTH-THERM-010": chemistryComparators.DEFAULT_KINETIC_CONDUCTIVITY_INPUTS,
  ...EARTH_ASTRO_COMPARATOR_DEFAULTS,
  "EARTH-BIO-002": bioNeuroComparators.DEFAULT_PROTEIN_RIBBON_SINE_GORDON_INPUTS,
  "EARTH-BIO-003": bioNeuroComparators.DEFAULT_PROTEIN_ANGLE_RESIDUAL_INPUTS,
  "EARTH-BIO-005": bioNeuroComparators.DEFAULT_DNA_TWIST_WRITHE_ENERGY_INPUTS,
  "EARTH-BIO-006": bioNeuroComparators.DEFAULT_FINITE_MARKOV_STATE_GRAPH_INPUTS,
  "EARTH-NEURO-001": bioNeuroComparators.DEFAULT_AXON_KINK_PROPAGATION_INPUTS,
  "EARTH-NEURO-002": bioNeuroComparators.DEFAULT_ACTION_POTENTIAL_WAVEFORM_INPUTS,
  "EARTH-NEURO-003": bioNeuroComparators.DEFAULT_CONNECTOME_EIGENMODE_INPUTS,
  "EARTH-NEURO-004": bioNeuroComparators.DEFAULT_SEVEN_POINT_EIGHT_THREE_HZ_AUDIT_INPUTS,
  "EARTH-NEURO-005": bioNeuroComparators.DEFAULT_AGGREGATE_SURVIVAL_THRESHOLD_INPUTS,
  "EARTH-X-005": bioNeuroComparators.DEFAULT_BLIND_SPECTRUM_PROTOCOL_INPUTS,
} satisfies ComparatorSimulationInputs;

const EARTH_SIMULATION_INPUTS_BY_ID = {
  "EARTH-FND-001": DEFAULT_CANONICAL_CONSTANT_AUDIT_INPUTS,
  "EARTH-FND-002": { exponents: [-18, -6, 6, 18] },
  "EARTH-FND-003": {},
  "EARTH-FND-004": { generations: 12 },
  "EARTH-FND-005": {},
  "EARTH-FND-006": DEFAULT_FIXED_POINT_RECOGNIZABILITY_INPUTS,
  "EARTH-FND-007": { pairs: [{ p: 3, q: 1, label: "proton" }, { p: 2, q: 3, label: "trefoil" }, { p: 3, q: 3, label: "three-component link" }] },
  "EARTH-FND-008": { xi0: 0.15e-15, referenceDensity: 1.7e44, density: 1e30, lengthUnit: "m", densityUnit: "m^-3" },
  "EARTH-FND-010": { rOverXi0: [1, 10, 100] },
  "EARTH-FND-011": {},
  "EARTH-FND-014": DEFAULT_SOURCE_SEQUENCE_AUDIT_INPUTS,
  "EARTH-GEO-004": DEFAULT_TREFOIL_TUBE_INPUTS,
  "EARTH-FLD-001": DEFAULT_DERRICK_SCALING_INPUTS,
  "EARTH-FLD-005": {},
  "EARTH-FLD-006": DEFAULT_DECOHERENCE_SCALING_INPUTS,
  "EARTH-FLD-007": {},
  "EARTH-FLD-008": {},
  "EARTH-FLD-010": {},
  "EARTH-NUC-001": DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS,
  "EARTH-NUC-004": DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS,
  "EARTH-PRT-001": DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS,
  "EARTH-PRT-005": DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS,
  "EARTH-CHEM-002": DEFAULT_BOND_POTENTIAL_AUDIT_INPUTS,
  "EARTH-CHEM-004": { coordination: 4, starts: 4, maximumIterations: 1000 },
  "EARTH-CHEM-007": DEFAULT_SHELL_CAPACITY_AUDIT_INPUTS,
  "EARTH-SPEC-001": DEFAULT_STANDING_WAVE_SPECTRUM_AUDIT_INPUTS,
  "EARTH-SPEC-007": DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS,
  "EARTH-MAT-004": DEFAULT_KRAMERS_KRONIG_INPUTS,
  "EARTH-MAT-006": DEFAULT_FRESNEL_INTERFACE_INPUTS,
  "EARTH-MAT-010": DEFAULT_PHOTON_KINEMATICS_AUDIT_INPUTS,
  "EARTH-THERM-001": DEFAULT_CRITICAL_TEMPERATURE_AUDIT_INPUTS,
  "EARTH-THERM-006": DEFAULT_EARTH_SOLUBILITY_PRODUCT_SOURCE_INPUTS,
  "EARTH-THERM-007": DEFAULT_ELECTROLYTE_SPECIATION_INPUTS,
  "EARTH-GRV-001": DEFAULT_GRAVITY_FORMULA_AUDIT_INPUTS,
  "EARTH-GRV-002": DEFAULT_COSMOLOGY_HORIZON_COUNT_INPUTS,
  "EARTH-COS-001": DEFAULT_COMPACTNESS_KOTTLER_INPUTS,
  "EARTH-COS-006": DEFAULT_STANDARD_PLANCK_ENTROPY_INPUTS,
  "EARTH-PLAN-005": DEFAULT_GEOMAGNETIC_EXPRESSION_AUDIT_INPUTS,
  "EARTH-PLAN-008": DEFAULT_STANDARD_ISOTHERMAL_SCALE_HEIGHT_INPUTS,
  "EARTH-PLAN-009": DEFAULT_WATER_PHASE_COHERENCE_INPUTS,
  "EARTH-PLAN-010": {},
  "EARTH-PLAN-012": DEFAULT_STANDARD_UNIFORM_SPHERE_BINDING_INPUTS,
  "EARTH-STAR-003": {},
  "EARTH-STAR-008": {},
  "EARTH-STAR-009": {},
  "EARTH-GAL-004": DEFAULT_TULLY_FISHER_REGRESSION_INPUTS,
  "EARTH-GAL-005": DEFAULT_SMBH_RATIO_RESIDUAL_INPUTS,
  "EARTH-BIO-001": DEFAULT_GENETIC_CODE_KNOT_TABLE_AUDIT_INPUTS,
  "EARTH-BIO-004": DEFAULT_DNA_GEOMETRY_LINKING_INPUTS,
  "EARTH-BIO-007": DEFAULT_METABOLISM_FIDELITY_LIFESPAN_AUDIT_INPUTS,
  "EARTH-BIO-008": DEFAULT_TRANSLATION_SPLICING_ARITHMETIC_AUDIT_INPUTS,
  "EARTH-BIO-009": DEFAULT_LIVING_STATE_ARITHMETIC_AUDIT_INPUTS,
  "EARTH-NEURO-006": DEFAULT_AXON_ACTION_POTENTIAL_ARITHMETIC_AUDIT_INPUTS,
  "EARTH-X-003": DEFAULT_SCREENING_NO_GO_INPUTS,
  ...EARTH_COMPARATOR_DEFAULTS,
} satisfies { [Id in EarthSimulationId]: EarthSimulationInputs[Id] };

export const DEFAULT_EARTH_SIMULATION_INPUTS = Object.freeze(Object.fromEntries(
  SUPPORTED_EARTH_SIMULATION_IDS.map((id) => [id, EARTH_SIMULATION_INPUTS_BY_ID[id]]),
)) as { readonly [Id in EarthSimulationId]: EarthSimulationInputs[Id] };

const EARTH_SOURCE_REPRODUCTION_IDS = new Set<EarthProgramId>([
  "EARTH-FND-001", "EARTH-FND-002", "EARTH-FND-003", "EARTH-FND-004", "EARTH-FND-005",
  "EARTH-FND-007", "EARTH-FND-008", "EARTH-FND-010", "EARTH-FND-011", "EARTH-FND-014",
  "EARTH-FLD-001", "EARTH-FLD-010", "EARTH-NUC-001", "EARTH-NUC-004", "EARTH-PRT-001",
  "EARTH-PRT-005", "EARTH-CHEM-002", "EARTH-CHEM-004", "EARTH-CHEM-007", "EARTH-SPEC-001",
  "EARTH-THERM-001", "EARTH-THERM-006", "EARTH-GRV-001", "EARTH-PLAN-005", "EARTH-PLAN-010",
  "EARTH-STAR-003", "EARTH-STAR-008", "EARTH-STAR-009", "EARTH-BIO-001", "EARTH-BIO-004",
  "EARTH-BIO-007", "EARTH-BIO-008", "EARTH-BIO-009", "EARTH-NEURO-006",
]);

const EARTH_SOURCE_CONTRACT_VALIDATOR_IDS = new Set<EarthProgramId>([
  "EARTH-FND-006", "EARTH-FND-009", "EARTH-FND-012", "EARTH-FND-013", "EARTH-GEO-001",
  "EARTH-FLD-004", "EARTH-NUC-002", "EARTH-NUC-005", "EARTH-PRT-002", "EARTH-PRT-004",
  "EARTH-CHEM-003", "EARTH-CHEM-005", "EARTH-CHEM-009", "EARTH-THERM-002", "EARTH-COS-006",
  "EARTH-PLAN-001", "EARTH-PLAN-002", "EARTH-PLAN-007", "EARTH-STAR-001", "EARTH-STAR-004",
  "EARTH-STAR-007", "EARTH-GAL-001", "EARTH-GAL-003", "EARTH-GAL-005", "EARTH-GAL-006",
  "EARTH-GAL-007", "EARTH-BIO-003", "EARTH-NEURO-004", "EARTH-X-003", "EARTH-X-005",
]);

const EARTH_NUMERICAL_BASELINE_IDS = new Set<EarthProgramId>([
  "EARTH-GEO-002", "EARTH-GEO-003", "EARTH-GEO-004", "EARTH-GEO-005", "EARTH-FLD-002",
  "EARTH-FLD-003", "EARTH-FLD-005", "EARTH-FLD-006", "EARTH-FLD-007", "EARTH-FLD-008",
  "EARTH-FLD-009", "EARTH-NUC-003", "EARTH-PRT-003", "EARTH-CHEM-006", "EARTH-CHEM-008",
  "EARTH-SPEC-002", "EARTH-SPEC-003", "EARTH-SPEC-005", "EARTH-MAT-001", "EARTH-MAT-002",
  "EARTH-MAT-004", "EARTH-MAT-009", "EARTH-THERM-005", "EARTH-THERM-007", "EARTH-PLAN-003",
  "EARTH-PLAN-004", "EARTH-PLAN-009", "EARTH-STAR-002", "EARTH-STAR-005", "EARTH-STAR-006",
  "EARTH-GAL-002", "EARTH-GAL-004", "EARTH-BIO-002", "EARTH-BIO-005", "EARTH-BIO-006",
  "EARTH-NEURO-001", "EARTH-NEURO-002", "EARTH-NEURO-003", "EARTH-NEURO-005",
]);

function relationshipForProgram(id: EarthProgramId): EarthMethodRelationship {
  if (EARTH_SOURCE_REPRODUCTION_IDS.has(id)) return "earth-source-reproduction";
  if (EARTH_SOURCE_CONTRACT_VALIDATOR_IDS.has(id)) return "source-contract-validator";
  if (EARTH_NUMERICAL_BASELINE_IDS.has(id)) return "traditional-numerical-baseline";
  return "traditional-analytic-baseline";
}

function methodIdForRelationship(relationship: EarthMethodRelationship): EarthMethodId {
  switch (relationship) {
    case "earth-source-reproduction": return "earth-source-reproduction-v1";
    case "traditional-analytic-baseline": return "traditional-analytic-baseline-v1";
    case "traditional-numerical-baseline": return "traditional-numerical-baseline-v1";
    case "source-contract-validator": return "source-contract-validator-v1";
  }
}

const EXISTING_PROVENANCE = {
  "EARTH-FND-001": { kind: "reproduction", model: "EARTH literal constants and dimensional claims" },
  "EARTH-FND-002": { kind: "reproduction", model: "EARTH golden-power source claims" },
  "EARTH-FND-003": { kind: "reproduction", model: "EARTH pi and fine-structure source expressions" },
  "EARTH-FND-004": { kind: "reproduction", model: "EARTH canonical three-symbol substitution" },
  "EARTH-FND-005": { kind: "reproduction", model: "EARTH canonical and printed substitution matrices" },
  "EARTH-FND-006": { kind: "comparison", model: "bounded symbolic recognizability audit without physical-vacuum equivalence" },
  "EARTH-FND-007": { kind: "reproduction", model: "EARTH torus labels audited with standard invariants" },
  "EARTH-FND-008": { kind: "reproduction", model: "EARTH density-spacing expression" },
  "EARTH-FND-010": { kind: "reproduction", model: "EARTH three printed coupling forms" },
  "EARTH-FND-011": { kind: "reproduction", model: "EARTH Planck-twist source expression" },
  "EARTH-FND-014": { kind: "reproduction", model: "EARTH source-variant morphisms and sequence claims" },
  "EARTH-GEO-004": { kind: "comparison", model: "standard elastic trefoil-tube analogue, not the EARTH scalar model" },
  "EARTH-FLD-001": { kind: "reproduction", model: "EARTH scalar energy under three-dimensional Derrick scaling" },
  "EARTH-FLD-005": { kind: "comparison", model: "normalized damped stochastic diffusion FDT; EARTH (ν,μ) pinned but λ₀≠λ̃₀ and continuum noise undefined" },
  "EARTH-FLD-006": { kind: "comparison", model: "FLD-005 collapse-time ρ,T sweep with pinned (ν,μ); λ₀≠λ̃₀ so μ,ν are not independent" },
  "EARTH-FLD-007": { kind: "comparison", model: "toy two-level Shirley Floquet analogue of the printed surgery barrier; not Hopfion surgery" },
  "EARTH-FLD-008": { kind: "comparison", model: "analytic sine-Gordon kink at EARTH width ξ₀; toy SG, not a fermion" },
  "EARTH-FLD-010": { kind: "reproduction", model: "EARTH printed wall-potential derivative audit" },
  "EARTH-NUC-001": { kind: "reproduction", model: "EARTH nuclear pair rules with standard torus invariants" },
  "EARTH-NUC-004": { kind: "reproduction", model: "EARTH/Thad/Nassim/SM proton mass-radius-χ ledger" },
  "EARTH-PRT-001": { kind: "reproduction", model: "EARTH electron, Bohr, and Rydberg formulas" },
  "EARTH-PRT-005": { kind: "reproduction", model: "EARTH particle quantum-number and literal source claims" },
  "EARTH-CHEM-002": { kind: "reproduction", model: "EARTH bond potential with explicit normalized parameters" },
  "EARTH-CHEM-004": { kind: "reproduction", model: "EARTH spherical pair-energy objective" },
  "EARTH-CHEM-007": { kind: "reproduction", model: "EARTH shell capacity and radius formulas" },
  "EARTH-SPEC-001": { kind: "reproduction", model: "EARTH standing-wave frequency law" },
  "EARTH-SPEC-007": { kind: "comparison", model: "standard rotor, rovibrational, and hyperfine selection-rule comparators" },
  "EARTH-MAT-004": { kind: "comparison", model: "finite-band Kramers-Kronig benchmark with declared extrapolation" },
  "EARTH-MAT-006": { kind: "comparison", model: "standard isotropic complex-index Fresnel interface" },
  "EARTH-MAT-010": { kind: "comparison", model: "standard photon kinematics and emission comparators without an EARTH functional" },
  "EARTH-THERM-001": { kind: "reproduction", model: "EARTH critical-temperature multiplier" },
  "EARTH-THERM-006": { kind: "reproduction", model: "EARTH printed solubility-product expression beside an activity comparator" },
  "EARTH-THERM-007": { kind: "comparison", model: "ideal electrolyte speciation comparator without an EARTH constitutive law" },
  "EARTH-GRV-001": { kind: "reproduction", model: "EARTH gravity and cosmology formulas in SI" },
  "EARTH-GRV-002": { kind: "comparison", model: "user-declared horizon and baryon-density convention calculator" },
  "EARTH-COS-001": { kind: "comparison", model: "Planck-coordinate compactness and Kottler identity interface" },
  "EARTH-COS-006": { kind: "comparison", model: "EARTH Planck scales compared with standard entropy definitions" },
  "EARTH-PLAN-005": { kind: "reproduction", model: "EARTH geomagnetic dipole expression" },
  "EARTH-PLAN-008": { kind: "comparison", model: "EARTH density transform compared with hydrostatic scale height" },
  "EARTH-PLAN-009": { kind: "comparison", model: "bounded engineering water-phase comparison sweep" },
  "EARTH-PLAN-010": { kind: "reproduction", model: "EARTH printed plate and seismic formulas" },
  "EARTH-PLAN-012": { kind: "comparison", model: "EARTH planetary formulas compared with standard binding energy" },
  "EARTH-STAR-003": { kind: "reproduction", model: "EARTH printed stellar mass-lifetime formula and source examples" },
  "EARTH-STAR-008": { kind: "reproduction", model: "EARTH printed pulsation formula and harmonic assignments" },
  "EARTH-STAR-009": { kind: "reproduction", model: "EARTH printed supernova and compact-object formulas" },
  "EARTH-GAL-004": { kind: "comparison", model: "log-space Tully-Fisher regression over explicitly supplied source-synthetic defaults" },
  "EARTH-GAL-005": { kind: "comparison", model: "frozen EARTH phi^-18 SMBH-host ratio residual audit" },
  "EARTH-BIO-001": { kind: "reproduction", model: "EARTH printed genetic-code knot table without a predictive mapping" },
  "EARTH-BIO-004": { kind: "reproduction", model: "EARTH DNA geometry and linking expressions" },
  "EARTH-BIO-007": { kind: "reproduction", model: "EARTH printed metabolism, fidelity, and lifespan formulas" },
  "EARTH-BIO-008": { kind: "reproduction", model: "EARTH printed translation and splicing arithmetic" },
  "EARTH-BIO-009": { kind: "reproduction", model: "EARTH printed living-state arithmetic" },
  "EARTH-NEURO-006": { kind: "reproduction", model: "EARTH printed axon and action-potential arithmetic" },
  "EARTH-X-003": { kind: "comparison", model: "independence ledger for proposed compactness routes" },
} as const;

const COMPARATOR_PROVENANCE = Object.fromEntries(
  Object.keys(EARTH_COMPARATOR_KERNELS).map((id) => [id, {
    kind: "comparison" as const,
    model: "independent bounded standard comparator or source-contract validator; not EARTH-derived",
  }]),
) as Record<ComparatorSimulationId, { kind: "comparison"; model: string }>;

const PROVENANCE = {
  ...EXISTING_PROVENANCE,
  ...COMPARATOR_PROVENANCE,
} satisfies Record<EarthSimulationId, { kind: "reproduction" | "comparison"; model: string }>;

const PILOT_PROGRAM_DEFINITIONS = {
  "EARTH-THERM-006": Object.freeze({
    id: "EARTH-THERM-006",
    defaultMethodId: "earth-source-reproduction-v1",
    methods: Object.freeze([
      Object.freeze({
        id: "earth-source-reproduction-v1",
        programId: "EARTH-THERM-006",
        title: "EARTH printed Ksp source expression",
        runtime: "browser-worker",
        defaultInputs: DEFAULT_EARTH_SOLUBILITY_PRODUCT_SOURCE_INPUTS,
        execute: earthSolubilityProductSource,
        kind: "reproduction",
        precision: "float64",
        model: "Literal bounded evaluation of the printed EARTH CHEM-8 solubility-product expression",
        relationship: "earth-source-reproduction",
        modelOrigin: "earth-corpus",
        earthDerived: true,
        validatesEarthTheory: false,
      }),
      Object.freeze({
        id: "traditional-analytic-baseline-v1",
        programId: "EARTH-THERM-006",
        title: "Standard ion-activity-product analytic baseline",
        runtime: "browser-worker",
        defaultInputs: DEFAULT_STANDARD_ION_ACTIVITY_PRODUCT_INPUTS,
        execute: standardIonActivityProduct,
        kind: "comparison",
        precision: "float64",
        model: "Standard dimensionless ion-activity product from supplied concentrations and activity coefficients",
        relationship: "traditional-analytic-baseline",
        modelOrigin: "standard-physics",
        earthDerived: false,
        validatesEarthTheory: false,
      }),
    ]),
  }),
  "EARTH-COS-006": Object.freeze({
    id: "EARTH-COS-006",
    defaultMethodId: "traditional-analytic-baseline-v1",
    methods: Object.freeze([
      Object.freeze({
        id: "earth-source-reproduction-v1",
        programId: "EARTH-COS-006",
        title: "EARTH printed Planck-length and entropy expressions",
        runtime: "browser-worker",
        defaultInputs: DEFAULT_EARTH_PLANCK_ENTROPY_SOURCE_INPUTS,
        execute: earthPlanckEntropySource,
        kind: "reproduction",
        precision: "float64",
        model: "Literal evaluation of the two printed EARTH Planck lengths and their entropy substitutions",
        relationship: "earth-source-reproduction",
        modelOrigin: "earth-corpus",
        earthDerived: true,
        validatesEarthTheory: false,
      }),
      Object.freeze({
        id: "traditional-analytic-baseline-v1",
        programId: "EARTH-COS-006",
        title: "Standard Planck and Bekenstein-Hawking analytic baseline",
        runtime: "browser-worker",
        defaultInputs: DEFAULT_STANDARD_PLANCK_ENTROPY_INPUTS,
        execute: standardPlanckEntropy,
        kind: "comparison",
        precision: "float64",
        model: "Standard SI Planck length and Bekenstein-Hawking area entropy",
        relationship: "traditional-analytic-baseline",
        modelOrigin: "standard-physics",
        earthDerived: false,
        validatesEarthTheory: false,
      }),
    ]),
  }),
  "EARTH-PLAN-008": Object.freeze({
    id: "EARTH-PLAN-008",
    defaultMethodId: "traditional-analytic-baseline-v1",
    methods: Object.freeze([
      Object.freeze({
        id: "earth-source-reproduction-v1",
        programId: "EARTH-PLAN-008",
        title: "EARTH atmospheric density-coherence transform",
        runtime: "browser-worker",
        defaultInputs: DEFAULT_EARTH_ATMOSPHERIC_COHERENCE_INPUTS,
        execute: earthAtmosphericCoherenceTransform,
        kind: "reproduction",
        precision: "float64",
        model: "EARTH same-density coherence transform over a bounded atmospheric mass-density sweep",
        relationship: "earth-source-reproduction",
        modelOrigin: "earth-corpus",
        earthDerived: true,
        validatesEarthTheory: false,
      }),
      Object.freeze({
        id: "traditional-analytic-baseline-v1",
        programId: "EARTH-PLAN-008",
        title: "Standard isothermal hydrostatic scale-height baseline",
        runtime: "browser-worker",
        defaultInputs: DEFAULT_STANDARD_ISOTHERMAL_SCALE_HEIGHT_INPUTS,
        execute: standardIsothermalScaleHeight,
        kind: "comparison",
        precision: "float64",
        model: "Standard ideal-gas isothermal hydrostatic scale height",
        relationship: "traditional-analytic-baseline",
        modelOrigin: "standard-physics",
        earthDerived: false,
        validatesEarthTheory: false,
      }),
    ]),
  }),
  "EARTH-PLAN-012": Object.freeze({
    id: "EARTH-PLAN-012",
    defaultMethodId: "traditional-analytic-baseline-v1",
    methods: Object.freeze([
      Object.freeze({
        id: "earth-source-reproduction-v1",
        programId: "EARTH-PLAN-012",
        title: "EARTH printed planetary binding and seismic expressions",
        runtime: "browser-worker",
        defaultInputs: DEFAULT_EARTH_PLANETARY_BINDING_SEISMIC_INPUTS,
        execute: earthPlanetaryBindingSeismic,
        kind: "reproduction",
        precision: "float64",
        model: "Literal EARTH planetary binding and seismic expressions with retained SI dimensions",
        relationship: "earth-source-reproduction",
        modelOrigin: "earth-corpus",
        earthDerived: true,
        validatesEarthTheory: false,
      }),
      Object.freeze({
        id: "traditional-analytic-baseline-v1",
        programId: "EARTH-PLAN-012",
        title: "Standard uniform-sphere gravitational binding baseline",
        runtime: "browser-worker",
        defaultInputs: DEFAULT_STANDARD_UNIFORM_SPHERE_BINDING_INPUTS,
        execute: standardUniformSphereBindingEnergy,
        kind: "comparison",
        precision: "float64",
        model: "Standard Newtonian gravitational binding energy of a uniform-density sphere",
        relationship: "traditional-analytic-baseline",
        modelOrigin: "standard-physics",
        earthDerived: false,
        validatesEarthTheory: false,
      }),
    ]),
  }),
} as const;

const PRT_001_PROGRAM_DEFINITION = Object.freeze({
  id: "EARTH-PRT-001",
  defaultMethodId: "earth-source-reproduction-v1" as const,
  methods: Object.freeze([
    Object.freeze({
      id: "earth-source-reproduction-v1" as const,
      programId: "EARTH-PRT-001" as const,
      title: "earth source reproduction",
      runtime: "browser-worker" as const,
      defaultInputs: DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS,
      execute: electronBohrRydbergAudit,
      kind: "reproduction" as const,
      precision: "float64" as const,
      model: "EARTH electron, Bohr, and Rydberg formulas",
      relationship: "earth-source-reproduction" as const,
      modelOrigin: "earth-corpus" as const,
      earthDerived: true,
      validatesEarthTheory: false as const,
    }),
    Object.freeze({
      id: CHEM6_CHIRAL_LINES_METHOD_ID,
      programId: "EARTH-PRT-001" as const,
      title: "CHEM-6 chiral-spiral line ledger",
      runtime: "browser-worker" as const,
      defaultInputs: DEFAULT_CHEM6_CHIRAL_LINES_INPUTS,
      execute: chem6ChiralLines,
      kind: "reproduction" as const,
      precision: "float64" as const,
      model: "CHEM-6 λ_m=2d_n/m and ν_m=m·3c·δχ²/(2π d_n) printed line ledger",
      relationship: "earth-source-reproduction" as const,
      modelOrigin: "earth-corpus" as const,
      earthDerived: true,
      validatesEarthTheory: false as const,
    }),
  ]),
});

const NUC_004_PROGRAM_DEFINITION = Object.freeze({
  id: "EARTH-NUC-004",
  defaultMethodId: "earth-source-reproduction-v1" as const,
  methods: Object.freeze([
    Object.freeze({
      id: "earth-source-reproduction-v1" as const,
      programId: "EARTH-NUC-004" as const,
      title: "earth source reproduction",
      runtime: "browser-worker" as const,
      defaultInputs: DEFAULT_PROTON_MASS_RADIUS_CHI_INPUTS,
      execute: protonMassRadiusChi,
      kind: "reproduction" as const,
      precision: "float64" as const,
      model: "EARTH/Thad/Nassim/SM proton mass-radius-χ ledger",
      relationship: "earth-source-reproduction" as const,
      modelOrigin: "earth-corpus" as const,
      earthDerived: true,
      validatesEarthTheory: false as const,
    }),
    Object.freeze({
      id: COUPLING_FORCE_HIERARCHY_METHOD_ID,
      programId: "EARTH-NUC-004" as const,
      title: "coupling force hierarchy",
      runtime: "browser-worker" as const,
      defaultInputs: DEFAULT_COUPLING_FORCE_HIERARCHY_INPUTS,
      execute: couplingForceHierarchy,
      kind: "reproduction" as const,
      precision: "float64" as const,
      model: "EARTH/Thad/Nassim/SM coupling-force hierarchy; three printed Γ(r) forms overlay",
      relationship: "earth-source-reproduction" as const,
      modelOrigin: "earth-corpus" as const,
      earthDerived: true,
      validatesEarthTheory: false as const,
    }),
  ]),
});

type PilotProgramId = keyof typeof PILOT_PROGRAM_DEFINITIONS;

function isPilotProgramId(programId: EarthProgramId): programId is PilotProgramId {
  return programId in PILOT_PROGRAM_DEFINITIONS;
}

type EarthProgramDefinitions = {
  readonly [Id in EarthProgramId]: EarthProgramDefinition<
    Id,
    EarthMethodId,
    EarthSimulationInputs[Id],
    EarthMethodOutputFor<Id, EarthMethodIdsFor<Id>>
  >;
};

type UntypedEarthKernel = (inputs: unknown, options: EarthRunOptions) => EarthKernelResult<unknown>;

export const EARTH_PROGRAM_DEFINITIONS = Object.freeze(Object.fromEntries(
  SUPPORTED_EARTH_SIMULATION_IDS.map((programId) => {
    if (isPilotProgramId(programId)) return [programId, PILOT_PROGRAM_DEFINITIONS[programId]];
    if (programId === "EARTH-PRT-001") return [programId, PRT_001_PROGRAM_DEFINITION];
    if (programId === "EARTH-NUC-004") return [programId, NUC_004_PROGRAM_DEFINITION];
    const relationship = relationshipForProgram(programId);
    const methodId = methodIdForRelationship(relationship);
    const modelOrigin: EarthModelOrigin = relationship === "earth-source-reproduction"
      ? "earth-corpus"
      : relationship === "source-contract-validator" ? "engine-audit" : "standard-physics";
    const provenance = PROVENANCE[programId];
    const method = Object.freeze({
      id: methodId,
      programId,
      title: relationship.replaceAll("-", " "),
      runtime: "browser-worker" as const,
      defaultInputs: DEFAULT_EARTH_SIMULATION_INPUTS[programId],
      execute: EARTH_KERNELS[programId as keyof typeof EARTH_KERNELS] as unknown as UntypedEarthKernel,
      kind: provenance.kind,
      precision: "float64" as const,
      model: provenance.model,
      relationship,
      modelOrigin,
      earthDerived: relationship === "earth-source-reproduction",
      validatesEarthTheory: false as const,
    });
    return [programId, Object.freeze({ id: programId, defaultMethodId: methodId, methods: Object.freeze([method]) })];
  }),
)) as EarthProgramDefinitions;

export const DEFAULT_EARTH_METHOD_INPUTS = Object.freeze(Object.fromEntries(
  SUPPORTED_EARTH_SIMULATION_IDS.map((programId) => {
    const program = EARTH_PROGRAM_DEFINITIONS[programId];
    return [programId, Object.freeze(Object.fromEntries(
      program.methods.map((method) => [method.id, method.defaultInputs]),
    ))];
  }),
)) as { readonly [Id in EarthProgramId]: Readonly<Partial<Record<EarthMethodId, EarthSimulationInputs[Id]>>> };

export function getEarthProgramDefinition<Id extends EarthProgramId>(programId: Id): EarthProgramDefinitions[Id] {
  const definition = EARTH_PROGRAM_DEFINITIONS[programId];
  if (!definition) throw new RangeError(`Unsupported EARTH program ID: ${String(programId)}`);
  return definition;
}

export function listEarthMethods<Id extends EarthProgramId>(
  programId: Id,
): EarthProgramDefinitions[Id]["methods"] {
  return getEarthProgramDefinition(programId).methods;
}

export function getDefaultEarthMethodId<Id extends EarthProgramId>(programId: Id): EarthMethodId {
  return getEarthProgramDefinition(programId).defaultMethodId;
}

function requireEarthMethod<Id extends EarthProgramId>(
  programId: Id,
  methodId: string,
): EarthProgramDefinitions[Id]["methods"][number] {
  const method = getEarthProgramDefinition(programId).methods.find(({ id }) => id === methodId);
  if (!method) throw new RangeError(`Unsupported EARTH method ID ${methodId} for program ${programId}`);
  return method;
}

function executeEarthMethod<Id extends EarthProgramId>(
  programId: Id,
  methodId: string,
  inputs: EarthSimulationInputs[Id],
  options: EarthRunOptions,
): EarthSimulationResult<
  Id,
  EarthMethodOutputFor<Id, EarthMethodIdsFor<Id>>,
  EarthMethodId
> {
  checkCancelled(options);
  const definition = requireEarthMethod(programId, methodId);
  const kernel = definition.execute(inputs, options);
  const provenance = {
    kind: definition.kind,
    precision: definition.precision,
    model: definition.model,
    relationship: definition.relationship,
    modelOrigin: definition.modelOrigin,
    earthDerived: definition.earthDerived,
    validatesEarthTheory: false as const,
  };
  return {
    ...kernel,
    schemaVersion: 2,
    programId,
    methodId: definition.id,
    executionStatus: "completed",
    id: programId,
    status: "completed",
    relationship: definition.relationship,
    modelOrigin: definition.modelOrigin,
    earthDerived: definition.earthDerived,
    validatesEarthTheory: false,
    provenance,
    predictions: earthMethodPredictions(kernel),
  };
}

export function getEarthMethodDefinition<
  Id extends EarthProgramId,
  MethodId extends EarthMethodIdsFor<Id>,
>(
  programId: Id,
  methodId: MethodId,
): EarthMethodDefinition<
  Id,
  MethodId,
  EarthMethodInputsFor<Id, MethodId>,
  EarthMethodOutputFor<Id, MethodId>
>;
export function getEarthMethodDefinition<Id extends EarthProgramId>(
  programId: Id,
  methodId: string,
): EarthProgramDefinitions[Id]["methods"][number] {
  return requireEarthMethod(programId, methodId);
}

export function getEarthMethodDefaultInputs<
  Id extends EarthProgramId,
  MethodId extends EarthMethodIdsFor<Id>,
>(
  programId: Id,
  methodId: MethodId,
): EarthMethodInputsFor<Id, MethodId>;
export function getEarthMethodDefaultInputs<Id extends EarthProgramId>(
  programId: Id,
  methodId: string,
): EarthSimulationInputs[Id] {
  return structuredClone(requireEarthMethod(programId, methodId).defaultInputs);
}

export function runEarthMethod<
  Id extends EarthProgramId,
  MethodId extends EarthMethodIdsFor<Id>,
>(
  programId: Id,
  methodId: MethodId,
  inputs: EarthMethodInputsFor<Id, MethodId>,
  options?: EarthRunOptions,
): EarthMethodResult<Id, MethodId>;
export function runEarthMethod<Id extends EarthProgramId>(
  programId: Id,
  methodId: string,
  inputs: EarthSimulationInputs[Id],
  options: EarthRunOptions = {},
): EarthSimulationResult<
  Id,
  EarthMethodOutputFor<Id, EarthMethodIdsFor<Id>>,
  EarthMethodId
> {
  return executeEarthMethod(programId, methodId, inputs, options);
}

export function runEarthSimulation<Id extends EarthSimulationId>(
  id: Id,
  inputs: EarthSimulationInputs[Id],
  options: EarthRunOptions = {},
): EarthResult<Id> {
  if (!isEarthSimulationId(id)) throw new RangeError(`Unsupported EARTH simulation ID: ${String(id)}`);
  return executeEarthMethod(id, getDefaultEarthMethodId(id), inputs, options) as EarthResult<Id>;
}

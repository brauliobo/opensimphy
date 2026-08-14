import type { ConvergenceCriteria, ConvergenceGroup } from './types'

export interface ConvergenceCertification {
  groups: ConvergenceGroup[]
  issues: string[]
  converged: boolean
}

function finiteNonnegative(value: number) {
  return Number.isFinite(value) && value >= 0
}

function monotone(values: readonly number[]) {
  return values.every((value, index) => index === 0 || value <= values[index - 1]!)
}

function sameFiniteNumber(left: number | undefined, right: number) {
  return left !== undefined && Number.isFinite(left) && Math.abs(left - right) <= Number.EPSILON * 64 * Math.max(1, Math.abs(left), Math.abs(right))
}

function parseNumber(value: string) {
  return Number(value)
}

const numericToken = String.raw`[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|NaN|Inf(?:inity)?)`
const kspResidualPattern = new RegExp(String.raw`KSP Residual norm\s+(${numericToken})\s*$`, 'i')
const nonlinearResidualPattern = new RegExp(String.raw`Residual\s+(\d+):\s+abs\s+(${numericToken})\s+rel\s+(${numericToken})\s*$`, 'i')
const numericReasonPattern = /KSP (Converged|Diverged) reason\s*(?:[:=]\s*)?([+-]?\d+)\s*$/i
const namedReasonPattern = /Linear solve (converged|diverged|did not converge) due to\s+([A-Z][A-Z0-9_]*)(?:\s+iterations\s+\d+)?\s*$/i

type PetscReasonOutcome = 'converged' | 'diverged' | 'iterating'
interface PetscReasonDefinition { name: string; outcome: PetscReasonOutcome }
interface PetscReasonEvidence { present: boolean; valid: boolean; code?: number; name?: string; outcome?: PetscReasonOutcome }

// Canonical KSPConvergedReasons emitted by pinned PETSc d2a0018167bbba9fbc1f09828039a44e18cc4d99.
const petscReasonsByCode = new Map<number, PetscReasonDefinition>([
  [-12, { name: 'DIVERGED_USER', outcome: 'diverged' }],
  [-11, { name: 'DIVERGED_PC_FAILED', outcome: 'diverged' }],
  [-10, { name: 'DIVERGED_INDEFINITE_MAT', outcome: 'diverged' }],
  [-9, { name: 'DIVERGED_NANORINF', outcome: 'diverged' }],
  [-8, { name: 'DIVERGED_INDEFINITE_PC', outcome: 'diverged' }],
  [-7, { name: 'DIVERGED_NONSYMMETRIC', outcome: 'diverged' }],
  [-6, { name: 'DIVERGED_BREAKDOWN_BICG', outcome: 'diverged' }],
  [-5, { name: 'DIVERGED_BREAKDOWN', outcome: 'diverged' }],
  [-4, { name: 'DIVERGED_DTOL', outcome: 'diverged' }],
  [-3, { name: 'DIVERGED_ITS', outcome: 'diverged' }],
  [-2, { name: 'DIVERGED_NULL', outcome: 'diverged' }],
  [0, { name: 'CONVERGED_ITERATING', outcome: 'iterating' }],
  [1, { name: 'CONVERGED_RTOL_NORMAL_EQUATIONS', outcome: 'converged' }],
  [2, { name: 'CONVERGED_RTOL', outcome: 'converged' }],
  [3, { name: 'CONVERGED_ATOL', outcome: 'converged' }],
  [4, { name: 'CONVERGED_ITS', outcome: 'converged' }],
  [5, { name: 'CONVERGED_NEG_CURVE', outcome: 'converged' }],
  [6, { name: 'CONVERGED_STEP_LENGTH', outcome: 'converged' }],
  [7, { name: 'CONVERGED_HAPPY_BREAKDOWN', outcome: 'converged' }],
  [8, { name: 'CONVERGED_USER', outcome: 'converged' }],
  [9, { name: 'CONVERGED_ATOL_NORMAL_EQUATIONS', outcome: 'converged' }],
])
const petscReasonsByName = new Map([...petscReasonsByCode].map(([code, definition]) => [definition.name, { code, outcome: definition.outcome }]))

export function certifyConvergence(lines: readonly string[], criteria: ConvergenceCriteria, parameters: Record<string, number>): ConvergenceCertification {
  const groups: ConvergenceGroup[] = []
  const issues: string[] = []
  const reasonEvidence = new Map<ConvergenceGroup, PetscReasonEvidence>()
  const evidenceFor = (group: ConvergenceGroup) => {
    const existing = reasonEvidence.get(group)
    if (existing) return existing
    const created: PetscReasonEvidence = { present: true, valid: true }
    reasonEvidence.set(group, created)
    return created
  }
  let system = 0, solve = 0, systemName = '', timeStep: number | undefined, time: number | undefined
  let current: ConvergenceGroup | undefined
  for (const line of lines.flatMap((entry) => entry.split(/[\r\n]+/)).map((entry) => entry.replace(/\x1b\[[0-9;]*m/g, ''))) {
    const systemMatch = /System (\d+)\/(\d+):/.exec(line)
    if (systemMatch) system = Number(systemMatch[1])
    const declaration = /System '([^']+)'/.exec(line)
    if (declaration) systemName = declaration[1]!
    const timestep = /Theta Time = ([0-9.eE+-]+|NaN|[+-]?Inf(?:inity)?).*TimeStep (\d+)/.exec(line)
    if (timestep) { time = parseNumber(timestep[1]!); timeStep = Number(timestep[2]) }
    const solveBoundary = /Solve\[([^\]]+)\]/.exec(line)
    if (solveBoundary) {
      current = { system, systemName: solveBoundary[1]!, solve: ++solve, kind: 'linear', boundary: 'solve', timeStep, time, residuals: [], converged: false }
      groups.push(current)
    }
    const residual = kspResidualPattern.exec(line)
    if (residual) {
      if (!current || current.kind !== 'linear') issues.push(`KSP residual has no Solve boundary: ${line}`)
      else current.residuals.push(parseNumber(residual[1]!))
    } else if (/KSP Residual norm\b/i.test(line)) issues.push(`malformed KSP residual evidence: ${line}`)
    const numericReason = numericReasonPattern.exec(line)
    if (numericReason) {
      if (!current || current.kind !== 'linear') issues.push(`PETSc reason has no Solve boundary: ${line}`)
      else {
        const reason = Number(numericReason[2])
        const statedOutcome = numericReason[1]!.toLowerCase() as 'converged' | 'diverged'
        const definition = Number.isSafeInteger(reason) ? petscReasonsByCode.get(reason) : undefined
        const evidence = evidenceFor(current)
        if (!definition || definition.outcome === 'iterating' || statedOutcome !== definition.outcome) {
          evidence.valid = false
          issues.push(`${current.systemName} solve ${current.solve} has invalid numeric PETSc reason evidence`)
        }
        if (evidence.code !== undefined && evidence.code !== reason) {
          evidence.valid = false
          issues.push(`${current.systemName} solve ${current.solve} has conflicting numeric PETSc reasons`)
        }
        if (evidence.name !== undefined && definition?.name !== evidence.name) {
          evidence.valid = false
          issues.push(`${current.systemName} solve ${current.solve} has conflicting PETSc reason evidence`)
        }
        evidence.code ??= reason
        evidence.outcome ??= definition?.outcome
        current.reason ??= reason
      }
    } else if (/KSP (?:Converged|Diverged) reason\b/i.test(line)) {
      if (current?.kind === 'linear') evidenceFor(current).valid = false
      issues.push(`malformed numeric PETSc reason evidence: ${line}`)
    }
    const textReason = namedReasonPattern.exec(line)
    if (textReason) {
      if (!current || current.kind !== 'linear') issues.push(`PETSc reason has no Solve boundary: ${line}`)
      else {
        const outcome = textReason[1]!.toLowerCase() === 'converged' ? 'converged' : 'diverged'
        const name = textReason[2]!.toUpperCase()
        const definition = petscReasonsByName.get(name)
        const reasonText = `${outcome}:${name}`
        const evidence = evidenceFor(current)
        if (!definition || definition.outcome === 'iterating' || definition.outcome !== outcome) {
          evidence.valid = false
          issues.push(`${current.systemName} solve ${current.solve} has invalid named PETSc reason evidence`)
        }
        if (evidence.name !== undefined && evidence.name !== name) {
          evidence.valid = false
          issues.push(`${current.systemName} solve ${current.solve} has conflicting named PETSc reasons`)
        }
        if (evidence.code !== undefined && definition?.code !== evidence.code) {
          evidence.valid = false
          issues.push(`${current.systemName} solve ${current.solve} has conflicting PETSc reason evidence`)
        }
        evidence.name ??= name
        evidence.outcome ??= definition?.outcome
        current.reasonText ??= reasonText
      }
    } else if (/Linear solve (?:converged|diverged|did not converge) due to\b/i.test(line)) {
      if (current?.kind === 'linear') evidenceFor(current).valid = false
      issues.push(`malformed named PETSc reason evidence: ${line}`)
    }
    const nonlinear = nonlinearResidualPattern.exec(line)
    if (nonlinear) {
      current = {
        system, systemName, solve: ++solve, kind: 'nonlinear', boundary: 'nonlinear-iteration', timeStep, time,
        nonlinearIteration: Number(nonlinear[1]), relativeResidual: parseNumber(nonlinear[3]!), residuals: [parseNumber(nonlinear[2]!)], converged: false,
      }
      groups.push(current)
    } else if (/\bResidual\s+\S+:\s+abs\b/i.test(line)) issues.push(`malformed nonlinear residual evidence: ${line}`)
  }

  if (!groups.length) issues.push('solver log contains no convergence groups')
  const linear = groups.filter((group) => group.kind === 'linear')
  for (const group of linear) {
    const values = group.residuals
    if (values.length !== criteria.linear.residualCount) issues.push(`${group.systemName} solve ${group.solve} has ${values.length} residuals; expected ${criteria.linear.residualCount}`)
    if (!values.every(finiteNonnegative)) issues.push(`${group.systemName} solve ${group.solve} has non-finite or negative residual evidence`)
    if (!monotone(values)) issues.push(`${group.systemName} solve ${group.solve} residuals are not monotone`)
    const initial = values[0], final = values.at(-1)
    const evidence = reasonEvidence.get(group)
    if (evidence?.present) group.converged = evidence.valid && evidence.outcome === 'converged'
    else group.converged = initial !== undefined && final !== undefined && finiteNonnegative(initial) && finiteNonnegative(final)
      && final <= criteria.linear.absoluteTolerance + criteria.linear.relativeTolerance * initial
    if (!group.converged) issues.push(`${group.systemName} solve ${group.solve} did not meet PETSc reason or residual criteria`)
  }

  const nonlinear = groups.filter((group) => group.kind === 'nonlinear')
  if (nonlinear.length) {
    const rule = criteria.nonlinear
    if (!rule) issues.push('nonlinear convergence evidence is not permitted by the fixture')
    else {
      const absolute = nonlinear.map((group) => group.residuals[0]!)
      const relative = nonlinear.map((group) => group.relativeResidual!)
      const iterations = nonlinear.map((group) => group.nonlinearIteration!)
      const finite = absolute.every(finiteNonnegative) && relative.every(finiteNonnegative)
      const contiguous = iterations.every((iteration, index) => iteration === index)
      const countValid = nonlinear.length >= rule.minIterations && nonlinear.length <= rule.maxIterations
      const monotoneEvidence = monotone(absolute) && monotone(relative)
      const finalValid = finite && absolute.at(-1)! <= rule.absoluteTolerance && relative.at(-1)! <= rule.relativeTolerance
      if (!finite) issues.push('nonlinear residual evidence is non-finite or negative')
      if (!contiguous) issues.push(`nonlinear iterations are not contiguous from zero: ${iterations.join(',')}`)
      if (!countValid) issues.push(`nonlinear iteration count ${nonlinear.length} is outside ${rule.minIterations}..${rule.maxIterations}`)
      if (!monotoneEvidence) issues.push('nonlinear absolute and relative residuals must be monotone')
      if (!finalValid) issues.push('nonlinear final absolute and relative criteria were not met')
      const converged = finite && contiguous && countValid && monotoneEvidence && finalValid
      for (const group of nonlinear) group.converged = converged
    }
  }

  const structure = criteria.structure
  if (structure.kind === 'fixed') {
    const actual = groups.map(({ kind, systemName }) => ({ kind, systemName }))
    if (JSON.stringify(actual) !== JSON.stringify(structure.groups)) issues.push(`convergence group structure does not match fixture: ${JSON.stringify(actual)}`)
  } else if (structure.kind === 'transient') {
    const active = !structure.activation || parameters[structure.activation.parameter] === structure.activation.value
    if (!active) {
      if (groups.length !== 1 || groups[0]?.kind !== 'linear' || groups[0].systemName !== structure.systemName) issues.push(`steady convergence structure is not one ${structure.systemName} solve`)
      if (groups.some(({ kind }) => kind === 'nonlinear')) issues.push('steady convergence structure contains nonlinear evidence')
    } else {
      const end = parameters[structure.endParameter], step = parameters[structure.stepParameter]
      const count = end / step
      if (!(Number.isFinite(count) && count > 0 && Number.isInteger(count))) issues.push(`transient parameters ${structure.endParameter}/${structure.stepParameter} do not define an integer solve count`)
      else if (groups.length !== count || groups.some((group, index) => group.kind !== 'linear' || group.systemName !== structure.systemName || group.timeStep !== index + 1 || !sameFiniteNumber(group.time, step * (index + 1)))) {
        issues.push(`transient convergence structure does not contain ${count} ordered ${structure.systemName} time steps`)
      }
    }
  } else {
    const active = !structure.activation || parameters[structure.activation.parameter] === structure.activation.value
    const valid = active
      ? groups.length > 0 && groups.length % 2 === 0 && groups.every((group, index) => group.systemName === structure.systemName && group.kind === (index % 2 === 0 ? 'linear' : 'nonlinear'))
      : groups.length === 1 && groups[0]?.kind === 'linear' && groups[0].systemName === structure.systemName
    if (!valid) issues.push(active ? `nonlinear convergence structure is not alternating ${structure.systemName} linear/iteration evidence` : `linear convergence structure is not one ${structure.systemName} solve`)
  }

  if (groups.some(({ converged }) => !converged)) issues.push('one or more convergence groups are uncertified')
  return { groups, issues: [...new Set(issues)], converged: issues.length === 0 }
}

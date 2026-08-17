export function nativeConvergenceOracle(source, project) {
  if (!project.convergence) throw new Error(`native fixture ${project.id} has no convergence criteria`)
  const records = []
  const failures = []
  const scalar = String.raw`[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|NaN|Inf(?:inity)?)`
  const normLine = new RegExp(String.raw`KSP Residual norm\s+(${scalar})\s*$`, 'i')
  const iterationLine = new RegExp(String.raw`Residual\s+(\d+):\s+abs\s+(${scalar})\s+rel\s+(${scalar})\s*$`, 'i')
  const codeLine = /KSP (Converged|Diverged) reason\s*(?:[:=]\s*)?([+-]?\d+)\s*$/i
  const nameLine = /Linear solve (converged|diverged|did not converge) due to\s+([A-Z][A-Z0-9_]*)(?:\s+iterations\s+\d+)?\s*$/i
  // Canonical KSPConvergedReasons emitted by pinned PETSc d2a0018167bbba9fbc1f09828039a44e18cc4d99.
  const reasonCodes = new Map([
    [-12, ['DIVERGED_USER', 'diverged']],
    [-11, ['DIVERGED_PC_FAILED', 'diverged']],
    [-10, ['DIVERGED_INDEFINITE_MAT', 'diverged']],
    [-9, ['DIVERGED_NANORINF', 'diverged']],
    [-8, ['DIVERGED_INDEFINITE_PC', 'diverged']],
    [-7, ['DIVERGED_NONSYMMETRIC', 'diverged']],
    [-6, ['DIVERGED_BREAKDOWN_BICG', 'diverged']],
    [-5, ['DIVERGED_BREAKDOWN', 'diverged']],
    [-4, ['DIVERGED_DTOL', 'diverged']],
    [-3, ['DIVERGED_ITS', 'diverged']],
    [-2, ['DIVERGED_NULL', 'diverged']],
    [0, ['CONVERGED_ITERATING', 'iterating']],
    [1, ['CONVERGED_RTOL_NORMAL_EQUATIONS', 'converged']],
    [2, ['CONVERGED_RTOL', 'converged']],
    [3, ['CONVERGED_ATOL', 'converged']],
    [4, ['CONVERGED_ITS', 'converged']],
    [5, ['CONVERGED_NEG_CURVE', 'converged']],
    [6, ['CONVERGED_STEP_LENGTH', 'converged']],
    [7, ['CONVERGED_HAPPY_BREAKDOWN', 'converged']],
    [8, ['CONVERGED_USER', 'converged']],
    [9, ['CONVERGED_ATOL_NORMAL_EQUATIONS', 'converged']],
  ])
  const reasonNames = new Map([...reasonCodes].map(([code, [name, outcome]]) => [name, { code, outcome }]))
  const reasonEvidence = new Map()
  const evidenceFor = (record) => {
    if (!reasonEvidence.has(record)) reasonEvidence.set(record, { valid: true })
    return reasonEvidence.get(record)
  }
  let declaredSystem = '', system = 0, serial = 0, clock, timeIndex, active
  for (const decorated of source.split(/[\r\n]+/)) {
    const raw = decorated.replace(/\x1b\[[\d;]*m/g, '')
    const declaration = raw.match(/System '([^']+)'/)
    if (declaration) declaredSystem = declaration[1]
    const dimension = raw.match(/System (\d+)\/\d+:/)
    if (dimension) system = Number(dimension[1])
    const theta = raw.match(/Theta Time = ([0-9.eE+-]+|NaN|[+-]?Inf(?:inity)?).*TimeStep (\d+)/)
    if (theta) { clock = Number(theta[1]); timeIndex = Number(theta[2]) }
    const solve = raw.match(/Solve\[([^\]]+)\]/)
    if (solve) {
      active = { system, systemName: solve[1], solve: ++serial, kind: 'linear', boundary: 'solve', ...(timeIndex === undefined ? {} : { timeStep: timeIndex, time: clock }), residuals: [], converged: false }
      records.push(active)
    }
    const norm = raw.match(normLine)
    if (norm) {
      if (!active || active.kind !== 'linear') throw new Error(`native KSP norm lacks a solve boundary: ${raw}`)
      active.residuals.push(Number(norm[1]))
    } else if (/KSP Residual norm\b/i.test(raw)) failures.push(`malformed native KSP residual evidence: ${raw}`)
    const code = raw.match(codeLine)
    if (code) {
      if (!active || active.kind !== 'linear') throw new Error(`native PETSc reason lacks a solve boundary: ${raw}`)
      const value = Number(code[2])
      const stated = code[1].toLowerCase()
      const definition = Number.isSafeInteger(value) ? reasonCodes.get(value) : undefined
      const evidence = evidenceFor(active)
      if (!definition || definition[1] === 'iterating' || stated !== definition[1]) {
        evidence.valid = false
        failures.push(`invalid native numeric PETSc reason for ${active.systemName} solve ${active.solve}`)
      }
      if (evidence.code !== undefined && evidence.code !== value) {
        evidence.valid = false
        failures.push(`conflicting native numeric PETSc reasons for ${active.systemName} solve ${active.solve}`)
      }
      if (evidence.name !== undefined && definition?.[0] !== evidence.name) {
        evidence.valid = false
        failures.push(`conflicting native PETSc reason evidence for ${active.systemName} solve ${active.solve}`)
      }
      evidence.code ??= value
      evidence.outcome ??= definition?.[1]
      active.reason ??= value
    } else if (/KSP (?:Converged|Diverged) reason\b/i.test(raw)) {
      if (active?.kind === 'linear') evidenceFor(active).valid = false
      failures.push(`malformed native numeric PETSc reason evidence: ${raw}`)
    }
    const named = raw.match(nameLine)
    if (named) {
      if (!active || active.kind !== 'linear') throw new Error(`native PETSc reason lacks a solve boundary: ${raw}`)
      const label = named[1].toLowerCase() === 'converged' ? 'converged' : 'diverged'
      const identifier = named[2].toUpperCase()
      const definition = reasonNames.get(identifier)
      const text = `${label}:${identifier}`
      const evidence = evidenceFor(active)
      if (!definition || definition.outcome === 'iterating' || definition.outcome !== label) {
        evidence.valid = false
        failures.push(`invalid native named PETSc reason for ${active.systemName} solve ${active.solve}`)
      }
      if (evidence.name !== undefined && evidence.name !== identifier) {
        evidence.valid = false
        failures.push(`conflicting native named PETSc reasons for ${active.systemName} solve ${active.solve}`)
      }
      if (evidence.code !== undefined && definition?.code !== evidence.code) {
        evidence.valid = false
        failures.push(`conflicting native PETSc reason evidence for ${active.systemName} solve ${active.solve}`)
      }
      evidence.name ??= identifier
      evidence.outcome ??= definition?.outcome
      active.reasonText ??= text
    } else if (/Linear solve (?:converged|diverged|did not converge) due to\b/i.test(raw)) {
      if (active?.kind === 'linear') evidenceFor(active).valid = false
      failures.push(`malformed native named PETSc reason evidence: ${raw}`)
    }
    const iteration = raw.match(iterationLine)
    if (iteration) {
      active = {
        system, systemName: declaredSystem, solve: ++serial, kind: 'nonlinear', boundary: 'nonlinear-iteration', ...(timeIndex === undefined ? {} : { timeStep: timeIndex, time: clock }),
        nonlinearIteration: Number(iteration[1]), relativeResidual: Number(iteration[3]), residuals: [Number(iteration[2])], converged: false,
      }
      records.push(active)
    } else if (/\bResidual\s+\S+:\s+abs\b/i.test(raw)) failures.push(`malformed native nonlinear residual evidence: ${raw}`)
  }

  const finite = (value) => Number.isFinite(value) && value >= 0
  const descending = (values) => values.every((value, index) => index === 0 || value <= values[index - 1])
  const sameTime = (left, right) => Number.isFinite(left) && Math.abs(left - right) <= Number.EPSILON * 64 * Math.max(1, Math.abs(left), Math.abs(right))
  for (const record of records.filter(({ kind }) => kind === 'linear')) {
    const values = record.residuals, first = values[0], last = values.at(-1), rule = project.convergence.linear
    if (values.length !== rule.residualCount || !values.every(finite) || !descending(values)) failures.push(`invalid native linear evidence for ${record.systemName} solve ${record.solve}`)
    const evidence = reasonEvidence.get(record)
    record.converged = evidence ? evidence.valid && evidence.outcome === 'converged' : finite(first) && finite(last) && last <= rule.absoluteTolerance + rule.relativeTolerance * first
    if (!record.converged) failures.push(`native linear criteria failed for ${record.systemName} solve ${record.solve}`)
  }
  const nonlinear = records.filter(({ kind }) => kind === 'nonlinear')
  if (nonlinear.length) {
    const rule = project.convergence.nonlinear
    if (!rule) failures.push('native log contains unexpected nonlinear iterations')
    else {
      const absolute = nonlinear.map(({ residuals }) => residuals[0]), relative = nonlinear.map(({ relativeResidual }) => relativeResidual)
      const iterationOrder = nonlinear.every(({ nonlinearIteration }, index) => nonlinearIteration === index)
      const accepted = nonlinear.length >= rule.minIterations && nonlinear.length <= rule.maxIterations && iterationOrder
        && absolute.every(finite) && relative.every(finite) && descending(absolute) && descending(relative)
        && absolute.at(-1) <= rule.absoluteTolerance && relative.at(-1) <= rule.relativeTolerance
      for (const record of nonlinear) record.converged = accepted
      if (!accepted) failures.push('native nonlinear convergence criteria failed')
    }
  }

  const structure = project.convergence.structure
  if (structure.kind === 'fixed') {
    if (JSON.stringify(records.map(({ kind, systemName }) => ({ kind, systemName }))) !== JSON.stringify(structure.groups)) failures.push('native fixed convergence structure differs from descriptor')
  } else if (structure.kind === 'transient') {
    const active = !structure.activation || project.setNumbers[structure.activation.parameter] === structure.activation.value
    const end = project.setNumbers[structure.endParameter], step = project.setNumbers[structure.stepParameter], count = active ? end / step : 1
    const mismatch = active
      ? !Number.isInteger(count) || records.length !== count || records.some((record, index) => record.kind !== 'linear' || record.systemName !== structure.systemName || record.timeStep !== index + 1 || !sameTime(record.time, step * (index + 1)))
      : records.length !== 1 || records[0]?.kind !== 'linear' || records[0]?.systemName !== structure.systemName
    if (mismatch) failures.push('native transient convergence structure differs from descriptor')
  } else {
    const active = !structure.activation || project.setNumbers[structure.activation.parameter] === structure.activation.value
    const mismatch = active
      ? !records.length || records.length % 2 || records.some((record, index) => record.systemName !== structure.systemName || record.kind !== (index % 2 ? 'nonlinear' : 'linear'))
      : records.length !== 1 || records[0]?.kind !== 'linear' || records[0]?.systemName !== structure.systemName
    if (mismatch) failures.push('native nonlinear convergence structure differs from descriptor')
  }
  if (!records.length) failures.push('native log has no convergence records')
  if (records.some(({ converged }) => !converged)) failures.push('native log contains uncertified groups')
  if (failures.length) throw new Error(`${project.id} native convergence certification failed: ${[...new Set(failures)].join('; ')}`)
  return records
}

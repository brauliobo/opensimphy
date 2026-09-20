export interface SlepcEigenpair {
  index: number
  value: number
  residual: number
}

const numeric = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`
const eigPattern = new RegExp(String.raw`EIG\s+(\d+)\s+w\^2\s+=\s+(${numeric})\s+(${numeric})\s+(${numeric})`)
const convergedPattern = /SLEPc number of converged eigenpairs:\s+(\d+)/
const requestedPattern = /SLEPc number of requested eigenvalues:\s+(\d+)/

function linesOf(source: readonly string[]) {
  return source.flatMap((entry) => entry.split(/[\r\n]+/)).map((line) => line.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean)
}

export function parseSlepcEigenpairs(source: readonly string[]): SlepcEigenpair[] {
  const modes: SlepcEigenpair[] = []
  for (const line of linesOf(source)) {
    const match = eigPattern.exec(line)
    if (!match) continue
    modes.push({
      index: Number(match[1]),
      value: Number(match[2]),
      residual: Number(match[4]),
    })
  }
  return modes
}

export function certifySlepcEigenSolve(source: readonly string[], requested = 8): SlepcEigenpair[] {
  const lines = linesOf(source)
  if (lines.some((line) => /SLEPc diverged|SLEPc generic breakdown/i.test(line))) {
    throw new Error(`SLEPc eigen solve diverged: ${lines.filter((line) => /SLEPc/.test(line)).slice(-8).join('\n')}`)
  }
  const requestedMatch = lines.map((line) => requestedPattern.exec(line)).find(Boolean)
  const convergedMatch = lines.map((line) => convergedPattern.exec(line)).find(Boolean)
  const modes = parseSlepcEigenpairs(lines)
  const nconv = convergedMatch ? Number(convergedMatch[1]) : modes.length
  const nev = requestedMatch ? Number(requestedMatch[1]) : requested
  if (!(nconv > 0) || !modes.length) throw new Error(`SLEPc produced no converged eigenpairs: ${lines.filter((line) => /SLEPc|EIG /.test(line)).slice(-12).join('\n')}`)
  if (modes.length > nconv) throw new Error(`SLEPc logged ${modes.length} eigenpairs but nconv=${nconv}`)
  if (nev > 0 && nconv < nev) throw new Error(`SLEPc nconv ${nconv} is below requested ${nev}`)
  return modes
}

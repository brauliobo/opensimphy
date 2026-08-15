import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const forbidden = new Set([
  'socket', 'socketcall', 'connect', 'bind', 'listen', 'accept', 'accept4',
  'send', 'sendto', 'sendmsg', 'sendmmsg', 'recv', 'recvfrom', 'recvmsg', 'recvmmsg',
  'shutdown', 'getsockopt', 'setsockopt', 'getsockname', 'getpeername', 'socketpair',
  'getaddrinfo', 'freeaddrinfo', 'gethostbyname', 'gethostbyaddr',
  'fork', 'vfork', 'clone', 'clone3', 'exec', 'execl', 'execle', 'execlp', 'execv',
  'execve', 'execveat', 'execvp', 'execvpe', 'fexecve', 'posix_spawn', 'posix_spawnp',
  'system', 'popen',
])

export function normalizeBoundarySymbol(name) {
  let symbol = name.trim().replace(/^[$'"`]+|['"`]+$/g, '')
  symbol = symbol.match(/^([A-Za-z_$][A-Za-z0-9_$@]*)(?:\(.*\))$/)?.[1] ?? symbol
  symbol = symbol.replace(/@{1,2}[^@]+$/, '')
  if (symbol.startsWith('___syscall_')) symbol = symbol.slice(1)
  else if (/^_[A-Za-z]/.test(symbol)) symbol = symbol.slice(1)
  if (symbol.startsWith('__syscall_')) symbol = symbol.slice('__syscall_'.length)
  if (symbol.startsWith('__wasi_sock_')) symbol = symbol.slice('__wasi_sock_'.length)
  return symbol.toLowerCase()
}

function isForbidden(name) {
  return forbidden.has(normalizeBoundarySymbol(name))
}

function importSection(text) {
  const match = text.match(/(?:^|\n)Import\[[^\n]*\]:\n([\s\S]*?)(?=\n[A-Z][A-Za-z ]*\[[^\n]*\]:|$)/)
  return match?.[1] ?? ''
}

function importedName(line) {
  return line.match(/<-\s+[^.\s]+\.([^\s]+)\s*$/)?.[1]
}

function linkedName(line) {
  return line.trim().match(/(?:\(([^()]+)\)|\s([^\s]+))$/)?.slice(1).find(Boolean)
}

function symbolName(line) {
  return line.trim().match(/(?:^|\s)[A-Z?]\s+(.+)$/)?.[1]
}

export function forbiddenBoundaryFindings({ imports, linkMap, symbols }) {
  return [
    ...importSection(imports).split('\n').filter((line) => isForbidden(importedName(line) ?? '')).map((line) => `final import: ${line.trim()}`),
    ...linkMap.split('\n').filter((line) => isForbidden(linkedName(line) ?? '')).map((line) => `link map: ${line.trim()}`),
    ...symbols.split('\n').filter((line) => isForbidden(symbolName(line) ?? '')).map((line) => `pre-strip symbol: ${line.trim()}`),
  ]
}

async function main() {
  const values = Object.fromEntries(process.argv.slice(2).map((argument) => argument.split('=', 2)))
  for (const required of ['--imports', '--link-map', '--symbols']) if (!values[required]) throw new Error(`missing ${required}=PATH`)
  const [imports, linkMap, symbols] = await Promise.all([
    readFile(values['--imports'], 'utf8'), readFile(values['--link-map'], 'utf8'), readFile(values['--symbols'], 'utf8'),
  ])
  const findings = forbiddenBoundaryFindings({ imports, linkMap, symbols })
  if (findings.length) {
    console.error('forbidden process or network boundary detected')
    console.error(findings.join('\n'))
    process.exitCode = 4
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()

import { forbiddenBoundaryFindings } from '../../tools/wasm/check-forbidden-boundary.mjs'

describe('WASM process and socket boundary certification', () => {
  const clean = {
    imports: 'combined.wasm:\tfile format wasm 0x1\n\nImport[1]:\n - func[0] sig=0 <env.emscripten_resize_heap> <- env.emscripten_resize_heap\nFunction[1]:\n',
    linkMap: '       0        0        0 __wasm_call_ctors\n',
    symbols: '00000001 T opensimphy_combined_run\n',
  }

  const boundaries = [
    'socket', 'socketcall', 'connect', 'bind', 'listen', 'accept', 'accept4',
    'send', 'sendto', 'sendmsg', 'sendmmsg', 'recv', 'recvfrom', 'recvmsg', 'recvmmsg',
    'shutdown', 'getsockopt', 'setsockopt', 'getsockname', 'getpeername', 'socketpair',
    'getaddrinfo', 'freeaddrinfo', 'gethostbyname', 'gethostbyaddr',
    'fork', 'vfork', 'clone', 'clone3', 'exec', 'execl', 'execle', 'execlp', 'execv',
    'execve', 'execveat', 'execvp', 'execvpe', 'fexecve', 'posix_spawn', 'posix_spawnp',
    'system', 'popen',
  ]
  const evidence = [
    ['final import', (symbol: string) => ({ ...clean, imports: clean.imports.replaceAll('emscripten_resize_heap', symbol) })],
    ['link map', (symbol: string) => ({ ...clean, linkMap: `       0       10       10 ${symbol}\n` })],
    ['pre-strip symbol', (symbol: string) => ({ ...clean, symbols: `00000001 U ${symbol}\n` })],
  ] as const

  it.each(boundaries.flatMap((symbol) => evidence.map(([source, fixture]) => [source, symbol, fixture(symbol)] as const)))(
    'rejects %s boundary symbol %s', (_, __, fixture) => {
      expect(forbiddenBoundaryFindings(fixture)).toHaveLength(1)
    },
  )

  it.each(boundaries.flatMap((symbol) => evidence.map(([source, fixture]) => [source, symbol, fixture(`__syscall_${symbol}`)] as const)))(
    'rejects %s Emscripten syscall %s', (_, __, fixture) => {
      expect(forbiddenBoundaryFindings(fixture)).toHaveLength(1)
    },
  )

  it.each([
    'socketFactory', 'socketpairing', 'socketcallback', 'connected', 'binding', 'listener',
    'acceptable', 'sender', 'sendBuffer', 'receiver', 'recvBuffer', 'shutdownHandler',
    'getsockoptimize', 'setsockoption', 'forklift', 'cloneable', 'execute', 'execution',
    'posix_spawnattr_init', 'systematic', 'population', 'GmshClient::Connect(char const*)',
    'BOPTools_BoxSelector::Accept(int)', '__syscall_socket_helper',
  ])('allows near-miss symbol %s', (symbol) => {
    for (const [, fixture] of evidence) expect(forbiddenBoundaryFindings(fixture(symbol))).toEqual([])
  })

  it.each([
    ['leading underscore', '_socket'],
    ['libc version', 'connect@@GLIBC_2.2.5'],
    ['Emscripten export', '___syscall_sendmsg'],
    ['C function signature', 'socket()'],
    ['WASI socket import', '__wasi_sock_shutdown'],
  ])('normalizes and rejects %s decoration', (_, symbol) => {
    expect(forbiddenBoundaryFindings({ ...clean, symbols: `00000001 U ${symbol}\n` })).toHaveLength(1)
  })
})

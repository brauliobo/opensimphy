export function createCombinedRuntime(Module, buildApi, descriptor) {
  const gmsh = buildApi(Module, descriptor)
  const invoke = Module.cwrap('opensimphy_combined_run', 'number', ['number', 'number'])
  const setJson = Module.cwrap('opensimphy_combined_onelab_set_json', 'number', ['string'])
  const getJson = Module.cwrap('opensimphy_combined_onelab_get_json', 'number', [])
  const clear = Module.cwrap('opensimphy_combined_onelab_clear', null, [])
  const getChanged = Module.cwrap('opensimphy_combined_onelab_get_changed', 'number', [])
  const setChanged = Module.cwrap('opensimphy_combined_onelab_set_changed', null, ['number'])
  const initializeLoop = Module.cwrap('opensimphy_combined_loop_initialize', 'number', ['number'])
  const incrementLoop = Module.cwrap('opensimphy_combined_loop_increment', 'number', [])
  const abort = Module.cwrap('opensimphy_combined_abort', null, [])
  const close = Module.cwrap('opensimphy_combined_close', null, [])
  const lastError = Module.cwrap('opensimphy_combined_last_error', 'number', [])
  const heapBytes = Module.cwrap('opensimphy_combined_heap_bytes', 'number', [])
  const serverIdentity = Module.cwrap('opensimphy_combined_server_identity', 'number', [])
  const lastGetdpServerIdentity = Module.cwrap('opensimphy_combined_last_getdp_server_identity', 'number', [])
  const getdpCalls = Module.cwrap('opensimphy_combined_getdp_calls', 'number', [])
  const loopInitializeCalls = Module.cwrap('opensimphy_combined_loop_initialize_calls', 'number', [])
  const loopIncrementCalls = Module.cwrap('opensimphy_combined_loop_increment_calls', 'number', [])
  const jsonImportCalls = Module.cwrap('opensimphy_combined_json_import_calls', 'number', [])
  const jsonExportCalls = Module.cwrap('opensimphy_combined_json_export_calls', 'number', [])

  gmsh.FS = Module.FS
  gmsh.module = Module
  const solver = {
    FS: Module.FS,
    module: Module,
    onelab: {
      clear,
      get() {
        const pointer = getJson()
        if (!pointer) throw new Error('combined runtime could not serialize ONELAB')
        return Module.UTF8ToString(pointer)
      },
      set(json) {
        const status = setJson(json)
        if (status !== 0) throw new Error(`combined runtime rejected ONELAB JSON with status ${status}`)
      },
      getChanged,
      setChanged,
    },
    loop: {
      initialize(limit = 10_000) {
        const points = initializeLoop(limit)
        if (points < 0) throw new Error(`native ONELAB loop exceeds bounded limit ${limit}`)
        return points
      },
      increment: () => Boolean(incrementLoop()),
    },
    abort,
    close,
    diagnostics: {
      heapBytes,
      bridge() {
        const server = serverIdentity()
        const getdpServer = lastGetdpServerIdentity()
        return {
          serverIdentity: server,
          lastGetdpServerIdentity: getdpServer,
          sharedServer: getdpServer !== 0 && getdpServer === server,
          getdpCalls: getdpCalls(),
          loopInitializeCalls: loopInitializeCalls(),
          loopIncrementCalls: loopIncrementCalls(),
          jsonImportCalls: jsonImportCalls(),
          jsonExportCalls: jsonExportCalls(),
        }
      },
      lastError: () => {
        const pointer = lastError()
        return pointer ? Module.UTF8ToString(pointer) : ''
      },
    },
    run(args) {
      if (!args.includes('-onelab')) args = [...args, '-onelab', 'GetDP']
      const pointers = []
      const argv = Module._malloc(args.length * 4)
      try {
        const heap = new Uint32Array(Module.wasmMemory.buffer)
        args.forEach((arg, index) => {
          const size = Module.lengthBytesUTF8(arg) + 1
          const pointer = Module._malloc(size)
          pointers.push(pointer)
          Module.stringToUTF8(arg, pointer, size)
          heap[(argv >> 2) + index] = pointer
        })
        const status = invoke(args.length, argv)
        if (status === 70) throw new Error(this.diagnostics.lastError() || 'combined native exception')
        return status
      } finally {
        pointers.forEach((pointer) => Module._free(pointer))
        Module._free(argv)
      }
    },
  }
  return { ...gmsh, FS: Module.FS, module: Module, solver }
}

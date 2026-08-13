export function createGetdpRuntime(Module) {
  const invoke = Module.cwrap('opensimphy_getdp_run', 'number', ['number', 'number'])
  const setJson = Module.cwrap('opensimphy_getdp_onelab_set_json', 'number', ['string'])
  const getJson = Module.cwrap('opensimphy_getdp_onelab_get_json', 'number', [])
  const clear = Module.cwrap('opensimphy_getdp_onelab_clear', null, [])
  const getChanged = Module.cwrap('opensimphy_getdp_onelab_get_changed', 'number', [])
  const setChanged = Module.cwrap('opensimphy_getdp_onelab_set_changed', null, ['number'])

  return {
    FS: Module.FS,
    module: Module,
    onelab: {
      clear,
      get() {
        const pointer = getJson()
        if (!pointer) throw new Error('GetDP could not serialize its ONELAB database')
        return Module.UTF8ToString(pointer)
      },
      set(json) {
        const status = setJson(json)
        if (status !== 0) throw new Error(`GetDP rejected ONELAB JSON with status ${status}`)
      },
      getChanged,
      setChanged,
    },
    run(args) {
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
        return invoke(args.length, argv)
      } finally {
        pointers.forEach((pointer) => Module._free(pointer))
        Module._free(argv)
      }
    },
  }
}

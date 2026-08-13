export function createGetdpRuntime(Module) {
  const invoke = Module.cwrap('opensimphy_getdp_run', 'number', ['number', 'number'])

  return {
    FS: Module.FS,
    module: Module,
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

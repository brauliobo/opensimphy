import { nextTick } from 'vue'

function vaporBlockRoot(block: unknown): Node | undefined {
  if (block instanceof Node) return block
  if (Array.isArray(block)) {
    for (const child of block) {
      const root = vaporBlockRoot(child)
      if (root) return root
    }
    return
  }
  if (!block || typeof block !== 'object') return
  const record = block as { nodes?: unknown; el?: Node; block?: unknown }
  if (record.el instanceof Node) return record.el
  if ('nodes' in record) return vaporBlockRoot(record.nodes)
  if ('block' in record) return vaporBlockRoot(record.block)
}

type VaporInstanceFields = {
  block?: unknown
  interopVNode?: { el?: Node }
}

type VtuAppLike = {
  _instance?: { proxy?: object | null; vnode?: { el?: Node } }
  _container?: Node | null
}

function vaporRootEl(vm: ({ $?: VaporInstanceFields; $el?: Node } & VaporInstanceFields) | null): Node | undefined {
  if (vm == null) return
  try {
    const el = vm.$el
    if (el) return el
  } catch {
    // VDOM $el reads instance.vnode.el; vapor instances have block instead.
  }
  const inst = vm.$ ?? vm
  return vaporBlockRoot(inst.block) ?? inst.interopVNode?.el
}

function rootElFromApp(app?: VtuAppLike): Node | undefined {
  const vnodeEl = app?._instance?.vnode?.el
  if (vnodeEl instanceof Node) return vnodeEl
  const container = app?._container
  if (!(container instanceof Node)) return
  return container.firstChild instanceof Node ? container.firstChild : container
}

function syntheticVtuVm(el: Node | undefined) {
  const fakeVNode = { el, shapeFlag: 1, component: null, children: null }
  const internal = {
    vnode: fakeVNode,
    subTree: fakeVNode,
    isUnmounted: false,
    setupState: {},
    refs: {},
    proxy: null as unknown,
  }
  const vm = {
    $el: el,
    $: internal,
    $root: undefined,
    $options: {},
    $props: {},
    $data: {},
    $nextTick: nextTick,
  }
  internal.proxy = vm
  return vm
}

function wrapVtuVm<T extends object>(record: T, rootEl: Node | undefined): T {
  const fakeVNode = { el: rootEl, shapeFlag: 1, component: null, children: null }
  const internal = (record as { $?: object }).$ ?? record
  const fakeInternal = new Proxy(internal, {
    get(target, key, receiver) {
      if (key === 'vnode' || key === 'subTree') return fakeVNode
      // Keep VueWrapper.componentVM as this proxy. VTU otherwise wraps the
      // vapor exposeProxy and reads the real instance.vnode (always undefined).
      if (key === 'exposed' || key === 'exposeProxy' || key === 'devtoolsRawSetupState') return undefined
      return Reflect.get(target, key, receiver)
    },
  })
  return new Proxy(record, {
    get(target, key, receiver) {
      if (key === '$el') return rootEl
      if (key === '$') return fakeInternal
      const value = Reflect.get(target, key, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as T
}

// Vue Test Utils 2.5 still constructs VueWrapper from VDOM public instances
// ($el, $.vnode, $.subTree). Vapor refs do not expose those. Wrap the vm for
// the wrapper factory only; do not mutate VaporComponentInstance.
export function withVtuVaporVm<T>(vm: T, app?: VtuAppLike): T {
  const resolved = (vm ?? app?._instance?.proxy ?? null) as (T & object) | null
  if (resolved == null) return wrapVtuVm(syntheticVtuVm(rootElFromApp(app)), rootElFromApp(app)) as T
  return wrapVtuVm(resolved, vaporRootEl(resolved) ?? rootElFromApp(app))
}

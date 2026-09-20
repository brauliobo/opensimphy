/** Official Giac/Xcas WASM (GPL-3.0-or-later). Loaded lazily; never bundled into route chunks. */

interface GiacModule {
  calledRun?: boolean
  onRuntimeInitialized?: () => void
  cwrap: (name: string, returnType: string, argTypes: string[]) => (command: string) => string
}

declare global {
  interface Window {
    Module?: GiacModule
  }
}

let caseval: ((command: string) => string) | undefined
let loading: Promise<void> | undefined

export function giacScriptUrl(): string {
  const base = import.meta.env.BASE_URL
  return `${base.endsWith('/') ? base : `${base}/`}giac/giacwasm.js`
}

export async function ensureGiac(): Promise<void> {
  if (caseval) return
  loading ??= loadGiac().catch((reason) => {
    loading = undefined
    throw reason
  })
  await loading
}

export function giacEval(command: string): string {
  if (!caseval) throw new Error('Giac is not loaded')
  const raw = stripGiacQuotes(String(caseval(command) ?? '').trim())
  if (!raw) throw new Error(`Giac returned an empty result for ${command}`)
  if (raw.startsWith('GIAC_ERROR')) throw new Error(raw.slice('GIAC_ERROR'.length).trim() || raw)
  if (/^(Error|Not implemented|Bad Argument|undef|\?)/i.test(raw)) throw new Error(raw)
  return raw
}

export function giacLatex(expression: string): string {
  return giacEval(`latex(${expression})`)
}

export function parseGiacNumber(raw: string): number | undefined {
  const exact = raw.split('=')[0]?.trim() ?? ''
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(exact)) return Number(exact)
  const approx = raw.split('=')[1]?.trim() ?? ''
  if (approx && Number.isFinite(Number(approx))) return Number(approx)
}

export function formatGiacExact(raw: string): string {
  return raw.split('=')[0]?.trim() || raw
}

export function formatSolveList(raw: string, variable: string): string {
  const body = raw.replace(/^list/, '').replace(/^\[/, '').replace(/\]$/, '')
  return body.split(',').map((part) => {
    const text = part.trim()
    if (!text) return ''
    if (text.includes('=')) {
      const [name, value] = text.split('=').map((item) => item.trim())
      return `${name} = ${value}`
    }
    return `${variable} = ${text}`
  }).filter(Boolean).join(', ')
}

async function loadGiac(): Promise<void> {
  if (import.meta.env.VITEST || (typeof process !== 'undefined' && process.env.VITEST)) {
    await loadGiacFromVendorFile()
    return
  }
  await loadGiacBrowser()
}

async function loadGiacBrowser(): Promise<void> {
  const runtime = globalThis as typeof globalThis & { Module?: GiacModule }
  const Module = runtime.Module ?? {}
  runtime.Module = Module
  const ready = runtimeReady(Module)
  if (!document.querySelector('script[data-giac-wasm]')) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = giacScriptUrl()
      script.async = true
      script.dataset.giacWasm = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load Giac WASM from ${script.src}`))
      document.head.appendChild(script)
    })
  }
  await ready
  bindCaseval(Module)
}

async function loadGiacFromVendorFile(): Promise<void> {
  const { createRequire } = await import('node:module')
  const { existsSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const vm = await import('node:vm')
  const runtime = globalThis as typeof globalThis & { Module?: GiacModule, require?: NodeRequire }
  const path = join(process.cwd(), 'vendor/giacjs/giacwasm.js')
  if (!existsSync(path)) throw new Error('Giac WASM is missing; run npm run giac:acquire')
  runtime.require ??= createRequire(path)
  const Module = runtime.Module ?? {}
  runtime.Module = Module
  const ready = runtimeReady(Module)
  vm.runInThisContext(readFileSync(path, 'utf8'), { filename: path })
  await ready
  bindCaseval(Module)
}

function runtimeReady(Module: GiacModule): Promise<void> {
  if (Module.calledRun && Module.cwrap) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Giac WASM initialization timed out')), 120_000)
    const previous = Module.onRuntimeInitialized
    Module.onRuntimeInitialized = () => {
      clearTimeout(timer)
      previous?.()
      resolve()
    }
  })
}

function bindCaseval(Module: GiacModule): void {
  caseval = Module.cwrap('caseval', 'string', ['string'])
}

function stripGiacQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\"/g, '"')
  return value
}

export function formControlValue(event: Event): string | null {
  const target = event.target
  if (
    target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement
  ) {
    return target.value
  }
  return null
}

export function createRouteWriteGate() {
  let applying = false
  return {
    run(fn: () => void): void {
      applying = true
      try {
        fn()
      } finally {
        applying = false
      }
    },
    isApplying(): boolean {
      return applying
    },
  }
}

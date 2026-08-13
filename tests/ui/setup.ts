import { vi } from 'vitest'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', { value: ResizeObserverMock })
Object.defineProperty(window, 'scrollTo', { value: vi.fn() })
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const context = {
  scale: vi.fn(),
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  fillStyle: '',
}

HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext

vi.mock('plotly.js-dist-min', () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
  },
}))

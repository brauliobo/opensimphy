import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4184',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  workers: 1,
  projects: [{ name: 'chromium-separate-production', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run simulation:verify && VITE_ONELAB_ENABLED=true VITE_ONELAB_PROFILE=separate nice npm run build && nice npm run preview -- --host 127.0.0.1 --port 4184',
    url: 'http://127.0.0.1:4184',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

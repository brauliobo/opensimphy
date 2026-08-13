import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/deployment',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4184',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-netlify', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'VITE_ONELAB_ENABLED=false nice npm run build && nice npm run preview -- --host 127.0.0.1 --port 4184',
    url: 'http://127.0.0.1:4184',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests-pwa',
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4174/MyHub/' },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
})

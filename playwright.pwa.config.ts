import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests-pwa',
  workers: 1,
  retries: 0,
  use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:4174/MyHub/' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/MyHub/',
    reuseExistingServer: false,
  },
})

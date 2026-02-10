import { defineConfig } from '@playwright/test'

const PORT = 3201
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
    testDir: './tests',
    timeout: 45_000,
    fullyParallel: false,
    workers: 1,
    use: {
        baseURL: BASE_URL,
        headless: true,
    },
    webServer: {
        command: `npm run dev -- --port ${PORT}`,
        url: `${BASE_URL}/admin/login`,
        reuseExistingServer: true,
        timeout: 180_000,
    },
})

import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
})

export const openRouterModel = openrouter('google/gemini-2.5-flash-lite', {
    plugins: [{ id: 'response-healing' }],
})

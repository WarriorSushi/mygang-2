import { createOpenAI } from '@ai-sdk/openai'

const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
})

export const openRouterModel = openrouter('google/gemini-2.5-flash-lite')

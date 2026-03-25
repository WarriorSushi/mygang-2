/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { loadEnvConfig } = require('@next/env')
const { createClient } = require('@supabase/supabase-js')

let envLoaded = false

const REPORT_ROOT = path.join(
    process.cwd(),
    'docs',
    'polish and bug fixes',
    'codex-rerun-2026-03-12',
    'repair-rollout'
)

function ensureEnvLoaded() {
    if (envLoaded) return
    loadEnvConfig(process.cwd())
    envLoaded = true
}

function requireEnv(name) {
    ensureEnvLoaded()
    const value = process.env[name]
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
}

function createAdminSupabaseClient() {
    return createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

function ensureReportDir() {
    fs.mkdirSync(REPORT_ROOT, { recursive: true })
    return REPORT_ROOT
}

function writeReportFiles(baseName, report, markdown) {
    ensureReportDir()

    const jsonPath = path.join(REPORT_ROOT, `${baseName}.json`)
    const markdownPath = path.join(REPORT_ROOT, `${baseName}.md`)

    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
    fs.writeFileSync(markdownPath, `${markdown.trim()}\n`)

    return { jsonPath, markdownPath }
}

function loadShippedCharacterCatalog() {
    const filePath = path.join(process.cwd(), 'src', 'constants', 'characters.ts')
    const source = fs.readFileSync(filePath, 'utf8')
    const match = source.match(
        /const BASE_CHARACTERS: BaseCharacterCatalogEntry\[\]\s*=\s*(\[[\s\S]*?\])\s*\r?\n\r?\nconst CHARACTER_CATALOG_BY_STYLE/
    )

    if (!match) {
        throw new Error('Failed to locate BASE_CHARACTERS in src/constants/characters.ts')
    }

    const baseCatalog = vm.runInNewContext(`(${match[1]})`, {}, { filename: filePath })
    if (!Array.isArray(baseCatalog)) {
        throw new Error('Failed to load shipped character catalog from src/constants/characters.ts')
    }

    return baseCatalog.map((entry) => ({
        ...entry,
        avatar: `/avatars/${entry.id}.webp`,
    }))
}

function buildPromptBlock(entry) {
    return `- ID: "${entry.id}", Name: "${entry.name}", Archetype: "${entry.archetype}", Voice: "${entry.voice}", Style: "${entry.sample}"`
}

function buildTypingStyle(entry) {
    const parts = []
    if (typeof entry.typingSpeed === 'number') {
        parts.push(`Typing speed ${entry.typingSpeed.toFixed(2)}x.`)
    }
    if (Array.isArray(entry.tags) && entry.tags.length > 0) {
        parts.push(`Tags: ${entry.tags.join(', ')}.`)
    }
    parts.push(`Reference line: "${entry.sample}"`)
    return parts.join(' ')
}

function buildPersonalityPrompt(entry) {
    const parts = [
        `Role: ${entry.roleLabel || entry.archetype || entry.name}.`,
        `Vibe: ${entry.vibe}.`,
        `Voice: ${entry.voice}.`,
    ]

    if (Array.isArray(entry.tags) && entry.tags.length > 0) {
        parts.push(`Traits: ${entry.tags.join(', ')}.`)
    }

    return parts.join(' ')
}

function buildCharacterRows() {
    return loadShippedCharacterCatalog().map((entry) => ({
        id: entry.id,
        name: entry.name,
        vibe: entry.vibe,
        color: entry.color,
        voice_description: entry.voice,
        typing_style: buildTypingStyle(entry),
        sample_line: entry.sample,
        archetype: entry.archetype,
        personality_prompt: buildPersonalityPrompt(entry),
        avatar_url: entry.avatar ?? null,
        prompt_block: buildPromptBlock(entry),
    }))
}

function unique(values) {
    return [...new Set(values)]
}

module.exports = {
    REPORT_ROOT,
    buildCharacterRows,
    createAdminSupabaseClient,
    ensureReportDir,
    loadShippedCharacterCatalog,
    requireEnv,
    unique,
    writeReportFiles,
}

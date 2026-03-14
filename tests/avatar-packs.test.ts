import fs from 'node:fs'
import path from 'node:path'
import { CHARACTERS, getCharactersForAvatarStyle } from '../src/constants/characters'
import { DEFAULT_AVATAR_STYLE, normalizeAvatarStyle, resolveAvatarUrl } from '../src/lib/avatar-style'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  PASS: ${label}`)
        passed += 1
    } else {
        console.error(`  FAIL: ${label}`)
        failed += 1
    }
}

const expectedIds = CHARACTERS.map((character) => character.id).sort()
const publicRoot = path.join(process.cwd(), 'public', 'avatars')

function getPackFiles(pack: 'human' | 'retro') {
    return fs.readdirSync(path.join(publicRoot, pack)).filter((file) => file.endsWith('.webp')).sort()
}

console.log('=== Avatar Pack Validation ===\n')

console.log('1. Human and Retro packs include every character')
for (const pack of ['human', 'retro'] as const) {
    const files = getPackFiles(pack)
    assert(files.length === expectedIds.length, `${pack} pack has ${expectedIds.length} files`)
    assert(
        JSON.stringify(files) === JSON.stringify(expectedIds.map((id) => `${id}.webp`)),
        `${pack} pack filenames match character ids`
    )
}

console.log('\n2. Style resolver returns the right paths')
assert(resolveAvatarUrl('vee', 'robots') === '/avatars/vee.webp', 'robots resolve from root avatars folder')
assert(resolveAvatarUrl('vee', 'human') === '/avatars/human/vee.webp', 'human resolve from human avatars folder')
assert(resolveAvatarUrl('vee', 'retro') === '/avatars/retro/vee.webp', 'retro resolve from retro avatars folder')

console.log('\n3. Catalog generation respects avatar style')
const humanCatalog = getCharactersForAvatarStyle('human')
const retroCatalog = getCharactersForAvatarStyle('retro')
assert(humanCatalog.every((character) => character.avatar === resolveAvatarUrl(character.id, 'human')), 'human catalog avatars are styled correctly')
assert(retroCatalog.every((character) => character.avatar === resolveAvatarUrl(character.id, 'retro')), 'retro catalog avatars are styled correctly')

console.log('\n4. Invalid or missing styles safely fall back to robots')
assert(normalizeAvatarStyle(undefined) === DEFAULT_AVATAR_STYLE, 'undefined falls back to robots')
assert(normalizeAvatarStyle('mystery-pack') === DEFAULT_AVATAR_STYLE, 'unknown style falls back to robots')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)

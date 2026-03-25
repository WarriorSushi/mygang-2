import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = process.cwd()
const migrationsDir = path.join(projectRoot, 'supabase', 'migrations')
const driftNotePath = path.join('supabase', 'migrations', 'REMOTE_DRIFT_2026-03-25.md')
const supabaseCommand = process.platform === 'win32' ? 'supabase.exe' : 'supabase'
const canonicalRecoveryVersion = '20260324220158'
const acknowledgedRemoteOnlyVersions = [
  '20260316224522',
  '20260317170547',
  '20260317170549',
  '20260317170551',
  '20260317170552',
  '20260317195424',
  '20260317195426',
  '20260317195429',
  '20260317195431',
  '20260317195433',
  '20260317195435',
  '20260317195437',
  '20260317195505',
  '20260317195507',
]
const acknowledgedRemoteOnlySet = new Set(acknowledgedRemoteOnlyVersions)

function listLocalMigrationVersions() {
  return fs.readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .map((name) => name.slice(0, 14))
    .sort()
}

function parseMigrationList(output) {
  const remoteVersions = new Set()
  const rowPattern = /^\s*(\d{14})?\s*\|\s*(\d{14})?\s*\|\s*(.+?)\s*$/

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    const match = line.match(rowPattern)
    if (!match) continue

    const [, , remoteVersion] = match
    if (remoteVersion) remoteVersions.add(remoteVersion)
  }

  return [...remoteVersions].sort()
}

function printList(label, values) {
  console.error(`${label} (${values.length}):`)
  for (const value of values) {
    console.error(`  - ${value}`)
  }
}

function hasCanonicalRecoveryMigration() {
  return fs.readdirSync(migrationsDir)
    .some((name) => name.startsWith(`${canonicalRecoveryVersion}_`) && name.endsWith('.sql'))
}

const result = spawnSync(
  supabaseCommand,
  ['migration', 'list'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  }
)

if (result.status !== 0) {
  process.stderr.write(result.stderr || '')
  console.error('[guard:supabase-migration-parity] Failed to read remote migration history via Supabase CLI.')
  process.exit(result.status ?? 1)
}

const localVersions = listLocalMigrationVersions()
const remoteVersions = parseMigrationList(result.stdout || '')

if (remoteVersions.length === 0) {
  console.error('[guard:supabase-migration-parity] Could not parse any remote migration versions from `supabase migration list`.')
  console.error('[guard:supabase-migration-parity] Raw CLI output:')
  console.error(result.stdout || '(empty)')
  process.exit(1)
}

const localSet = new Set(localVersions)
const remoteSet = new Set(remoteVersions)
const remoteOnly = remoteVersions.filter((version) => !localSet.has(version))
const localOnly = localVersions.filter((version) => !remoteSet.has(version))
const unexpectedRemoteOnly = remoteOnly.filter((version) => !acknowledgedRemoteOnlySet.has(version))
const acknowledgedRemoteOnly = remoteOnly.filter((version) => acknowledgedRemoteOnlySet.has(version))

if (remoteOnly.length === 0 && localOnly.length === 0) {
  console.log('[guard:supabase-migration-parity] Local migration files match the linked remote migration history.')
  process.exit(0)
}

if (unexpectedRemoteOnly.length === 0 && localOnly.length === 0) {
  if (!hasCanonicalRecoveryMigration()) {
    console.error(`[guard:supabase-migration-parity] The linked remote only differs by the acknowledged March 16-17, 2026 history, but the canonical recovery migration ${canonicalRecoveryVersion} is missing from this repo.`)
    console.error(`[guard:supabase-migration-parity] See ${driftNotePath} before attempting db push, db pull, or migration repair.`)
    process.exit(1)
  }

  console.log(`[guard:supabase-migration-parity] Linked remote history still includes ${acknowledgedRemoteOnly.length} acknowledged March 16-17, 2026 remote-only versions.`)
  console.log(`[guard:supabase-migration-parity] Canonical recovery migration ${canonicalRecoveryVersion} is present locally, so this known historical drift is accepted.`)
  process.exit(0)
}

console.error('[guard:supabase-migration-parity] Unexpected migration drift detected between local files and linked remote history.')
if (unexpectedRemoteOnly.length > 0) {
  printList('Unexpected remote-only versions', unexpectedRemoteOnly)
}
if (acknowledgedRemoteOnly.length > 0) {
  printList('Acknowledged remote-only versions', acknowledgedRemoteOnly)
}
if (localOnly.length > 0) {
  printList('Unexpected local-only versions', localOnly)
}
console.error(`[guard:supabase-migration-parity] See ${driftNotePath} before attempting db push, db pull, or migration repair.`)
console.error('[guard:supabase-migration-parity] Do not mark the acknowledged March 16-17, 2026 remote versions reverted, and do not push local migrations to shared environments until the linked diff is empty.')
process.exit(1)

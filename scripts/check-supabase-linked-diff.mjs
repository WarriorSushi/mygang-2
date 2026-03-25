import { spawnSync } from 'node:child_process'

const projectRoot = process.cwd()
const supabaseCommand = process.platform === 'win32' ? 'supabase.exe' : 'supabase'

const result = spawnSync(
  supabaseCommand,
  ['db', 'diff', '--linked', '--schema', 'public'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  }
)

const combinedOutput = [result.stdout || '', result.stderr || '']
  .filter(Boolean)
  .join('\n')
  .trim()

if (result.status !== 0) {
  if (combinedOutput) {
    process.stderr.write(`${combinedOutput}\n`)
  }
  console.error('[guard:supabase-linked-diff] Failed to diff the linked remote schema.')
  console.error('[guard:supabase-linked-diff] Check Docker Desktop, Supabase CLI auth, and the linked project state before treating the repo as authoritative.')
  process.exit(result.status ?? 1)
}

if (!combinedOutput.includes('No schema changes found')) {
  if (combinedOutput) {
    process.stderr.write(`${combinedOutput}\n`)
  }
  console.error('[guard:supabase-linked-diff] The linked remote schema still differs from a fresh replay of the repo migrations.')
  process.exit(1)
}

console.log('[guard:supabase-linked-diff] A fresh replay of the repo migrations matches the linked remote schema.')

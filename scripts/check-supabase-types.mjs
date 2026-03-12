import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = process.cwd()
const envFiles = ['.env.local', '.env']
const targetPath = path.join(projectRoot, 'src', 'lib', 'database.types.ts')

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName)
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function getProjectId() {
  if (process.env.SUPABASE_PROJECT_ID) return process.env.SUPABASE_PROJECT_ID

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null

  try {
    const host = new URL(url).hostname
    return host.split('.')[0] || null
  } catch {
    return null
  }
}

function normalize(content) {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n'
}

for (const envFile of envFiles) {
  loadEnvFile(envFile)
}

const projectId = getProjectId()
if (!projectId) {
  console.error('[guard:supabase-types] Could not resolve Supabase project id from SUPABASE_PROJECT_ID or NEXT_PUBLIC_SUPABASE_URL.')
  process.exit(1)
}

const supabaseCommand = process.platform === 'win32' ? 'supabase.exe' : 'supabase'

const generated = spawnSync(
  supabaseCommand,
  ['gen', 'types', 'typescript', '--project-id', projectId, '--schema', 'public'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
  }
)

if (generated.status !== 0) {
  process.stderr.write(generated.stderr || '')
  console.error('[guard:supabase-types] Supabase type generation failed.')
  process.exit(generated.status ?? 1)
}

if (!fs.existsSync(targetPath)) {
  console.error(`[guard:supabase-types] Missing checked-in types file: ${targetPath}`)
  process.exit(1)
}

const current = normalize(fs.readFileSync(targetPath, 'utf8'))
const next = normalize(generated.stdout || '')

if (current !== next) {
  console.error('[guard:supabase-types] src/lib/database.types.ts is stale.')
  console.error(`[guard:supabase-types] Re-run: supabase gen types typescript --project-id ${projectId} --schema public > src/lib/database.types.ts`)
  process.exit(1)
}

console.log('[guard:supabase-types] src/lib/database.types.ts is up to date.')

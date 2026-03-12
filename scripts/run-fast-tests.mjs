import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const testsDir = path.join(process.cwd(), 'tests')
const fastTests = fs.readdirSync(testsDir)
  .filter((file) => file.endsWith('.test.ts'))
  .sort()

if (fastTests.length === 0) {
  console.log('[test:fast] No script-style tests found.')
  process.exit(0)
}

for (const file of fastTests) {
  const fullPath = path.join('tests', file)
  console.log(`[test:fast] Running ${fullPath}`)
  const result = spawnSync(`pnpm exec tsx "${fullPath}"`, {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log(`[test:fast] Passed ${fastTests.length} script-style tests.`)

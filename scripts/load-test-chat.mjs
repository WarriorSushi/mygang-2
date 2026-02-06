const baseUrl = process.env.CHAT_URL || 'http://localhost:3000'
const concurrency = Number(process.env.CONCURRENCY || 5)
const requestsPerUser = Number(process.env.REQUESTS || 2)

const activeGangIds = ['kael', 'nyx', 'rico', 'cleo']

async function runUser(id) {
  const timings = []
  for (let i = 0; i < requestsPerUser; i++) {
    const payload = {
      messages: [
        {
          id: `${id}-${i}-u`,
          speaker: 'user',
          content: `Load test message ${i} from user ${id}`,
          created_at: new Date().toISOString()
        }
      ],
      activeGangIds,
      userName: `LoadTester${id}`,
      userNickname: 'Load',
      silentTurns: 0,
      burstCount: 0,
      chatMode: 'ecosystem'
    }

    const start = Date.now()
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mock-ai': 'true' },
      body: JSON.stringify(payload)
    })
    const elapsed = Date.now() - start
    timings.push(elapsed)
    if (!res.ok) {
      const body = await res.text()
      console.error(`User ${id} request failed (${res.status}): ${body}`)
    } else {
      await res.json()
    }
  }
  return timings
}

async function main() {
  const users = Array.from({ length: concurrency }, (_, i) => i + 1)
  const allTimings = (await Promise.all(users.map(runUser))).flat()
  const total = allTimings.reduce((sum, t) => sum + t, 0)
  const avg = allTimings.length ? (total / allTimings.length).toFixed(2) : 0
  const max = allTimings.length ? Math.max(...allTimings) : 0
  console.log(`Load test complete: ${allTimings.length} requests`)
  console.log(`Avg latency: ${avg}ms`)
  console.log(`Max latency: ${max}ms`)
}

main().catch((err) => {
  console.error('Load test failed:', err)
  process.exit(1)
})

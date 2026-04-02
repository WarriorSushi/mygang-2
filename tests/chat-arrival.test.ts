import {
    buildArrivalBannerCopy,
    buildArrivalLoaderSteps,
    buildPendingArrivalContext,
    buildStarterChips,
    consumePendingArrivalContext,
    readPendingArrivalContext,
    savePendingArrivalContext,
} from '../src/lib/chat-arrival'

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

class FakeStorage {
    private values = new Map<string, string>()

    getItem(key: string) {
        return this.values.has(key) ? (this.values.get(key) as string) : null
    }

    setItem(key: string, value: string) {
        this.values.set(key, value)
    }

    removeItem(key: string) {
        this.values.delete(key)
    }
}

class FailingStorage extends FakeStorage {
    override setItem(key: string, value: string) {
        void key
        void value
        throw new Error('storage unavailable')
    }
}

type FakeArrivalWindow = {
    sessionStorage: FakeStorage
    localStorage: FakeStorage
}

function withFakeWindow<T>(fn: (windowRef: { sessionStorage: FakeStorage; localStorage: FakeStorage }) => T) {
    const globalWindow = globalThis as unknown as { window?: FakeArrivalWindow }
    const previousWindow = globalWindow.window
    const fakeWindow: FakeArrivalWindow = {
        sessionStorage: new FakeStorage(),
        localStorage: new FakeStorage(),
    }

    globalWindow.window = fakeWindow
    try {
        return fn(fakeWindow)
    } finally {
        if (previousWindow === undefined) {
            delete globalWindow.window
        } else {
            globalWindow.window = previousWindow
        }
    }
}

console.log('\n1. Arrival context includes freshness marker and intro preference')
{
    const context = buildPendingArrivalContext({
        userName: 'Irfan',
        squad: [{ id: 'atlas', name: 'Atlas', roleLabel: 'the tactician' }],
        customNames: { atlas: 'Atlas' },
        vibeSummary: 'honest, balanced, calm',
    })

    assert(typeof context.arrivalToken === 'string' && context.arrivalToken.length > 8, 'arrival token exists')
    assert(context.preferServerIntro === true, 'server intro preferred by default')
    assert(context.vibeSummary === 'honest, balanced, calm', 'vibe summary preserved')
}

console.log('\n2. Session storage wins, local fallback works, and consume clears both')
{
    withFakeWindow((win) => {
        const context = buildPendingArrivalContext({
            userName: 'Irfan',
            squad: [
                { id: 'vee', name: 'Vee' },
                { id: 'sage', name: 'Sage' },
            ],
            vibeSummary: 'warm, balanced, lively',
        })

        savePendingArrivalContext(context)
        assert(win.sessionStorage.getItem('mygang-pending-arrival') !== null, 'save prefers session storage')
        assert(win.localStorage.getItem('mygang-pending-arrival-fallback') === null, 'save avoids local fallback when session works')

        win.localStorage.setItem('mygang-pending-arrival-fallback', JSON.stringify(context))

        const fromSession = readPendingArrivalContext({ arrivalToken: context.arrivalToken })
        assert(fromSession?.arrivalToken === context.arrivalToken, 'session payload read')

        win.sessionStorage.removeItem('mygang-pending-arrival')
        const fromFallback = readPendingArrivalContext({ arrivalToken: context.arrivalToken })
        assert(fromFallback?.arrivalToken === context.arrivalToken, 'local fallback read')

        const consumed = consumePendingArrivalContext({ arrivalToken: context.arrivalToken })
        assert(consumed?.arrivalToken === context.arrivalToken, 'consume returns context')
        assert(win.sessionStorage.getItem('mygang-pending-arrival') === null, 'session cleared on consume')
        assert(win.localStorage.getItem('mygang-pending-arrival-fallback') === null, 'fallback cleared on consume')
    })
}

console.log('\n3. Local fallback is only used when session storage fails')
{
    const globalWindow = globalThis as unknown as { window?: FakeArrivalWindow }
    const previousWindow = globalWindow.window
    const fakeWindow: FakeArrivalWindow = {
        sessionStorage: new FailingStorage(),
        localStorage: new FakeStorage(),
    }

    globalWindow.window = fakeWindow
    try {
        const context = buildPendingArrivalContext({
            userName: 'Irfan',
            squad: [{ id: 'atlas', name: 'Atlas' }],
        })

        savePendingArrivalContext(context)
        assert(fakeWindow.localStorage.getItem('mygang-pending-arrival-fallback') !== null, 'fallback cache is written when session storage fails')
    } finally {
        if (previousWindow === undefined) {
            delete globalWindow.window
        } else {
            globalWindow.window = previousWindow
        }
    }
}

console.log('\n4. Expired arrivals are ignored')
{
    withFakeWindow((win) => {
        const expiredContext = {
            createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
            arrivalToken: 'expired-token',
            userName: 'Irfan',
            memoryPreviewLimit: 5,
            vibeSummary: null,
            preferServerIntro: true,
            squad: [],
        }

        win.sessionStorage.setItem('mygang-pending-arrival', JSON.stringify(expiredContext))
        assert(readPendingArrivalContext({ arrivalToken: 'expired-token' }) === null, 'expired arrival rejected')
    })
}

console.log('\n5. Arrival copy mentions light recall and feels specific')
{
    const context = buildPendingArrivalContext({
        userName: 'Irfan',
        squad: [
            { id: 'vee', name: 'Vee', roleLabel: 'the sweet flirt' },
            { id: 'atlas', name: 'Atlas', roleLabel: 'the tactician' },
            { id: 'sage', name: 'Sage', roleLabel: 'the listener' },
        ],
        vibeSummary: 'honest, balanced, calm',
    })

    const steps = buildArrivalLoaderSteps(context)
    const banner = buildArrivalBannerCopy(context)
    assert(steps.some((step) => step.caption.includes('light recall')), 'loader explains light recall')
    assert(steps.some((step) => step.caption.includes('honest, balanced, calm')), 'loader uses vibe summary')
    assert(banner.detail.includes('light-recall preview'), 'banner explains light recall')
    assert(banner.detail.includes('honest, balanced, calm'), 'banner includes vibe summary')
}

console.log('\n6. Starter chips are personalized')
{
    const context = buildPendingArrivalContext({
        userName: 'Irfan',
        squad: [
            { id: 'vee', name: 'Vee', roleLabel: 'the sweet flirt' },
            { id: 'atlas', name: 'Atlas', roleLabel: 'the tactician' },
        ],
        vibeSummary: 'honest, balanced, calm',
    })

    const chips = buildStarterChips(context, 'Irfan', ['Vee', 'Atlas'])
    assert(chips.length === 4, 'four chips returned')
    assert(chips.some((chip) => chip.toLowerCase().includes('honest')), 'chips react to vibe')
    assert(chips.some((chip) => chip.toLowerCase().includes('crew')), 'chips reference the crew')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)

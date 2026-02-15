'use client'

import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/stores/chat-store'
import { trackEvent } from '@/lib/analytics'

const AUTO_LOW_COST_STRESS_WINDOW_MS = 2 * 60 * 1000
const AUTO_LOW_COST_HARD_WINDOW_MS = 5 * 60 * 1000
const AUTO_LOW_COST_RECOVERY_TURNS = 10

interface UseCapacityManagerArgs {
    onToast: (message: string) => void
}

export function useCapacityManager({ onToast }: UseCapacityManagerArgs) {
    const { lowCostMode } = useChatStore()

    const [autoLowCostMode, setAutoLowCostMode] = useState(false)
    const autoLowCostModeRef = useRef(false)
    const capacityErrorTimestampsRef = useRef<number[]>([])
    const successfulUserTurnsSinceCapacityRef = useRef(0)

    // Keep ref in sync with state
    useEffect(() => {
        autoLowCostModeRef.current = autoLowCostMode
    }, [autoLowCostMode])

    // If user manually enables lowCostMode while auto mode is active, reset auto mode
    useEffect(() => {
        if (!lowCostMode) return
        if (!autoLowCostModeRef.current) return
        autoLowCostModeRef.current = false
        capacityErrorTimestampsRef.current = []
        successfulUserTurnsSinceCapacityRef.current = 0
        setAutoLowCostMode(false)
    }, [lowCostMode])

    const recordCapacityError = (status: number, isUserInitiated: boolean) => {
        if (status !== 429 && status !== 402) return
        if (!isUserInitiated) return

        const now = Date.now()
        const withinHardWindow = capacityErrorTimestampsRef.current
            .filter((timestamp) => now - timestamp <= AUTO_LOW_COST_HARD_WINDOW_MS)
        withinHardWindow.push(now)
        capacityErrorTimestampsRef.current = withinHardWindow
        successfulUserTurnsSinceCapacityRef.current = 0

        const stressCount = withinHardWindow.filter((timestamp) => now - timestamp <= AUTO_LOW_COST_STRESS_WINDOW_MS).length
        const hardCount = withinHardWindow.length
        const shouldEnableAutoMode = stressCount >= 2 || hardCount >= 4
        if (!lowCostMode && shouldEnableAutoMode && !autoLowCostModeRef.current) {
            autoLowCostModeRef.current = true
            setAutoLowCostMode(true)
            onToast('Capacity is tight. Running temporary low-cost mode.')
            trackEvent('auto_low_cost_mode_enabled', {
                metadata: {
                    status,
                    stressCount,
                    hardCount
                }
            })
        }
    }

    const recordSuccessfulUserTurn = () => {
        if (!autoLowCostModeRef.current || lowCostMode) return

        successfulUserTurnsSinceCapacityRef.current += 1
        if (successfulUserTurnsSinceCapacityRef.current < AUTO_LOW_COST_RECOVERY_TURNS) return

        autoLowCostModeRef.current = false
        capacityErrorTimestampsRef.current = []
        successfulUserTurnsSinceCapacityRef.current = 0
        setAutoLowCostMode(false)
        onToast('Capacity recovered. Restored full mode.')
        trackEvent('auto_low_cost_mode_disabled', {
            metadata: {
                reason: 'recovery',
                stableUserTurns: AUTO_LOW_COST_RECOVERY_TURNS
            }
        })
    }

    return {
        autoLowCostMode,
        autoLowCostModeRef,
        setAutoLowCostMode,
        recordCapacityError,
        recordSuccessfulUserTurn,
    }
}

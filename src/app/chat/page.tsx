'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChatStore, Message } from '@/stores/chat-store'
import { useShallow } from 'zustand/react/shallow'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { isSquadTierWriteError, trackOperationalError } from '@/lib/operational-telemetry'
import { saveGang, deactivateSquadTierMembers } from '@/app/auth/actions'
import { getCharactersForAvatarStyle } from '@/constants/characters'

// Modular components
import { ChatHeader } from '@/components/chat/chat-header'
import { MessageList } from '@/components/chat/message-list'
const MemoryVault = dynamic(() => import('@/components/chat/memory-vault').then((m) => m.MemoryVault), { ssr: false })
const ChatSettings = dynamic(() => import('@/components/chat/chat-settings').then((m) => m.ChatSettings), { ssr: false })
import { ChatInput } from '@/components/chat/chat-input'
import { AiDisclaimer } from '@/components/chat/ai-disclaimer'
import { ErrorBoundary } from '@/components/orchestrator/error-boundary'
import { InlineToast } from '@/components/chat/inline-toast'
import { MessagesRemainingBanner } from '@/components/billing/messages-remaining-banner'
const SquadReconcile = dynamic(() => import('@/components/orchestrator/squad-reconcile').then((m) => m.SquadReconcile), { ssr: false })
const PaywallPopup = dynamic(() => import('@/components/billing/paywall-popup').then((m) => m.PaywallPopup), { ssr: false })
const ConfettiCelebration = dynamic(() => import('@/components/effects/confetti-celebration').then((m) => m.ConfettiCelebration), { ssr: false })
const UpgradePickerModal = dynamic(() => import('@/components/squad/upgrade-picker-modal').then((m) => m.UpgradePickerModal), { ssr: false })
const DowngradeKeeperModal = dynamic(() => import('@/components/squad/downgrade-keeper-modal').then((m) => m.DowngradeKeeperModal), { ssr: false })

// Custom hooks
import { useChatHistory } from '@/hooks/use-chat-history'
import { useTypingSimulation } from '@/hooks/use-typing-simulation'
import { useCapacityManager } from '@/hooks/use-capacity-manager'
import { useAutonomousFlow } from '@/hooks/use-autonomous-flow'
import { useChatApi } from '@/hooks/use-chat-api'
import { useTabPresence } from '@/hooks/use-tab-presence'

function getStarterChips(name: string) {
    const label = name || 'everyone'
    return [
        `Hey! I'm ${label}, what's good?`,
        "What's up guys?",
        "Hype me up rn",
        "Roast me lol",
    ]
}

type SettingsPanelTarget = 'root' | 'wallpaper' | 'rename'

export default function ChatPage() {
    const {
        messages,
        activeGang,
        userId,
        userName,
        userNickname,
        isHydrated,
        chatMode,
        ecosystemSpeed,
        lowCostMode,
        chatWallpaper,
        subscriptionTier,
        avatarStylePreference,
        squadConflict,
        setSquadConflict,
        pendingUpgrade,
        setPendingUpgrade,
        pendingDowngrade,
        setPendingDowngrade,
        setActiveGang,
    } = useChatStore(useShallow((s) => ({
        messages: s.messages,
        activeGang: s.activeGang,
        userId: s.userId,
        userName: s.userName,
        userNickname: s.userNickname,
        isHydrated: s.isHydrated,
        chatMode: s.chatMode,
        ecosystemSpeed: s.ecosystemSpeed,
        lowCostMode: s.lowCostMode,
        chatWallpaper: s.chatWallpaper,
        subscriptionTier: s.subscriptionTier,
        avatarStylePreference: s.avatarStylePreference,
        squadConflict: s.squadConflict,
        setSquadConflict: s.setSquadConflict,
        pendingUpgrade: s.pendingUpgrade,
        setPendingUpgrade: s.setPendingUpgrade,
        pendingDowngrade: s.pendingDowngrade,
        setPendingDowngrade: s.setPendingDowngrade,
        setActiveGang: s.setActiveGang,
    })))

    const hasUserSentMessage = useMemo(() => messages.some((m) => m.speaker === 'user'), [messages])

    const [isVaultOpen, setIsVaultOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [settingsPanelTarget, setSettingsPanelTarget] = useState<SettingsPanelTarget>('root')
    const [showResumeBanner, setShowResumeBanner] = useState(false)
    const [resumeBannerText, setResumeBannerText] = useState('Resumed your last session')
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [isOnline, setIsOnline] = useState(true)
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)
    const [paywallOpen, setPaywallOpen] = useState(false)
    const [paywallCooldown, setPaywallCooldown] = useState(0)
    const [paywallTier, setPaywallTier] = useState('free')
    const [showConfetti, setShowConfetti] = useState(false)
    const [cooldownUntil, setCooldownUntil] = useState(() => {
        if (typeof window === 'undefined') return 0
        const saved = window.sessionStorage.getItem('mygang-cooldown-until')
        if (!saved) return 0
        const ts = parseInt(saved, 10)
        return ts > Date.now() ? ts : 0
    })
    const [cooldownLabel, setCooldownLabel] = useState<string | null>(null)

    const captureRootRef = useRef<HTMLDivElement>(null)
    const resumeBannerRef = useRef(false)
    const sessionRef = useRef<{ id: string; startedAt: number } | null>(null)
    const { theme } = useTheme()
    const router = useRouter()

    const onToast = useCallback((msg: string) => setToastMessage(msg), [])

    const onPaywall = useCallback((cooldownSeconds: number, tier: string) => {
        setPaywallCooldown(cooldownSeconds)
        setPaywallTier(tier)
        setPaywallOpen(true)
        if (cooldownSeconds > 0) {
            const until = Date.now() + cooldownSeconds * 1000
            setCooldownUntil(until)
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('mygang-cooldown-until', String(until))
            }
        }
    }, [])

    const openSettingsPanel = useCallback((panel: SettingsPanelTarget = 'root') => {
        setSettingsPanelTarget(panel)
        setIsSettingsOpen(true)
    }, [])


    // ── Hooks ──

    const typing = useTypingSimulation()

    const capacity = useCapacityManager({ onToast })

    const api = useChatApi({
        activeGang,
        userName,
        userNickname,
        chatMode,
        ecosystemSpeed,
        lowCostMode,
        isOnline,
        autoLowCostModeRef: capacity.autoLowCostModeRef,
        onToast,
        queueTypingUser: typing.queueTypingUser,
        removeTypingUser: typing.removeTypingUser,
        clearTypingUsers: typing.clearTypingUsers,
        bumpFastMode: typing.bumpFastMode,
        triggerActivityPulse: typing.triggerActivityPulse,
        triggerReadingStatuses: typing.triggerReadingStatuses,
        recordCapacityError: capacity.recordCapacityError,
        recordSuccessfulUserTurn: capacity.recordSuccessfulUserTurn,
        setReplyingTo,
        onPaywall,
    })

    const history = useChatHistory({
        userId,
        isHydrated,
        isOnline,
        isGeneratingRef: api.isGeneratingRef,
        pendingUserMessagesRef: api.pendingUserMessagesRef,
        debounceTimerRef: api.debounceTimerRef,
    })
    const shouldShowEmptyStatePrompts = history.historyBootstrapDone && history.historyStatus === 'empty'

    const autonomous = useAutonomousFlow({
        isGeneratingRef: api.isGeneratingRef,
        pendingUserMessagesRef: api.pendingUserMessagesRef,
        sendToApiRef: api.sendToApiRef,
        lastUserMessageIdRef: api.lastUserMessageIdRef,
        autoLowCostModeRef: capacity.autoLowCostModeRef,
        autonomousBackoffUntilRef: api.autonomousBackoffUntilRef,
        idleAutoCountRef: api.idleAutoCountRef,
        initialGreetingRef: api.initialGreetingRef,
        queueTypingUser: typing.queueTypingUser,
        removeTypingUser: typing.removeTypingUser,
        pulseStatus: typing.pulseStatus,
        pickStatusFor: typing.pickStatusFor,
        historyBootstrapDone: history.historyBootstrapDone,
        historyStatus: history.historyStatus,
    })

    // Patch autonomous callbacks into API hook bridge refs (read at call time via .current)
    api.clearIdleAutonomousTimerRef.current = autonomous.clearIdleAutonomousTimer
    api.scheduleIdleAutonomousRef.current = autonomous.scheduleIdleAutonomous
    api.triggerLocalGreetingRef.current = autonomous.triggerLocalGreeting

    // Title-based unread presence (shows count while tab is hidden)
    useTabPresence(messages)

    // Show toast on history sync failure
    useEffect(() => {
        if (history.historyStatus === 'error') {
            setToastMessage('Could not load chat history.')
        }
    }, [history.historyStatus])

    const handleReplyMessage = useCallback((message: Message) => setReplyingTo(message), [])

    const replyingToDisplay = useMemo(() => {
        if (!replyingTo) return null
        return {
            id: replyingTo.id,
            speaker: replyingTo.speaker === 'user'
                ? 'user'
                : (activeGang.find((c) => c.id === replyingTo.speaker)?.name || replyingTo.speaker),
            content: replyingTo.content
        }
    }, [replyingTo, activeGang])

    // ── Auth guard: redirect to landing if not authenticated ──
    useEffect(() => {
        if (isHydrated && !userId) {
            router.replace('/')
        }
    }, [isHydrated, userId, router])

    // ── Guard: Redirect if no squad ──
    useEffect(() => {
        if (isHydrated && userId && activeGang.length === 0) {
            router.replace('/post-auth')
        }
    }, [activeGang, isHydrated, router, userId])

    // ── Analytics session ──
    useEffect(() => {
        if (!isHydrated) return
        const session = ensureAnalyticsSession()
        sessionRef.current = { id: session.id, startedAt: session.startedAt }
        if (session.isNew) {
            trackEvent('session_start', { sessionId: session.id, metadata: { source: 'chat' } })
        }
    }, [isHydrated])

    // ── Purchase celebration: trigger one-time greeting from characters ──
    // Uses sessionStorage (fast) + DB flag (reliable fallback for tab closure)
    const purchaseCelebrationTriggeredRef = useRef(false)
    useEffect(() => {
        if (!isHydrated || !userId || activeGang.length === 0) return
        if (purchaseCelebrationTriggeredRef.current) return
        if (api.isGeneratingRef.current) return

        // Check sessionStorage first (fast path)
        const sessionPlan = typeof window !== 'undefined'
            ? window.sessionStorage.getItem('mygang_just_purchased') as 'basic' | 'pro' | null
            : null

        const triggerCelebration = (plan: 'basic' | 'pro') => {
            purchaseCelebrationTriggeredRef.current = true
            setShowConfetti(true)
            if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem('mygang_just_purchased')
            }
            // Clear DB flag
            import('@/lib/supabase/client').then(({ createClient }) => {
                const supabase = createClient()
                supabase.from('profiles').update({ purchase_celebration_pending: null }).eq('id', userId).then(() => {})
            })

            const timer = setTimeout(() => {
                if (api.isGeneratingRef.current) return
                api.sendToApiRef.current({
                    isIntro: false,
                    isAutonomous: true,
                    purchaseCelebration: plan,
                }).catch((err) => console.error('Purchase celebration error:', err))
            }, 1500)
            return timer
        }

        if (sessionPlan) {
            const timer = triggerCelebration(sessionPlan)
            return () => clearTimeout(timer)
        }

        // Fallback: check DB flag (handles tab closure before sessionStorage was read)
        let cancelled = false
        let dbTimer: ReturnType<typeof setTimeout> | undefined
        import('@/lib/supabase/client').then(({ createClient }) => {
            const supabase = createClient()
            supabase.from('profiles')
                .select('purchase_celebration_pending, subscription_tier')
                .eq('id', userId)
                .single()
                .then(({ data }) => {
                    const rawCelebration = data?.purchase_celebration_pending as string | boolean | null | undefined
                    if (cancelled || !rawCelebration) return
                    const plan = rawCelebration === 'pro'
                        ? 'pro'
                        : rawCelebration === 'basic'
                            ? 'basic'
                            : data?.subscription_tier === 'pro'
                                ? 'pro'
                                : 'basic'
                    dbTimer = triggerCelebration(plan)
                })
        })
        return () => {
            cancelled = true
            if (dbTimer) clearTimeout(dbTimer)
        }
    }, [isHydrated, userId, activeGang.length, api.isGeneratingRef, api.sendToApiRef])

    // ── Cleanup timers ──
    useEffect(() => {
        const greetingTimersRef = autonomous.greetingTimersRef
        const idleAutonomousTimerRef = autonomous.idleAutonomousTimerRef
        const statusTimersRef = typing.statusTimersRef
        const typingFlushRef = typing.typingFlushRef
        const fastModeTimerRef = typing.fastModeTimerRef
        return () => {
            if (typingFlushRef.current) clearTimeout(typingFlushRef.current)
            if (fastModeTimerRef.current) clearTimeout(fastModeTimerRef.current)
            greetingTimersRef.current.forEach(clearTimeout)
            Object.values(statusTimersRef.current).forEach((timer) => {
                if (timer) clearTimeout(timer)
            })
            if (idleAutonomousTimerRef.current) clearTimeout(idleAutonomousTimerRef.current)
        }
    }, [autonomous.greetingTimersRef, autonomous.idleAutonomousTimerRef, typing.fastModeTimerRef, typing.statusTimersRef, typing.typingFlushRef])

    // ── Online/offline ──
    useEffect(() => {
        // Sync initial state client-side (avoids hydration mismatch)
        setIsOnline(navigator.onLine)
        const goOnline = () => setIsOnline(true)
        const goOffline = () => {
            setIsOnline(false)
            setToastMessage('You are offline. Messages will send after reconnecting.')
        }
        window.addEventListener('online', goOnline)
        window.addEventListener('offline', goOffline)
        return () => {
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [])

    // ── Resume banner ──
    useEffect(() => {
        if (isHydrated && messages.length > 0 && !resumeBannerRef.current) {
            const lastMessage = messages[messages.length - 1]
            const lastTime = lastMessage ? new Date(lastMessage.created_at).getTime() : 0
            const sessionStart = sessionRef.current?.startedAt ?? Date.now()
            const gapMs = lastTime ? Date.now() - lastTime : 0
            const hasUserMessages = messages.some((m) => m.speaker === 'user')
            const fromPreviousSession = lastTime > 0 && lastTime < sessionStart - 2 * 60 * 1000

            if (!hasUserMessages && !fromPreviousSession) return
            if (gapMs < 10 * 60 * 1000 && !fromPreviousSession) return

            resumeBannerRef.current = true
            if (gapMs > 6 * 60 * 60 * 1000) {
                const hours = Math.floor(gapMs / (1000 * 60 * 60))
                const days = Math.floor(hours / 24)
                const label = days > 0 ? `${days} day${days === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`
                setResumeBannerText(`Welcome back. It has been ${label}.`)
            } else {
                setResumeBannerText('Resumed your last session')
            }
            setShowResumeBanner(true)
            const timer = setTimeout(() => setShowResumeBanner(false), 6000)
            return () => clearTimeout(timer)
        }
    }, [isHydrated, messages])

    // ── Cooldown countdown ──
    useEffect(() => {
        if (cooldownUntil <= Date.now()) {
            setCooldownLabel(null)
            return
        }
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
            if (remaining <= 0) {
                setCooldownLabel(null)
                setCooldownUntil(0)
                return
            }
            const mins = Math.floor(remaining / 60)
            const secs = remaining % 60
            setCooldownLabel(`Resume in ${mins}:${secs.toString().padStart(2, '0')}`)
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [cooldownUntil])

    // H5 FIX: Clear cooldown when subscription tier changes (user just upgraded)
    useEffect(() => {
        setCooldownUntil(0)
        setCooldownLabel(null)
        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('mygang-cooldown-until')
        }
    }, [subscriptionTier])

    // ── Toast auto-dismiss ──
    useEffect(() => {
        if (!toastMessage) return
        const timer = setTimeout(() => setToastMessage(null), 4000)
        return () => clearTimeout(timer)
    }, [toastMessage])

    // ── Screenshot ──
    const takeScreenshot = async () => {
        if (captureRootRef.current === null) return

        const waitForFrame = () => new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve())
        })

        try {
            setIsSettingsOpen(false)
            setIsVaultOpen(false)
            await waitForFrame()
            await waitForFrame()
            await new Promise((resolve) => setTimeout(resolve, 150))
            if (typeof document !== 'undefined' && 'fonts' in document) {
                await document.fonts.ready
            }

            const el = captureRootRef.current
            const rect = el.getBoundingClientRect()

            // Pin all flex/min-h-0 descendants to their current sizes so
            // the html-to-image clone doesn't collapse them.
            const pinned: { node: HTMLElement; prev: string }[] = []
            el.querySelectorAll<HTMLElement>('*').forEach((child) => {
                const style = getComputedStyle(child)
                if (style.minHeight === '0px' || style.flex !== '0 1 auto') {
                    const childRect = child.getBoundingClientRect()
                    pinned.push({ node: child, prev: child.style.cssText })
                    child.style.width = `${childRect.width}px`
                    child.style.height = `${childRect.height}px`
                    child.style.flex = 'none'
                    child.style.minHeight = 'unset'
                    child.style.overflow = 'hidden'
                }
            })

            let dataUrl: string
            try {
                const { toPng } = await import('html-to-image')
                dataUrl = await toPng(el, {
                    cacheBust: true,
                    pixelRatio: 2,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: theme === 'dark' ? '#0b0f17' : '#eff3f8',
                    style: {
                        width: `${rect.width}px`,
                        height: `${rect.height}px`,
                        flex: 'none',
                        minHeight: 'unset',
                        overflow: 'hidden',
                    },
                    filter: (node) => {
                        if (!(node instanceof HTMLElement)) return true
                        return node.dataset.screenshotExclude !== 'true'
                    },
                })
            } finally {
                // Restore original styles regardless of success/failure
                for (const { node, prev } of pinned) {
                    node.style.cssText = prev
                }
            }

            const link = document.createElement('a')
            link.download = `mygang-moment-${Date.now()}.png`
            link.href = dataUrl
            link.click()
            setToastMessage('Moment captured.')
        } catch (err) {
            console.error('Screenshot failed:', err)
            setToastMessage('Could not capture this moment. Try again.')
        }
    }

    // I23: Show skeleton during store hydration to prevent flash of empty UI
    if (!isHydrated) {
        return (
            <div className="flex h-dvh items-center justify-center bg-background">
                <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
            </div>
        )
    }

    return (
        <main id="main-content" className="flex flex-col h-dvh bg-background text-foreground overflow-hidden relative isolate">
            <div className="chat-wallpaper-layer" data-wallpaper={chatWallpaper} aria-hidden="true" />

            <div ref={captureRootRef} className="flex-1 flex flex-col w-full relative min-h-0 z-10">
                <ChatHeader
                    activeGang={activeGang}
                    onOpenVault={() => {
                        setIsVaultOpen(true)
                    }}
                    onOpenSettings={() => openSettingsPanel('root')}
                    onRefresh={() => history.syncLatestHistory(true)}
                    typingUsers={typing.typingUsers}
                    memoryActive={true}
                    autoLowCostActive={capacity.autoLowCostMode && !lowCostMode}
                    tokenUsage={api.lastTokenUsageRef.current}
                    subscriptionTier={subscriptionTier}
                    chatMode={chatMode}
                />

                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="px-4 max-w-3xl mx-auto w-full">
                        {showResumeBanner && (
                            <div className="mb-2 rounded-full border border-border/50 bg-muted/40 px-4 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                                {resumeBannerText}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col">
                        <ErrorBoundary>
                            <MessageList
                                messages={messages}
                                activeGang={activeGang}
                                isFastMode={typing.isFastMode}
                                hasMoreHistory={history.hasMoreHistory}
                                loadingHistory={history.isLoadingOlderHistory}
                                onLoadOlderHistory={history.loadOlderHistory}
                                onReplyMessage={handleReplyMessage}
                                onLikeMessage={api.handleQuickLike}
                                onRetryMessage={api.handleRetryMessage}
                                typingUsers={typing.typingUsers}
                                historyError={history.historyStatus === 'error'}
                                onRetryHistory={history.retryBootstrap}
                            />
                        </ErrorBoundary>
                    </div>
                </div>

                <div className="shrink-0 px-4 pb-0">
                    {!isOnline && (
                        <div className="mx-3 sm:mx-0 mb-2 rounded-xl border border-amber-600/40 dark:border-amber-400/40 bg-amber-100/60 dark:bg-amber-400/10 px-3 py-2 text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-200">
                            Offline mode - reconnect to send messages
                        </div>
                    )}
                    <MessagesRemainingBanner />
                    <ChatInput
                        onSend={api.handleSend}
                        disabled={!isOnline || !!cooldownLabel}
                        online={isOnline}
                        replyingTo={replyingToDisplay}
                        onCancelReply={() => setReplyingTo(null)}
                        starterChips={!hasUserSentMessage && shouldShowEmptyStatePrompts ? getStarterChips(userName || '') : []}
                        cooldownPlaceholder={cooldownLabel}
                    />
                    <AiDisclaimer />
                </div>
            </div>

            <InlineToast
                message={toastMessage}
                onClose={() => setToastMessage(null)}
                action={history.historyStatus === 'error' ? { label: 'Retry', onClick: () => { setToastMessage(null); history.retryBootstrap() } } : undefined}
            />

            <ErrorBoundary>
                <MemoryVault isOpen={isVaultOpen} onClose={() => setIsVaultOpen(false)} tier={subscriptionTier} />
            </ErrorBoundary>
            <ErrorBoundary>
            <ChatSettings
                isOpen={isSettingsOpen}
                onClose={() => {
                    setIsSettingsOpen(false)
                    setSettingsPanelTarget('root')
                }}
                onTakeScreenshot={takeScreenshot}
                initialPanel={settingsPanelTarget}
            />
            </ErrorBoundary>
            <SquadReconcile
                conflict={squadConflict}
                onResolve={() => setSquadConflict(null)}
            />
            {pendingUpgrade && (
                <UpgradePickerModal
                    currentSquadIds={activeGang.map(c => c.id)}
                    newSlots={pendingUpgrade.newSlots}
                    newTier={pendingUpgrade.newTier}
                    onComplete={(addedIds) => {
                        const newChars = getCharactersForAvatarStyle(avatarStylePreference).filter(c => addedIds.includes(c.id))
                        setActiveGang([...activeGang, ...newChars])
                        setPendingUpgrade(null)
                    }}
                    onDismiss={() => setPendingUpgrade(null)}
                />
            )}
            {pendingDowngrade && (
                <DowngradeKeeperModal
                    currentSquad={activeGang}
                    maxKeep={pendingDowngrade.newLimit}
                    autoRemovableIds={pendingDowngrade.autoRemovableIds}
                    onConfirm={async (keepIds) => {
                        const removedIds = activeGang.filter(c => !keepIds.includes(c.id)).map(c => c.id)
                        try {
                            await saveGang(keepIds)
                            await deactivateSquadTierMembers(removedIds)
                            setActiveGang(activeGang.filter(c => keepIds.includes(c.id)))
                            setPendingDowngrade(null)
                        } catch (error) {
                            trackOperationalError(
                                isSquadTierWriteError(error) ? 'squad_tier_write_failed' : 'squad_write_failed',
                                {
                                    user_id: userId,
                                    source_path: 'chat.downgrade.confirm',
                                    removed_count: removedIds.length,
                                },
                                error
                            )
                            setToastMessage(error instanceof Error ? error.message : 'Could not update your squad. Please try again.')
                        }
                    }}
                    onAutoRemove={async () => {
                        const removeIds = pendingDowngrade.autoRemovableIds
                        try {
                            const keepIds = activeGang.filter(c => !removeIds.includes(c.id)).map(c => c.id)
                            await saveGang(keepIds)
                            await deactivateSquadTierMembers(removeIds)
                            setActiveGang(activeGang.filter(c => !removeIds.includes(c.id)))
                            setPendingDowngrade(null)
                        } catch (error) {
                            trackOperationalError(
                                isSquadTierWriteError(error) ? 'squad_tier_write_failed' : 'squad_write_failed',
                                {
                                    user_id: userId,
                                    source_path: 'chat.downgrade.auto-remove',
                                    removed_count: removeIds.length,
                                },
                                error
                            )
                            setToastMessage(error instanceof Error ? error.message : 'Could not update your squad. Please try again.')
                        }
                    }}
                />
            )}
            <PaywallPopup
                open={paywallOpen}
                onOpenChange={setPaywallOpen}
                cooldownSeconds={paywallCooldown}
                tier={paywallTier}
                onOpenSettings={() => openSettingsPanel('rename')}
                onOpenMemoryVault={() => setIsVaultOpen(true)}
                onOpenWallpaper={() => openSettingsPanel('wallpaper')}
            />
            <ConfettiCelebration trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
        </main>
    )
}

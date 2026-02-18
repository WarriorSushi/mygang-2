'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChatStore, Message } from '@/stores/chat-store'
import { useShallow } from 'zustand/react/shallow'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'

// Modular components
import { ChatHeader } from '@/components/chat/chat-header'
import { MessageList } from '@/components/chat/message-list'
const AuthWall = dynamic(() => import('@/components/orchestrator/auth-wall').then((m) => m.AuthWall), { ssr: false })
const MemoryVault = dynamic(() => import('@/components/chat/memory-vault').then((m) => m.MemoryVault), { ssr: false })
const ChatSettings = dynamic(() => import('@/components/chat/chat-settings').then((m) => m.ChatSettings), { ssr: false })
import { ChatInput } from '@/components/chat/chat-input'
import { ErrorBoundary } from '@/components/orchestrator/error-boundary'
import { InlineToast } from '@/components/chat/inline-toast'
const SquadReconcile = dynamic(() => import('@/components/orchestrator/squad-reconcile').then((m) => m.SquadReconcile), { ssr: false })

// Custom hooks
import { useChatHistory } from '@/hooks/use-chat-history'
import { useTypingSimulation } from '@/hooks/use-typing-simulation'
import { useCapacityManager } from '@/hooks/use-capacity-manager'
import { useAutonomousFlow } from '@/hooks/use-autonomous-flow'
import { useChatApi } from '@/hooks/use-chat-api'

export default function ChatPage() {
    const {
        messages,
        activeGang,
        userId,
        userName,
        userNickname,
        isGuest,
        isHydrated,
        setIsGuest,
        chatMode,
        lowCostMode,
        chatWallpaper,
        squadConflict,
        setSquadConflict,
    } = useChatStore(useShallow((s) => ({
        messages: s.messages,
        activeGang: s.activeGang,
        userId: s.userId,
        userName: s.userName,
        userNickname: s.userNickname,
        isGuest: s.isGuest,
        isHydrated: s.isHydrated,
        setIsGuest: s.setIsGuest,
        chatMode: s.chatMode,
        lowCostMode: s.lowCostMode,
        chatWallpaper: s.chatWallpaper,
        squadConflict: s.squadConflict,
        setSquadConflict: s.setSquadConflict,
    })))

    const [showAuthWall, setShowAuthWall] = useState(false)
    const [isVaultOpen, setIsVaultOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [showResumeBanner, setShowResumeBanner] = useState(false)
    const [resumeBannerText, setResumeBannerText] = useState('Resumed your last session')
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)

    const captureRootRef = useRef<HTMLDivElement>(null)
    const resumeBannerRef = useRef(false)
    const sessionRef = useRef<{ id: string; startedAt: number } | null>(null)
    const { theme } = useTheme()
    const router = useRouter()

    const onToast = (msg: string) => setToastMessage(msg)

    // ── Hooks ──

    const typing = useTypingSimulation()

    const capacity = useCapacityManager({ onToast })

    const api = useChatApi({
        activeGang,
        userId,
        userName,
        userNickname,
        isGuest,
        messages,
        chatMode,
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
        setShowAuthWall,
        setReplyingTo,
    })

    const autonomous = useAutonomousFlow({
        isGeneratingRef: api.isGeneratingRef,
        pendingUserMessagesRef: api.pendingUserMessagesRef,
        sendToApiRef: api.sendToApiRef,
        lastUserMessageIdRef: api.lastUserMessageIdRef,
        autoLowCostModeRef: capacity.autoLowCostModeRef,
        autonomousBackoffUntilRef: api.autonomousBackoffUntilRef,
        silentTurnsRef: api.silentTurnsRef,
        burstCountRef: api.burstCountRef,
        idleAutoCountRef: api.idleAutoCountRef,
        initialGreetingRef: api.initialGreetingRef,
        queueTypingUser: typing.queueTypingUser,
        removeTypingUser: typing.removeTypingUser,
        pulseStatus: typing.pulseStatus,
        pickStatusFor: typing.pickStatusFor,
    })

    // Patch autonomous callbacks into API hook bridge refs (read at call time via .current)
    api.clearIdleAutonomousTimerRef.current = autonomous.clearIdleAutonomousTimer
    api.scheduleIdleAutonomousRef.current = autonomous.scheduleIdleAutonomous
    api.triggerLocalGreetingRef.current = autonomous.triggerLocalGreeting

    const history = useChatHistory({
        userId,
        isHydrated,
        isOnline,
        isGeneratingRef: api.isGeneratingRef,
        pendingUserMessagesRef: api.pendingUserMessagesRef,
        debounceTimerRef: api.debounceTimerRef,
    })

    // Show toast on history sync failure
    useEffect(() => {
        if (history.historyStatus === 'error') {
            setToastMessage('Could not load chat history. Try refreshing.')
        }
    }, [history.historyStatus])

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

    // ── Guard: Redirect if no squad ──
    useEffect(() => {
        if (isHydrated && activeGang.length === 0) {
            router.replace(userId ? '/post-auth' : '/onboarding')
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

    // ── Cleanup timers ──
    useEffect(() => {
        const greetingTimers = autonomous.greetingTimersRef.current
        const statusTimers = typing.statusTimersRef.current
        return () => {
            if (typing.typingFlushRef.current) clearTimeout(typing.typingFlushRef.current)
            if (typing.fastModeTimerRef.current) clearTimeout(typing.fastModeTimerRef.current)
            greetingTimers.forEach(clearTimeout)
            Object.values(statusTimers).forEach((timer) => {
                if (timer) clearTimeout(timer)
            })
            if (autonomous.idleAutonomousTimerRef.current) clearTimeout(autonomous.idleAutonomousTimerRef.current)
        }
    }, [])

    // ── Online/offline ──
    useEffect(() => {
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
            const timer = setTimeout(() => setShowResumeBanner(false), 4000)
            return () => clearTimeout(timer)
        }
    }, [isHydrated, messages])

    // ── Toast auto-dismiss ──
    useEffect(() => {
        if (!toastMessage) return
        const timer = setTimeout(() => setToastMessage(null), 4000)
        return () => clearTimeout(timer)
    }, [toastMessage])

    // ── Auth wall conversion ──
    useEffect(() => {
        if (showAuthWall && !isGuest) {
            setShowAuthWall(false)
            trackEvent('auth_wall_conversion', { metadata: { source: 'chat' } })
            const pending = api.pendingBlockedMessageRef.current
            api.pendingBlockedMessageRef.current = null
            if (pending) {
                void api.handleSendRef.current(pending.content, { replyToId: pending.replyToId, reaction: pending.reaction })
            }
        }
    }, [isGuest, showAuthWall, api.pendingBlockedMessageRef, api.handleSendRef])

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

    return (
        <main className="flex flex-col h-dvh bg-background text-foreground overflow-hidden relative isolate">
            <BackgroundBlobs isMuted={typing.typingUsers.length > 0} className="absolute inset-0 z-0 overflow-hidden pointer-events-none" />
            <div className="chat-wallpaper-layer" data-wallpaper={chatWallpaper} aria-hidden="true" />

            <div ref={captureRootRef} className="flex-1 flex flex-col w-full relative min-h-0 z-10">
                <ChatHeader
                    activeGang={activeGang}
                    onOpenVault={() => setIsVaultOpen(true)}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onRefresh={() => history.syncLatestHistory(true)}
                    typingUsers={typing.typingUsers}
                    memoryActive={!isGuest}
                    autoLowCostActive={capacity.autoLowCostMode && !lowCostMode}
                    tokenUsage={api.lastTokenUsageRef.current}
                />

                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="px-4 md:px-10 lg:px-14">
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
                                onReplyMessage={(message) => setReplyingTo(message)}
                                onLikeMessage={api.handleQuickLike}
                                onRetryMessage={api.handleRetryMessage}
                            />
                        </ErrorBoundary>
                    </div>
                </div>

                <div className="shrink-0 border-t border-border/40 dark:border-white/8 bg-card/95 dark:bg-[rgba(14,22,37,0.92)] backdrop-blur-xl px-0 pb-0 sm:border-t sm:bg-card/95 sm:dark:bg-[rgba(14,22,37,0.92)] sm:backdrop-blur-xl sm:px-10 lg:px-14 sm:pb-3">
                    {!isOnline && (
                        <div className="mx-3 sm:mx-0 mb-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[10px] uppercase tracking-widest text-amber-200">
                            Offline mode - reconnect to send messages
                        </div>
                    )}
                    <ChatInput
                        onSend={api.handleSend}
                        disabled={!isOnline}
                        online={isOnline}
                        replyingTo={replyingToDisplay}
                        onCancelReply={() => setReplyingTo(null)}
                    />
                </div>
            </div>

            <InlineToast message={toastMessage} onClose={() => setToastMessage(null)} />

            <AuthWall
                isOpen={showAuthWall}
                onClose={() => setShowAuthWall(false)}
                onSuccess={() => {
                    setIsGuest(false)
                    setShowAuthWall(false)
                }}
            />
            <MemoryVault isOpen={isVaultOpen} onClose={() => setIsVaultOpen(false)} />
            <ChatSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onTakeScreenshot={takeScreenshot}
            />
            <SquadReconcile
                conflict={squadConflict}
                onResolve={() => setSquadConflict(null)}
            />
        </main>
    )
}

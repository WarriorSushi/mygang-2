import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { ChatWallpaper } from '@/constants/wallpapers'
import { CHARACTERS } from '@/constants/characters'
import { applyAvatarStyleToGang, DEFAULT_AVATAR_STYLE, normalizeAvatarStyle, type AvatarStyle } from '@/lib/avatar-style'
import type { SubscriptionTier } from '@/lib/billing'

const MAX_PERSISTED_MESSAGES = 100
const CHAT_STORAGE_KEY = 'mygang-chat-storage'

function createNoopStorage(): StateStorage {
    return {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    }
}

function createSessionFirstStorage(): StateStorage {
    if (typeof window === 'undefined') return createNoopStorage()

    return {
        getItem: (name) => {
            const sessionValue = window.sessionStorage.getItem(name)
            if (sessionValue !== null) return sessionValue

            const legacyValue = window.localStorage.getItem(name)
            if (legacyValue === null) return null

            try {
                window.sessionStorage.setItem(name, legacyValue)
            } catch {}
            try {
                window.localStorage.removeItem(name)
            } catch {}
            return legacyValue
        },
        setItem: (name, value) => {
            window.sessionStorage.setItem(name, value)
            try {
                window.localStorage.removeItem(name)
            } catch {}
        },
        removeItem: (name) => {
            window.sessionStorage.removeItem(name)
            try {
                window.localStorage.removeItem(name)
            } catch {}
        },
    }
}

export interface Message {
    id: string
    speaker: string // 'user' or Character ID
    content: string
    created_at: string
    reaction?: string // For "Reaction-Only Turns"
    replyToId?: string // For "Quote-Reply UI"
    deliveryStatus?: 'sending' | 'sent' | 'failed'
    deliveryError?: string
    source?: 'chat' | 'wywa' | 'system' // Message origin for filtering
}

export interface Character {
    id: string
    name: string
    vibe: string
    color: string
    roleLabel?: string
    avatar?: string
    archetype?: string
    gradient?: string
    voice?: string
    sample?: string
    typingSpeed?: number
    tags?: string[]
}

interface ChatState {
    messages: Message[]
    activeGang: Character[]
    avatarStylePreference: AvatarStyle
    userName: string | null
    userId: string | null
    subscriptionTier: SubscriptionTier
    userNickname: string | null // For "Nickname Evolution"
    characterStatuses: Record<string, string> // For "Activity Status"
    isHydrated: boolean // To track if AuthManager has finished initial sync
    chatMode: 'gang_focus' | 'ecosystem'
    ecosystemSpeed: 'fast' | 'normal' | 'relaxed'
    lowCostMode: boolean // User-settable via settings + auto-managed by useCapacityManager
    chatWallpaper: ChatWallpaper
    showPersonaRoles: boolean
    customCharacterNames: Record<string, string>
    messagesRemaining: number | null
    cooldownSeconds: number | null
    squadConflict: { local: Character[]; remote: Character[]; localName?: string | null; remoteName?: string | null } | null
    pendingUpgrade: { newTier: 'basic' | 'pro'; newSlots: number } | null
    pendingDowngrade: { newLimit: number; autoRemovableIds: string[] } | null
    newMemoryCount: number
    totalMemoryCount: number
    showUpgradeTour: boolean
    setMessages: (messages: Message[]) => void
    addMessage: (message: Message) => void
    setActiveGang: (gang: Character[]) => void
    setAvatarStylePreference: (style: AvatarStyle) => void
    setUserName: (name: string | null) => void
    setUserId: (id: string | null) => void
    setSubscriptionTier: (tier: SubscriptionTier) => void
    setUserNickname: (nickname: string | null) => void
    setCharacterStatus: (characterId: string, status: string) => void
    setIsHydrated: (isHydrated: boolean) => void
    setChatMode: (mode: 'gang_focus' | 'ecosystem') => void
    setEcosystemSpeed: (speed: 'fast' | 'normal' | 'relaxed') => void
    setLowCostMode: (enabled: boolean) => void
    setChatWallpaper: (wallpaper: ChatWallpaper) => void
    setShowPersonaRoles: (showPersonaRoles: boolean) => void
    setCustomCharacterNames: (names: Record<string, string>) => void
    setSquadConflict: (conflict: { local: Character[]; remote: Character[]; localName?: string | null; remoteName?: string | null } | null) => void
    setPendingUpgrade: (upgrade: { newTier: 'basic' | 'pro'; newSlots: number } | null) => void
    setMessagesRemaining: (remaining: number | null) => void
    setCooldownSeconds: (seconds: number | null) => void
    setPendingDowngrade: (downgrade: { newLimit: number; autoRemovableIds: string[] } | null) => void
    setNewMemoryCount: (count: number) => void
    incrementNewMemoryCount: (count: number) => void
    setTotalMemoryCount: (count: number) => void
    setShowUpgradeTour: (show: boolean) => void
    clearChat: () => void
}

// Set for O(1) duplicate checks on hot path
let _messageIdSet = new Set<string>()

function rebuildIdSet(messages: Message[]) {
    _messageIdSet = new Set(messages.map((m) => m.id))
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            messages: [],
            activeGang: [],
            avatarStylePreference: DEFAULT_AVATAR_STYLE,
            userName: null,
            userId: null,
            subscriptionTier: 'free',
            userNickname: null,
            characterStatuses: {},
            isHydrated: false,
            chatMode: 'gang_focus',
            ecosystemSpeed: 'normal',
            lowCostMode: false,
            chatWallpaper: 'default',
            showPersonaRoles: true,
            customCharacterNames: {},
            messagesRemaining: null,
            cooldownSeconds: null,
            squadConflict: null,
            pendingUpgrade: null,
            pendingDowngrade: null,
            newMemoryCount: 0,
            totalMemoryCount: 0,
            showUpgradeTour: false,
            setMessages: (messages) => {
                const seen = new Set<string>()
                const deduped: Message[] = []
                for (const m of messages) {
                    if (seen.has(m.id)) continue
                    seen.add(m.id)
                    deduped.push(m)
                }
                const sliced = deduped.slice(-MAX_PERSISTED_MESSAGES)
                rebuildIdSet(sliced)
                return set({ messages: sliced })
            },
            addMessage: (message) => set((state) => {
                if (_messageIdSet.has(message.id)) return state
                _messageIdSet.add(message.id)
                const next = [...state.messages, message].slice(-MAX_PERSISTED_MESSAGES)
                if (next.length < state.messages.length + 1) {
                    // Slicing trimmed old messages, rebuild set
                    rebuildIdSet(next)
                }
                return { messages: next }
            }),
            setActiveGang: (gang) => set((state) => ({
                activeGang: applyAvatarStyleToGang(gang, state.avatarStylePreference),
            })),
            setAvatarStylePreference: (avatarStylePreference) => set((state) => {
                const normalizedStyle = normalizeAvatarStyle(avatarStylePreference)
                return {
                    avatarStylePreference: normalizedStyle,
                    activeGang: state.activeGang.length > 0
                        ? applyAvatarStyleToGang(state.activeGang, normalizedStyle)
                        : state.activeGang,
                }
            }),
            setUserName: (name) => set({ userName: name }),
            setUserId: (userId) => set({ userId }),
            setSubscriptionTier: (subscriptionTier) => set((state) => {
                const tierChanged = subscriptionTier !== state.subscriptionTier
                const upgraded = tierChanged && state.subscriptionTier === 'free' && subscriptionTier !== 'free'
                return {
                    subscriptionTier,
                    // Reset memory badge counts on tier change to prevent stale values
                    ...(tierChanged ? { newMemoryCount: 0, totalMemoryCount: 0 } : {}),
                    // Show upgrade tour when moving from free to paid
                    ...(upgraded ? { showUpgradeTour: true } : {}),
                }
            }),
            setUserNickname: (nickname) => set({ userNickname: nickname }),
            setCharacterStatus: (characterId, status) => set((state) => ({
                characterStatuses: { ...state.characterStatuses, [characterId]: status }
            })),
            setIsHydrated: (isHydrated) => set({ isHydrated }),
            setChatMode: (chatMode) => set({ chatMode }),
            setEcosystemSpeed: (ecosystemSpeed) => set({ ecosystemSpeed }),
            setLowCostMode: (lowCostMode) => set({ lowCostMode }),
            setChatWallpaper: (chatWallpaper) => set({ chatWallpaper }),
            setShowPersonaRoles: (showPersonaRoles) => set({ showPersonaRoles }),
            setCustomCharacterNames: (customCharacterNames) => set({ customCharacterNames }),
            setSquadConflict: (squadConflict) => set({ squadConflict }),
            setPendingUpgrade: (pendingUpgrade) => set({ pendingUpgrade }),
            setMessagesRemaining: (messagesRemaining) => set({ messagesRemaining }),
            setCooldownSeconds: (cooldownSeconds) => set({ cooldownSeconds }),
            setPendingDowngrade: (pendingDowngrade) => set({ pendingDowngrade }),
            setNewMemoryCount: (newMemoryCount) => set({ newMemoryCount }),
            incrementNewMemoryCount: (count) => set((state) => ({ newMemoryCount: state.newMemoryCount + count })),
            setTotalMemoryCount: (totalMemoryCount) => set({ totalMemoryCount }),
            setShowUpgradeTour: (showUpgradeTour) => set({ showUpgradeTour }),
            clearChat: () => {
                _messageIdSet.clear()
                return set({ messages: [] })
            },
        }),
        {
            name: CHAT_STORAGE_KEY,
            storage: createJSONStorage(createSessionFirstStorage),
            partialize: (state) => ({
                activeGang: state.activeGang,
                avatarStylePreference: state.avatarStylePreference,
                userName: state.userName,
                userNickname: state.userNickname,
                chatMode: state.chatMode,
                ecosystemSpeed: state.ecosystemSpeed,
                lowCostMode: state.lowCostMode,
                chatWallpaper: state.chatWallpaper,
                showPersonaRoles: state.showPersonaRoles,
                customCharacterNames: state.customCharacterNames,
                newMemoryCount: state.newMemoryCount,
                totalMemoryCount: state.totalMemoryCount,
                showUpgradeTour: state.showUpgradeTour
            }),
            onRehydrateStorage: () => (state) => {
                if (typeof window !== 'undefined') {
                    try {
                        window.localStorage.removeItem(CHAT_STORAGE_KEY)
                    } catch {}
                }

                if (state?.messages) {
                    // M5 FIX: Create new objects instead of mutating in-place
                    // (mutation defeats MessageItem memo — same ref = skip re-render)
                    const fixed = state.messages.map(m =>
                        m.deliveryStatus === 'sending'
                            ? { ...m, deliveryStatus: 'failed' as const, deliveryError: 'Message interrupted. Please retry.' }
                            : m
                    )
                    const hadStale = fixed.some((m, i) => m !== state.messages[i])
                    rebuildIdSet(fixed)
                    if (hadStale) {
                        useChatStore.setState({ messages: fixed })
                    }
                }
                const avatarStylePreference = normalizeAvatarStyle(state?.avatarStylePreference)
                if (state?.avatarStylePreference !== avatarStylePreference) {
                    useChatStore.setState({ avatarStylePreference })
                }

                // Enrich activeGang from catalog to restore avatar URLs lost during serialization
                if (state?.activeGang?.length) {
                    const enriched = state.activeGang.map(char => {
                        const catalog = CHARACTERS.find(c => c.id === char.id)
                        return catalog ? { ...catalog, ...char } : char
                    })
                    useChatStore.setState({
                        avatarStylePreference,
                        activeGang: applyAvatarStyleToGang(enriched, avatarStylePreference),
                    })
                }
            },
        }
    )
)

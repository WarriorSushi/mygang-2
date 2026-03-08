import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatWallpaper } from '@/constants/wallpapers'
import { CHARACTERS } from '@/constants/characters'

const MAX_PERSISTED_MESSAGES = 100

export interface Message {
    id: string
    speaker: string // 'user' or Character ID
    content: string
    created_at: string
    reaction?: string // For "Reaction-Only Turns"
    replyToId?: string // For "Quote-Reply UI"
    deliveryStatus?: 'sending' | 'sent' | 'failed'
    deliveryError?: string
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
    userName: string | null
    userId: string | null
    subscriptionTier: 'free' | 'basic' | 'pro'
    userNickname: string | null // For "Nickname Evolution"
    characterStatuses: Record<string, string> // For "Activity Status"
    isHydrated: boolean // To track if AuthManager has finished initial sync
    chatMode: 'gang_focus' | 'ecosystem'
    lowCostMode: boolean
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
    setMessages: (messages: Message[]) => void
    addMessage: (message: Message) => void
    setActiveGang: (gang: Character[]) => void
    setUserName: (name: string | null) => void
    setUserId: (id: string | null) => void
    setSubscriptionTier: (tier: 'free' | 'basic' | 'pro') => void
    setUserNickname: (nickname: string | null) => void
    setCharacterStatus: (characterId: string, status: string) => void
    setIsHydrated: (isHydrated: boolean) => void
    setChatMode: (mode: 'gang_focus' | 'ecosystem') => void
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
            userName: null,
            userId: null,
            subscriptionTier: 'free',
            userNickname: null,
            characterStatuses: {},
            isHydrated: false,
            chatMode: 'gang_focus',
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
            setActiveGang: (gang) => set({ activeGang: gang }),
            setUserName: (name) => set({ userName: name }),
            setUserId: (userId) => set({ userId }),
            setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),
            setUserNickname: (nickname) => set({ userNickname: nickname }),
            setCharacterStatus: (characterId, status) => set((state) => ({
                characterStatuses: { ...state.characterStatuses, [characterId]: status }
            })),
            setIsHydrated: (isHydrated) => set({ isHydrated }),
            setChatMode: (chatMode) => set({ chatMode }),
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
            clearChat: () => {
                _messageIdSet.clear()
                return set({ messages: [] })
            },
        }),
        {
            name: 'mygang-chat-storage',
            partialize: (state) => ({
                messages: state.messages,
                activeGang: state.activeGang,
                userName: state.userName,
                userNickname: state.userNickname,
                userId: state.userId,
                chatMode: state.chatMode,
                lowCostMode: state.lowCostMode,
                chatWallpaper: state.chatWallpaper,
                showPersonaRoles: state.showPersonaRoles,
                customCharacterNames: state.customCharacterNames,
                newMemoryCount: state.newMemoryCount,
                totalMemoryCount: state.totalMemoryCount
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.messages) {
                    // Reset stale 'sending' statuses that survived a page refresh
                    let hadStale = false
                    for (const m of state.messages) {
                        if (m.deliveryStatus === 'sending') {
                            m.deliveryStatus = 'failed'
                            m.deliveryError = 'Message interrupted. Please retry.'
                            hadStale = true
                        }
                    }
                    rebuildIdSet(state.messages)
                    if (hadStale) {
                        useChatStore.setState({ messages: [...state.messages] })
                    }
                }
                // Enrich activeGang from catalog to restore avatar URLs lost during serialization
                if (state?.activeGang?.length) {
                    const enriched = state.activeGang.map(char => {
                        const catalog = CHARACTERS.find(c => c.id === char.id)
                        return catalog ? { ...catalog, ...char, avatar: catalog.avatar } : char
                    })
                    useChatStore.setState({ activeGang: enriched })
                }
            },
        }
    )
)

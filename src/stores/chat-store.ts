import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatWallpaper } from '@/constants/wallpapers'

const MAX_PERSISTED_MESSAGES = 600

export interface Message {
    id: string
    speaker: string // 'user' or Character ID
    content: string
    created_at: string
    is_guest?: boolean
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
    isGuest: boolean
    userName: string | null
    userId: string | null
    userNickname: string | null // For "Nickname Evolution"
    characterStatuses: Record<string, string> // For "Activity Status"
    isHydrated: boolean // To track if AuthManager has finished initial sync
    chatMode: 'gang_focus' | 'ecosystem'
    lowCostMode: boolean
    chatWallpaper: ChatWallpaper
    showPersonaRoles: boolean
    customCharacterNames: Record<string, string>
    squadConflict: { local: Character[]; remote: Character[] } | null
    setMessages: (messages: Message[]) => void
    addMessage: (message: Message) => void
    setActiveGang: (gang: Character[]) => void
    setIsGuest: (isGuest: boolean) => void
    setUserName: (name: string | null) => void
    setUserId: (id: string | null) => void
    setUserNickname: (nickname: string | null) => void
    setCharacterStatus: (characterId: string, status: string) => void
    setIsHydrated: (isHydrated: boolean) => void
    setChatMode: (mode: 'gang_focus' | 'ecosystem') => void
    setLowCostMode: (enabled: boolean) => void
    setChatWallpaper: (wallpaper: ChatWallpaper) => void
    setShowPersonaRoles: (showPersonaRoles: boolean) => void
    setCustomCharacterNames: (names: Record<string, string>) => void
    setSquadConflict: (conflict: { local: Character[]; remote: Character[] } | null) => void
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
            isGuest: true,
            userName: null,
            userId: null,
            userNickname: null,
            characterStatuses: {},
            isHydrated: false,
            chatMode: 'ecosystem',
            lowCostMode: false,
            chatWallpaper: 'default',
            showPersonaRoles: true,
            customCharacterNames: {},
            squadConflict: null,
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
            setIsGuest: (isGuest) => set({ isGuest }),
            setUserName: (name) => set({ userName: name }),
            setUserId: (userId) => set({ userId }),
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
                isGuest: state.isGuest,
                userName: state.userName,
                userNickname: state.userNickname,
                userId: state.userId,
                chatMode: state.chatMode,
                lowCostMode: state.lowCostMode,
                chatWallpaper: state.chatWallpaper,
                showPersonaRoles: state.showPersonaRoles,
                customCharacterNames: state.customCharacterNames
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.messages) rebuildIdSet(state.messages)
            },
        }
    )
)

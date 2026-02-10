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
    chatMode: 'entourage' | 'ecosystem'
    lowCostMode: boolean
    chatWallpaper: ChatWallpaper
    showPersonaRoles: boolean
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
    setChatMode: (mode: 'entourage' | 'ecosystem') => void
    setLowCostMode: (enabled: boolean) => void
    setChatWallpaper: (wallpaper: ChatWallpaper) => void
    setShowPersonaRoles: (showPersonaRoles: boolean) => void
    setSquadConflict: (conflict: { local: Character[]; remote: Character[] } | null) => void
    clearChat: () => void
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
            squadConflict: null,
            setMessages: (messages) => set({ messages: messages.slice(-MAX_PERSISTED_MESSAGES) }),
            addMessage: (message) => set((state) => ({ messages: [...state.messages, message].slice(-MAX_PERSISTED_MESSAGES) })),
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
            setSquadConflict: (squadConflict) => set({ squadConflict }),
            clearChat: () => set({ messages: [] }),
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
                showPersonaRoles: state.showPersonaRoles
            })
        }
    )
)

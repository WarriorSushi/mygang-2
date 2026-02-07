'use client'

import { useState } from 'react'
import { useChatStore } from '@/stores/chat-store'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings2, Zap, Trash2, Camera, ChevronRight, ArrowLeft, Paintbrush, ScanLine, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateUserSettings } from '@/app/auth/actions'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { CHAT_WALLPAPERS, type ChatWallpaper } from '@/constants/wallpapers'

type SettingsPanel = 'root' | 'mode' | 'wallpaper' | 'labels' | 'media'

interface ChatSettingsProps {
    isOpen: boolean
    onClose: () => void
    onTakeScreenshot: () => void
}

function wallpaperPreviewClass(id: ChatWallpaper) {
    if (id === 'neon') return 'bg-[radial-gradient(circle_at_20%_25%,rgba(14,165,233,0.9),rgba(14,165,233,0.1)_45%),radial-gradient(circle_at_80%_25%,rgba(236,72,153,0.85),rgba(236,72,153,0.05)_45%),radial-gradient(circle_at_50%_90%,rgba(34,197,94,0.8),rgba(34,197,94,0.06)_40%)]'
    if (id === 'soft') return 'bg-[radial-gradient(circle_at_20%_25%,rgba(244,114,182,0.45),rgba(244,114,182,0.05)_45%),radial-gradient(circle_at_80%_25%,rgba(59,130,246,0.4),rgba(59,130,246,0.05)_45%),linear-gradient(160deg,rgba(255,255,255,0.7),rgba(226,232,240,0.65))]'
    if (id === 'aurora') return 'bg-[radial-gradient(circle_at_10%_20%,rgba(45,212,191,0.8),rgba(45,212,191,0.05)_45%),radial-gradient(circle_at_85%_20%,rgba(147,51,234,0.8),rgba(147,51,234,0.05)_45%),radial-gradient(circle_at_50%_90%,rgba(96,165,250,0.65),rgba(96,165,250,0.06)_45%)]'
    if (id === 'sunset') return 'bg-[radial-gradient(circle_at_15%_25%,rgba(251,146,60,0.8),rgba(251,146,60,0.05)_45%),radial-gradient(circle_at_80%_20%,rgba(244,63,94,0.75),rgba(244,63,94,0.05)_45%),radial-gradient(circle_at_45%_90%,rgba(250,204,21,0.65),rgba(250,204,21,0.06)_45%)]'
    if (id === 'graphite') return 'bg-[linear-gradient(155deg,rgba(30,41,59,0.95),rgba(15,23,42,0.95)),repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_2px,transparent_2px,transparent_8px)]'
    if (id === 'midnight') return 'bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(3,7,18,0.98))]'
    return 'bg-[radial-gradient(circle_at_20%_25%,rgba(99,102,241,0.75),rgba(99,102,241,0.06)_45%),radial-gradient(circle_at_80%_25%,rgba(16,185,129,0.7),rgba(16,185,129,0.05)_45%),radial-gradient(circle_at_50%_90%,rgba(236,72,153,0.6),rgba(236,72,153,0.06)_45%)]'
}

export function ChatSettings({ isOpen, onClose, onTakeScreenshot }: ChatSettingsProps) {
    const {
        chatMode,
        setChatMode,
        clearChat,
        chatWallpaper,
        setChatWallpaper,
        showPersonaRoles,
        setShowPersonaRoles,
    } = useChatStore()

    const [panel, setPanel] = useState<SettingsPanel>('root')

    const handleChatModeChange = (value: string) => {
        if (value !== 'entourage' && value !== 'ecosystem') return
        setChatMode(value)
        updateUserSettings({ chat_mode: value })
    }

    const handleWallpaperChange = (value: ChatWallpaper) => {
        setChatWallpaper(value)
        updateUserSettings({ chat_wallpaper: value })
    }

    const handleClose = (nextOpen: boolean) => {
        if (nextOpen) return
        setPanel('root')
        onClose()
    }

    return (
        <Sheet open={isOpen} onOpenChange={handleClose}>
            <SheetContent
                side="right"
                showCloseButton={false}
                className="w-[88vw] max-w-[380px] p-0 border-l border-white/10 bg-background/95 backdrop-blur-2xl text-foreground shadow-[0_0_45px_-10px_rgba(0,0,0,0.5)]"
            >
                <SheetTitle className="sr-only">Gang Controls</SheetTitle>
                <SheetDescription className="sr-only">Adjust mode, wallpaper, labels, and media settings.</SheetDescription>
                <div className="flex h-full flex-col">
                    <div className="border-b border-border/70 px-4 py-3">
                        <div className="flex items-center gap-2">
                            {panel !== 'root' && (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="rounded-full"
                                    onClick={() => setPanel('root')}
                                    aria-label="Back to settings"
                                >
                                    <ArrowLeft size={16} />
                                </Button>
                            )}
                            <div className="flex items-center gap-2">
                                <div className="rounded-lg border border-primary/20 bg-primary/15 p-1.5">
                                    <Settings2 size={14} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-wide">Gang Controls</p>
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                        {panel === 'root' && 'Main Menu'}
                                        {panel === 'mode' && 'Intelligence'}
                                        {panel === 'wallpaper' && 'Chat Wallpaper'}
                                        {panel === 'labels' && 'Persona Labels'}
                                        {panel === 'media' && 'Media'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative flex-1 overflow-hidden">
                        <div className={cn(
                            'absolute inset-0 space-y-3 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'root' ? 'translate-x-0 opacity-100' : '-translate-x-6 opacity-0 pointer-events-none'
                        )}>
                            <Button
                                variant="ghost"
                                className="h-auto w-full justify-between rounded-2xl border border-border/70 bg-card/50 px-4 py-4"
                                onClick={() => setPanel('mode')}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Intelligence Mode</p>
                                    <p className="text-[11px] text-muted-foreground">Gang Focus or Ecosystem</p>
                                </div>
                                <ChevronRight size={16} />
                            </Button>

                            <Button
                                variant="ghost"
                                className="h-auto w-full justify-between rounded-2xl border border-border/70 bg-card/50 px-4 py-4"
                                onClick={() => setPanel('wallpaper')}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Wallpaper</p>
                                    <p className="text-[11px] text-muted-foreground">Current: {CHAT_WALLPAPERS.find((w) => w.id === chatWallpaper)?.label || 'Default'}</p>
                                </div>
                                <Paintbrush size={16} />
                            </Button>

                            <Button
                                variant="ghost"
                                className="h-auto w-full justify-between rounded-2xl border border-border/70 bg-card/50 px-4 py-4"
                                onClick={() => setPanel('labels')}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Role Labels</p>
                                    <p className="text-[11px] text-muted-foreground">Show role next to persona names in chat</p>
                                </div>
                                <Tags size={16} />
                            </Button>

                            <Button
                                variant="ghost"
                                className="h-auto w-full justify-between rounded-2xl border border-border/70 bg-card/50 px-4 py-4"
                                onClick={() => setPanel('media')}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Media & Account</p>
                                    <p className="text-[11px] text-muted-foreground">Capture moment and account settings</p>
                                </div>
                                <ScanLine size={16} />
                            </Button>

                            <Button
                                variant="ghost"
                                className="mt-4 w-full rounded-2xl gap-2 h-11 border border-destructive/20 text-destructive/70 hover:bg-destructive hover:text-white"
                                onClick={() => {
                                    if (confirm("Clear all messages? This can't be undone.")) {
                                        clearChat()
                                        onClose()
                                    }
                                }}
                            >
                                <Trash2 size={14} />
                                Clear Timeline
                            </Button>
                        </div>

                        <div className={cn(
                            'absolute inset-0 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'mode' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                        )}>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Zap size={12} className="text-amber-400" />
                                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Intelligence</Label>
                                </div>
                                <Tabs value={chatMode} onValueChange={handleChatModeChange}>
                                    <TabsList className="grid h-10 grid-cols-2 rounded-xl border border-border/70 bg-card/60 p-1">
                                        <TabsTrigger value="entourage" className="rounded-lg text-[10px] uppercase tracking-widest">Gang Focus</TabsTrigger>
                                        <TabsTrigger value="ecosystem" className="rounded-lg text-[10px] uppercase tracking-widest">Ecosystem</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <p className="text-[11px] text-muted-foreground">
                                    {chatMode === 'entourage' ? 'Focused on user prompt. Minimal side chatter.' : 'Natural group banter and side interactions.'}
                                </p>
                            </div>
                        </div>

                        <div className={cn(
                            'absolute inset-0 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'wallpaper' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                        )}>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Paintbrush size={12} className="text-fuchsia-400" />
                                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Chat Wallpaper</Label>
                                </div>
                                <p className="px-1 text-[11px] text-muted-foreground">Visual look only. Does not affect AI behavior.</p>
                                <div className="grid max-h-[calc(100dvh-210px)] grid-cols-1 gap-2 overflow-y-auto pr-1">
                                    {CHAT_WALLPAPERS.map((option) => {
                                        const active = chatWallpaper === option.id
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => handleWallpaperChange(option.id)}
                                                className={cn(
                                                    'flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2 text-left transition-colors',
                                                    active ? 'border-primary/50 bg-primary/10' : 'border-border/70 bg-card/40 hover:bg-card/70'
                                                )}
                                            >
                                                <div className={cn('h-12 w-16 shrink-0 rounded-xl border border-white/15', wallpaperPreviewClass(option.id))} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-black uppercase tracking-wider">{option.label}</p>
                                                    <p className="truncate text-[11px] text-muted-foreground">{option.description}</p>
                                                </div>
                                                {active && <span className="text-[10px] font-black uppercase tracking-widest text-primary">Active</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className={cn(
                            'absolute inset-0 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'labels' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                        )}>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Tags size={12} className="text-cyan-400" />
                                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Persona Labels</Label>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/50 px-3 py-3">
                                    <div className="pr-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wider">Show role next to name</p>
                                        <p className="text-[11px] text-muted-foreground">Example: Nyx - the hacker</p>
                                    </div>
                                    <Switch
                                        checked={showPersonaRoles}
                                        onCheckedChange={setShowPersonaRoles}
                                        aria-label="Toggle persona role labels"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={cn(
                            'absolute inset-0 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'media' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                        )}>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Camera size={12} className="text-blue-400" />
                                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Media & Account</Label>
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={onTakeScreenshot}
                                    className="h-auto w-full justify-between rounded-2xl border border-border/70 bg-card/50 px-4 py-4"
                                >
                                    <div className="text-left">
                                        <p className="text-[11px] font-black uppercase tracking-wider">Capture Moment</p>
                                        <p className="text-[11px] text-muted-foreground">Download chat as PNG</p>
                                    </div>
                                    <Camera size={16} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    asChild
                                    className="h-auto w-full justify-between rounded-2xl border border-border/70 bg-card/50 px-4 py-4"
                                >
                                    <Link href="/settings">
                                        <div className="text-left">
                                            <p className="text-[11px] font-black uppercase tracking-wider">Account Settings</p>
                                            <p className="text-[11px] text-muted-foreground">Theme, usage, preferences</p>
                                        </div>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-border/70 px-4 py-2 text-center text-[9px] uppercase tracking-[0.35em] text-muted-foreground/70">
                        MyGang Stable v1.6
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

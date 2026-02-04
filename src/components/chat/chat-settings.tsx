'use client'

import { useChatStore } from '@/stores/chat-store'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings2, Zap, ShieldAlert, Trash2, Camera, Brain, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatSettingsProps {
    isOpen: boolean
    onClose: () => void
    onTakeScreenshot: () => void
}

export function ChatSettings({ isOpen, onClose, onTakeScreenshot }: ChatSettingsProps) {
    const {
        chatMode,
        setChatMode,
        isHapticEnabled,
        setHapticEnabled,
        clearChat
    } = useChatStore()

    return (
        <Sheet open={isOpen} onOpenChange={onClose} modal={false}>
            <SheetContent side="right" className="w-[280px] sm:w-[350px] p-0 border-l border-white/5 bg-black/40 backdrop-blur-3xl text-white shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
                <div className="flex-1 overflow-y-auto scrollbar-hide p-4 sm:p-6 space-y-6">
                    <SheetHeader className="text-left space-y-0.5 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/20 border border-primary/20">
                                <Settings2 className="text-primary" size={14} />
                            </div>
                            <SheetTitle className="text-white italic uppercase tracking-tighter text-base">Gang Controls</SheetTitle>
                        </div>
                        <SheetDescription className="text-muted-foreground text-[9px] uppercase tracking-widest font-bold opacity-40">
                            Premium Engine v1.5
                        </SheetDescription>
                    </SheetHeader>

                    {/* Gang Intelligence */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Zap size={12} className="text-amber-400" />
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Intelligence</Label>
                        </div>
                        <Tabs value={chatMode} onValueChange={(v) => setChatMode(v as any)}>
                            <TabsList className="grid grid-cols-2 bg-white/[0.03] border border-white/5 p-1 h-9 rounded-xl">
                                <TabsTrigger
                                    value="entourage"
                                    className="data-[state=active]:bg-primary/90 data-[state=active]:text-primary-foreground italic font-black text-[9px] uppercase rounded-lg transition-all"
                                >
                                    Entourage
                                </TabsTrigger>
                                <TabsTrigger
                                    value="ecosystem"
                                    className="data-[state=active]:bg-primary/90 data-[state=active]:text-primary-foreground italic font-black text-[9px] uppercase rounded-lg transition-all"
                                >
                                    Ecosystem
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <p className="text-[9px] text-muted-foreground/60 leading-tight px-1 italic">
                            {chatMode === 'entourage'
                                ? "Focused on you. Minimal side-chatter."
                                : "Natural banter mode engaged."}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Camera size={12} className="text-blue-400" />
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Media</Label>
                        </div>
                        <Button
                            variant="ghost"
                            onClick={onTakeScreenshot}
                            className="w-full justify-between px-4 py-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all group"
                        >
                            <div className="text-left">
                                <p className="text-[11px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Capture Moment</p>
                                <p className="text-[9px] text-muted-foreground opacity-60">Download chat as PNG</p>
                            </div>
                            <Camera size={16} className="text-muted-foreground opacity-40 group-hover:text-primary group-hover:scale-110 transition-all" />
                        </Button>
                    </div>

                    {/* Preferences */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Zap size={12} className="text-purple-400" />
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Preferences</Label>
                        </div>
                        <div className="flex items-center justify-between px-4 py-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider">Tactile Feedback</p>
                                <p className="text-[9px] text-muted-foreground opacity-60">Haptic vibrations</p>
                            </div>
                            <Switch
                                checked={isHapticEnabled}
                                onCheckedChange={setHapticEnabled}
                                size="sm"
                            />
                        </div>
                    </div>

                    {/* Reset */}
                    <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
                        <Button
                            variant="ghost"
                            className="w-full rounded-2xl gap-2 font-black text-[10px] uppercase tracking-widest h-11 border border-destructive/10 text-destructive/50 hover:bg-destructive hover:text-white transition-all group"
                            onClick={() => {
                                if (confirm("Clear all messages? This can't be undone.")) {
                                    clearChat()
                                    onClose()
                                }
                            }}
                        >
                            <Trash2 size={14} className="group-hover:animate-bounce" /> Clear Timeline
                        </Button>
                    </div>
                </div>
                <div className="absolute bottom-6 left-0 right-0 py-4 text-center pointer-events-none">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-[0.5em] font-black opacity-20">
                        MyGang Stable V1.5
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    )
}

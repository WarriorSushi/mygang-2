'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Character, useChatStore } from '@/stores/chat-store'
import { saveGang } from '@/app/auth/actions'
import { trackEvent } from '@/lib/analytics'
import { createClient } from '@/lib/supabase/client'
import { persistUserJourney } from '@/lib/supabase/client-journey'

interface SquadConflict {
    local: Character[]
    remote: Character[]
    localName?: string | null
    remoteName?: string | null
}

interface SquadReconcileProps {
    conflict: SquadConflict | null
    onResolve: () => void
}

export function SquadReconcile({ conflict, onResolve }: SquadReconcileProps) {
    const { setActiveGang, setUserName, userId } = useChatStore()
    const [isSaving, setIsSaving] = useState(false)

    if (!conflict) return null

    const { local, remote, localName, remoteName } = conflict
    const hasGangConflict = local.length >= 2 && remote.length >= 2
    const hasNameConflict = !!localName && !!remoteName && localName !== remoteName

    const handleUseLocal = async () => {
        setIsSaving(true)
        try {
            if (hasGangConflict) {
                await saveGang(local.map((c) => c.id))
                setActiveGang(local)
            }
            if (hasNameConflict && userId) {
                setUserName(localName)
                const supabase = createClient()
                await persistUserJourney(supabase, userId, { username: localName })
            }
            trackEvent('squad_reconcile', { metadata: { choice: 'local', hasGangConflict, hasNameConflict } })
        } finally {
            setIsSaving(false)
            onResolve()
        }
    }

    const handleUseCloud = async () => {
        setIsSaving(true)
        try {
            if (hasGangConflict) {
                setActiveGang(remote)
            }
            if (hasNameConflict) {
                setUserName(remoteName)
            }
            trackEvent('squad_reconcile', { metadata: { choice: 'cloud', hasGangConflict, hasNameConflict } })
        } finally {
            setIsSaving(false)
            onResolve()
        }
    }

    return (
        <Dialog open={!!conflict} onOpenChange={(open) => !open && onResolve()}>
            <DialogContent className="sm:max-w-lg bg-background/80 backdrop-blur-3xl border-border/50 rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Sync Conflict</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        This device and the cloud have different data. Pick which to keep.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {hasNameConflict && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-border/50 bg-muted/40 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Device name</div>
                                <div className="font-semibold text-sm">{localName}</div>
                            </div>
                            <div className="rounded-2xl border border-border/50 bg-muted/40 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Cloud name</div>
                                <div className="font-semibold text-sm">{remoteName}</div>
                            </div>
                        </div>
                    )}

                    {hasGangConflict && (
                        <>
                            <div className="rounded-2xl border border-border/50 bg-muted/40 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Device gang</div>
                                <div className="flex flex-wrap gap-2">
                                    {local.map((member) => (
                                        <span key={member.id} className="px-3 py-1 rounded-full border border-border/50 text-[11px] uppercase tracking-widest">
                                            {member.name}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border/50 bg-muted/40 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Cloud gang</div>
                                <div className="flex flex-wrap gap-2">
                                    {remote.map((member) => (
                                        <span key={member.id} className="px-3 py-1 rounded-full border border-border/50 text-[11px] uppercase tracking-widest">
                                            {member.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        onClick={handleUseCloud}
                        className="w-full rounded-2xl"
                        disabled={isSaving}
                    >
                        Use Cloud Data
                    </Button>
                    <Button
                        onClick={handleUseLocal}
                        className="w-full rounded-2xl"
                        disabled={isSaving}
                    >
                        Keep This Device
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

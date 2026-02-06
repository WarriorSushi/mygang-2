'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Character, useChatStore } from '@/stores/chat-store'
import { saveGang } from '@/app/auth/actions'
import { trackEvent } from '@/lib/analytics'

interface SquadConflict {
    local: Character[]
    remote: Character[]
}

interface SquadReconcileProps {
    conflict: SquadConflict | null
    onResolve: () => void
}

export function SquadReconcile({ conflict, onResolve }: SquadReconcileProps) {
    const { setActiveGang } = useChatStore()
    const [isSaving, setIsSaving] = useState(false)

    if (!conflict) return null

    const { local, remote } = conflict

    const handleUseLocal = async () => {
        setIsSaving(true)
        try {
            await saveGang(local.map((c) => c.id))
            setActiveGang(local)
            trackEvent('squad_reconcile', { metadata: { choice: 'local' } })
        } finally {
            setIsSaving(false)
            onResolve()
        }
    }

    const handleUseCloud = () => {
        setActiveGang(remote)
        trackEvent('squad_reconcile', { metadata: { choice: 'cloud' } })
        onResolve()
    }

    return (
        <Dialog open={!!conflict} onOpenChange={(open) => !open && onResolve()}>
            <DialogContent className="sm:max-w-lg bg-background/80 backdrop-blur-3xl border-white/10 rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Gang Sync Detected</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        This device and the cloud have different gangs. Pick the one you want to keep.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">This device</div>
                        <div className="flex flex-wrap gap-2">
                            {local.map((member) => (
                                <span key={member.id} className="px-3 py-1 rounded-full border border-white/10 text-[11px] uppercase tracking-widest">
                                    {member.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Cloud gang</div>
                        <div className="flex flex-wrap gap-2">
                            {remote.map((member) => (
                                <span key={member.id} className="px-3 py-1 rounded-full border border-white/10 text-[11px] uppercase tracking-widest">
                                    {member.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        onClick={handleUseCloud}
                        className="w-full rounded-2xl"
                        disabled={isSaving}
                    >
                        Use Cloud Gang
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

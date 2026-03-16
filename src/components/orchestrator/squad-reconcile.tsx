'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Character, useChatStore } from '@/stores/chat-store'
import { saveGang } from '@/app/auth/actions'
import { trackEvent } from '@/lib/analytics'
import { trackOperationalError } from '@/lib/operational-telemetry'
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
    const setActiveGang = useChatStore((s) => s.setActiveGang)
    const setUserName = useChatStore((s) => s.setUserName)
    const userId = useChatStore((s) => s.userId)
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    if (!conflict) return null

    const { local, remote, localName, remoteName } = conflict
    const hasGangConflict = local.length !== remote.length || local.some((c, i) => remote[i]?.id !== c.id)
    const hasNameConflict = !!localName && !!remoteName && localName !== remoteName

    const handleUseLocal = async () => {
        setIsSaving(true)
        setErrorMessage(null)
        try {
            if (hasGangConflict && local.length >= 2) {
                await saveGang(local.map((c) => c.id))
                setActiveGang(local)
            } else if (hasGangConflict && local.length > 0) {
                setActiveGang(local)
            }
            if (hasNameConflict && userId) {
                setUserName(localName)
                const supabase = createClient()
                await persistUserJourney(supabase, userId, { username: localName })
            }
            trackEvent('squad_reconcile', { metadata: { choice: 'local', hasGangConflict, hasNameConflict } })
            onResolve()
        } catch (error) {
            if (hasGangConflict) {
                trackOperationalError('squad_write_failed', {
                    user_id: userId,
                    source_path: 'squad-reconcile.local',
                    choice: 'local',
                }, error)
            }
            setErrorMessage(error instanceof Error ? error.message : 'Could not keep the device data. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleUseCloud = async () => {
        setIsSaving(true)
        setErrorMessage(null)
        try {
            if (hasGangConflict && remote.length >= 2) {
                await saveGang(remote.map((c) => c.id))
                setActiveGang(remote)
            } else if (hasGangConflict && remote.length > 0) {
                // Remote has members but fewer than 2 — just set local store without persisting
                setActiveGang(remote)
            }
            if (hasNameConflict && userId) {
                setUserName(remoteName)
                const supabase = createClient()
                await persistUserJourney(supabase, userId, { username: remoteName })
            } else if (hasNameConflict) {
                setUserName(remoteName)
            }
            trackEvent('squad_reconcile', { metadata: { choice: 'cloud', hasGangConflict, hasNameConflict } })
            onResolve()
        } catch (error) {
            if (hasGangConflict) {
                trackOperationalError('squad_write_failed', {
                    user_id: userId,
                    source_path: 'squad-reconcile.cloud',
                    choice: 'cloud',
                }, error)
            }
            setErrorMessage(error instanceof Error ? error.message : 'Could not keep the cloud data. Please try again.')
        } finally {
            setIsSaving(false)
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

                {errorMessage && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {errorMessage}
                    </div>
                )}

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

                <div className="grid gap-3 sm:grid-cols-2">
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

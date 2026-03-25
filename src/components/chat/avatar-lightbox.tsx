'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Character } from '@/stores/chat-store'
import Image from 'next/image'

interface AvatarLightboxProps {
    character: Character
    onClose: () => void
    /** Ref to the trigger element for focus restoration */
    triggerRef?: React.RefObject<HTMLElement | null>
}

export function AvatarLightbox({ character, onClose, triggerRef }: AvatarLightboxProps) {
    const lightboxRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!lightboxRef.current) return
        const el = lightboxRef.current
        const triggerNode = triggerRef?.current
        const focusable = el.querySelectorAll<HTMLElement>('button, [tabindex="0"]')
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        first.focus()

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
                return
            }
            if (e.key !== 'Tab') return
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus() }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus() }
            }
        }
        el.addEventListener('keydown', handleKeyDown)
        return () => {
            el.removeEventListener('keydown', handleKeyDown)
            triggerNode?.focus()
        }
    }, [onClose, triggerRef])

    if (!character.avatar) return null

    return createPortal(
        <div
            ref={lightboxRef}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            tabIndex={0}
            role="dialog"
            aria-modal="true"
            aria-label={`${character.name}'s avatar`}
        >
            <div
                className="relative flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="w-56 h-56 sm:w-72 sm:h-72 rounded-2xl overflow-hidden shadow-2xl"
                    style={{ outline: `2px solid ${character.color || '#555'}`, outlineOffset: '2px' }}
                >
                    <Image
                        src={character.avatar}
                        alt={character.name}
                        width={288}
                        height={288}
                        className="w-full h-full object-cover"
                        sizes="288px"
                        priority
                    />
                </div>
                <div className="text-center">
                    <p className="text-white font-semibold text-base">{character.name}</p>
                    {(character.roleLabel || character.archetype) && (
                        <p className="text-white/60 text-xs">{character.roleLabel || character.archetype}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-1 px-4 py-1.5 min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-xs transition-colors"
                >
                    Close
                </button>
            </div>
        </div>,
        document.body
    )
}

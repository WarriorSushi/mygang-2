'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
    { href: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: UsersRound },
]

export function AdminNavLinks() {
    const pathname = usePathname()

    return (
        <>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors',
                            active
                                ? 'bg-white/[0.09] text-slate-100 border border-white/[0.1]'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                        )}
                    >
                        <Icon size={14} className={active ? 'text-emerald-300' : 'text-slate-500'} />
                        {label}
                    </Link>
                )
            })}
        </>
    )
}

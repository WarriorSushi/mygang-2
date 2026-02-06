'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-center bg-background">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Authentication Failed</h1>
        <p className="text-muted-foreground">
          We couldn't complete your sign-in. This can happen if the link expired or was already used.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <Link href="/onboarding">
            <Button className="rounded-full px-6 w-full sm:w-auto">Try Again</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="rounded-full px-6 w-full sm:w-auto">Back Home</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}

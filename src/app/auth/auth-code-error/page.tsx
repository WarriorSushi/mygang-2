'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Authentication Failed</h1>
        <p className="text-muted-foreground">
          We couldn't complete your sign-in. This can happen if the link expired or was already used.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/onboarding">
            <Button className="rounded-full px-6">Try Again</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="rounded-full px-6">Back Home</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}

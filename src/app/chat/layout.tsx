import type { Metadata } from 'next'
import { CookieConsent } from '@/components/ui/cookie-consent'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CookieConsent delayMs={60000} />
    </>
  )
}

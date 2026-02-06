import type { Metadata } from 'next'
import Script from 'next/script'
import { LandingPage } from '@/components/landing/landing-page'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mygang.ai'

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'MyGang.ai',
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'MyGang.ai',
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'MyGang.ai',
      applicationCategory: 'ChatApplication',
      operatingSystem: 'Web',
      description:
        'Experience the group chat that never sleeps. 8 unique AI personalities ready to roar, roast, and vibe with you 24/7.',
      url: siteUrl,
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
    },
  ],
}

export default function Page() {
  return (
    <>
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage />
    </>
  )
}

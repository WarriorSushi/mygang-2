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
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'pashaseenainc@gmail.com',
        contactType: 'customer support',
      },
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
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Can this really feel like a friend group?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Each persona has a distinct voice and the group chemistry grows with you.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I change my crew later?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Absolutely. You can swap personalities anytime until your lineup feels perfect.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is it just for lonely moments?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Use it for anything: late-night talks, motivation, confidence, or pure chaos and fun.',
          },
        },
      ],
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

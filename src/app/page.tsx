import type { Metadata } from 'next'
import Script from 'next/script'
import dynamic from 'next/dynamic'

const LandingPage = dynamic(() => import('@/components/landing/landing-page').then(mod => mod.LandingPage), { ssr: true })

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
      logo: `${siteUrl}/logo.webp`,
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'contact@mygang.ai',
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
        'The first AI group chat — hang out with multiple AI friends who talk to you AND each other. Not a chatbot. A whole friend group, always online.',
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
            text: 'Yes. Each friend has a distinct voice and the group chemistry grows with you.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I change my gang later?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Absolutely. You can swap friends anytime until your lineup feels perfect.',
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
        {
          '@type': 'Question',
          name: 'How is MyGang.ai different from Character AI?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Character AI and most AI companion apps offer 1-on-1 conversations. MyGang.ai is the first AI GROUP chat — multiple AI friends with distinct personalities who talk to you AND to each other, creating real group dynamics.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is MyGang.ai free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes! The free tier includes 4 gang members and 25 messages per hour. Paid plans unlock more members, unlimited messages, and deeper memory for \$14.99-\$19.99/month.',
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

import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Pricing',
    description: 'Choose the perfect MyGang.ai plan. Free forever, Basic at $14.99/mo, or Pro at $19.99/mo with unlimited messages and full memory.',
    alternates: { canonical: '/pricing' },
}

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'Can I cancel anytime?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes, absolutely. Cancel with one click from your account settings. No contracts, no hidden fees, no guilt trips. Your subscription stays active until the end of your billing period.',
            },
        },
        {
            '@type': 'Question',
            name: 'What happens to my gang if I downgrade?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Your chat history stays exactly where it is — you never lose messages. If your squad is larger than your new plan allows, you\'ll get to choose which members to keep. If you re-subscribe later, your removed members come right back.',
            },
        },
        {
            '@type': 'Question',
            name: 'What does "memory" actually mean?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Memory means your gang members remember details about you across conversations — your name, preferences, inside jokes, and things you\'ve told them. Without memory, each conversation starts fresh.',
            },
        },
        {
            '@type': 'Question',
            name: 'Is my data safe?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Your data is encrypted and stored securely on Supabase infrastructure. We never sell your data or share your conversations with third parties. Your chats are yours.',
            },
        },
        {
            '@type': 'Question',
            name: 'Why is Pro so cheap right now?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'We\'re offering a special launch price to thank early adopters. Prices may increase as we add more features, so now is the best time to get in.',
            },
        },
    ],
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <script
                type="application/ld+json"
                // Safe: static hardcoded data, no user input
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            {children}
        </>
    )
}

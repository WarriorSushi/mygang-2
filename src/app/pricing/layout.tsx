import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Pricing',
    description: 'Choose the perfect MyGang.ai plan. Free forever, Basic at $14.99/mo, or Pro at $19.99/mo with unlimited messages and full memory.',
    alternates: { canonical: '/pricing' },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children
}

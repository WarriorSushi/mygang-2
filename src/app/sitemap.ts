import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mygang.ai'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date('2026-03-16'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/pricing`,
      lastModified: new Date('2026-03-16'),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/alternative`,
      lastModified: new Date('2026-04-04'),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date('2026-04-05'),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blog/ai-group-chat-vs-individual`,
      lastModified: new Date('2026-04-05'),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${siteUrl}/blog/ai-companions-loneliness-research`,
      lastModified: new Date('2026-04-05'),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${siteUrl}/blog/what-is-ai-group-chat`,
      lastModified: new Date('2026-04-05'),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: new Date('2026-03-16'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date('2026-03-16'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date('2026-03-16'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}

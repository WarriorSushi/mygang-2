import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { BackButton } from '../about/back-button'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Blog — MyGang.ai',
  description:
    'Insights on AI companions, group chat dynamics, loneliness research, and why the future of AI friendship is social. From the team building MyGang.ai.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'MyGang.ai Blog — The Future of AI Friendship',
    description: 'Research-backed insights on AI companions, group dynamics, and building meaningful AI relationships.',
    type: 'website',
  },
}

const posts = [
  {
    slug: 'what-is-ai-group-chat',
    title: 'What Is AI Group Chat? The Next Evolution of AI Companions',
    description:
      'AI group chat is a new category where multiple AI characters interact with you and each other. Learn how it works and why it matters.',
    date: '2026-04-05',
    readTime: '5 min read',
    tags: ['Explainer', 'AI Group Chat', 'Product'],
  },
  {
    slug: 'ai-companions-loneliness-research',
    title: 'The Research on AI Companions and Loneliness (2026)',
    description:
      'A roundup of every major study on AI companions and loneliness — from George Mason University, MIT, the APA, and the Ada Lovelace Institute.',
    date: '2026-04-05',
    readTime: '6 min read',
    tags: ['Research', 'Loneliness', 'Studies'],
  },
  {
    slug: 'ai-group-chat-vs-individual',
    title: 'Why AI Group Chat Is Better Than 1-on-1 AI Companions',
    description:
      'Research shows solo AI chatbots increase loneliness. Here\'s why AI group dynamics are the solution — and what we\'re building at MyGang.ai.',
    date: '2026-04-05',
    readTime: '8 min read',
    tags: ['Research', 'AI Companions', 'Loneliness'],
  },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <BackButton />
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Image src="/logo.webp" alt="MyGang" width={32} height={32} className="object-contain" />
          <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        </div>
        <p className="text-muted-foreground mb-12">
          Research, insights, and stories from the team building the first AI group chat.
        </p>

        <div className="space-y-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block group rounded-xl border border-border/50 p-6 hover:border-primary/30 hover:bg-muted/30 transition-all"
            >
              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span>·</span>
                <span>{post.readTime}</span>
              </div>
              <h2 className="text-xl font-semibold group-hover:text-primary transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed">{post.description}</p>
              <div className="flex gap-2 mt-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

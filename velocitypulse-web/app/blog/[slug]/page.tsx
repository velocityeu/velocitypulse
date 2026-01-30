import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react'
import { getPostBySlug, getAllPostSlugs, markdownToHtml } from '@/lib/blog'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    return {
      title: 'Post Not Found | VelocityPulse Blog',
    }
  }

  return {
    title: `${post.title} | VelocityPulse Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: post.image ? [post.image] : undefined,
    },
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const htmlContent = markdownToHtml(post.content)

  return (
    <main id="main-content" className="min-h-screen">
      {/* Back link */}
      <div className="border-b border-[var(--color-border-light)]">
        <div className="container-wide py-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>

      {/* Article */}
      <article className="py-12 md:py-16">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <header className="mb-12">
              {/* Tags */}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 text-xs font-medium rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-primary mb-6 leading-tight">
                {post.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>
                    {post.author}
                    {post.authorRole && (
                      <span className="text-tertiary"> - {post.authorRole}</span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(post.date)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {post.readingTime}
                </span>
              </div>

              {/* Description */}
              <p className="mt-6 text-lg text-secondary leading-relaxed">
                {post.description}
              </p>
            </header>

            {/* Featured image */}
            {post.image && (
              <div className="mb-12 rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.image}
                  alt=""
                  className="w-full"
                />
              </div>
            )}

            {/* Content */}
            <div
              className="prose prose-lg max-w-none
                prose-headings:font-display prose-headings:font-semibold prose-headings:text-primary
                prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-secondary prose-p:leading-relaxed prose-p:my-4
                prose-a:text-[var(--color-accent)] prose-a:no-underline hover:prose-a:underline
                prose-strong:text-primary prose-strong:font-semibold
                prose-code:text-[var(--color-accent)] prose-code:bg-[var(--color-bg-secondary)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-[var(--color-bg-secondary)] prose-pre:border prose-pre:border-[var(--color-border-light)] prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-x-auto
                prose-ul:my-4 prose-ul:pl-6 prose-li:text-secondary prose-li:my-1
                prose-ol:my-4 prose-ol:pl-6
                prose-blockquote:border-l-4 prose-blockquote:border-[var(--color-accent)] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-secondary
                prose-hr:border-[var(--color-border-light)] prose-hr:my-8"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-[var(--color-border-light)]">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:gap-3 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to all posts
              </Link>
            </footer>
          </div>
        </div>
      </article>
    </main>
  )
}

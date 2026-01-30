import Link from 'next/link'
import { ArrowRight, Calendar, Clock, User } from 'lucide-react'
import { getAllPosts } from '@/lib/blog'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog | VelocityPulse',
  description: 'Network monitoring insights, best practices, and product updates from the VelocityPulse team.',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function BlogPage() {
  const posts = await getAllPosts()

  return (
    <main id="main-content" className="min-h-screen">
      {/* Hero */}
      <section className="py-16 md:py-24 border-b border-[var(--color-border-light)]">
        <div className="container-wide">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-semibold text-primary mb-6">
              Blog
            </h1>
            <p className="text-lg text-secondary leading-relaxed">
              Network monitoring insights, best practices, and product updates from the VelocityPulse team.
            </p>
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-16 md:py-24">
        <div className="container-wide">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-secondary text-lg">
                No blog posts yet. Check back soon for updates.
              </p>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="group flex flex-col rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] overflow-hidden hover:border-[var(--color-accent)] transition-colors"
                >
                  {post.image && (
                    <div className="aspect-video bg-[var(--color-bg)] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.image}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="flex flex-col flex-1 p-6">
                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {post.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs font-medium rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Title */}
                    <h2 className="font-display text-xl font-semibold text-primary mb-2 group-hover:text-[var(--color-accent)] transition-colors">
                      <Link href={`/blog/${post.slug}`} className="block">
                        {post.title}
                      </Link>
                    </h2>

                    {/* Description */}
                    <p className="text-secondary text-sm leading-relaxed mb-4 flex-1">
                      {post.description}
                    </p>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-tertiary">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(post.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {post.readingTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {post.author}
                      </span>
                    </div>

                    {/* Read more */}
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-[var(--color-accent)] hover:gap-2 transition-all"
                    >
                      Read more
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

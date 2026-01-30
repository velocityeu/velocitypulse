import fs from 'fs'
import path from 'path'

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  author: string
  authorRole?: string
  readingTime: string
  tags: string[]
  content: string
  image?: string
}

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  date: string
  author: string
  authorRole?: string
  readingTime: string
  tags: string[]
  image?: string
}

/**
 * Parse front matter from MDX/Markdown content
 * Simple parser that handles YAML-style front matter
 */
function parseFrontMatter(content: string): { frontMatter: Record<string, string | string[]>; body: string } {
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/
  const match = content.match(frontMatterRegex)

  if (!match) {
    return { frontMatter: {}, body: content }
  }

  const frontMatterStr = match[1]
  const body = content.slice(match[0].length).trim()

  const frontMatter: Record<string, string | string[]> = {}
  const lines = frontMatterStr.split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    // Handle arrays (simple inline format: [tag1, tag2])
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1)
      frontMatter[key] = arrayContent.split(',').map(item => item.trim().replace(/['"]/g, ''))
    } else {
      frontMatter[key] = value
    }
  }

  return { frontMatter, body }
}

/**
 * Calculate reading time based on word count
 */
function calculateReadingTime(content: string): string {
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  const minutes = Math.ceil(wordCount / wordsPerMinute)
  return `${minutes} min read`
}

/**
 * Get all blog posts metadata (sorted by date, newest first)
 */
export async function getAllPosts(): Promise<BlogPostMeta[]> {
  // Check if directory exists
  if (!fs.existsSync(BLOG_DIR)) {
    return []
  }

  const files = fs.readdirSync(BLOG_DIR)
  const mdxFiles = files.filter(f => f.endsWith('.mdx') || f.endsWith('.md'))

  const posts: BlogPostMeta[] = []

  for (const file of mdxFiles) {
    const slug = file.replace(/\.mdx?$/, '')
    const filePath = path.join(BLOG_DIR, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const { frontMatter, body } = parseFrontMatter(content)

    posts.push({
      slug,
      title: frontMatter.title as string || slug,
      description: frontMatter.description as string || '',
      date: frontMatter.date as string || new Date().toISOString(),
      author: frontMatter.author as string || 'VelocityPulse Team',
      authorRole: frontMatter.authorRole as string,
      readingTime: calculateReadingTime(body),
      tags: (frontMatter.tags as string[]) || [],
      image: frontMatter.image as string,
    })
  }

  // Sort by date, newest first
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/**
 * Get a single blog post by slug
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const mdxPath = path.join(BLOG_DIR, `${slug}.mdx`)
  const mdPath = path.join(BLOG_DIR, `${slug}.md`)

  let filePath: string | null = null
  if (fs.existsSync(mdxPath)) {
    filePath = mdxPath
  } else if (fs.existsSync(mdPath)) {
    filePath = mdPath
  }

  if (!filePath) {
    return null
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const { frontMatter, body } = parseFrontMatter(content)

  return {
    slug,
    title: frontMatter.title as string || slug,
    description: frontMatter.description as string || '',
    date: frontMatter.date as string || new Date().toISOString(),
    author: frontMatter.author as string || 'VelocityPulse Team',
    authorRole: frontMatter.authorRole as string,
    readingTime: calculateReadingTime(body),
    tags: (frontMatter.tags as string[]) || [],
    content: body,
    image: frontMatter.image as string,
  }
}

/**
 * Get all post slugs for static generation
 */
export async function getAllPostSlugs(): Promise<string[]> {
  if (!fs.existsSync(BLOG_DIR)) {
    return []
  }

  const files = fs.readdirSync(BLOG_DIR)
  return files
    .filter(f => f.endsWith('.mdx') || f.endsWith('.md'))
    .map(f => f.replace(/\.mdx?$/, ''))
}

/**
 * Simple Markdown to HTML converter for blog content
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown

  // Code blocks (must be done before inline code)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? ` class="language-${lang}"` : ''
    return `<pre><code${langClass}>${escapeHtml(code.trim())}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // Unordered lists
  html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />')

  // Paragraphs (wrap remaining text)
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('<')) return trimmed
    return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`
  }).join('\n')

  return html
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

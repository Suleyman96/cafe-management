import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import readingTime from 'reading-time';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

// L7 — slugs feed `path.join(BLOG_DIR, ...)`. Constrain them to lowercase
// alphanumerics + hyphens so a crafted slug (`../`, absolute paths, null
// bytes, encoded separators) can't escape BLOG_DIR and read arbitrary files.
// All real post filenames are lowercase-kebab, so this is a no-op for them.
const SLUG_RE = /^[a-z0-9-]+$/;

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  image?: string;
  tags: string[];
  readingTime: string;
  content: string;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));

  const posts = files
    .map((file) => getPostBySlug(file.replace('.mdx', '')))
    .filter(Boolean) as BlogPost[];

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  // L7 — reject anything that isn't a plain lowercase-kebab slug before it
  // reaches the filesystem.
  if (!SLUG_RE.test(slug)) return null;

  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const stats = readingTime(content);

  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    date: data.date ?? '',
    author: data.author ?? 'Gustri Team',
    image: data.image,
    tags: data.tags ?? [],
    readingTime: stats.text,
    content,
  };
}

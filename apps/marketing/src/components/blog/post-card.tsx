import Link from 'next/link';
import type { BlogPost } from '@/lib/blog';

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="group rounded-2xl border border-gray-100 bg-white p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <time dateTime={post.date}>
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <span>&middot;</span>
        <span>{post.readingTime}</span>
      </div>
      <Link href={`/blog/${post.slug}`} className="block mt-3">
        <h2 className="text-xl font-semibold text-gray-900 group-hover:text-primary-500 transition-colors">
          {post.title}
        </h2>
      </Link>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2">{post.description}</p>
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

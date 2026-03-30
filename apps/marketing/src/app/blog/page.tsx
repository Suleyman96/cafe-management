import type { Metadata } from 'next';
import { PostCard } from '@/components/blog/post-card';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Tips, guides, and insights on restaurant management, cafe operations, and growing your food business.',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <section className="pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">Blog</h1>
          <p className="mt-6 text-lg text-gray-600">
            Guides, tips, and insights for running a better restaurant.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="mt-16 text-center text-gray-500">No posts yet. Check back soon!</p>
        ) : (
          <div className="mt-16 space-y-6">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

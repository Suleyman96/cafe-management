import type { MDXRemoteProps } from 'next-mdx-remote/rsc';

// Destructure `ref` out of MDX props to avoid LegacyRef vs Ref type mismatch
// between next-mdx-remote and @types/react 18.3+
export const mdxComponents: MDXRemoteProps['components'] = {
  h1: ({ ref: _, ...props }) => (
    <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-4" {...props} />
  ),
  h2: ({ ref: _, ...props }) => (
    <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-3" {...props} />
  ),
  h3: ({ ref: _, ...props }) => (
    <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2" {...props} />
  ),
  p: ({ ref: _, ...props }) => <p className="text-gray-600 leading-relaxed mb-4" {...props} />,
  ul: ({ ref: _, ...props }) => (
    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1" {...props} />
  ),
  ol: ({ ref: _, ...props }) => (
    <ol className="list-decimal list-inside text-gray-600 mb-4 space-y-1" {...props} />
  ),
  li: ({ ref: _, ...props }) => <li className="leading-relaxed" {...props} />,
  a: ({ ref: _, ...props }) => (
    <a className="text-primary-500 hover:text-primary-600 underline" {...props} />
  ),
  blockquote: ({ ref: _, ...props }) => (
    <blockquote
      className="border-l-4 border-primary-200 pl-4 italic text-gray-500 my-4"
      {...props}
    />
  ),
  code: ({ ref: _, ...props }) => (
    <code
      className="bg-gray-100 rounded px-1.5 py-0.5 text-sm font-mono text-gray-800"
      {...props}
    />
  ),
  pre: ({ ref: _, ...props }) => (
    <pre
      className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto mb-4 text-sm"
      {...props}
    />
  ),
};

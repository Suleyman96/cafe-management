import type { MDXRemoteProps } from 'next-mdx-remote/rsc';

export const mdxComponents: MDXRemoteProps['components'] = {
  h1: (props) => <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-4" {...props} />,
  h2: (props) => <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-3" {...props} />,
  h3: (props) => <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2" {...props} />,
  p: (props) => <p className="text-gray-600 leading-relaxed mb-4" {...props} />,
  ul: (props) => <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1" {...props} />,
  ol: (props) => (
    <ol className="list-decimal list-inside text-gray-600 mb-4 space-y-1" {...props} />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: (props) => <a className="text-primary-500 hover:text-primary-600 underline" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-l-4 border-primary-200 pl-4 italic text-gray-500 my-4"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="bg-gray-100 rounded px-1.5 py-0.5 text-sm font-mono text-gray-800"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto mb-4 text-sm"
      {...props}
    />
  ),
};

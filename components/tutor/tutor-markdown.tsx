"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TutorMarkdownProps {
  content: string;
}

export function TutorMarkdown({ content }: TutorMarkdownProps) {
  return (
    <div className="tutor-markdown break-words text-sm leading-relaxed text-ink font-sans">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed text-neutral-800">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-neutral-800">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-4 mb-3 space-y-1 text-neutral-800">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-4 mb-3 space-y-1 text-neutral-800">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-ink mt-4 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-ink mt-3.5 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mt-3 mb-1">
              {children}
            </h3>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-ink font-mono text-[12px] border border-black/5">
                  {children}
                </code>
              );
            }
            return (
              <div className="my-3 rounded-xl bg-[#F9F8F5] border border-black/10 p-3.5 overflow-x-auto text-ink font-mono text-[12px]">
                <code className="leading-relaxed">{children}</code>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="my-3 w-full overflow-x-auto rounded-xl border border-black/10 bg-white shadow-xs">
              <table className="w-full text-xs text-left border-collapse min-w-[360px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#F5F3EE] border-b border-black/10 text-ink">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-black/5 text-neutral-800">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-semibold text-ink tracking-wide border-r border-black/5 last:border-r-0 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-neutral-700 border-r border-black/5 last:border-r-0 leading-relaxed">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-orange pl-3.5 my-2.5 text-neutral-600 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-black/10" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange hover:underline underline-offset-2 font-medium"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

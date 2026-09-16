"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TutorMarkdownProps {
  content: string;
}

export function TutorMarkdown({ content }: TutorMarkdownProps) {
  return (
    <div className="tutor-markdown break-words text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-200">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-2.5 space-y-1 text-slate-200">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-2.5 space-y-1 text-slate-200">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold text-white mt-3.5 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold text-white mt-3 mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mt-2.5 mb-1">{children}</h3>,
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-slate-900/90 text-indigo-300 font-mono text-[12px] border border-slate-700/60">
                  {children}
                </code>
              );
            }
            return (
              <div className="my-2.5 rounded-lg bg-slate-900/90 border border-slate-700/60 p-3 overflow-x-auto">
                <code className="text-[12px] font-mono text-indigo-200 leading-relaxed">{children}</code>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="my-3 w-full overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-900/60 shadow-sm">
              <table className="w-full text-xs text-left border-collapse min-w-[360px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800/90 border-b border-slate-700/80 text-slate-200">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-800/80 text-slate-300">{children}</tbody>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-semibold text-white tracking-wide border-r border-slate-800/60 last:border-r-0 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-slate-300 border-r border-slate-800/60 last:border-r-0 leading-relaxed">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500/70 pl-3 my-2 text-slate-300 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-slate-700/60" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
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

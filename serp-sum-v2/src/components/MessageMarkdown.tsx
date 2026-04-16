import { useMemo, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageMarkdownProps {
  content: string;
  compact?: boolean;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

type CodeRendererProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
};

function getTextContent(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(getTextContent).join('');
  }

  return '';
}

function extractLanguage(className?: string): string {
  if (!className) return 'text';
  const match = className.match(/language-([a-z0-9+#_-]+)/i);
  return match?.[1]?.toLowerCase() || 'text';
}

function normalizeMessage(message: string): string {
  return message.replace(/\r\n/g, '\n').trim();
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1200);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#11131f]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#161a2a] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-gray-400">
        <span>{language}</span>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-gray-200 transition-colors hover:bg-white/10"
        >
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="m-0 max-h-[340px] overflow-auto p-3 text-[12px] leading-5 text-gray-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MessageMarkdown({ content, compact = false }: MessageMarkdownProps) {
  const normalizedContent = useMemo(() => normalizeMessage(content), [content]);

  const components = useMemo<Components>(() => {
    const bodyTextClass = compact ? 'text-[13px] leading-6 text-gray-100' : 'text-[14px] leading-7 text-gray-100';

    return {
      p: ({ children }) => <p className={`${bodyTextClass} mb-3 last:mb-0`}>{children}</p>,
      h1: ({ children }) => <h1 className="mb-3 mt-1 text-lg font-semibold text-white">{children}</h1>,
      h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold text-white">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold uppercase tracking-wide text-gray-100">{children}</h3>,
      ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-gray-100">{children}</ul>,
      ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-gray-100">{children}</ol>,
      li: ({ children }) => <li className={bodyTextClass}>{children}</li>,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-blue-300 underline decoration-blue-300/40 underline-offset-4">
          {children}
        </a>
      ),
      blockquote: ({ children }) => (
        <blockquote className="my-3 border-l-2 border-sky-400/40 bg-sky-500/10 px-3 py-2 text-gray-100">{children}</blockquote>
      ),
      code: ({ inline, className, children }: CodeRendererProps) => {
        const codeText = getTextContent(children).replace(/\n$/, '');
        const language = extractLanguage(className);

        if (!inline) {
          return <CodeBlock language={language} code={codeText} />;
        }

        return <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-sky-100">{children}</code>;
      },
      pre: ({ children }) => <>{children}</>,
    };
  }, [compact]);

  if (!normalizedContent) {
    return null;
  }

  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{normalizedContent}</ReactMarkdown>;
}

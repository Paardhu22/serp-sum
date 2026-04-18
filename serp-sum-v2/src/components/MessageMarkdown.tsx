import { useMemo, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import clike from 'react-syntax-highlighter/dist/esm/languages/prism/clike';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
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

SyntaxHighlighter.registerLanguage('markup', markup);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('xml', markup);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('clike', clike);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);

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
      <div className="max-h-[340px] overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            background: 'transparent',
            padding: '12px',
            fontSize: '12px',
            lineHeight: '1.6',
            fontFamily: 'var(--font-code)',
          }}
          codeTagProps={{ style: { fontFamily: 'var(--font-code)' } }}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function MessageMarkdown({ content, compact = false }: MessageMarkdownProps) {
  const normalizedContent = useMemo(() => normalizeMessage(content), [content]);

  const components = useMemo<Components>(() => {
    const bodyTextClass = compact ? 'text-[13px] leading-[1.55] text-gray-700' : 'text-[14px] leading-[1.6] text-gray-800';

    return {
      p: ({ children }) => <p className={`${bodyTextClass} mb-3 last:mb-0`} style={{ fontFamily: 'var(--font-ui)' }}>{children}</p>,
      h1: ({ children }) => <h1 className="mb-3 mt-1 text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-content)' }}>{children}</h1>,
      h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-bold text-gray-800" style={{ fontFamily: 'var(--font-content)' }}>{children}</h2>,
      h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-bold uppercase tracking-wide text-gray-700" style={{ fontFamily: 'var(--font-content)' }}>{children}</h3>,
      ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-gray-700" style={{ fontFamily: 'var(--font-ui)' }}>{children}</ul>,
      ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-gray-700" style={{ fontFamily: 'var(--font-ui)' }}>{children}</ol>,
      li: ({ children }) => <li className={bodyTextClass} style={{ fontFamily: 'var(--font-ui)' }}>{children}</li>,
      table: ({ children }) => (
        <div className="my-4 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50/50">
          <table className="w-full min-w-[360px] border-collapse text-left">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-gray-100/50">{children}</thead>,
      tbody: ({ children }) => <tbody>{children}</tbody>,
      tr: ({ children }) => <tr className="border-t border-gray-100 even:bg-gray-50/30">{children}</tr>,
      th: ({ children }) => (
        <th className="px-3 py-2 text-[12px] uppercase tracking-[0.12em] text-gray-600 font-bold" style={{ fontFamily: 'var(--font-content)' }}>
          {children}
        </th>
      ),
      td: ({ children }) => <td className="px-3 py-2 text-[13px] leading-[1.55] text-gray-700" style={{ fontFamily: 'var(--font-ui)' }}>{children}</td>,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-purple-600 underline decoration-purple-300/40 underline-offset-4 font-medium transition-colors hover:text-purple-700">
          {children}
        </a>
      ),
      blockquote: ({ children }) => (
        <blockquote className="my-3 border-l-4 border-purple-200 bg-purple-50/50 px-4 py-3 text-gray-700 italic rounded-r-lg" style={{ fontFamily: 'var(--font-ui)' }}>{children}</blockquote>
      ),
      code: ({ inline, className, children }: CodeRendererProps) => {
        const codeText = getTextContent(children).replace(/\n$/, '');
        const language = extractLanguage(className);

        if (!inline) {
          return <CodeBlock language={language} code={codeText} />;
        }

        return (
          <code
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px] text-purple-700 font-medium"
            style={{ fontFamily: 'var(--font-code)' }}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }) => <>{children}</>,
    };
  }, [compact]);

  if (!normalizedContent) {
    return null;
  }

  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{normalizedContent}</ReactMarkdown>;
}

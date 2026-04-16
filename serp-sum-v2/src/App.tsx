import { useState, useRef, useEffect, useCallback } from 'react';

import { MessageMarkdown } from './components/MessageMarkdown';
import type { ChatMessage, KnowledgeItem } from './shared/types';

interface ChatResponse {
  success?: boolean;
  reply?: string;
  error?: string;
}

interface KnowledgeResponse {
  success?: boolean;
  items?: KnowledgeItem[];
  error?: string;
}

interface DefaultResponse {
  success?: boolean;
  error?: string;
}

function formatTimestamp(isoDate: string): string {
  const asDate = new Date(isoDate);
  if (Number.isNaN(asDate.getTime())) {
    return 'Unknown time';
  }

  return asDate.toLocaleString();
}

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I am your serp-sum assistant. Ask me anything and I will answer with clear structure and clean code examples.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeError, setKnowledgeError] = useState('');
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isClearingKnowledge, setIsClearingKnowledge] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadKnowledge = useCallback(() => {
    setIsKnowledgeLoading(true);
    setKnowledgeError('');

    chrome.runtime.sendMessage({ type: 'GET_KNOWLEDGE' }, (res: KnowledgeResponse) => {
      setIsKnowledgeLoading(false);

      if (chrome.runtime.lastError) {
        setKnowledgeError(chrome.runtime.lastError.message || 'Failed to load knowledge.');
        return;
      }

      if (res?.success && Array.isArray(res.items)) {
        setKnowledgeItems(res.items);
        return;
      }

      setKnowledgeError(res?.error || 'Could not load saved knowledge.');
    });
  }, []);



  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmedInput };
    const nextHistory = [...messages, userMsg];

    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      messages: nextHistory,
      context: { origin: 'side-panel' },
    }, (res: ChatResponse) => {
      setIsLoading(false);

      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${runtimeError.message}` }]);
        return;
      }

      if (res?.success && typeof res.reply === 'string') {
        const reply = res.reply;
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        loadKnowledge();
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "❌ Error: " + (res?.error || "Failed to reach AI.") }]);
      }
    });
  };

  const clearKnowledge = () => {
    if (isClearingKnowledge) return;

    if (!window.confirm('Clear all saved knowledge items from this device?')) {
      return;
    }

    setIsClearingKnowledge(true);
    chrome.runtime.sendMessage({ type: 'CLEAR_KNOWLEDGE' }, (res: DefaultResponse) => {
      setIsClearingKnowledge(false);

      if (chrome.runtime.lastError) {
        setKnowledgeError(chrome.runtime.lastError.message || 'Failed to clear knowledge.');
        return;
      }

      if (res?.success) {
        setKnowledgeItems([]);
        setKnowledgeError('');
        return;
      }

      setKnowledgeError(res?.error || 'Could not clear knowledge.');
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#0f0f14] text-white font-sans selection:bg-purple-500/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          serp-sum OS
        </h1>
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
        </div>
      </div>


      <div className="flex gap-2 p-3">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${activeTab === 'chat' ? 'bg-white/15 border border-white/10' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Chat
        </button>
        <button 
          onClick={() => {
            setActiveTab('knowledge');
            loadKnowledge();
          }}
          className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${activeTab === 'knowledge' ? 'bg-white/15 border border-white/10' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Knowledge
        </button>
      </div>

      {activeTab === 'chat' ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Chat History */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600/40 border border-indigo-500/20 text-white rounded-br-sm' 
                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <MessageMarkdown content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap text-[14px] leading-6">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-bl-sm text-white/40 flex gap-1">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce [animation-delay:0.2s]">●</span>
                  <span className="animate-bounce [animation-delay:0.4s]">●</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/5 bg-[#0f0f14]">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask anything..."
                className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-5 pr-12 text-sm outline-none focus:border-purple-500/40 transition-all placeholder-gray-500"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading}
                className="absolute right-2 p-1.5 bg-white text-black rounded-full hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-300">Knowledge Base</h2>
            <button
              onClick={clearKnowledge}
              disabled={isClearingKnowledge || isKnowledgeLoading || knowledgeItems.length === 0}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isClearingKnowledge ? 'Clearing' : 'Clear all'}
            </button>
          </div>

          <p className="mb-4 text-xs leading-5 text-gray-400">
            Saved answers are stored in local extension storage on this device, so you can open this tab even when offline.
          </p>

          {knowledgeError && (
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {knowledgeError}
            </div>
          )}

          {isKnowledgeLoading ? (
            <div className="flex h-[65%] items-center justify-center text-xs uppercase tracking-[0.14em] text-gray-500">Loading knowledge...</div>
          ) : knowledgeItems.length === 0 ? (
            <div className="flex h-[65%] flex-col items-center justify-center text-center">
              <div className="bg-sky-500/10 p-4 rounded-full mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-300"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              </div>
              <p className="max-w-[250px] text-sm leading-6 text-gray-400">
                Ask questions or summarize text to build your local knowledge library.
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1 pb-2 max-h-[calc(100vh-180px)] scrollbar-thin scrollbar-thumb-white/5">
              {knowledgeItems.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-white leading-6">{item.title}</h3>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                      {item.kind === 'summary' ? 'Summary' : 'Chat'} · {formatTimestamp(item.createdAt)}
                    </p>
                  </div>

                  <div className="mb-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-gray-500">Prompt</p>
                    <p className="text-[13px] leading-6 text-gray-200 whitespace-pre-wrap">{item.prompt}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">Answer</p>
                    <MessageMarkdown content={item.response} compact />
                  </div>

                  {(item.source.pageTitle || item.source.pageUrl) && (
                    <div className="mt-2 text-[11px] leading-5 text-gray-400">
                      <span className="uppercase tracking-[0.12em] text-gray-500">Source: </span>
                      {item.source.pageTitle || 'Web page'}
                      {item.source.pageUrl && (
                        <>
                          {' '}
                          <a
                            href={item.source.pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-300 underline decoration-sky-300/40 underline-offset-4"
                          >
                            Open
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

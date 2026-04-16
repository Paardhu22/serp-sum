import { useState, useEffect } from 'react';

import { MessageMarkdown } from '../components/MessageMarkdown';
import type { ChatMessage, KnowledgeSource } from '../shared/types';

interface ChatResponse {
  success?: boolean;
  reply?: string;
  explanation?: string;
  error?: string;
}

function getPageContext(): KnowledgeSource {
  return {
    origin: 'content-popup',
    pageTitle: document.title || undefined,
    pageUrl: window.location.href || undefined,
  };
}

export const ContentApp = () => {
  const [selectedText, setSelectedText] = useState("");
  const [buttonPos, setButtonPos] = useState<{ top: number; left: number } | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const handleMouseUp = () => {
      // Delay slightly to let the browser register the selection
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() || "";
        
        // Don't hide button if we're clicking inside our own UI
        if (!text && !isOpen) {
          setButtonPos(null);
          setSelectedText("");
          return;
        }

        if (text && text.length > 5 && !isOpen) {
          const range = selection?.getRangeAt(0);
          const rect = range?.getBoundingClientRect();
          if (rect) {
            setSelectedText(text);
            setButtonPos({
              top: rect.bottom + window.scrollY + 10,
              left: rect.left + window.scrollX,
            });
          }
        }
      }, 100);
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [isOpen]);

  const handleSummarize = () => {
    setButtonPos(null);
    setIsOpen(true);
    setIsLoading(true);
    setChatHistory([]);
    setPopupPos({ top: 100, left: Math.max(24, window.innerWidth - 420) });

    chrome.runtime.sendMessage({
      type: 'EXPLAIN_TEXT',
      text: selectedText,
      context: getPageContext(),
    }, (res: ChatResponse) => {
      setIsLoading(false);
      if (chrome.runtime.lastError) {
        setChatHistory([{ role: 'assistant', content: `❌ Error: ${chrome.runtime.lastError.message || 'Request failed'}` }]);
        return;
      }

      if (!res?.success || typeof res.explanation !== 'string') {
        setChatHistory([{ role: 'assistant', content: '❌ Error: ' + (res?.error || 'Request failed') }]);
      } else {
        setChatHistory([{ role: 'assistant', content: res.explanation }]);
      }
    });
  };

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: inputValue }];
    setChatHistory(newHistory);
    setInputValue("");
    setIsLoading(true);

    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      messages: newHistory,
      context: getPageContext(),
    }, (res: ChatResponse) => {
      setIsLoading(false);

      if (chrome.runtime.lastError) {
        setChatHistory([...newHistory, { role: 'assistant', content: `❌ Error: ${chrome.runtime.lastError.message || 'Failed to reply.'}` }]);
        return;
      }

      if (res?.success && typeof res.reply === 'string') {
        setChatHistory([...newHistory, { role: 'assistant', content: res.reply }]);
      } else {
        setChatHistory([...newHistory, { role: 'assistant', content: '❌ Error: Failed to reply.' }]);
      }
    });
  };

  return (
    <>
      {/* Floating Summarize Button */}
      {buttonPos && !isOpen && (
        <button
          className="fixed z-[2147483647] bg-[#1a1a24]/90 backdrop-blur-xl border border-white/20 text-white shadow-xl rounded-full px-4 py-2 text-sm font-semibold hover:bg-white/10 transition-all hover:scale-105"
          style={{ top: buttonPos.top, left: buttonPos.left }}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent text deselection
            handleSummarize();
          }}
        >
          ✨ Summarize
        </button>
      )}

      {/* Glassmorphic Chat Popup */}
      {isOpen && (
        <div
          className="fixed z-[2147483647] w-[380px] bg-black/60 backdrop-blur-2xl border border-white/15 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
          style={{ top: popupPos?.top, left: popupPos?.left, maxHeight: '80vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">serp-sum</span>
            <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-red-400 font-bold transition-colors">✕</button>
          </div>

          {/* Chat Content */}
          <div className="p-4 flex-1 overflow-y-auto flex flex-col space-y-3 min-h-[150px] max-h-[400px] scrollbar-thin scrollbar-thumb-white/10">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`text-sm p-3 rounded-2xl w-[90%] break-words ${msg.role === 'user' ? 'bg-indigo-600/40 text-white self-end rounded-br-sm' : 'bg-white/10 text-gray-200 border border-white/5 self-start rounded-bl-sm'}`}>
                {msg.role === 'assistant' ? (
                  <MessageMarkdown content={msg.content} compact />
                ) : (
                  <p className="whitespace-pre-wrap text-[14px] leading-6">{msg.content}</p>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="bg-white/5 text-white/50 p-3 rounded-2xl rounded-bl-sm self-start flex gap-1 w-fit">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce delay-100">●</span>
                <span className="animate-bounce delay-200">●</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChat} className="p-3 border-t border-white/10 bg-white/5 flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a follow-up..."
              className="flex-1 bg-black/40 border border-white/10 rounded-full px-4 py-2 text-sm text-white outline-none focus:border-purple-500/50 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-white text-black font-semibold rounded-full px-4 py-2 text-sm hover:bg-gray-200 disabled:opacity-50 transition-all"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
};

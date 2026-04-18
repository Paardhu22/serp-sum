import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [knowledgeError, setKnowledgeError] = useState('');
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isClearingKnowledge, setIsClearingKnowledge] = useState(false);

  const [thinkMode, setThinkMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

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

  const handleSend = async (textToSend?: string) => {
    const trimmedInput = textToSend ? textToSend.trim() : input.trim();
    if (!trimmedInput || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmedInput };
    const nextHistory = [...messages, userMsg];

    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      messages: nextHistory,
      context: { origin: 'side-panel', thinkMode },
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
    if (!window.confirm('Clear all saved knowledge items from this device?')) return;

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
  }, [messages, isLoading, activeTab]);

  const filteredKnowledgeItems = useMemo(() => {
    const query = knowledgeSearch.trim().toLowerCase();
    if (!query) return knowledgeItems;
    return knowledgeItems.filter((item) => {
      const haystack = [item.title, item.prompt, item.response, item.source.pageTitle || ''].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [knowledgeItems, knowledgeSearch]);

  const startVoiceMode = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support the Web Speech API");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      let draft = '';
      for (let i = 0; i < event.results.length; i++) {
        draft += event.results[i][0].transcript;
      }
      setInput(draft);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  return (
    <div className="flex h-screen w-full bg-[#f8f9fa] overflow-hidden text-gray-900 font-ui selection:bg-purple-100 selection:text-purple-900">

      {/* LEFT MAIN AREA */}
      <div className="flex-1 flex flex-col relative bg-white m-2 rounded-[24px] shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
        {/* Main Content Scrollable Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 pb-0 flex flex-col">
          {activeTab === 'knowledge' ? (
            <div className="flex-1 min-h-0 flex flex-col p-2 pt-0 w-full animate-in fade-in duration-300">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">Knowledge Space</h2>
                <button
                  onClick={clearKnowledge}
                  disabled={isClearingKnowledge || isKnowledgeLoading || knowledgeItems.length === 0}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
                >
                  {isClearingKnowledge ? 'Clearing...' : 'Clear All'}
                </button>
              </div>

              <p className="mb-4 text-xs font-medium text-gray-500">
                Your saved insights and responses are securely stored locally on this device.
              </p>

              <div className="mb-5 relative">
                <input
                  type="text"
                  value={knowledgeSearch}
                  onChange={(event) => setKnowledgeSearch(event.target.value)}
                  placeholder="Search your knowledge base..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pl-10 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                />
                <svg className="absolute left-3.5 top-3 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {filteredKnowledgeItems.length} result{filteredKnowledgeItems.length === 1 ? '' : 's'}
                </p>
              </div>

              {knowledgeError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">
                  {knowledgeError}
                </div>
              )}

              {isKnowledgeLoading ? (
                <div className="flex flex-1 items-center justify-center text-sm font-medium uppercase tracking-widest text-gray-400">Loading your knowledge...</div>
              ) : knowledgeItems.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center pb-20">
                  <div className="bg-purple-50 p-4 rounded-full mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  </div>
                  <p className="max-w-[280px] text-sm text-gray-500 font-medium">
                    No items saved yet. Start chatting or summarizing to build your local knowledge library.
                  </p>
                </div>
              ) : filteredKnowledgeItems.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <p className="max-w-[280px] text-sm text-gray-500 font-medium">
                    No saved knowledge matches your search. Try a different keyword.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto pr-2 pb-2 h-0 flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                  {filteredKnowledgeItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
                      <div className="mb-3 flex justify-between items-start">
                        <h3 className="text-[15px] font-bold text-gray-900 leading-tight pr-4">{item.title}</h3>
                        <div className="flex flex-col items-end gap-1">
                          <span className="shrink-0 rounded bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                            {item.kind === 'summary' ? 'Summary' : 'Chat'}
                          </span>
                          <span className="text-[10px] text-gray-400">{formatTimestamp(item.createdAt)}</span>
                        </div>
                      </div>
                      <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-600">Prompt</p>
                        <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap">{item.prompt}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-purple-600">Answer</p>
                        <MessageMarkdown content={item.response} compact />
                      </div>
                      {(item.source.pageTitle || item.source.pageUrl) && (
                        <div className="mt-4 flex items-center justify-between text-xs font-medium text-gray-500 border-t border-gray-100 pt-3">
                          <span className="truncate max-w-[70%]">Source: {item.source.pageTitle || 'Web page'}</span>
                          {item.source.pageUrl && (
                            <a href={item.source.pageUrl} target="_blank" rel="noreferrer" className="text-purple-600 hover:text-purple-700 underline decoration-purple-200 underline-offset-4 shrink-0 transition">Open Link ↗</a>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center animate-in fade-in duration-500">
              <h1 className="text-[44px] font-bold text-black mb-1 tracking-tight">Hi,</h1>
              <h2 className="text-[22px] font-semibold text-black mb-8 tracking-tight">How can I assist you today?</h2>
            </div>
          ) : (
            <div className="flex-1 space-y-6 pb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[15px] leading-relaxed shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] ${msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-sm'
                    : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                    {msg.role === 'assistant' ? (
                      <MessageMarkdown content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl rounded-bl-sm text-gray-400 flex gap-1.5 items-center shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse delay-150"></span>
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse delay-300"></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <div className="p-4 pt-2 shrink-0">
          <div className="border border-gray-200 rounded-[20px] bg-white shadow-sm flex flex-col focus-within:ring-2 ring-purple-100 focus-within:border-purple-300 transition-all">
            {/* Top Toolbar */}
            <div className="flex items-center justify-end p-2 pb-0">
              <div className="flex items-center gap-1 text-gray-500 pr-2">
                <button className="p-1.5 hover:bg-gray-100 hover:text-gray-800 rounded-md transition"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg></button>
                <button className="p-1.5 hover:bg-gray-100 hover:text-gray-800 rounded-md transition"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
                <button className="p-1.5 hover:bg-gray-100 hover:text-gray-800 rounded-md transition"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></button>
                <button className="p-1.5 hover:bg-gray-100 hover:text-gray-800 rounded-md transition"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg></button>
                <button className="p-1.5 hover:bg-gray-100 hover:text-gray-800 rounded-md transition"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></button>
                <button className="flex items-center gap-1 p-1 bg-purple-600 text-white rounded-md mx-1 transition hover:bg-purple-700 shadow-sm"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
              </div>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="w-full px-4 py-2 mt-1 text-[15px] outline-none resize-none bg-transparent min-h-[64px] max-h-[200px] overflow-y-auto placeholder:text-gray-300 placeholder:font-normal"
              placeholder="Ask anything, @ models, / prompts"
            />

            <div className="flex items-center justify-between p-3 pt-1">
              <div className="flex gap-2">
                <button
                  onClick={() => setThinkMode(!thinkMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[13px] font-medium transition shadow-sm ${thinkMode ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                  Think
                </button>
                <button
                  onClick={startVoiceMode}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[13px] font-medium transition shadow-sm ${isListening ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                  {isListening ? 'Listening...' : 'Voice Mode'}
                </button>
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-black transition disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
              </button>
            </div>
          </div>

          {/* Footer Bar removed */}
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="flex flex-col items-center py-4 flex-shrink-0 relative border-l border-gray-100 bg-gray-50/30" style={{ width: '42px' }}>
        <div className="flex gap-2 mb-4 text-gray-500">
          <button className="p-0.5 hover:bg-gray-200 rounded transition"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></button>
          <button className="p-0.5 hover:bg-gray-200 rounded transition"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg></button>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1 w-full mt-2">
          {[
            { id: 'chat', label: 'Chat', icon: <img src="/Gemini_Generated_Image_v58ufcv58ufcv58u-removebg-preview.png" className="w-[18px] h-[18px] object-contain" alt="Chat" /> },
            { id: 'knowledge', label: 'Agent', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg> },
            { id: 'creator', label: 'Creator', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><line x1="2" y1="2" x2="22" y2="22" /></svg> },
            { id: 'translate', label: 'Translate', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'knowledge' || item.id === 'chat') {
                  setActiveTab(item.id as any);
                  if (item.id === 'knowledge') loadKnowledge();
                }
              }}
              className={`flex flex-col items-center gap-1 w-full py-1.5 transition relative group ${activeTab === item.id
                ? 'text-purple-600'
                : item.id === 'chat' && activeTab !== 'knowledge' ? 'text-purple-600' : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              <div className={`p-1.5 rounded-[10px] transition-all ${activeTab === item.id
                ? 'bg-purple-100 text-purple-600 shadow-sm'
                : 'bg-transparent text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-800'
                }`}>
                {item.icon}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-4 w-full">
        </div>
      </div>

    </div>
  );
}

export default App;

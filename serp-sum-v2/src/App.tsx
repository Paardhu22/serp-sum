import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your serp-sum assistant. How can I help you understand the web today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    chrome.runtime.sendMessage({ type: "CHAT_MESSAGE", messages: [...messages, userMsg] }, (res) => {
      setIsLoading(false);
      if (res?.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "❌ Error: " + (res?.error || "Failed to reach AI.") }]);
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0f14] text-white font-sans selection:bg-purple-500/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          serp-sum OS
        </h1>
        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 p-3">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${activeTab === 'chat' ? 'bg-white/15 border border-white/10' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Chat
        </button>
        <button 
          onClick={() => setActiveTab('knowledge')}
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
                  {msg.content}
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
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center">
          <div className="bg-purple-500/10 p-4 rounded-full mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <h2 className="font-semibold mb-2">Knowledge Base</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-[200px]">
            Your saved summaries and clips will appear here in the next update.
          </p>
        </div>
      )}
    </div>
  );
}

export default App;

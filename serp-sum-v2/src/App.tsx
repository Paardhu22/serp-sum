import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageMarkdown } from './components/MessageMarkdown';
import type { ChatMessage, KnowledgeItem } from './shared/types';

interface ChatResponse {
  success?: boolean;
  reply?: string;
  error?: string;
}

interface TranslationResponse {
  success?: boolean;
  translatedText?: string;
  detectedLanguage?: string;
  error?: string;
}

interface ImageGenerationResponse {
  success?: boolean;
  imageDataUrl?: string;
  imageUrl?: string;
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

type SidebarTab = 'chat' | 'knowledge' | 'creator' | 'translate' | 'settings';
type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

type TranslateTarget = {
  label: string;
  value: string;
};

type CreatorStyle = {
  label: string;
  value: string;
};

const TRANSLATE_TARGETS: TranslateTarget[] = [
  { label: 'English', value: 'English' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' },
  { label: 'German', value: 'German' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'Japanese', value: 'Japanese' },
  { label: 'Telugu', value: 'Telugu' },
  { label: 'Tamil', value: 'Tamil' },
  { label: 'Korean', value: 'Korean' },
  { label: 'Arabic', value: 'Arabic' },
];

const CREATOR_STYLES: CreatorStyle[] = [
  { label: 'Photoreal', value: 'photorealistic, high detail' },
  { label: 'Cinematic', value: 'cinematic lighting, dramatic composition' },
  { label: 'Illustration', value: 'clean digital illustration' },
  { label: 'Anime', value: 'anime style, expressive characters' },
  { label: '3D Render', value: 'high quality 3d render, octane style' },
];

const IMAGE_SIZE_OPTIONS: Array<{ label: string; value: ImageSize }> = [
  { label: 'Square (1024x1024)', value: '1024x1024' },
  { label: 'Portrait (1024x1536)', value: '1024x1536' },
  { label: 'Landscape (1536x1024)', value: '1536x1024' },
];

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function formatTimestamp(isoDate: string): string {
  const asDate = new Date(isoDate);
  if (Number.isNaN(asDate.getTime())) {
    return 'Unknown time';
  }
  return asDate.toLocaleString();
}

function App() {
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('chat');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [knowledgeError, setKnowledgeError] = useState('');
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isClearingKnowledge, setIsClearingKnowledge] = useState(false);

  const [isThinkModeEnabled, setIsThinkModeEnabled] = useState(false);
  const [isVoiceModeEnabled, setIsVoiceModeEnabled] = useState(false);

  const [translateInput, setTranslateInput] = useState('');
  const [translateTarget, setTranslateTarget] = useState('English');
  const [translatedOutput, setTranslatedOutput] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [translationError, setTranslationError] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const [creatorPrompt, setCreatorPrompt] = useState('');
  const [creatorStyle, setCreatorStyle] = useState(CREATOR_STYLES[0].value);
  const [creatorSize, setCreatorSize] = useState<ImageSize>('1024x1024');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [creatorError, setCreatorError] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptPrefixRef = useRef('');
  const isVoiceModeEnabledRef = useRef(false);

  useEffect(() => {
    if (!chrome?.storage?.local) {
      return;
    }

    chrome.storage.local.get(['uiDarkMode'], (stored) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (typeof stored?.uiDarkMode === 'boolean') {
        setIsDarkMode(stored.uiDarkMode);
      }
    });
  }, []);

  useEffect(() => {
    if (!chrome?.storage?.local) {
      return;
    }

    chrome.storage.local.set({ uiDarkMode: isDarkMode });
  }, [isDarkMode]);

  const loadKnowledge = useCallback(() => {
    if (!chrome?.runtime?.sendMessage) {
      setKnowledgeError('Extension runtime is unavailable.');
      return;
    }

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

  const handleSubmit = () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput || isLoading) {
      return;
    }

    if (!chrome?.runtime?.sendMessage) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '❌ Error: Extension runtime is unavailable.' }]);
      return;
    }

    const payload = {
      inputText: trimmedInput,
      isThinkModeEnabled,
      isVoiceModeEnabled,
    };
    console.log('Submitting payload:', payload);

    const userMsg: ChatMessage = { role: 'user', content: trimmedInput };
    const nextHistory = [...messages, userMsg];

    setMessages(nextHistory);
    setInputText('');
    setIsLoading(true);

    chrome.runtime.sendMessage(
      {
        type: 'CHAT_MESSAGE',
        messages: nextHistory,
        context: {
          origin: 'side-panel',
          thinkMode: isThinkModeEnabled,
        },
      },
      (res: ChatResponse) => {
        setIsLoading(false);

        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          setMessages((prev) => [...prev, { role: 'assistant', content: `❌ Error: ${runtimeError.message || 'Request failed.'}` }]);
          return;
        }

        if (res?.success && typeof res.reply === 'string') {
          const replyText = res.reply;
          setMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
          loadKnowledge();
          return;
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: `❌ Error: ${res?.error || 'Failed to reach AI.'}` }]);
      },
    );
  };

  const clearKnowledge = () => {
    if (isClearingKnowledge) {
      return;
    }

    if (!window.confirm('Clear all saved knowledge items from this device?')) {
      return;
    }

    if (!chrome?.runtime?.sendMessage) {
      setKnowledgeError('Extension runtime is unavailable.');
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
  }, [messages, isLoading, activeSidebarTab]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isVoiceModeEnabledRef.current = isVoiceModeEnabled;
  }, [isVoiceModeEnabled]);

  const filteredKnowledgeItems = useMemo(() => {
    const query = knowledgeSearch.trim().toLowerCase();
    if (!query) {
      return knowledgeItems;
    }

    return knowledgeItems.filter((item) => {
      const haystack = [item.title, item.prompt, item.response, item.source.pageTitle || ''].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [knowledgeItems, knowledgeSearch]);

  const stopVoiceRecognition = useCallback(() => {
    if (!recognitionRef.current) {
      return;
    }

    recognitionRef.current.onresult = null;
    recognitionRef.current.onerror = null;
    recognitionRef.current.onend = null;
    recognitionRef.current.stop();
    recognitionRef.current = null;
  }, []);

  const startVoiceRecognition = useCallback(async () => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert('Your browser does not support voice recognition in this panel.');
      setIsVoiceModeEnabled(false);
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('Microphone permission denied or unavailable.', error);
      alert('Microphone access is blocked. Please allow microphone permissions for this extension.');
      setIsVoiceModeEnabled(false);
      return;
    }

    stopVoiceRecognition();

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    transcriptPrefixRef.current = inputText.trim();

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }

      const cleanedTranscript = transcript.trim();
      const prefix = transcriptPrefixRef.current;
      const nextValue = cleanedTranscript
        ? prefix
          ? `${prefix}\n${cleanedTranscript}`
          : cleanedTranscript
        : prefix;

      setInputText(nextValue);
    };

    recognition.onerror = (event: any) => {
      console.error('Voice recognition error:', event?.error || event);
      setIsVoiceModeEnabled(false);
      stopVoiceRecognition();
    };

    recognition.onend = () => {
      if (!recognitionRef.current || !isVoiceModeEnabledRef.current) {
        return;
      }

      try {
        recognition.start();
      } catch (error) {
        console.error('Could not restart voice recognition.', error);
        setIsVoiceModeEnabled(false);
        stopVoiceRecognition();
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      console.log('Voice recognition started.');
    } catch (error) {
      console.error('Could not start voice recognition.', error);
      setIsVoiceModeEnabled(false);
      stopVoiceRecognition();
    }
  }, [inputText, stopVoiceRecognition]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const looksLikeText = file.type.startsWith('text/')
      || /\.(txt|md|json|csv|js|ts|tsx|html|css)$/i.test(file.name);

    if (!looksLikeText) {
      const sizeInKb = Math.max(1, Math.round(file.size / 1024));
      setInputText((prev) => `${prev}${prev ? '\n\n' : ''}[Attached file: ${file.name} (${sizeInKb} KB)]`);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawContent = typeof reader.result === 'string' ? reader.result : '';
      const cappedContent = rawContent.length > 7000
        ? `${rawContent.slice(0, 7000)}\n...[truncated]`
        : rawContent;

      setInputText((prev) => `${prev}${prev ? '\n\n' : ''}[Attached file: ${file.name}]\n${cappedContent}`);
    };
    reader.onerror = (error) => {
      console.error('Failed to read selected file.', error);
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const handleUploadAction = () => {
    fileInputRef.current?.click();
  };

  const handleContextAction = () => {
    if (!chrome?.tabs?.query || !chrome?.scripting?.executeScript) {
      console.warn('Context extraction API is unavailable.');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTabId = tabs[0]?.id;
      if (!activeTabId) {
        console.warn('No active tab found for context capture.');
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: () => document.body?.innerText?.slice(0, 5000) || '',
      }).then((results) => {
        const pageText = results?.[0]?.result;
        if (typeof pageText !== 'string' || !pageText.trim()) {
          console.warn('No readable text found on the page.');
          return;
        }

        setInputText((prev) => `${prev}${prev ? '\n\n' : ''}Summarize this page content:\n${pageText}`);
        setActiveSidebarTab('chat');
      }).catch((error) => {
        console.error('Unable to capture active page context.', error);
      });
    });
  };

  const handleSettingsAction = () => {
    setActiveSidebarTab('settings');
  };

  const handleHistoryAction = () => {
    setActiveSidebarTab('knowledge');
    loadKnowledge();
  };

  const handleAddAction = () => {
    setMessages([]);
    setInputText('');
    setActiveSidebarTab('chat');
    setIsVoiceModeEnabled(false);
    stopVoiceRecognition();
  };

  const toggleThinkMode = () => {
    setIsThinkModeEnabled((prev) => !prev);
  };

  const toggleVoiceMode = () => {
    if (isVoiceModeEnabled) {
      setIsVoiceModeEnabled(false);
      stopVoiceRecognition();
      return;
    }

    setIsVoiceModeEnabled(true);
    void startVoiceRecognition();
  };

  const handleTranslate = () => {
    const text = translateInput.trim();
    if (!text || isTranslating) {
      return;
    }

    if (!chrome?.runtime?.sendMessage) {
      setTranslationError('Extension runtime is unavailable.');
      return;
    }

    setIsTranslating(true);
    setTranslationError('');
    setTranslatedOutput('');
    setDetectedLanguage('');

    chrome.runtime.sendMessage(
      {
        type: 'TRANSLATE_TEXT',
        text,
        targetLanguage: translateTarget,
        sourceLanguage: 'auto',
      },
      (res: TranslationResponse) => {
        setIsTranslating(false);

        if (chrome.runtime.lastError) {
          setTranslationError(chrome.runtime.lastError.message || 'Translation request failed.');
          return;
        }

        if (res?.success && typeof res.translatedText === 'string') {
          setTranslatedOutput(res.translatedText);
          setDetectedLanguage(res.detectedLanguage || 'Auto-detected');
          return;
        }

        setTranslationError(res?.error || 'Could not translate this text.');
      },
    );
  };

  const handleCopyTranslation = async () => {
    if (!translatedOutput) {
      return;
    }

    try {
      await navigator.clipboard.writeText(translatedOutput);
    } catch (error) {
      console.error('Could not copy translation.', error);
    }
  };

  const handleGenerateImage = () => {
    const prompt = creatorPrompt.trim();
    if (!prompt || isGeneratingImage) {
      return;
    }

    if (!chrome?.runtime?.sendMessage) {
      setCreatorError('Extension runtime is unavailable.');
      return;
    }

    setIsGeneratingImage(true);
    setCreatorError('');
    setGeneratedImageUrl('');

    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_IMAGE',
        prompt,
        style: creatorStyle,
        size: creatorSize,
      },
      (res: ImageGenerationResponse) => {
        setIsGeneratingImage(false);

        if (chrome.runtime.lastError) {
          setCreatorError(chrome.runtime.lastError.message || 'Image generation failed.');
          return;
        }

        if (res?.success && (typeof res.imageDataUrl === 'string' || typeof res.imageUrl === 'string')) {
          setGeneratedImageUrl(res.imageDataUrl || res.imageUrl || '');
          return;
        }

        setCreatorError(res?.error || 'Image generation failed.');
      },
    );
  };

  const handleDownloadGeneratedImage = () => {
    if (!generatedImageUrl) {
      return;
    }

    const link = document.createElement('a');
    link.href = generatedImageUrl;
    link.download = `serp-sum-generated-${Date.now()}.png`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.click();
  };

  const showComposer = activeSidebarTab === 'chat';

  const toolbarButtonClass = cx(
    'rounded-md border p-2 shadow-sm transition',
    isDarkMode
      ? 'border-transparent bg-slate-800/90 text-slate-300 hover:border-slate-600 hover:bg-slate-700 hover:text-slate-100'
      : 'border-transparent bg-white/85 text-gray-600 hover:border-gray-200 hover:bg-white hover:text-gray-900',
  );

  const sidebarItems: Array<{ id: SidebarTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'chat',
      label: 'Chat',
      icon: <img src="/Gemini_Generated_Image_v58ufcv58ufcv58u-removebg-preview.png" className="h-[34px] w-[34px] aspect-square rounded-full object-contain" alt="Chat" />,
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>,
    },
    {
      id: 'creator',
      label: 'Creator',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><line x1="2" y1="2" x2="22" y2="22" /></svg>,
    },
    {
      id: 'translate',
      label: 'Translate',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    },
  ];

  return (
    <div className={cx(
      'flex h-screen w-full overflow-hidden font-ui',
      isDarkMode
        ? 'bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-100'
        : 'bg-[#f4f5f7] text-gray-900 selection:bg-indigo-100 selection:text-indigo-900',
    )}
    >
      <div className={cx(
        'm-3 flex flex-1 flex-col overflow-hidden rounded-[24px] border',
        isDarkMode
          ? 'border-slate-700 bg-slate-900 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.7)]'
          : 'border-[#e2e5ea] bg-white shadow-[0_14px_30px_-22px_rgba(15,23,42,0.55)]',
      )}
      >
        <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto px-6 py-6 pb-0">
          {activeSidebarTab === 'knowledge' ? (
            <div className="flex min-h-0 flex-1 flex-col p-2 pt-0 animate-in fade-in duration-300">
              <div className="mb-5 flex items-center justify-between">
                <h2 className={cx('text-sm font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-200' : 'text-gray-800')}>Knowledge Space</h2>
                <button
                  onClick={clearKnowledge}
                  disabled={isClearingKnowledge || isKnowledgeLoading || knowledgeItems.length === 0}
                  className={cx(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    isDarkMode
                      ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'border-gray-200 bg-white text-red-600 hover:bg-red-50',
                  )}
                >
                  {isClearingKnowledge ? 'Clearing...' : 'Clear All'}
                </button>
              </div>

              <p className={cx('mb-4 text-xs font-medium', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                Your saved insights and responses are stored locally on this device.
              </p>

              <div className="relative mb-5">
                <input
                  type="text"
                  value={knowledgeSearch}
                  onChange={(event) => setKnowledgeSearch(event.target.value)}
                  placeholder="Search your knowledge base..."
                  className={cx(
                    'w-full rounded-xl border px-4 py-2.5 pl-10 text-sm outline-none transition-colors',
                    isDarkMode
                      ? 'border-slate-600 bg-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
                      : 'border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-500 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100',
                  )}
                />
                <svg className={cx('absolute left-3.5 top-3', isDarkMode ? 'text-slate-400' : 'text-gray-500')} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <p className={cx('mt-2 text-[11px] font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                  {filteredKnowledgeItems.length} result{filteredKnowledgeItems.length === 1 ? '' : 's'}
                </p>
              </div>

              {knowledgeError && (
                <div className={cx(
                  'mb-4 rounded-xl border px-4 py-3 text-sm shadow-sm',
                  isDarkMode ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-600',
                )}
                >
                  {knowledgeError}
                </div>
              )}

              {isKnowledgeLoading ? (
                <div className={cx('flex flex-1 items-center justify-center text-sm font-medium uppercase tracking-widest', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Loading your knowledge...</div>
              ) : knowledgeItems.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
                  <div className={cx('mb-4 rounded-full p-4', isDarkMode ? 'bg-indigo-500/20' : 'bg-indigo-50')}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cx(isDarkMode ? 'text-indigo-300' : 'text-indigo-500')}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  </div>
                  <p className={cx('max-w-[280px] text-sm font-medium', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                    No items saved yet. Start chatting to build your local knowledge library.
                  </p>
                </div>
              ) : filteredKnowledgeItems.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <p className={cx('max-w-[280px] text-sm font-medium', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                    No saved knowledge matches your search. Try a different keyword.
                  </p>
                </div>
              ) : (
                <div className="h-0 flex-1 space-y-4 overflow-y-auto pb-2 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                  {filteredKnowledgeItems.map((item) => (
                    <article key={item.id} className={cx(
                      'rounded-2xl border p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md',
                      isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-white',
                    )}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <h3 className={cx('pr-4 text-[15px] font-bold leading-tight', isDarkMode ? 'text-slate-100' : 'text-gray-900')}>{item.title}</h3>
                        <div className="flex flex-col items-end gap-1">
                          <span className={cx(
                            'shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                            isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-500',
                          )}
                          >
                            {item.kind === 'summary' ? 'Summary' : 'Chat'}
                          </span>
                          <span className={cx('text-[10px]', isDarkMode ? 'text-slate-400' : 'text-gray-400')}>{formatTimestamp(item.createdAt)}</span>
                        </div>
                      </div>
                      <div className={cx('mb-4 rounded-xl border px-4 py-3', isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-100 bg-gray-50')}>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-500">Prompt</p>
                        <p className={cx('whitespace-pre-wrap text-sm font-medium', isDarkMode ? 'text-slate-200' : 'text-gray-700')}>{item.prompt}</p>
                      </div>
                      <div className={cx('rounded-xl border px-4 py-3 shadow-sm', isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-100 bg-white')}>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-500">Answer</p>
                        <MessageMarkdown content={item.response} compact />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : activeSidebarTab === 'settings' ? (
            <div className="flex flex-1 flex-col gap-5 pb-10 animate-in fade-in duration-300">
              <div>
                <h2 className={cx('mb-2 text-2xl font-bold tracking-tight', isDarkMode ? 'text-slate-100' : 'text-gray-800')}>Settings</h2>
                <p className={cx('text-sm font-medium', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Personalize your assistant behavior and appearance.</p>
              </div>

              <div className={cx('rounded-2xl border p-5', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white')}>
                <div className="mb-4">
                  <h3 className={cx('text-base font-semibold', isDarkMode ? 'text-slate-100' : 'text-gray-900')}>Dark Mode</h3>
                  <p className={cx('mt-1 text-sm', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Switch between light and dark themes for the entire side panel.</p>
                </div>

                <button
                  onClick={() => setIsDarkMode((prev) => !prev)}
                  className={cx(
                    'flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold transition',
                    isDarkMode
                      ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30'
                      : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                  )}
                >
                  <span className={cx('inline-block h-2.5 w-2.5 rounded-full', isDarkMode ? 'bg-indigo-300' : 'bg-indigo-500')} />
                  {isDarkMode ? 'Dark Mode Enabled' : 'Enable Dark Mode'}
                </button>
              </div>

              <div className={cx('rounded-2xl border p-5', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white')}>
                <h3 className={cx('text-base font-semibold', isDarkMode ? 'text-slate-100' : 'text-gray-900')}>Think Mode</h3>
                <p className={cx('mt-1 text-sm', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                  When enabled in Chat, responses use a deeper reasoning profile with a minimum 15-second thinking window.
                </p>
              </div>
            </div>
          ) : activeSidebarTab === 'translate' ? (
            <div className="flex flex-1 flex-col gap-5 pb-8 animate-in fade-in duration-300">
              <div>
                <h2 className={cx('mb-2 text-2xl font-bold tracking-tight', isDarkMode ? 'text-slate-100' : 'text-gray-800')}>Translation Tools</h2>
                <p className={cx('text-sm font-medium', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Translate text accurately across languages while preserving meaning and tone.</p>
              </div>

              <div className={cx('rounded-2xl border p-4', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white')}>
                <label className={cx('mb-2 block text-xs font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Source Text</label>
                <textarea
                  value={translateInput}
                  onChange={(event) => setTranslateInput(event.target.value)}
                  placeholder="Paste text to translate..."
                  className={cx(
                    'min-h-[150px] w-full resize-y rounded-xl border px-4 py-3 text-sm outline-none',
                    isDarkMode
                      ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-indigo-400'
                      : 'border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:border-indigo-300',
                  )}
                />

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <select
                    value={translateTarget}
                    onChange={(event) => setTranslateTarget(event.target.value)}
                    className={cx(
                      'rounded-lg border px-3 py-2 text-sm outline-none',
                      isDarkMode
                        ? 'border-slate-600 bg-slate-900 text-slate-100'
                        : 'border-gray-200 bg-white text-gray-700',
                    )}
                  >
                    {TRANSLATE_TARGETS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleTranslate}
                    disabled={isTranslating || !translateInput.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isTranslating ? 'Translating...' : `Translate to ${translateTarget}`}
                  </button>
                </div>

                {translationError && (
                  <p className={cx('mt-3 text-sm', isDarkMode ? 'text-red-300' : 'text-red-600')}>{translationError}</p>
                )}
              </div>

              {(translatedOutput || isTranslating) && (
                <div className={cx('rounded-2xl border p-4', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white')}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className={cx('text-xs font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                      Translation {detectedLanguage ? `(${detectedLanguage})` : ''}
                    </p>
                    {translatedOutput && (
                      <button
                        onClick={() => void handleCopyTranslation()}
                        className={cx('text-xs font-semibold underline underline-offset-4', isDarkMode ? 'text-indigo-300' : 'text-indigo-600')}
                      >
                        Copy
                      </button>
                    )}
                  </div>
                  {isTranslating ? (
                    <p className={cx('text-sm', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Preparing a high-quality translation...</p>
                  ) : (
                    <p className={cx('whitespace-pre-wrap text-sm leading-relaxed', isDarkMode ? 'text-slate-100' : 'text-gray-800')}>{translatedOutput}</p>
                  )}
                </div>
              )}
            </div>
          ) : activeSidebarTab === 'creator' ? (
            <div className="flex flex-1 flex-col gap-5 pb-8 animate-in fade-in duration-300">
              <div>
                <h2 className={cx('mb-2 text-2xl font-bold tracking-tight', isDarkMode ? 'text-slate-100' : 'text-gray-800')}>Creator Studio</h2>
                <p className={cx('text-sm font-medium', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Generate production-ready images from your prompt with style and size controls.</p>
              </div>

              <div className={cx('rounded-2xl border p-4', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white')}>
                <label className={cx('mb-2 block text-xs font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Image Prompt</label>
                <textarea
                  value={creatorPrompt}
                  onChange={(event) => setCreatorPrompt(event.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className={cx(
                    'min-h-[140px] w-full resize-y rounded-xl border px-4 py-3 text-sm outline-none',
                    isDarkMode
                      ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-indigo-400'
                      : 'border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:border-indigo-300',
                  )}
                />

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    value={creatorStyle}
                    onChange={(event) => setCreatorStyle(event.target.value)}
                    className={cx(
                      'rounded-lg border px-3 py-2 text-sm outline-none',
                      isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white text-gray-700',
                    )}
                  >
                    {CREATOR_STYLES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>

                  <select
                    value={creatorSize}
                    onChange={(event) => setCreatorSize(event.target.value as ImageSize)}
                    className={cx(
                      'rounded-lg border px-3 py-2 text-sm outline-none',
                      isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white text-gray-700',
                    )}
                  >
                    {IMAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage || !creatorPrompt.trim()}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGeneratingImage ? 'Generating image...' : 'Generate Image'}
                </button>

                {creatorError && (
                  <p className={cx('mt-3 text-sm', isDarkMode ? 'text-red-300' : 'text-red-600')}>{creatorError}</p>
                )}
              </div>

              {generatedImageUrl && (
                <div className={cx('rounded-2xl border p-4', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white')}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className={cx('text-xs font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Generated Image</p>
                    <button
                      onClick={handleDownloadGeneratedImage}
                      className={cx('text-xs font-semibold underline underline-offset-4', isDarkMode ? 'text-indigo-300' : 'text-indigo-600')}
                    >
                      Download
                    </button>
                  </div>
                  <img src={generatedImageUrl} alt="Generated visual" className="w-full rounded-xl border border-black/10 object-cover" />
                </div>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-end pb-16 animate-in fade-in duration-500">
              <h1 className={cx('text-[38px] font-semibold leading-[1.02] tracking-tight', isDarkMode ? 'text-slate-100' : 'text-gray-900')}>Hi,</h1>
              <h2 className={cx('mt-1 text-[24px] font-medium leading-[1.12] tracking-tight', isDarkMode ? 'text-slate-300' : 'text-gray-700')}>How can I assist you today?</h2>
            </div>
          ) : (
            <div className="flex-1 space-y-6 pb-4">
              {messages.map((msg, index) => (
                <div key={index} className={cx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cx(
                    'max-w-[95%] rounded-2xl p-5 text-[16px] leading-relaxed shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]',
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-indigo-600 text-white'
                      : isDarkMode
                        ? 'rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-100'
                        : 'rounded-bl-sm border border-gray-100 bg-gray-50 text-gray-800',
                  )}
                  >
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
                  <div className={cx(
                    'flex items-center gap-1.5 rounded-2xl rounded-bl-sm border p-4 shadow-sm',
                    isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-gray-100 bg-gray-50 text-gray-400',
                  )}
                  >
                    <span className={cx('h-2 w-2 animate-pulse rounded-full', isDarkMode ? 'bg-slate-400' : 'bg-gray-400')} />
                    <span className={cx('h-2 w-2 animate-pulse rounded-full delay-150', isDarkMode ? 'bg-slate-400' : 'bg-gray-400')} />
                    <span className={cx('h-2 w-2 animate-pulse rounded-full delay-300', isDarkMode ? 'bg-slate-400' : 'bg-gray-400')} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showComposer && (
          <div className="shrink-0 p-5 pt-3">
            <div className={cx(
              'flex flex-col rounded-[24px] border transition-all',
              isDarkMode
                ? 'border-slate-700 bg-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0.25)] focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/25'
                : 'border-[#d8dbe3] bg-[#f8f9fb] shadow-[0_4px_12px_rgba(15,23,42,0.06)] focus-within:border-[#b8c0f5] focus-within:ring-2 focus-within:ring-[#d8defd]',
            )}
            >
              <div className="flex items-center justify-end p-3 pb-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".txt,.md,.json,.csv,.js,.ts,.tsx,.html,.css"
                />

                <div className="flex items-center gap-1.5 pr-2">
                  <button onClick={handleUploadAction} title="Upload" className={toolbarButtonClass}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
                  <button onClick={handleContextAction} title="Context" className={toolbarButtonClass}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></button>
                  <button onClick={handleSettingsAction} title="Settings" className={toolbarButtonClass}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg></button>
                  <button onClick={handleHistoryAction} title="History" className={toolbarButtonClass}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg></button>
                  <button onClick={handleAddAction} title="New Chat" className="mx-1 flex items-center gap-1.5 rounded-md bg-indigo-600 p-1.5 text-white shadow-sm transition hover:bg-indigo-700"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                className={cx(
                  'mt-1 min-h-[110px] max-h-[300px] w-full resize-none overflow-y-auto bg-transparent px-5 py-3 text-[16px] outline-none placeholder:font-normal',
                  isDarkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-gray-800 placeholder:text-gray-500',
                )}
                placeholder="Ask anything, @ models, / prompts"
              />

              <div className="flex items-center justify-between p-4 pt-1">
                <div className="flex gap-2.5">
                  <button
                    onClick={toggleThinkMode}
                    className={cx(
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium shadow-sm transition',
                      isThinkModeEnabled
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : isDarkMode
                          ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    Think
                  </button>

                  <button
                    onClick={toggleVoiceMode}
                    className={cx(
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium shadow-sm transition',
                      isVoiceModeEnabled
                        ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                        : isDarkMode
                          ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                    {isVoiceModeEnabled ? 'Listening...' : 'Voice Mode'}
                  </button>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!inputText.trim() || isLoading}
                  className={cx(
                    'rounded-full p-2.5 transition disabled:opacity-30 disabled:hover:bg-transparent',
                    isDarkMode
                      ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      : 'text-gray-600 hover:bg-gray-200/70 hover:text-gray-900',
                  )}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={cx(
        'relative flex w-[52px] flex-shrink-0 flex-col items-center border-l py-4',
        isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-[#dde1e8] bg-[#eceff4]',
      )}
      >
        <div className={cx('mb-4 flex gap-2', isDarkMode ? 'text-slate-400' : 'text-gray-600')}>
          <button onClick={() => window.close()} title="Close Side Panel" className={cx('rounded p-0.5 transition', isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-200')}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></button>
          <button onClick={() => alert('Sidebar Expansion Coming Soon')} title="Expand" className={cx('rounded p-0.5 transition', isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-200')}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg></button>
        </div>

        <div className="mt-2 flex w-full flex-1 flex-col items-center gap-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              title={item.label}
              onClick={() => {
                setActiveSidebarTab(item.id);
                if (item.id === 'knowledge') {
                  loadKnowledge();
                }
              }}
              className={cx(
                'group relative flex w-full flex-col items-center gap-1 py-1.5 transition',
                activeSidebarTab === item.id
                  ? 'text-indigo-700'
                  : isDarkMode
                    ? 'text-slate-400 hover:text-slate-100'
                    : 'text-gray-600 hover:text-gray-900',
              )}
            >
              <div className={cx(
                'rounded-[10px] p-1.5 transition-all',
                activeSidebarTab === item.id
                  ? 'bg-indigo-100 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(79,70,229,0.14)]'
                  : isDarkMode
                    ? 'bg-transparent text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-100'
                    : 'bg-transparent text-gray-600 group-hover:bg-gray-200/70 group-hover:text-gray-900',
              )}
              >
                {item.icon}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;

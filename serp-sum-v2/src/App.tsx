import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageMarkdown } from './components/MessageMarkdown';
import type { ChatMessage, KnowledgeItem } from './shared/types';



interface DefaultResponse {
  success?: boolean;
  error?: string;
}

type SidebarTab = 'chat' | 'knowledge' | 'creator' | 'translate' | 'settings' | 'tasks';
type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

type TranslateTarget = {
  label: string;
  value: string;
};

type CreatorStyle = {
  label: string;
  value: string;
};

interface Task {
  id: string;
  title: string;
  triggerTime: number;
  frequency: 'once' | 'daily';
}

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

// Set this to your live Vercel URL (exclude trailing slash)
const BASE_URL = 'https://serp-sum.vercel.app';


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

  const [chatModel, setChatModel] = useState('gemini-3-flash');
  const [creatorModel, setCreatorModel] = useState('gemini-3.1-flash-image-preview');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isCreatorModelOpen, setIsCreatorModelOpen] = useState(false);
  const [isCreatorStyleOpen, setIsCreatorStyleOpen] = useState(false);
  const [isCreatorSizeOpen, setIsCreatorSizeOpen] = useState(false);
  const [isTranslateTargetOpen, setIsTranslateTargetOpen] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('12:00');
  const [newTaskFrequency, setNewTaskFrequency] = useState<'once' | 'daily'>('once');
  const [isHourDropdownOpen, setIsHourDropdownOpen] = useState(false);
  const [isMinuteDropdownOpen, setIsMinuteDropdownOpen] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get(['tasks'], (result) => {
      if (result.tasks) {
        setTasks(result.tasks as Task[]);
      }
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.tasks) {
        setTasks((changes.tasks.newValue as Task[]) || []);
      }
    };
    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }
    return () => {
      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  // Auto-Login on Mount (Silent authentication)
  useEffect(() => {
    if (!chrome?.identity?.getAuthToken) {
      return;
    }

    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        // Safe to ignore, user just hasn't granted permissions fully yet or token expired
        return;
      }

      console.log('Silent Google Token retrieved, verifying session...');

      try {
        const response = await fetch(`${BASE_URL}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.success && data.user) {
          console.log('Successfully restored session from Neon DB:', data.user);
          setUser(data.user);
        }
      } catch (error) {
        console.error('Silent auto-login failed to connect to backend:', error);
      }
    });
  }, []);

  const loadKnowledge = useCallback(async () => {
    if (!user) {
      setKnowledgeError('Please log in to view your chat history.');
      return;
    }

    setIsKnowledgeLoading(true);
    setKnowledgeError('');

    try {
      const response = await fetch(`${BASE_URL}/api/chat?userId=${user.id}`);
      const data = await response.json();

      if (data.success && Array.isArray(data.chats)) {
        const items = data.chats.map((chat: any) => {
          const userMessage = chat.messages.find((m: any) => m.role === 'user');
          const assistantMessage = chat.messages.find((m: any) => m.role === 'assistant');
          return {
            id: chat.id,
            createdAt: chat.createdAt,
            kind: 'chat',
            title: chat.title || 'Chat',
            prompt: userMessage?.content || '...',
            response: assistantMessage?.content || 'No response yet.',
            source: { origin: 'side-panel' },
            messages: chat.messages
          } as any;
        });
        setKnowledgeItems(items);
      } else {
        setKnowledgeError(data.error || 'Could not load your history.');
      }
    } catch (e: any) {
      setKnowledgeError(e.message || 'Error fetching history.');
    } finally {
      setIsKnowledgeLoading(false);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) {
      alert("Please log in by clicking the profile avatar before sending messages!");
      return;
    }

    const trimmedInput = inputText.trim();
    if (!trimmedInput || isLoading) {
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

    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: nextHistory,
          temperature: 0.62,
          maxTokens: 650,
          model: chatModel,
          userId: user?.id,
          chatId: currentChatId,
        }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (data.success && typeof data.reply === 'string') {
        const replyText = data.reply;
        setMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
        if (data.chatId) {
          setCurrentChatId(data.chatId);
        }
        loadKnowledge();
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `❌ Error: ${data.error || 'Failed to reach AI.'}` }]);
      }
    } catch (error: any) {
      setIsLoading(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: `❌ Error: ${error.message || 'Request failed.'}` }]);
    }
  };

  const handleSummarizePage = async () => {
    if (!user) {
      alert("Please log in by clicking the profile avatar before summarizing pages!");
      return;
    }

    if (!chrome?.tabs || !chrome?.scripting) {
      alert("Chrome extension APIs are not available.");
      return;
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.id) {
        alert("Could not find the active tab.");
        return;
      }

      // Inject script to scrape the page text
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => document.body.innerText,
      });

      const extractedText = results[0]?.result;
      if (!extractedText || typeof extractedText !== 'string') {
        alert("Could not extract text from the current page.");
        return;
      }

      const truncatedText = extractedText.slice(0, 10000);
      const promptText = `Please provide a comprehensive summary of the following page content:\n\n${truncatedText}`;

      const userMsg: ChatMessage = { role: 'user', content: "Summarizing current page..." };
      const nextHistory = [...messages, userMsg];

      setMessages(nextHistory);
      setIsLoading(true);

      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: promptText }],
          temperature: 0.62,
          maxTokens: 650,
          model: chatModel,
          userId: user?.id,
          chatId: currentChatId,
        }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (data.success && typeof data.reply === 'string') {
        // Swap out the placeholder with actual prompt so it renders nicely when refreshed (though this session state is temporary)
        setMessages([...messages, { role: 'user', content: "Summarizing current page..." }, { role: 'assistant', content: data.reply }]);
        if (data.chatId) {
          setCurrentChatId(data.chatId);
        }
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `❌ Error: ${data.error || 'Failed to summarize page.'}` }]);
      }
    } catch (error: any) {
      setIsLoading(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: `❌ Error: ${error.message || 'Request failed.'}` }]);
    }
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

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        v.name.includes('Female') || 
        v.name.includes('Zira') || 
        v.name.includes('Samantha') || 
        v.name.includes('Victoria') ||
        v.name.includes('Google UK English Female')
      );
      
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      utterance.pitch = 0.8;

      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech is not supported in your browser.");
    }
  };

  const handleTranslate = async () => {
    const text = translateInput.trim();
    if (!text || isTranslating) {
      return;
    }

    setIsTranslating(true);
    setTranslationError('');
    setTranslatedOutput('');
    setDetectedLanguage('');

    try {
      const response = await fetch(`${BASE_URL}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          targetLanguage: translateTarget,
          sourceLanguage: 'auto',
          userId: user?.id,
        }),
      });

      const res = await response.json();
      setIsTranslating(false);

      if (res?.success && typeof res.translatedText === 'string') {
        setTranslatedOutput(res.translatedText);
        setDetectedLanguage(res.detectedLanguage || 'Auto-detected');
      } else {
        setTranslationError(res?.error || 'Could not translate this text.');
      }
    } catch (err: any) {
      setIsTranslating(false);
      setTranslationError(err.message || 'Translation request failed.');
    }
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

  const handleGenerateImage = async () => {
    const prompt = creatorPrompt.trim();
    if (!prompt || isGeneratingImage) {
      return;
    }

    setIsGeneratingImage(true);
    setCreatorError('');
    setGeneratedImageUrl('');

    try {
      const response = await fetch(`${BASE_URL}/api/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          style: creatorStyle,
          size: creatorSize,
          model: creatorModel,
          userId: user?.id,
        }),
      });

      const res = await response.json();
      setIsGeneratingImage(false);

      if (res?.success && (typeof res.imageDataUrl === 'string' || typeof res.imageUrl === 'string')) {
        setGeneratedImageUrl(res.imageDataUrl || res.imageUrl || '');
      } else {
        setCreatorError(res?.error || 'Image generation failed.');
      }
    } catch (err: any) {
      setIsGeneratingImage(false);
      setCreatorError(err.message || 'Image generation failed.');
    }
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

  const handleLogin = () => {
    if (!chrome?.identity?.getAuthToken) {
      console.warn('Chrome Identity API is not available.');
      return;
    }

    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        console.error('Login failed:', chrome.runtime.lastError.message);
        return;
      }

      console.log('Google Token retrieved, sending to backend...');

      try {
        const response = await fetch(`${BASE_URL}/api/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.success) {
          console.log('Successfully saved to Neon DB:', data.user);
          setUser(data.user);
          alert(`Welcome, ${data.user.name || data.user.email}! Database sync successful.`);
          // In a future step, we can save this user object to a React state variable
        } else {
          console.error('Backend auth error:', data.error);
          alert('Failed to verify with backend.');
        }
      } catch (error) {
        console.error('Network error connecting to backend:', error);
        alert('Could not connect to the Next.js backend. Is it running on port 3000?');
      }
    });
  };

  const handleLogout = () => {
    if (!chrome?.identity?.getAuthToken) {
      console.warn('Chrome Identity API is not available.');
      return;
    }

    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      if (token) {
        try {
          await fetch('https://accounts.google.com/o/oauth2/revoke?token=' + token);
        } catch (error) {
          console.error('Error revoking token:', error);
        }
        chrome.identity.removeCachedAuthToken({ token: token as string }, () => {
          setUser(null);
          setCurrentChatId(null);
        });
      } else {
        setUser(null);
        setCurrentChatId(null);
      }
    });
  };

  const handleResumeChat = (chat: any) => {
    setCurrentChatId(chat.id);
    if (chat.messages && Array.isArray(chat.messages)) {
      setMessages(chat.messages.map((m: any) => ({ role: m.role, content: m.content })));
    } else {
      setMessages([
        { role: 'user', content: chat.prompt },
        { role: 'assistant', content: chat.response }
      ]);
    }
    setActiveSidebarTab('chat');
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskTime) return;
    const [hours, minutes] = newTaskTime.split(':').map(Number);
    const now = new Date();
    // Create a date object for today with the specified time
    const triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    
    // If that time has already passed today, schedule it for tomorrow
    if (triggerDate.getTime() <= now.getTime()) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }
    
    const timestamp = triggerDate.getTime();
    
    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      triggerTime: timestamp,
      frequency: newTaskFrequency
    };

    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    
    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ tasks: updatedTasks });
    }
    if (chrome?.alarms) {
      chrome.alarms.create(newTask.id, {
        when: timestamp,
        periodInMinutes: newTask.frequency === 'daily' ? 1440 : undefined
      });
    }

    setNewTaskTitle('');
    setNewTaskTime('12:00');
    setNewTaskFrequency('once');
  };

  const handleDeleteTask = async (id: string) => {
    const updatedTasks = tasks.filter(t => t.id !== id);
    setTasks(updatedTasks);
    
    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ tasks: updatedTasks });
    }
    if (chrome?.alarms) {
      chrome.alarms.clear(id);
    }
  };

  const showComposer = activeSidebarTab === 'chat';

  const toolbarButtonClass = cx(
    'rounded-md p-1.5 transition text-gray-500',
    isDarkMode
      ? 'hover:bg-slate-700 hover:text-slate-200'
      : 'hover:bg-gray-200/70 hover:text-gray-800'
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
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M8 2v9l3-3 3 3V2" /></svg>,
    },
    {
      id: 'creator',
      label: 'Creator',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>,
    },
    {
      id: 'translate',
      label: 'Translate',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></svg>,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    },
  ];

  return (
    <div className={cx(
      'flex h-screen w-full overflow-hidden font-ui',
      isDarkMode
        ? 'bg-[#1e1e1e] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-100'
        : 'bg-[#f7f7f8] text-gray-900 selection:bg-indigo-100 selection:text-indigo-900',
    )}
    >
      {/* Main Content Area */}
      <div className={cx(
        'flex flex-1 flex-col overflow-hidden',
        isDarkMode ? 'bg-[#2b2b2b]' : 'bg-[#f7f7f8]'
      )}
      >
        <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto px-5 py-6 pb-0">

          {activeSidebarTab === 'knowledge' && (
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
                Your chat history is securely synced to the cloud.
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
                    <article
                      key={item.id}
                      onClick={() => handleResumeChat(item)}
                      className={cx(
                        'cursor-pointer rounded-2xl border p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md',
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
          )}

          {activeSidebarTab === 'tasks' && (
            <div className="flex flex-1 flex-col gap-5 pb-8 animate-in fade-in duration-300">
              <div>
                <h2 className={cx('mb-2 text-2xl font-bold tracking-tight', isDarkMode ? 'text-slate-100' : 'text-gray-800')}>Tasks & Reminders</h2>
                <p className={cx('text-sm font-medium', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Set up reminders and tasks.</p>
              </div>

              <div className={cx('rounded-2xl border p-4 shadow-xl backdrop-blur-xl', isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-gray-200/50 bg-white/60')}>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={cx('mb-1 block text-xs font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Task Title</label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="What do you need to do?"
                      className={cx('w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors backdrop-blur-md', isDarkMode ? 'border-slate-600 bg-slate-800/50 text-slate-100 focus:border-indigo-400' : 'border-gray-200 bg-white/70 text-gray-800 focus:border-indigo-300')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={cx('mb-1 block text-xs font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Time</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <button
                          onClick={() => setIsHourDropdownOpen(!isHourDropdownOpen)}
                          className={cx('flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors backdrop-blur-md', isDarkMode ? 'border-slate-600 bg-slate-800/50 text-slate-100 focus:border-indigo-400' : 'border-gray-200 bg-white/70 text-gray-800 focus:border-indigo-300')}
                        >
                          {newTaskTime.split(':')[0] || '12'}h
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={cx('transition-transform opacity-50', isHourDropdownOpen && 'rotate-180')}><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                        
                        {isHourDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsHourDropdownOpen(false)} />
                            <div className={cx(
                              'absolute left-0 top-full z-20 mt-2 max-h-60 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 rounded-xl border shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200',
                              isDarkMode ? 'bg-gray-900/80 border-gray-700' : 'bg-white/70 border-white/30'
                            )}>
                              {Array.from({ length: 24 }).map((_, i) => {
                                const val = i.toString().padStart(2, '0');
                                return (
                                  <button
                                    key={val}
                                    onClick={() => {
                                      setNewTaskTime(`${val}:${newTaskTime.split(':')[1] || '00'}`);
                                      setIsHourDropdownOpen(false);
                                    }}
                                    className={cx(
                                      'w-full px-4 py-2 text-left text-sm transition-colors',
                                      newTaskTime.split(':')[0] === val
                                        ? (isDarkMode ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                                        : (isDarkMode ? 'text-slate-200 hover:bg-indigo-500/20 hover:text-indigo-400' : 'text-gray-700 hover:bg-indigo-500/10 hover:text-indigo-500')
                                    )}
                                  >
                                    {val}h
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="relative flex-1">
                        <button
                          onClick={() => setIsMinuteDropdownOpen(!isMinuteDropdownOpen)}
                          className={cx('flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors backdrop-blur-md', isDarkMode ? 'border-slate-600 bg-slate-800/50 text-slate-100 focus:border-indigo-400' : 'border-gray-200 bg-white/70 text-gray-800 focus:border-indigo-300')}
                        >
                          {newTaskTime.split(':')[1] || '00'}m
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={cx('transition-transform opacity-50', isMinuteDropdownOpen && 'rotate-180')}><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                        
                        {isMinuteDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsMinuteDropdownOpen(false)} />
                            <div className={cx(
                              'absolute left-0 top-full z-20 mt-2 max-h-60 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 rounded-xl border shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200',
                              isDarkMode ? 'bg-gray-900/80 border-gray-700' : 'bg-white/70 border-white/30'
                            )}>
                              {Array.from({ length: 60 }).map((_, i) => {
                                const val = i.toString().padStart(2, '0');
                                return (
                                  <button
                                    key={val}
                                    onClick={() => {
                                      setNewTaskTime(`${newTaskTime.split(':')[0] || '12'}:${val}`);
                                      setIsMinuteDropdownOpen(false);
                                    }}
                                    className={cx(
                                      'w-full px-4 py-2 text-left text-sm transition-colors',
                                      newTaskTime.split(':')[1] === val
                                        ? (isDarkMode ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                                        : (isDarkMode ? 'text-slate-200 hover:bg-indigo-500/20 hover:text-indigo-400' : 'text-gray-700 hover:bg-indigo-500/10 hover:text-indigo-500')
                                    )}
                                  >
                                    {val}m
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    </div>
                    <div>
                      <label className={cx('mb-1 block text-xs font-bold uppercase tracking-wider', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Frequency</label>
                      <select
                        value={newTaskFrequency}
                        onChange={e => setNewTaskFrequency(e.target.value as 'once' | 'daily')}
                        className={cx('w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors backdrop-blur-md appearance-none', isDarkMode ? 'border-slate-600 bg-slate-800/50 text-slate-100 focus:border-indigo-400' : 'border-gray-200 bg-white/70 text-gray-800 focus:border-indigo-300')}
                      >
                        <option value="once">Once</option>
                        <option value="daily">Daily</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateTask}
                    disabled={!newTaskTitle.trim() || !newTaskTime}
                    className="mt-2 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Create Task
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {tasks.map(task => (
                  <div key={task.id} className={cx('flex items-center justify-between rounded-xl border p-3 shadow-sm backdrop-blur-md', isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-gray-200 bg-white/80')}>
                    <div>
                      <p className={cx('text-sm font-semibold', isDarkMode ? 'text-slate-200' : 'text-gray-800')}>{task.title}</p>
                      <p className={cx('text-xs', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                        {new Date(task.triggerTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {task.frequency === 'daily' ? 'Daily' : 'Once'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className={cx('rounded-lg p-1.5 transition-colors', isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className={cx('text-center text-sm mt-4', isDarkMode ? 'text-slate-500' : 'text-gray-400')}>No tasks right now.</p>
                )}
              </div>
            </div>
          )}

          {activeSidebarTab === 'settings' && (
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

              {user && (
                <button
                  onClick={handleLogout}
                  className="w-full py-2 mt-4 text-sm font-medium text-red-500 transition-colors bg-red-500/10 rounded-lg hover:bg-red-500/20"
                >
                  Log Out
                </button>
              )}
            </div>
          )}

          {activeSidebarTab === 'translate' && (
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
                  <div className="relative">
                    <button
                      onClick={() => setIsTranslateTargetOpen(!isTranslateTargetOpen)}
                      className={cx(
                        'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all backdrop-blur-md',
                        isDarkMode
                          ? 'bg-black/40 border-gray-700 text-slate-200 hover:bg-black/60'
                          : 'bg-white/10 border-white/20 text-gray-700 hover:bg-white/20'
                      )}
                    >
                      {translateTarget}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={cx('transition-transform', isTranslateTargetOpen && 'rotate-180')}><path d="m6 9 6 6 6-6" /></svg>
                    </button>

                    {isTranslateTargetOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsTranslateTargetOpen(false)} />
                        <div className={cx(
                          'absolute bottom-full left-0 z-20 mb-2 max-h-60 w-48 overflow-y-auto rounded-lg border shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-1 duration-200',
                          isDarkMode ? 'bg-gray-900/80 border-gray-700' : 'bg-white/70 border-white/30'
                        )}>
                          {TRANSLATE_TARGETS.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setTranslateTarget(option.value);
                                setIsTranslateTargetOpen(false);
                              }}
                              className={cx(
                                'w-full px-4 py-2 text-left text-sm transition-colors',
                                translateTarget === option.value
                                  ? (isDarkMode ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-purple-700')
                                  : (isDarkMode ? 'text-slate-200 hover:bg-purple-500/20 hover:text-purple-400' : 'text-gray-700 hover:bg-purple-500/10 hover:text-purple-500')
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

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
          )}

          {activeSidebarTab === 'creator' && (
            <div className="flex flex-1 flex-col gap-5 pb-8 animate-in fade-in duration-300">
              <div>
                <h2 className={cx('mb-2 text-2xl font-bold tracking-tight', isDarkMode ? 'text-slate-100' : 'text-gray-800')}>Creator Studio</h2>
                <p className={cx('text-sm font-medium', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>Generate production-ready images from your prompt with style and size controls.</p>
              </div>

              <div className={cx('rounded-2xl border p-4', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white')}>
                <div className="relative mb-4">
                  <button
                    onClick={() => setIsCreatorModelOpen(!isCreatorModelOpen)}
                    className={cx(
                      'flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium transition-all backdrop-blur-md',
                      isDarkMode
                        ? 'bg-black/40 border-gray-700 text-indigo-300 hover:bg-black/60'
                        : 'bg-white/10 border-white/20 text-indigo-700 hover:bg-white/20'
                    )}
                  >
                    {creatorModel === 'gemini-3.1-flash-image-preview' ? 'Gemini 3.1 Flash Image' : 'OpenAI DALL-E 3'}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={cx('transition-transform', isCreatorModelOpen && 'rotate-180')}><path d="m6 9 6 6 6-6" /></svg>
                  </button>

                  {isCreatorModelOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsCreatorModelOpen(false)} />
                      <div className={cx(
                        'absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-lg border shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200',
                        isDarkMode ? 'bg-gray-900/80 border-gray-700' : 'bg-white/70 border-white/30'
                      )}>
                        {[
                          { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image (Fast & Low Token)' },
                          { id: 'dall-e-3', name: 'OpenAI DALL-E 3' }
                        ].map((mod) => (
                          <button
                            key={mod.id}
                            onClick={() => {
                              setCreatorModel(mod.id);
                              setIsCreatorModelOpen(false);
                            }}
                            className={cx(
                              'w-full px-4 py-2.5 text-left text-sm transition-colors',
                              creatorModel === mod.id
                                ? (isDarkMode ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-purple-700')
                                : (isDarkMode ? 'text-slate-200 hover:bg-purple-500/20 hover:text-purple-400' : 'text-gray-700 hover:bg-purple-500/10 hover:text-purple-500')
                            )}
                          >
                            {mod.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

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
                  <div className="relative">
                    <button
                      onClick={() => setIsCreatorStyleOpen(!isCreatorStyleOpen)}
                      className={cx(
                        'flex w-full items-center justify-between rounded-lg border px-4 py-2 text-sm font-medium transition-all backdrop-blur-md',
                        isDarkMode
                          ? 'bg-black/40 border-gray-700 text-slate-200 hover:bg-black/60'
                          : 'bg-white/10 border-white/20 text-gray-700 hover:bg-white/20'
                      )}
                    >
                      {CREATOR_STYLES.find(s => s.value === creatorStyle)?.label || 'Select Style'}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={cx('transition-transform', isCreatorStyleOpen && 'rotate-180')}><path d="m6 9 6 6 6-6" /></svg>
                    </button>

                    {isCreatorStyleOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsCreatorStyleOpen(false)} />
                        <div className={cx(
                          'absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-lg border shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-1 duration-200',
                          isDarkMode ? 'bg-gray-900/80 border-gray-700' : 'bg-white/70 border-white/30'
                        )}>
                          {CREATOR_STYLES.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setCreatorStyle(option.value);
                                setIsCreatorStyleOpen(false);
                              }}
                              className={cx(
                                'w-full px-4 py-2 text-left text-sm transition-colors',
                                creatorStyle === option.value
                                  ? (isDarkMode ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-purple-700')
                                  : (isDarkMode ? 'text-slate-200 hover:bg-purple-500/20 hover:text-purple-400' : 'text-gray-700 hover:bg-purple-500/10 hover:text-purple-500')
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setIsCreatorSizeOpen(!isCreatorSizeOpen)}
                      className={cx(
                        'flex w-full items-center justify-between rounded-lg border px-4 py-2 text-sm font-medium transition-all backdrop-blur-md',
                        isDarkMode
                          ? 'bg-black/40 border-gray-700 text-slate-200 hover:bg-black/60'
                          : 'bg-white/10 border-white/20 text-gray-700 hover:bg-white/20'
                      )}
                    >
                      {IMAGE_SIZE_OPTIONS.find(s => s.value === creatorSize)?.label || 'Select Size'}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={cx('transition-transform', isCreatorSizeOpen && 'rotate-180')}><path d="m6 9 6 6 6-6" /></svg>
                    </button>

                    {isCreatorSizeOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsCreatorSizeOpen(false)} />
                        <div className={cx(
                          'absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-lg border shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-1 duration-200',
                          isDarkMode ? 'bg-gray-900/80 border-gray-700' : 'bg-white/70 border-white/30'
                        )}>
                          {IMAGE_SIZE_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setCreatorSize(option.value);
                                setIsCreatorSizeOpen(false);
                              }}
                              className={cx(
                                'w-full px-4 py-2 text-left text-sm transition-colors',
                                creatorSize === option.value
                                  ? (isDarkMode ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-100 text-purple-700')
                                  : (isDarkMode ? 'text-slate-200 hover:bg-purple-500/20 hover:text-purple-400' : 'text-gray-700 hover:bg-purple-500/10 hover:text-purple-500')
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
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
          )}

          {activeSidebarTab === 'chat' && messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center px-4 pb-20 animate-in fade-in duration-500">
              <h1 className={cx('text-[40px] font-bold leading-[1.1] tracking-tight', isDarkMode ? 'text-slate-100' : 'text-gray-900')}>Hi,</h1>
              <h2 className={cx('mt-2 text-[22px] font-semibold leading-[1.2] tracking-tight', isDarkMode ? 'text-slate-300' : 'text-gray-800')}>How can I assist you today?</h2>


            </div>
          ) : activeSidebarTab === 'chat' && (
            <div className="flex-1 space-y-6 pb-4">
              {messages.map((msg, index) => (
                <div key={index} className={cx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cx(
                    'max-w-[90%] rounded-2xl p-4 leading-relaxed relative group',
                    msg.role === 'user'
                      ? 'bg-[#eef2ff] text-indigo-900 rounded-br-sm font-sans text-sm'
                      : isDarkMode
                        ? 'bg-transparent text-slate-100 text-[14.5px]'
                        : 'bg-transparent text-gray-800 text-[14.5px]',
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="flex flex-col gap-2">
                        <MessageMarkdown content={msg.content} />
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleSpeak(msg.content)}
                            className={cx(
                              "flex items-center gap-1.5 p-1.5 px-2 rounded-md",
                              isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-gray-100 text-gray-500"
                            )}
                            title="Read aloud"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                            <span className="text-[11px] font-semibold uppercase tracking-wider">Listen</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start px-4">
                  <div className="flex items-center gap-1.5 p-2">
                    <span className={cx('h-1.5 w-1.5 animate-pulse rounded-full', isDarkMode ? 'bg-slate-500' : 'bg-gray-400')} />
                    <span className={cx('h-1.5 w-1.5 animate-pulse rounded-full delay-150', isDarkMode ? 'bg-slate-500' : 'bg-gray-400')} />
                    <span className={cx('h-1.5 w-1.5 animate-pulse rounded-full delay-300', isDarkMode ? 'bg-slate-500' : 'bg-gray-400')} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showComposer && (
          <div className="shrink-0 px-4 pb-4 pt-2">
            <div className="flex flex-col transition-all">
              <button
                onClick={handleSummarizePage}
                className={cx(
                  'flex items-center justify-center w-full py-2 mb-2 text-sm font-medium transition-colors rounded-lg',
                  isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                Summarize Page
              </button>
              <div className={cx(
                'flex flex-col rounded-2xl transition-all',
                isDarkMode
                  ? 'bg-[#333333]'
                  : 'bg-white',
              )}>
                <div className="flex items-center justify-between px-3 pt-2">
                  <div className="flex items-center gap-0.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".txt,.md,.json,.csv,.js,.ts,.tsx,.html,.css"
                    />
                    <button onClick={handleUploadAction} title="Upload" className={toolbarButtonClass}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
                    <button onClick={handleContextAction} title="Context" className={toolbarButtonClass}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></button>
                    <button onClick={handleHistoryAction} title="History" className={toolbarButtonClass}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        className={cx(
                          'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors',
                          isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <span className="whitespace-nowrap">
                          {chatModel === 'gemini-3-flash' ? 'Flash' : 'GPT-4o'}
                        </span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
                      </button>

                      {isModelDropdownOpen && (
                        <>
                          {/* Invisible backdrop to close dropdown when clicking outside */}
                          <div className="fixed inset-0 z-10" onClick={() => setIsModelDropdownOpen(false)} />

                          <div className={cx(
                            'absolute right-0 top-full z-20 mt-1.5 w-36 overflow-hidden rounded-xl border shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] animate-in fade-in slide-in-from-top-1 duration-200',
                            isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-white'
                          )}>
                            {[
                              { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
                              { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
                            ].map((mod) => (
                              <button
                                key={mod.id}
                                onClick={() => {
                                  setChatModel(mod.id);
                                  setIsModelDropdownOpen(false);
                                }}
                                className={cx(
                                  'w-full px-3 py-2 text-left text-[12px] font-semibold transition-colors',
                                  chatModel === mod.id
                                    ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-600')
                                    : (isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-50')
                                )}
                              >
                                {mod.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <button onClick={handleAddAction} title="New Chat" className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
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
                    'mt-1 min-h-[60px] max-h-[300px] w-full resize-none overflow-y-auto bg-transparent px-4 py-2 text-[15px] outline-none placeholder:font-normal',
                    isDarkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-gray-800 placeholder:text-[#a1a1aa]',
                  )}
                  placeholder="Ask anything, @ models, / prompts"
                />

                <div className="flex items-center justify-between px-3 pb-3 pt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={toggleThinkMode}
                      className={cx(
                        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                        isThinkModeEnabled
                          ? 'bg-indigo-50 text-indigo-700'
                          : isDarkMode
                            ? 'bg-transparent text-slate-300 hover:bg-slate-700'
                            : 'bg-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100',
                      )}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                      Innovate
                    </button>

                    <button
                      onClick={toggleVoiceMode}
                      className={cx(
                        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                        isVoiceModeEnabled
                          ? 'bg-indigo-50 text-indigo-700'
                          : isDarkMode
                            ? 'bg-transparent text-slate-300 hover:bg-slate-700'
                            : 'bg-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100',
                      )}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                      {isVoiceModeEnabled ? 'Listening' : 'Voice'}
                    </button>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!inputText.trim() || isLoading}
                    className={cx(
                      'rounded-full p-2 transition disabled:opacity-30',
                      isDarkMode
                        ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        : 'text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400',
                    )}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className={cx(
        'relative flex w-[56px] flex-shrink-0 flex-col items-center py-4 border-l',
        isDarkMode ? 'bg-[#1e1e1e] border-[#2b2b2b]' : 'bg-[#f7f7f8] border-gray-200/50',
      )}>
        <div className={cx('mb-6 flex gap-2', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
          <button onClick={() => window.close()} title="Close" className={cx('rounded p-1 transition', isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-200')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></button>
          <button onClick={() => alert('Expand')} title="Expand" className={cx('rounded p-1 transition', isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-200')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg></button>
        </div>

        <div className="mt-2 flex w-full flex-1 flex-col items-center gap-3">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              title={item.label}
              onClick={() => {
                setActiveSidebarTab(item.id);
                if (item.id === 'knowledge') loadKnowledge();
              }}
              className={cx(
                'group relative flex w-full flex-col items-center py-1 transition-colors',
                activeSidebarTab === item.id
                  ? 'text-indigo-600'
                  : isDarkMode
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-gray-500 hover:text-gray-900',
              )}
            >
              <div className={cx(
                'rounded-lg p-2 transition-all',
                activeSidebarTab === item.id
                  ? (isDarkMode ? 'bg-slate-800' : 'bg-gray-200')
                  : 'bg-transparent group-hover:bg-gray-200/50',
              )}>
                {item.icon}
              </div>
            </button>
          ))}
        </div>

        {/* Profile Avatar Mock at bottom */}
        <div className="mb-4 mt-auto flex w-full justify-center">
          <div
            onClick={handleLogin}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 overflow-hidden"
          >
            {user?.image ? (
              <img src={user.image} alt={user.name || "User"} className="h-full w-full object-cover" />
            ) : (
              'US'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
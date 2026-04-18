export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface KnowledgeSource {
  origin: 'side-panel' | 'content-popup';
  pageTitle?: string;
  pageUrl?: string;
  thinkMode?: boolean;
}


export type KnowledgeKind = 'chat' | 'summary';

export interface KnowledgeItem {
  id: string;
  createdAt: string;
  kind: KnowledgeKind;
  title: string;
  prompt: string;
  response: string;
  source: KnowledgeSource;
}

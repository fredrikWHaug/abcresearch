import type { PubMedArticle } from '@/types/papers'
import type { PressRelease } from '@/types/press-releases'

export interface ChatMessage {
  type: 'user' | 'system';
  message: string;
  searchSuggestions?: Array<{ id: string; label: string; query: string; description?: string }>;
  contextPapers?: PubMedArticle[];
  contextPressReleases?: PressRelease[];
}


export type AiProviderType =
  | 'chrome-builtin'
  | 'web-launchers'
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'gemini';

export interface AiSettingsConfig {
  preferredProvider: AiProviderType;
  // Ollama (Local LLM)
  ollamaEndpoint?: string;
  ollamaModel?: string;
  // Cloud BYOK API Keys
  openaiApiKey?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface ChromeBuiltinAiStatus {
  available: boolean;
  status: 'ready' | 'downloadable' | 'unsupported';
  message: string;
}

export interface AiGenerationResult {
  text: string;
  provider: AiProviderType;
  modelUsed?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  modelUsed?: string;
  isInitialVerdict?: boolean;
}

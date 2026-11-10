import { AiSettingsConfig, AiProviderType } from './ai-types';

const STORAGE_KEY_AI_CONFIG = 'forcelens_ai_config';

export const DEFAULT_AI_CONFIG: AiSettingsConfig = {
  preferredProvider: 'chrome-builtin',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3:latest',
  openaiModel: 'gpt-4o-mini',
  anthropicModel: 'claude-3-5-sonnet-latest',
  geminiModel: 'gemini-1.5-flash',
};

// In-memory fallback for environments without chrome.storage or localStorage (e.g. testing)
let memoryConfig: AiSettingsConfig = { ...DEFAULT_AI_CONFIG };

export async function getAiSettings(): Promise<AiSettingsConfig> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const res = await chrome.storage.local.get(STORAGE_KEY_AI_CONFIG);
      if (res && res[STORAGE_KEY_AI_CONFIG]) {
        return { ...DEFAULT_AI_CONFIG, ...res[STORAGE_KEY_AI_CONFIG] };
      }
    } else if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
      if (val) {
        return { ...DEFAULT_AI_CONFIG, ...JSON.parse(val) };
      }
    }
  } catch {
    // Fall back to memory config
  }
  return { ...memoryConfig };
}

export async function saveAiSettings(config: Partial<AiSettingsConfig>): Promise<void> {
  const current = await getAiSettings();
  const updated: AiSettingsConfig = { ...current, ...config };
  memoryConfig = updated;

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEY_AI_CONFIG]: updated });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Failed to save AI configuration:', err);
  }
}

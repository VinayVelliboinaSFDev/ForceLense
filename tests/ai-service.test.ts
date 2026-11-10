import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkChromeBuiltinAi,
  runChromeBuiltinAi,
  testOllamaConnection,
  runOllama,
  runOpenAi,
  executeAiAnalysis,
} from '../src/ai/ai-service';
import { getAiSettings, saveAiSettings, DEFAULT_AI_CONFIG } from '../src/ai/ai-store';
import { AiSettingsConfig } from '../src/ai/ai-types';

describe('Phase 2 AI Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Chrome Built-In AI (Prompt API / Gemini Nano)', () => {
    it('detects when Chrome Built-in AI is readily available', async () => {
      // Mock window.ai with Prompt API
      (globalThis as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn(),
        },
      };

      const status = await checkChromeBuiltinAi();
      expect(status.available).toBe(true);
      expect(status.status).toBe('ready');
      expect(status.message).toContain('ready for zero-latency');
    });

    it('detects when Chrome Built-in AI is unsupported or disabled', async () => {
      delete (globalThis as any).ai;

      const status = await checkChromeBuiltinAi();
      expect(status.available).toBe(false);
      expect(status.status).toBe('unsupported');
    });

    it('executes prompt with on-device session and destroys session on finish', async () => {
      const mockDestroy = vi.fn();
      const mockPrompt = vi.fn().mockResolvedValue('Access granted via Direct Record Ownership.');

      (globalThis as any).ai = {
        languageModel: {
          create: vi.fn().mockResolvedValue({
            prompt: mockPrompt,
            destroy: mockDestroy,
          }),
        },
      };

      const response = await runChromeBuiltinAi('Analyze this record access');
      expect(response).toBe('Access granted via Direct Record Ownership.');
      expect(mockPrompt).toHaveBeenCalledWith('Analyze this record access');
      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  describe('Local LLM (Ollama) Enterprise Integration', () => {
    it('tests connection to local Ollama and lists installed models', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3:latest' },
            { name: 'mistral:latest' },
            { name: 'codellama:7b' },
          ],
        }),
      });
      globalThis.fetch = fakeFetch;

      const res = await testOllamaConnection('http://localhost:11434');
      expect(res.ok).toBe(true);
      expect(res.models).toEqual(['llama3:latest', 'mistral:latest', 'codellama:7b']);
      expect(fakeFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.anything());
    });

    it('handles Ollama connection failure gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const res = await testOllamaConnection('http://localhost:11434');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Connection refused');
    });

    it('runs local prompt generation on Ollama /api/generate', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'Root cause: Missing Share row on Case table.' }),
      });

      const response = await runOllama('Explain access', 'http://localhost:11434', 'llama3:latest');
      expect(response).toBe('Root cause: Missing Share row on Case table.');
    });
  });

  describe('Cloud BYOK Providers (OpenAI, Gemini, etc.)', () => {
    it('fails fast if API Key is not set', async () => {
      await expect(runOpenAi('prompt', '', 'gpt-4o-mini')).rejects.toThrow('OpenAI API Key is missing');
    });

    it('calls OpenAI endpoint with Bearer auth and payload', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OpenAI analysis output.' } }],
        }),
      });
      globalThis.fetch = fakeFetch;

      const res = await runOpenAi('Test prompt', 'sk-fake-key-12345', 'gpt-4o-mini');
      expect(res).toBe('OpenAI analysis output.');
      expect(fakeFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-fake-key-12345',
          }),
        })
      );
    });

    it('calls Google Gemini endpoint with x-goog-api-key header and handles auto-fallback', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Gemini analysis output.' }] } }],
        }),
      });
      globalThis.fetch = fakeFetch;

      const res = await (await import('../src/ai/ai-service')).runGemini('Test prompt', 'AQ.TestKey123', 'gemini-1.5-flash');
      expect(res).toBe('Gemini analysis output.');
      expect(fakeFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-flash-lite-latest'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-goog-api-key': 'AQ.TestKey123',
          }),
        })
      );
    });
  });

  describe('Unified AI Execution Dispatcher', () => {
    it('dispatches to Ollama when preferredProvider is ollama', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'Ollama local response' }),
      });

      const config: AiSettingsConfig = {
        preferredProvider: 'ollama',
        ollamaEndpoint: 'http://localhost:11434',
        ollamaModel: 'llama3:latest',
      };

      const result = await executeAiAnalysis('Analyze context', config);
      expect(result.provider).toBe('ollama');
      expect(result.text).toBe('Ollama local response');
      expect(result.error).toBeUndefined();
    });

    it('returns error result without throwing if provider execution fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const config: AiSettingsConfig = {
        preferredProvider: 'ollama',
        ollamaEndpoint: 'http://localhost:11434',
        ollamaModel: 'llama3:latest',
      };

      const result = await executeAiAnalysis('Analyze context', config);
      expect(result.error).toContain('Network offline');
      expect(result.text).toBe('');
    });
  });

  describe('AI Configuration Store', () => {
    it('returns default configuration initially', async () => {
      const cfg = await getAiSettings();
      expect(cfg.preferredProvider).toBe('chrome-builtin');
      expect(cfg.ollamaEndpoint).toBe('http://localhost:11434');
      expect(cfg.ollamaModel).toBe('llama3:latest');
    });

    it('saves and updates AI settings', async () => {
      await saveAiSettings({
        preferredProvider: 'ollama',
        ollamaModel: 'mistral:latest',
      });

      const updated = await getAiSettings();
      expect(updated.preferredProvider).toBe('ollama');
      expect(updated.ollamaModel).toBe('mistral:latest');
    });
  });
});

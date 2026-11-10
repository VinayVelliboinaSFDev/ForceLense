import {
  AiProviderType,
  AiSettingsConfig,
  ChromeBuiltinAiStatus,
  AiGenerationResult,
  ChatMessage,
} from './ai-types';

/**
 * Checks whether Chrome's Built-In AI (Prompt API / Gemini Nano) is available on the current browser.
 */
export async function checkChromeBuiltinAi(): Promise<ChromeBuiltinAiStatus> {
  try {
    const aiObj = (typeof window !== 'undefined' ? (window as any).ai : undefined) ||
      (typeof globalThis !== 'undefined' ? (globalThis as any).ai : undefined);

    if (!aiObj || !aiObj.languageModel) {
      return {
        available: false,
        status: 'unsupported',
        message: 'Chrome Built-In AI is not enabled or not supported in this browser version. (Enable flags in chrome://flags/#prompt-api-for-gemini-nano)',
      };
    }

    if (typeof aiObj.languageModel.capabilities === 'function') {
      const capabilities = await aiObj.languageModel.capabilities();
      if (capabilities.available === 'readily') {
        return {
          available: true,
          status: 'ready',
          message: 'Chrome Built-In AI (Gemini Nano) is ready for zero-latency, on-device analysis.',
        };
      } else if (capabilities.available === 'after-download') {
        return {
          available: true,
          status: 'downloadable',
          message: 'Gemini Nano model download is needed. It will download automatically on first use.',
        };
      }
    }

    // Older draft or alternate availability
    if (typeof aiObj.languageModel.create === 'function') {
      return {
        available: true,
        status: 'ready',
        message: 'Chrome Built-In AI (Prompt API) detected and ready.',
      };
    }
  } catch (err) {
    return {
      available: false,
      status: 'unsupported',
      message: err instanceof Error ? err.message : 'Error inspecting Chrome Built-in AI',
    };
  }

  return {
    available: false,
    status: 'unsupported',
    message: 'Chrome Built-In AI is not available. Use 1-Click Launchers or configure Ollama/API Keys in Settings.',
  };
}

/**
 * Executes prompt on Chrome Built-In Gemini Nano
 */
export async function runChromeBuiltinAi(prompt: string): Promise<string> {
  const aiObj = (typeof window !== 'undefined' ? (window as any).ai : undefined) ||
    (typeof globalThis !== 'undefined' ? (globalThis as any).ai : undefined);

  if (!aiObj?.languageModel?.create) {
    throw new Error('Chrome Built-In AI is not supported on this device/browser.');
  }

  const session = await aiObj.languageModel.create({
    systemPrompt: 'You are an expert Salesforce Certified Technical Architect (CTA) and Security Engineer. Analyze the verified Salesforce REST API signals and explain access provenance and remediation clearly.',
  });

  try {
    const response = await session.prompt(prompt);
    return response;
  } finally {
    if (session && typeof session.destroy === 'function') {
      session.destroy();
    }
  }
}

/**
 * Tests connection to local Ollama server and lists installed models
 */
export async function testOllamaConnection(endpoint = 'http://localhost:11434'): Promise<{ ok: boolean; models: string[]; error?: string }> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  try {
    const res = await fetch(`${cleanEndpoint}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, models: [], error: `Ollama returned HTTP ${res.status}` };
    }
    const data = await res.json();
    const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name) : [];
    return { ok: true, models };
  } catch (err) {
    return {
      ok: false,
      models: [],
      error: err instanceof Error ? err.message : 'Cannot reach Ollama at ' + cleanEndpoint,
    };
  }
}

/**
 * Executes prompt on local Ollama server (supports both single prompt and multi-turn chat)
 */
export async function runOllama(prompt: string, endpoint = 'http://localhost:11434', model = 'llama3:latest'): Promise<string> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const res = await fetch(`${cleanEndpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3:latest',
      prompt,
      stream: false,
    }),
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        'Ollama returned HTTP 403 (Forbidden). Ollama blocked the Chrome Extension origin. Run in Terminal: launchctl setenv OLLAMA_ORIGINS "*" && killall Ollama ollama && open -a Ollama'
      );
    }
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama request failed (HTTP ${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  return data.response || 'No response returned from Ollama.';
}

/**
 * Multi-turn conversation on Ollama /api/chat
 */
export async function runOllamaChat(
  messages: ChatMessage[],
  endpoint = 'http://localhost:11434',
  model = 'llama3:latest'
): Promise<string> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  try {
    const res = await fetch(`${cleanEndpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3:latest',
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.message?.content || data.response || '';
    }
    if (res.status === 403) {
      throw new Error(
        'Ollama returned HTTP 403 (Forbidden). Ollama blocked the Chrome Extension origin. Run in Terminal: launchctl setenv OLLAMA_ORIGINS "*" && killall Ollama ollama && open -a Ollama'
      );
    }
  } catch {
    // Fall back to /api/generate with concatenated transcript
  }

  const transcript = messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n') + '\n\nAssistant:';
  return runOllama(transcript, endpoint, model);
}

/**
 * Executes prompt on OpenAI API (supports multi-turn)
 */
export async function runOpenAi(prompt: string, apiKey: string, model = 'gpt-4o-mini'): Promise<string> {
  return runOpenAiChat(
    [{ id: '1', role: 'user', content: prompt, timestamp: new Date().toISOString() }],
    apiKey,
    model
  );
}

export async function runOpenAiChat(
  messages: ChatMessage[],
  apiKey: string,
  model = 'gpt-4o-mini'
): Promise<string> {
  if (!apiKey) throw new Error('OpenAI API Key is missing. Please set it in Settings.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Salesforce CTA and Security Architect. Provide precise, actionable analysis and answers to follow-up questions based on the verified evidence.',
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(`OpenAI API error (${res.status}): ${errJson.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No completion returned from OpenAI.';
}

/**
 * Executes prompt on Anthropic API (supports multi-turn)
 */
export async function runAnthropic(prompt: string, apiKey: string, model = 'claude-3-5-sonnet-latest'): Promise<string> {
  return runAnthropicChat(
    [{ id: '1', role: 'user', content: prompt, timestamp: new Date().toISOString() }],
    apiKey,
    model
  );
}

export async function runAnthropicChat(
  messages: ChatMessage[],
  apiKey: string,
  model = 'claude-3-5-sonnet-latest'
): Promise<string> {
  if (!apiKey) throw new Error('Anthropic API Key is missing. Please set it in Settings.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet-latest',
      max_tokens: 1500,
      system: 'You are an expert Salesforce CTA and Security Architect. Answer questions about access provenance and setup remediation concisely.',
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(`Anthropic API error (${res.status}): ${errJson.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || 'No text returned from Anthropic.';
}

/**
 * Executes prompt on Google Gemini API with support for modern Gemini Studio keys and auto-fallback
 */
export async function runGemini(prompt: string, apiKey: string, model = 'gemini-flash-lite-latest'): Promise<string> {
  return runGeminiChat(
    [{ id: '1', role: 'user', content: prompt, timestamp: new Date().toISOString() }],
    apiKey,
    model
  );
}

export async function runGeminiChat(
  messages: ChatMessage[],
  apiKey: string,
  model = 'gemini-flash-lite-latest'
): Promise<string> {
  if (!apiKey) throw new Error('Gemini API Key is missing. Please set it in Settings.');

  const keyTrimmed = apiKey.trim();

  // Normalize legacy/retired model names (e.g. gemini-1.5-flash is retired on v1beta)
  let requestedModel = model?.trim() || 'gemini-flash-lite-latest';
  if (requestedModel === 'gemini-1.5-flash' || requestedModel === 'models/gemini-1.5-flash') {
    requestedModel = 'gemini-flash-lite-latest';
  }

  // Sequence of candidate models to try in case of 404 (retired model) or 503 (high demand spike)
  const candidateModels = Array.from(new Set([
    requestedModel.replace(/^models\//, ''),
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
  ]));

  let lastError = '';

  // Format multi-turn conversation for Gemini API
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  for (const candidate of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(keyTrimmed)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': keyTrimmed,
        },
        body: JSON.stringify({ contents }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error?.message || res.statusText;
        lastError = `Google Gemini API error (${res.status}): ${msg}`;

        // If 404 (model not found) or 503 (temporary high demand spike), try next candidate model
        if (res.status === 404 || res.status === 503) {
          continue;
        }
        throw new Error(lastError);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('404') && !msg.includes('503')) {
        throw err;
      }
      lastError = msg;
    }
  }

  throw new Error(lastError || 'All Gemini model candidates failed to respond.');
}

/**
 * Main dispatcher: Executes single prompt AI analysis
 */
export async function executeAiAnalysis(
  promptText: string,
  config: AiSettingsConfig
): Promise<AiGenerationResult> {
  return executeAiChat(
    [{ id: 'initial-prompt', role: 'user', content: promptText, timestamp: new Date().toISOString() }],
    config
  );
}

/**
 * Multi-Turn Dispatcher: Executes conversational multi-turn chat across configured providers
 */
export async function executeAiChat(
  messages: ChatMessage[],
  config: AiSettingsConfig
): Promise<AiGenerationResult> {
  const provider = config.preferredProvider;

  try {
    switch (provider) {
      case 'chrome-builtin': {
        // Multi-turn transcript for on-device Gemini Nano
        const conversationPrompt = messages
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n') + '\n\nAssistant:';
        const text = await runChromeBuiltinAi(conversationPrompt);
        return { text, provider: 'chrome-builtin', modelUsed: 'Gemini Nano (On-Device)' };
      }
      case 'ollama': {
        const text = await runOllamaChat(messages, config.ollamaEndpoint, config.ollamaModel);
        return { text, provider: 'ollama', modelUsed: `Ollama (${config.ollamaModel || 'llama3'})` };
      }
      case 'openai': {
        const text = await runOpenAiChat(messages, config.openaiApiKey || '', config.openaiModel);
        return { text, provider: 'openai', modelUsed: config.openaiModel || 'gpt-4o-mini' };
      }
      case 'anthropic': {
        const text = await runAnthropicChat(messages, config.anthropicApiKey || '', config.anthropicModel);
        return { text, provider: 'anthropic', modelUsed: config.anthropicModel || 'claude-3-5-sonnet' };
      }
      case 'gemini': {
        const text = await runGeminiChat(messages, config.geminiApiKey || '', config.geminiModel);
        return { text, provider: 'gemini', modelUsed: config.geminiModel || 'gemini-flash-lite-latest' };
      }
      case 'web-launchers':
      default:
        throw new Error('Web Launchers provider does not execute directly inside extension. Use 1-Click Launchers.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      text: '',
      provider,
      error: msg,
    };
  }
}


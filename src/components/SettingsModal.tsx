import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Key,
  Copy,
  Check,
  Info,
  Trash2,
  Sparkles,
  Bot,
  Cpu,
  ShieldCheck,
  Server,
  Cloud,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { getClientConfig, saveClientConfig, DEFAULT_API_VERSION, disconnectSession } from '../auth/token-store';
import { getRedirectUri } from '../auth/oauth';
import { getAiSettings, saveAiSettings, DEFAULT_AI_CONFIG } from '../ai/ai-store';
import { checkChromeBuiltinAi, testOllamaConnection } from '../ai/ai-service';
import { AiProviderType, ChromeBuiltinAiStatus } from '../ai/ai-types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMockMode: boolean;
  onToggleMockMode: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isMockMode,
  onToggleMockMode,
}) => {
  const [activeTab, setActiveTab] = useState<'salesforce' | 'ai'>('salesforce');

  // Salesforce config state
  const [clientId, setClientId] = useState('');
  const [apiVersion, setApiVersion] = useState(DEFAULT_API_VERSION);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // AI config state
  const [preferredProvider, setPreferredProvider] = useState<AiProviderType>('chrome-builtin');
  const [ollamaEndpoint, setOllamaEndpoint] = useState(DEFAULT_AI_CONFIG.ollamaEndpoint || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_AI_CONFIG.ollamaModel || 'llama3:latest');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState(DEFAULT_AI_CONFIG.openaiModel || 'gpt-4o-mini');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState(DEFAULT_AI_CONFIG.anthropicModel || 'claude-3-5-sonnet-latest');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState(DEFAULT_AI_CONFIG.geminiModel || 'gemini-1.5-flash');

  // Visual UI state
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [chromeAiStatus, setChromeAiStatus] = useState<ChromeBuiltinAiStatus | null>(null);
  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaTestResult, setOllamaTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const redirectUri = getRedirectUri();

  useEffect(() => {
    if (isOpen) {
      getClientConfig().then((cfg) => {
        setClientId(cfg.clientId || '');
        setApiVersion(cfg.apiVersion || DEFAULT_API_VERSION);
      });

      getAiSettings().then((aiCfg) => {
        setPreferredProvider(aiCfg.preferredProvider || 'chrome-builtin');
        setOllamaEndpoint(aiCfg.ollamaEndpoint || 'http://localhost:11434');
        setOllamaModel(aiCfg.ollamaModel || 'llama3:latest');
        setOpenaiKey(aiCfg.openaiApiKey || '');
        setOpenaiModel(aiCfg.openaiModel || 'gpt-4o-mini');
        setAnthropicKey(aiCfg.anthropicApiKey || '');
        setAnthropicModel(aiCfg.anthropicModel || 'claude-3-5-sonnet-latest');
        setGeminiKey(aiCfg.geminiApiKey || '');
        setGeminiModel(aiCfg.geminiModel || 'gemini-1.5-flash');
      });

      checkChromeBuiltinAi().then(setChromeAiStatus);
      setOllamaTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveClientConfig({
      clientId: clientId.trim(),
      apiVersion: apiVersion.trim() || DEFAULT_API_VERSION,
    });

    await saveAiSettings({
      preferredProvider,
      ollamaEndpoint: ollamaEndpoint.trim(),
      ollamaModel: ollamaModel.trim(),
      openaiApiKey: openaiKey.trim(),
      openaiModel: openaiModel.trim(),
      anthropicApiKey: anthropicKey.trim(),
      anthropicModel: anthropicModel.trim(),
      geminiApiKey: geminiKey.trim(),
      geminiModel: geminiModel.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  const handleResetData = async () => {
    if (confirm('Are you sure you want to disconnect and clear stored tokens and settings?')) {
      await disconnectSession();
      window.location.reload();
    }
  };

  const handleTestOllama = async () => {
    setTestingOllama(true);
    setOllamaTestResult(null);
    const res = await testOllamaConnection(ollamaEndpoint);
    setTestingOllama(false);
    if (res.ok) {
      setOllamaTestResult({
        ok: true,
        message: `Connected! Available models: ${res.models.slice(0, 3).join(', ')}${res.models.length > 3 ? ` (+${res.models.length - 3} more)` : ''}`,
      });
      if (res.models.length > 0 && !res.models.includes(ollamaModel)) {
        setOllamaModel(res.models[0]);
      }
    } else {
      setOllamaTestResult({
        ok: false,
        message: res.error || 'Connection failed',
      });
    }
  };

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">ForceLens Settings</h3>
              <p className="text-[11px] text-slate-500 font-medium">Salesforce Session & AI Architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('salesforce')}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'salesforce'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span>Salesforce & OAuth</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'ai'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI & Local LLM</span>
            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-extrabold uppercase">
              Phase 2
            </span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center animate-in fade-in">
              <Check className="w-4 h-4 mr-1.5 text-emerald-600" />
              Settings saved successfully!
            </div>
          )}

          {/* TAB 1: Salesforce & OAuth */}
          {activeTab === 'salesforce' && (
            <div className="space-y-3.5">
              {/* Chrome Redirect URI Box */}
              <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-blue-900 flex items-center">
                    <Info className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    OAuth Callback URL (Redirect URI)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRedirect}
                    className="text-blue-700 hover:text-blue-900 text-[11px] font-semibold flex items-center"
                  >
                    {copiedRedirect ? <Check className="w-3 h-3 mr-0.5 text-emerald-600" /> : <Copy className="w-3 h-3 mr-0.5" />}
                    Copy URL
                  </button>
                </div>
                <div className="p-1.5 bg-white border border-blue-200 rounded text-[11px] font-mono text-slate-700 break-all select-all">
                  {redirectUri}
                </div>
                <p className="text-[10px] text-blue-800 mt-1.5 leading-normal">
                  Add this callback URL to your Salesforce External Client App or Connected App OAuth settings if using manual login.
                </p>
              </div>

              {/* Client ID */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Salesforce Client ID (Consumer Key)
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="External Client App Consumer Key"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* API Version */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Salesforce REST API Version
                </label>
                <input
                  type="text"
                  placeholder="v60.0"
                  value={apiVersion}
                  onChange={(e) => setApiVersion(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                />
              </div>

              {/* Mock Mode Toggle */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 flex items-center text-xs">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    Demo / Sample Data Mode
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Explore ForceLens with simulated Case and permissions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleMockMode(!isMockMode)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isMockMode ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isMockMode ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AI & Local LLM (Phase 2) */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              {/* Chrome Built-in AI Status Card */}
              <div className="p-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 rounded-lg border border-indigo-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-950 flex items-center">
                    <Cpu className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    Chrome Built-In AI (Prompt API / Gemini Nano)
                  </span>
                  {chromeAiStatus?.status === 'ready' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      🟢 Ready (On-Device)
                    </span>
                  ) : chromeAiStatus?.status === 'downloadable' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      🟡 Download Needed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      ⚪ Not Enabled
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {chromeAiStatus?.message || 'Inspecting browser capabilities...'}
                </p>
                <div className="flex items-center text-[10px] text-indigo-700 font-semibold pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Default for regular users: Zero setup, zero latency, 100% on-device private.
                </div>
              </div>

              {/* Preferred AI Mode Selector */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Default AI Execution Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'chrome-builtin', label: 'Chrome Built-in AI', desc: 'On-device Gemini Nano (Zero setup)' },
                    { id: 'web-launchers', label: '1-Click Web Launchers', desc: 'ChatGPT / Claude / Copilot (Zero setup)' },
                    { id: 'ollama', label: 'Local LLM (Ollama)', desc: '100% Offline enterprise privacy' },
                    { id: 'openai', label: 'OpenAI API', desc: 'GPT-4o / GPT-4o-mini (BYOK)' },
                    { id: 'anthropic', label: 'Anthropic Claude API', desc: 'Claude 3.5 Sonnet (BYOK)' },
                    { id: 'gemini', label: 'Google Gemini API', desc: 'Gemini 1.5 Flash (BYOK)' },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between cursor-pointer transition-all ${
                        preferredProvider === opt.id
                          ? 'bg-indigo-50/70 border-indigo-500 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-[11px] text-slate-900">{opt.label}</span>
                        <input
                          type="radio"
                          name="aiProvider"
                          value={opt.id}
                          checked={preferredProvider === opt.id}
                          onChange={() => setPreferredProvider(opt.id as AiProviderType)}
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Ollama Configuration Section */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center">
                    <Server className="w-3.5 h-3.5 mr-1.5 text-slate-700" />
                    Ollama Configuration (Local LLM)
                  </span>
                  <button
                    type="button"
                    onClick={handleTestOllama}
                    disabled={testingOllama}
                    className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center cursor-pointer transition-all disabled:opacity-50"
                  >
                    {testingOllama ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin text-indigo-600" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1 text-indigo-600" />
                    )}
                    Test Connection
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Endpoint URL
                    </label>
                    <input
                      type="text"
                      placeholder="http://localhost:11434"
                      value={ollamaEndpoint}
                      onChange={(e) => setOllamaEndpoint(e.target.value)}
                      className="w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Model Tag
                    </label>
                    <input
                      type="text"
                      placeholder="llama3:latest"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className="w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-[11px]"
                    />
                  </div>
                </div>

                {ollamaTestResult && (
                  <div
                    className={`p-2 rounded text-[11px] flex items-center ${
                      ollamaTestResult.ok
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {ollamaTestResult.ok ? (
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 mr-1.5 text-rose-600 shrink-0" />
                    )}
                    <span>{ollamaTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Cloud API Keys (BYOK) Section */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center">
                    <Key className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                    Optional Cloud API Keys (BYOK)
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Stored Locally</span>
                </div>

                {/* OpenAI */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-700">OpenAI API Key</label>
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility('openai')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showKeys['openai'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  <input
                    type={showKeys['openai'] ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-[11px]"
                  />
                </div>

                {/* Anthropic */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-700">Anthropic Claude API Key</label>
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility('anthropic')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showKeys['anthropic'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  <input
                    type={showKeys['anthropic'] ? 'text' : 'password'}
                    placeholder="sk-ant-..."
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-[11px]"
                  />
                </div>

                {/* Google Gemini */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-700">Google Gemini API Key</label>
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility('gemini')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showKeys['gemini'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  <input
                    type={showKeys['gemini'] ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetData}
              className="text-red-600 hover:text-red-800 text-xs font-medium flex items-center"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Reset All Stored Data
            </button>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Code2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Bot,
  Zap,
  Play,
  Loader2,
  Cpu,
  Server,
  Settings,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { AnalysisResult } from '../types';
import { generateAiPrompt, openExternalAiApp } from '../analyzers/ai-prompt-generator';
import { getAiSettings, DEFAULT_AI_CONFIG } from '../ai/ai-store';
import { checkChromeBuiltinAi, executeAiAnalysis } from '../ai/ai-service';
import { AiSettingsConfig, ChromeBuiltinAiStatus, AiGenerationResult } from '../ai/ai-types';

interface AiExplainerTabProps {
  result: AnalysisResult;
  onOpenSettings?: () => void;
}

export const AiExplainerTab: React.FC<AiExplainerTabProps> = ({ result, onOpenSettings }) => {
  const [copied, setCopied] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // AI execution states
  const [aiConfig, setAiConfig] = useState<AiSettingsConfig>(DEFAULT_AI_CONFIG);
  const [chromeAiStatus, setChromeAiStatus] = useState<ChromeBuiltinAiStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<AiGenerationResult | null>(null);

  const promptText = generateAiPrompt(result);

  useEffect(() => {
    getAiSettings().then(setAiConfig);
    checkChromeBuiltinAi().then(setChromeAiStatus);
  }, []);

  const triggerToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => setActiveToast(null), 3500);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    triggerToast('Complete AI Prompt copied to clipboard! Ready to paste.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyResult = () => {
    if (generationResult?.text) {
      navigator.clipboard.writeText(generationResult.text);
      setCopiedResult(true);
      triggerToast('AI Analysis copied to clipboard!');
      setTimeout(() => setCopiedResult(false), 2000);
    }
  };

  const handleLaunchApp = (app: 'chatgpt' | 'claude' | 'copilot' | 'gemini', appName: string) => {
    openExternalAiApp(app, promptText);
    triggerToast(`Prompt copied! Opening ${appName} in a new tab... Press Cmd+V / Ctrl+V to paste.`);
  };

  const handleRunInExtensionAi = async () => {
    setIsGenerating(true);
    setGenerationResult(null);
    try {
      // If user selected web launchers but clicked in-extension run, use chrome-builtin if available, else ollama/openai
      let activeConfig = { ...aiConfig };
      if (activeConfig.preferredProvider === 'web-launchers') {
        if (chromeAiStatus?.available) {
          activeConfig.preferredProvider = 'chrome-builtin';
        } else if (activeConfig.ollamaEndpoint) {
          activeConfig.preferredProvider = 'ollama';
        } else if (activeConfig.openaiApiKey) {
          activeConfig.preferredProvider = 'openai';
        }
      }

      const res = await executeAiAnalysis(promptText, activeConfig);
      setGenerationResult(res);
      if (res.error) {
        triggerToast(`Analysis failed: ${res.error}`);
      } else {
        triggerToast('AI Analysis generated successfully!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenerationResult({
        text: '',
        provider: aiConfig.preferredProvider,
        error: msg,
      });
      triggerToast(`Error: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getProviderBadge = () => {
    switch (aiConfig.preferredProvider) {
      case 'chrome-builtin':
        return { label: 'Chrome Built-in AI', icon: Cpu, color: 'text-indigo-400 bg-indigo-950/80' };
      case 'ollama':
        return { label: `Ollama (${aiConfig.ollamaModel || 'llama3'})`, icon: Server, color: 'text-amber-400 bg-amber-950/80' };
      case 'openai':
        return { label: 'OpenAI (BYOK)', icon: Bot, color: 'text-emerald-400 bg-emerald-950/80' };
      case 'anthropic':
        return { label: 'Claude (BYOK)', icon: Bot, color: 'text-orange-400 bg-orange-950/80' };
      case 'gemini':
        return { label: 'Gemini (BYOK)', icon: Bot, color: 'text-blue-400 bg-blue-950/80' };
      default:
        return { label: '1-Click Launchers', icon: Zap, color: 'text-purple-400 bg-purple-950/80' };
    }
  };

  const currentBadge = getProviderBadge();
  const IconComp = currentBadge.icon;

  return (
    <div className="space-y-3 text-xs">
      {/* Toast Notice */}
      {activeToast && (
        <div className="p-2.5 bg-slate-900 text-white rounded-lg text-xs shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium text-[11px]">{activeToast}</span>
          </div>
        </div>
      )}

      {/* Main Runner Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 mr-1 fill-current" />
                Dual-Tier AI Engine
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-white/10 ${currentBadge.color}`}>
                <IconComp className="w-3 h-3 mr-1" />
                {currentBadge.label}
              </span>
            </div>
            <h3 className="text-sm font-bold tracking-tight text-white">
              Instant Salesforce Access Root Cause & Remediation
            </h3>
            <p className="text-[11px] text-indigo-200/90 leading-relaxed max-w-sm">
              Runs zero-setup with Chrome Built-In AI & 1-Click Web Launchers for everyday users, or local Ollama / custom API keys for enterprise privacy.
            </p>
          </div>
          <Bot className="w-8 h-8 text-indigo-400/80 shrink-0" />
        </div>

        {/* Action Buttons: 1-Click Run Inside Extension + Copy Prompt */}
        <div className="grid grid-cols-2 gap-2">
          {/* In-Extension Execution Button */}
          <button
            onClick={handleRunInExtensionAi}
            disabled={isGenerating}
            className="w-full py-2 px-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Analyzing Signals...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-current" />
                <span>
                  {aiConfig.preferredProvider === 'ollama'
                    ? 'Run Local Ollama'
                    : aiConfig.preferredProvider === 'openai'
                    ? 'Run OpenAI API'
                    : aiConfig.preferredProvider === 'anthropic'
                    ? 'Run Claude API'
                    : aiConfig.preferredProvider === 'gemini'
                    ? 'Run Gemini API'
                    : 'Run Built-In AI'}
                </span>
              </>
            )}
          </button>

          {/* Copy Prompt Button */}
          <button
            onClick={handleCopyPrompt}
            className="w-full py-2 px-3 bg-white/95 hover:bg-white text-slate-900 font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Prompt Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-blue-600" />
                <span>Copy Rich AI Prompt</span>
              </>
            )}
          </button>
        </div>

        {/* Chrome Built-in AI Status Note */}
        {chromeAiStatus?.status === 'unsupported' && aiConfig.preferredProvider === 'chrome-builtin' && (
          <div className="p-2 bg-indigo-950/60 border border-indigo-800/80 rounded text-[10px] text-indigo-200 flex items-center justify-between">
            <span className="flex items-center">
              <Cpu className="w-3.5 h-3.5 mr-1 text-amber-400 shrink-0" />
              Chrome Built-in AI not active in this browser. Use 1-Click Launchers below or configure Ollama in Settings.
            </span>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="text-amber-300 hover:text-amber-200 font-bold underline shrink-0 ml-1 cursor-pointer"
              >
                Settings
              </button>
            )}
          </div>
        )}
      </div>

      {/* Generated In-Extension Result Box */}
      {generationResult && (
        <div className="bg-white rounded-xl border border-indigo-200 p-3.5 shadow-sm space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-xs text-slate-900">
                AI Access Analysis Verdict
              </span>
              {generationResult.modelUsed && (
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono px-1.5 py-0.2 rounded font-semibold border border-indigo-100">
                  {generationResult.modelUsed}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleCopyResult}
                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
                title="Copy AI analysis"
              >
                {copiedResult ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setGenerationResult(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                title="Clear result"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {generationResult.error ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
              <div className="font-bold text-xs flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                Analysis Execution Notice
              </div>
              <p className="text-[11px] leading-relaxed">{generationResult.error}</p>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="mt-1 text-[11px] font-bold text-rose-800 underline block cursor-pointer"
                >
                  Configure AI Providers in Settings →
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 max-h-80 overflow-y-auto text-[11px] text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
              {generationResult.text}
            </div>
          )}
        </div>
      )}

      {/* 1-Click External AI Launchers Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center">
            <Zap className="w-3.5 h-3.5 text-amber-500 mr-1.5 fill-current" />
            1-Click Web Launchers (Copies Prompt & Opens Free Web App)
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Zero Setup</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* ChatGPT */}
          <button
            onClick={() => handleLaunchApp('chatgpt', 'ChatGPT')}
            className="p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between transition-all group text-left shadow-xs cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-[#10a37f] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                GPT
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 block">
                  ChatGPT
                </span>
                <span className="text-[10px] text-slate-400">OpenAI</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
          </button>

          {/* Claude */}
          <button
            onClick={() => handleLaunchApp('claude', 'Claude')}
            className="p-2.5 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 flex items-center justify-between transition-all group text-left shadow-xs cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-[#d97706] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                CL
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-amber-800 block">
                  Claude
                </span>
                <span className="text-[10px] text-slate-400">Anthropic</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 transition-colors" />
          </button>

          {/* Copilot */}
          <button
            onClick={() => handleLaunchApp('copilot', 'Copilot')}
            className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between transition-all group text-left shadow-xs cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-[#0078d4] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                CP
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-blue-800 block">
                  Copilot
                </span>
                <span className="text-[10px] text-slate-400">Microsoft</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
          </button>

          {/* Gemini */}
          <button
            onClick={() => handleLaunchApp('gemini', 'Gemini')}
            className="p-2.5 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 flex items-center justify-between transition-all group text-left shadow-xs cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-[#4285f4] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                GM
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-800 block">
                  Gemini
                </span>
                <span className="text-[10px] text-slate-400">Google</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center text-emerald-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Tokens & secrets strictly excluded
          </span>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center cursor-pointer"
            >
              <Settings className="w-3 h-3 mr-0.5" />
              Configure Ollama / API Keys in Settings
            </button>
          )}
        </div>
      </div>

      {/* Prompt Preview Accordion */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <button
          onClick={() => setShowPromptPreview(!showPromptPreview)}
          className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="flex items-center">
            <Code2 className="w-4 h-4 mr-1.5 text-blue-600" />
            Inspect Generated AI Prompt ({promptText.length} characters)
          </span>
          {showPromptPreview ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showPromptPreview && (
          <div className="p-3 bg-slate-900 border-t border-slate-200 max-h-72 overflow-y-auto">
            <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
              {promptText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

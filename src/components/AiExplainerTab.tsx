import React, { useState } from 'react';
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
} from 'lucide-react';
import { AnalysisResult } from '../types';
import { generateAiPrompt, openExternalAiApp } from '../analyzers/ai-prompt-generator';

interface AiExplainerTabProps {
  result: AnalysisResult;
}

export const AiExplainerTab: React.FC<AiExplainerTabProps> = ({ result }) => {
  const [copied, setCopied] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  const promptText = generateAiPrompt(result);

  const triggerToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => setActiveToast(null), 3500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    triggerToast('Complete AI Prompt copied to clipboard! Ready to paste.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunchApp = (app: 'chatgpt' | 'claude' | 'copilot' | 'gemini', appName: string) => {
    openExternalAiApp(app, promptText);
    triggerToast(`Prompt copied! Opening ${appName} in a new tab... Press Cmd+V / Ctrl+V to paste.`);
  };

  return (
    <div className="space-y-3">
      {/* Toast Notice */}
      {activeToast && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium text-[11px]">{activeToast}</span>
          </div>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white rounded-xl p-4 shadow-sm space-y-2.5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
              <Sparkles className="w-3 h-3 mr-1 fill-current" />
              AI Security Explainer
            </span>
            <h3 className="text-sm font-bold tracking-tight">
              Analyze Access with ChatGPT, Claude & Copilot
            </h3>
            <p className="text-[11px] text-blue-200/90 leading-relaxed max-w-sm">
              ForceLens has pre-packaged your Salesforce API evidence, CRUD tables, FLS, and sharing paths into an optimized prompt for expert AI analysis.
            </p>
          </div>
          <Bot className="w-8 h-8 text-blue-300/80 shrink-0" />
        </div>

        {/* 1-Click Copy Prompt Button */}
        <button
          onClick={handleCopy}
          className="w-full py-2 px-3 bg-white hover:bg-blue-50 text-slate-900 font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-700">Prompt Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-blue-600" />
              <span>Copy Complete AI Analysis Prompt</span>
            </>
          )}
        </button>
      </div>

      {/* 1-Click External AI Launchers Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center">
            <Zap className="w-3.5 h-3.5 text-amber-500 mr-1.5 fill-current" />
            1-Click Launchers (Copies & Opens App)
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Free Web Apps</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* ChatGPT */}
          <button
            onClick={() => handleLaunchApp('chatgpt', 'ChatGPT')}
            className="p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between transition-all group text-left"
          >
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-[#10a37f] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
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
            className="p-2.5 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 flex items-center justify-between transition-all group text-left"
          >
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-[#d97706] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
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
            className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between transition-all group text-left"
          >
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-[#0078d4] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
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
            className="p-2.5 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 flex items-center justify-between transition-all group text-left"
          >
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-[#4285f4] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
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
          <span className="flex items-center text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Tokens & secrets strictly excluded
          </span>
          <span>Paste into any chat prompt</span>
        </div>
      </div>

      {/* Prompt Preview Accordion */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <button
          onClick={() => setShowPromptPreview(!showPromptPreview)}
          className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors"
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

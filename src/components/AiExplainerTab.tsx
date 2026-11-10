import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Cpu,
  Server,
  Settings,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Send,
  User,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { AnalysisResult } from '../types';
import { generateAiPrompt, openExternalAiApp } from '../analyzers/ai-prompt-generator';
import { getAiSettings, DEFAULT_AI_CONFIG } from '../ai/ai-store';
import { checkChromeBuiltinAi, executeAiChat } from '../ai/ai-service';
import { AiSettingsConfig, ChromeBuiltinAiStatus, AiGenerationResult, ChatMessage } from '../ai/ai-types';
import { RichAiResponseView } from './RichAiResponseView';

interface AiExplainerTabProps {
  result: AnalysisResult;
  onOpenSettings?: () => void;
}

export const AiExplainerTab: React.FC<AiExplainerTabProps> = ({ result, onOpenSettings }) => {
  const [copied, setCopied] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // AI Configuration & Status
  const [aiConfig, setAiConfig] = useState<AiSettingsConfig>(DEFAULT_AI_CONFIG);
  const [chromeAiStatus, setChromeAiStatus] = useState<ChromeBuiltinAiStatus | null>(null);

  // Conversation & Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const promptText = generateAiPrompt(result);

  useEffect(() => {
    getAiSettings().then(setAiConfig);
    checkChromeBuiltinAi().then(setChromeAiStatus);
  }, []);

  useEffect(() => {
    // Scroll smoothly to bottom when new messages arrive
    if (chatMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isGenerating]);

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

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    triggerToast('Message content copied to clipboard!');
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleLaunchApp = (app: 'chatgpt' | 'claude' | 'copilot' | 'gemini', appName: string) => {
    openExternalAiApp(app, promptText);
    triggerToast(`Prompt copied! Opening ${appName} in a new tab... Press Cmd+V / Ctrl+V to paste.`);
  };

  /**
   * Helper to resolve active provider config
   */
  const getActiveConfig = (): AiSettingsConfig => {
    let activeConfig = { ...aiConfig };
    if (activeConfig.preferredProvider === 'web-launchers') {
      if (chromeAiStatus?.available) {
        activeConfig.preferredProvider = 'chrome-builtin';
      } else if (activeConfig.ollamaEndpoint) {
        activeConfig.preferredProvider = 'ollama';
      } else if (activeConfig.geminiApiKey) {
        activeConfig.preferredProvider = 'gemini';
      } else if (activeConfig.openaiApiKey) {
        activeConfig.preferredProvider = 'openai';
      } else if (activeConfig.anthropicApiKey) {
        activeConfig.preferredProvider = 'anthropic';
      }
    }
    return activeConfig;
  };

  /**
   * Runs the initial verdict analysis using the comprehensive verified evidence prompt
   */
  const handleRunInitialAnalysis = async () => {
    setIsGenerating(true);
    setExecutionError(null);
    setChatMessages([]);

    const activeConfig = getActiveConfig();

    try {
      const initialUserMsg: ChatMessage = {
        id: 'initial-prompt',
        role: 'user',
        content: promptText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const res: AiGenerationResult = await executeAiChat([initialUserMsg], activeConfig);

      if (res.error) {
        setExecutionError(res.error);
        triggerToast(`Analysis failed: ${res.error}`);
      } else {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: res.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: res.modelUsed,
          isInitialVerdict: true,
        };
        // We only show the assistant verdict in the visible message list so the massive raw prompt doesn't clutter the chat
        setChatMessages([assistantMsg]);
        triggerToast('AI Access Analysis generated successfully!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExecutionError(msg);
      triggerToast(`Error: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Sends a follow-up question in the ongoing multi-turn conversation
   */
  const handleSendFollowUp = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isGenerating) return;

    setInputText('');
    setExecutionError(null);

    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Full history including the root evidence prompt for context grounding
    const initialEvidencePrompt: ChatMessage = {
      id: 'root-evidence-prompt',
      role: 'user',
      content: promptText,
      timestamp: '',
    };

    const updatedVisibleMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedVisibleMessages);
    setIsGenerating(true);

    try {
      const activeConfig = getActiveConfig();
      // Send root evidence + subsequent conversation turns
      const conversationPayload: ChatMessage[] = [
        initialEvidencePrompt,
        ...chatMessages.map((m) => ({
          ...m,
          // exclude initial verdict marker for API serialization
        })),
        newUserMsg,
      ];

      const res: AiGenerationResult = await executeAiChat(conversationPayload, activeConfig);

      if (res.error) {
        setExecutionError(res.error);
        triggerToast(`Follow-up failed: ${res.error}`);
      } else {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: res.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: res.modelUsed,
        };
        setChatMessages([...updatedVisibleMessages, assistantMsg]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExecutionError(msg);
      triggerToast(`Error: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetConversation = () => {
    setChatMessages([]);
    setExecutionError(null);
    setInputText('');
    triggerToast('Conversation cleared.');
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

  const userName = result.targetUserName || 'this user';
  const quickSuggestionPrompts = [
    `How do I grant Edit access to ${userName} without changing Profile permissions?`,
    `Which specific Sharing Rule (Owner-based or Criteria-based) should I create?`,
    `Why are restricted fields hidden from ${userName}?`,
    `Draft a polite resolution ticket reply explaining why Edit is denied.`,
  ];

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
                AI Security Copilot
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
              Analyzes verified Salesforce provenance facts, explains visibility discrepancies, and chats interactively with you to remediate access blockers.
            </p>
          </div>
          <Bot className="w-8 h-8 text-indigo-400/80 shrink-0" />
        </div>

        {/* Action Buttons: 1-Click Run Inside Extension + Copy Prompt */}
        <div className="grid grid-cols-2 gap-2">
          {/* In-Extension Execution Button */}
          <button
            onClick={handleRunInitialAnalysis}
            disabled={isGenerating}
            className="w-full py-2 px-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
          >
            {isGenerating && chatMessages.length === 0 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Analyzing Signals...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-current" />
                <span>
                  {chatMessages.length > 0
                    ? 'Re-Run Analysis'
                    : aiConfig.preferredProvider === 'ollama'
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
              Chrome Built-in AI not active in this browser. Use 1-Click Launchers below or configure Ollama / Gemini in Settings.
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

      {/* Execution Error Notice */}
      {executionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1.5 animate-in fade-in duration-150">
          <div className="font-bold text-xs flex items-center justify-between">
            <span className="flex items-center">
              <AlertCircle className="w-4 h-4 mr-1.5 text-rose-600 shrink-0" />
              AI Execution Error
            </span>
            <button
              onClick={() => setExecutionError(null)}
              className="text-rose-500 hover:text-rose-700 text-[10px] font-bold"
            >
              Dismiss
            </button>
          </div>
          <p className="text-[11px] leading-relaxed font-mono">{executionError}</p>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="mt-1 text-[11px] font-bold text-rose-800 underline block cursor-pointer"
            >
              Configure API Keys / Models in Settings →
            </button>
          )}
        </div>
      )}

      {/* Interactive Chat Stream & Verdict Display */}
      {chatMessages.length > 0 && (
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-xs text-slate-900">
                AI Copilot Conversation
              </span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                {chatMessages.length} message{chatMessages.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={handleResetConversation}
              className="flex items-center text-[10px] text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded font-semibold transition-colors cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </button>
          </div>

          {/* Messages List */}
          <div className="space-y-3">
            {chatMessages.map((msg) => {
              const isAssistant = msg.role === 'assistant';

              return (
                <div
                  key={msg.id}
                  className={`space-y-1 ${
                    isAssistant ? 'w-full' : 'flex flex-col items-end pl-8'
                  }`}
                >
                  {/* Message Header */}
                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 px-1">
                    {isAssistant ? (
                      <>
                        <Bot className="w-3 h-3 text-indigo-600" />
                        <span className="font-bold text-slate-700">ForceLens Copilot</span>
                        {msg.modelUsed && (
                          <span className="font-mono text-[9px] bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                            {msg.modelUsed}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 text-blue-600" />
                        <span className="font-bold text-slate-700">You</span>
                      </>
                    )}
                    <span>• {msg.timestamp}</span>
                  </div>

                  {/* Message Body */}
                  {isAssistant ? (
                    <div className="space-y-2 relative group">
                      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="p-1 bg-white/90 hover:bg-white text-slate-600 border border-slate-200 rounded shadow-xs text-[10px] flex items-center cursor-pointer"
                          title="Copy response"
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Render Rich Cards / Scorecards / Markdown */}
                      <RichAiResponseView content={msg.content} />
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl rounded-tr-none text-xs leading-relaxed max-w-[85%] shadow-xs">
                      {msg.content}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking / Loader Indicator */}
            {isGenerating && (
              <div className="flex items-center space-x-2 p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-lg text-indigo-900 text-xs animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                <span className="font-medium text-[11px]">
                  ForceLens Copilot is analyzing Salesforce security rules and drafting remediation...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          {!isGenerating && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                <HelpCircle className="w-3 h-3 mr-1 text-indigo-500" />
                Quick Follow-Up Questions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickSuggestionPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendFollowUp(q)}
                    disabled={isGenerating}
                    className="text-left text-[11px] bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-900 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  >
                    💡 {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Chat Input Bar */}
          <div className="pt-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendFollowUp();
              }}
              className="flex items-center space-x-1.5"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask a follow-up question (e.g. 'How do I grant access via a Permission Set?')..."
                disabled={isGenerating}
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isGenerating}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
                title="Send message"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
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

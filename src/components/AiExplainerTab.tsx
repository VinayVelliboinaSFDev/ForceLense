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
  Send,
  User,
  MessageSquare,
  HelpCircle,
  Database,
} from 'lucide-react';
import { AnalysisResult } from '../types';
import { generateAiPrompt, openExternalAiApp } from '../analyzers/ai-prompt-generator';
import { getAiSettings, DEFAULT_AI_CONFIG } from '../ai/ai-store';
import { checkChromeBuiltinAi, executeAiChat } from '../ai/ai-service';
import { AiSettingsConfig, ChromeBuiltinAiStatus, AiGenerationResult, ChatMessage } from '../ai/ai-types';
import { RichAiResponseView } from './RichAiResponseView';
import { validateAndSanitizeSoql } from '../salesforce/soql-safety';
import { sfApi } from '../salesforce/api-client';

interface AiExplainerTabProps {
  result: AnalysisResult;
  onOpenSettings?: () => void;
  isMockMode?: boolean;
}

export const AiExplainerTab: React.FC<AiExplainerTabProps> = ({
  result,
  onOpenSettings,
  isMockMode = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // AI Configuration & Status
  const [aiConfig, setAiConfig] = useState<AiSettingsConfig>(DEFAULT_AI_CONFIG);
  const [chromeAiStatus, setChromeAiStatus] = useState<ChromeBuiltinAiStatus | null>(null);

  // Conversation & Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQueryingSalesforce, setIsQueryingSalesforce] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const promptText = generateAiPrompt(result);

  // Track active record and user context to preserve chat across tab switching
  // but cleanly reset when target user or record changes
  const currentContextKey = `${result.recordId}:${result.targetUserId}`;
  const prevContextKeyRef = useRef(currentContextKey);

  useEffect(() => {
    getAiSettings().then(setAiConfig);
    checkChromeBuiltinAi().then(setChromeAiStatus);
  }, []);

  useEffect(() => {
    // If the record or target user changes, reset the conversation
    if (prevContextKeyRef.current !== currentContextKey) {
      prevContextKeyRef.current = currentContextKey;
      setChatMessages([]);
      setExecutionError(null);
      setInputText('');
    }
  }, [currentContextKey]);

  useEffect(() => {
    // Scroll smoothly to bottom when new messages arrive or when error occurs
    if (chatMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isGenerating, isQueryingSalesforce, executionError]);

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
   * Executes a read-only SOQL query against Salesforce with safety checks
   */
  const executeQuerySafely = async (
    rawSoql: string
  ): Promise<{ records: Record<string, unknown>[]; error?: string; query: string }> => {
    const val = validateAndSanitizeSoql(rawSoql);
    if (!val.valid) {
      return { records: [], error: val.error, query: rawSoql };
    }

    if (isMockMode) {
      // Simulate intelligent mock response for mock/offline testing
      if (/FROM\s+UserRole/i.test(val.sanitized)) {
        return {
          records: [
            { Id: '00E000000000001', Name: 'Global Support Lead', DeveloperName: 'Global_Support_Lead' },
          ],
          query: val.sanitized,
        };
      }
      if (/FROM\s+Group/i.test(val.sanitized)) {
        return {
          records: [
            { Id: '00G000000000001', Name: 'Support Tier 1 Queue', Type: 'Queue' },
          ],
          query: val.sanitized,
        };
      }
      if (/FROM\s+Case/i.test(val.sanitized)) {
        return {
          records: [
            { Id: result.recordId, CaseNumber: '00001001', Subject: 'Customer Connectivity Issue' },
          ],
          query: val.sanitized,
        };
      }
      return {
        records: [{ Id: 'mock_record_1', Name: 'Mock Salesforce Record' }],
        query: val.sanitized,
      };
    }

    try {
      const records = await sfApi.query<Record<string, unknown>>(val.sanitized);
      return { records, query: val.sanitized };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { records: [], error: msg, query: val.sanitized };
    }
  };

  /**
   * Runs the initial verdict analysis using the verified evidence prompt
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
   * Supports Agentic Tool Calling: Executes read-only SOQL queries against Salesforce if needed
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

    // Root evidence prompt for context grounding
    const initialEvidencePrompt: ChatMessage = {
      id: 'root-evidence-prompt',
      role: 'user',
      content: promptText,
      timestamp: '',
    };

    const systemCapabilityNotice: ChatMessage = {
      id: 'system-capability',
      role: 'system',
      content: `You are ForceLens Copilot, an expert Salesforce security assistant.
Verified record access evidence is provided above.
If answering the user's question requires additional details from the connected Salesforce org (e.g. looking up a User, UserRole, Group, GroupMember, Share tables, ObjectPermissions, or PermissionSets), you have read-only access!
To query Salesforce, output:
[SALESFORCE_QUERY: SELECT <fields> FROM <sobject> WHERE <condition>]
ForceLens will automatically execute your read-only SOQL query against Salesforce and supply the live records to you to formulate your final answer.`,
      timestamp: '',
    };

    const updatedVisibleMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedVisibleMessages);
    setIsGenerating(true);

    try {
      const activeConfig = getActiveConfig();
      let conversationPayload: ChatMessage[] = [
        initialEvidencePrompt,
        systemCapabilityNotice,
        ...chatMessages,
        newUserMsg,
      ];

      let res: AiGenerationResult = await executeAiChat(conversationPayload, activeConfig);

      // Check if the AI Copilot requested a read-only Salesforce query
      const queryMatch =
        res.text.match(/\[SALESFORCE_QUERY:\s*(SELECT[\s\S]*?)\]/i) ||
        res.text.match(/```soql\s*(SELECT[\s\S]*?)```/i);

      let queryExecutedText: string | undefined;
      let queryRecordCount: number | undefined;

      if (queryMatch && !res.error) {
        const rawQuery = queryMatch[1].trim();
        setIsQueryingSalesforce(true);

        const queryOutcome = await executeQuerySafely(rawQuery);
        queryExecutedText = queryOutcome.query;
        queryRecordCount = queryOutcome.records.length;

        setIsQueryingSalesforce(false);

        // Feed query results back to model for synthesis
        const queryResultMsg: ChatMessage = {
          id: `query-result-${Date.now()}`,
          role: 'user',
          content: queryOutcome.error
            ? `[Salesforce Live Query Attempt Failed]\nQuery: ${rawQuery}\nError: ${queryOutcome.error}\nPlease answer the user explaining this restriction.`
            : `[Salesforce Live Query Results]\nQuery: ${queryOutcome.query}\nRecords (${queryOutcome.records.length}):\n${JSON.stringify(queryOutcome.records, null, 2)}\nPlease synthesize your final answer to the user based on these live Salesforce records.`,
          timestamp: '',
        };

        conversationPayload = [
          ...conversationPayload,
          {
            id: `assistant-call-${Date.now()}`,
            role: 'assistant',
            content: res.text,
            timestamp: '',
          },
          queryResultMsg,
        ];

        // Second turn with live data
        res = await executeAiChat(conversationPayload, activeConfig);
      }

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
          queryExecuted: queryExecutedText,
          recordCount: queryRecordCount,
        };
        setChatMessages([...updatedVisibleMessages, assistantMsg]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExecutionError(msg);
      triggerToast(`Error: ${msg}`);
    } finally {
      setIsGenerating(false);
      setIsQueryingSalesforce(false);
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
    `Why is Edit blocked if ${userName} has Profile Edit rights?`,
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
              Analyzes verified Salesforce record access & sharing rules, explains blockers, and queries your org live for deep root-cause investigation.
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

      {/* Execution Error Notice (when no chat started yet) */}
      {executionError && chatMessages.length === 0 && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1.5 animate-in fade-in duration-150">
          <div className="font-bold text-xs flex items-center justify-between">
            <span className="flex items-center">
              <AlertCircle className="w-4 h-4 mr-1.5 text-rose-600 shrink-0" />
              AI Execution Error
            </span>
            <button
              onClick={() => setExecutionError(null)}
              className="text-rose-500 hover:text-rose-700 text-[10px] font-bold cursor-pointer"
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

                      {/* Live Salesforce Query Badge (if executed by ForceLens) */}
                      {msg.queryExecuted && (
                        <div className="flex items-center justify-between p-2 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-[10px] font-mono shadow-2xs">
                          <div className="flex items-center space-x-1.5 truncate">
                            <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">
                              <strong>Queried Salesforce:</strong> {msg.queryExecuted}
                            </span>
                          </div>
                          <span className="shrink-0 ml-2 bg-emerald-200 text-emerald-950 font-bold px-1.5 py-0.2 rounded text-[9px]">
                            {msg.recordCount ?? 0} row{msg.recordCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      )}

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

            {/* Querying Salesforce Indicator */}
            {isQueryingSalesforce && (
              <div className="flex items-center space-x-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs animate-pulse">
                <Database className="w-4 h-4 animate-bounce text-emerald-600 shrink-0" />
                <span className="font-medium text-[11px]">
                  ForceLens is querying your Salesforce org with read-only SOQL for live verification...
                </span>
              </div>
            )}

            {/* Thinking / Loader Indicator */}
            {isGenerating && !isQueryingSalesforce && (
              <div className="flex items-center space-x-2 p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-lg text-indigo-900 text-xs animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                <span className="font-medium text-[11px]">
                  ForceLens Copilot is analyzing Salesforce security rules and drafting remediation...
                </span>
              </div>
            )}

            {/* In-Chat Execution Error Notice (Rendered directly under the chat) */}
            {executionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1.5 animate-in fade-in duration-150">
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1.5 text-rose-600 shrink-0" />
                    AI Execution Notice
                  </span>
                  <button
                    onClick={() => setExecutionError(null)}
                    className="text-rose-500 hover:text-rose-700 text-[10px] font-bold cursor-pointer"
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
                placeholder="Ask follow-up or query org (e.g. 'Query Melissa role' or 'How to fix via Sharing Rule?')..."
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

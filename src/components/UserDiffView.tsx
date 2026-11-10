import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Key,
  Shield,
  Loader2,
  GitCompare,
  X,
  UserCheck,
  Info,
  Sparkles,
  Zap,
  Copy,
  Check,
  ExternalLink,
  Bot,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { AnalysisResult, TargetUser } from '../types';
import { sfApi } from '../salesforce/api-client';
import { MOCK_TARGET_USERS } from './MockData';
import { generateDiffAiPrompt, openExternalAiApp } from '../analyzers/ai-prompt-generator';
import { getAiSettings, DEFAULT_AI_CONFIG } from '../ai/ai-store';
import { executeAiChat } from '../ai/ai-service';
import { AiSettingsConfig, AiGenerationResult } from '../ai/ai-types';
import { RichAiResponseView } from './RichAiResponseView';

interface UserDiffViewProps {
  userA: TargetUser;
  resultA: AnalysisResult;
  userB: TargetUser | null;
  resultB: AnalysisResult | null;
  candidateUsers: TargetUser[];
  onSelectUserB: (user: TargetUser) => void;
  isLoadingB: boolean;
  isMockMode?: boolean;
  onOpenSettings?: () => void;
}

export const UserDiffView: React.FC<UserDiffViewProps> = ({
  userA,
  resultA,
  userB,
  resultB,
  candidateUsers,
  onSelectUserB,
  isLoadingB,
  isMockMode = false,
  onOpenSettings,
}) => {
  // Search state for User B
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TargetUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditingUserB, setIsEditingUserB] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // AI Diff state
  const [aiConfig, setAiConfig] = useState<AiSettingsConfig>(DEFAULT_AI_CONFIG);
  const [isGeneratingDiffAi, setIsGeneratingDiffAi] = useState(false);
  const [diffAiResult, setDiffAiResult] = useState<AiGenerationResult | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);

  useEffect(() => {
    getAiSettings().then(setAiConfig);
  }, []);

  // Reset diff AI result when User B changes
  useEffect(() => {
    setDiffAiResult(null);
  }, [userB?.id]);

  // Auto focus search input when entering edit mode
  useEffect(() => {
    if (isEditingUserB && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isEditingUserB]);

  // Debounced live user search for User B
  useEffect(() => {
    if (!searchTerm.trim()) {
      const candidates = (candidateUsers.length > 0 ? candidateUsers : MOCK_TARGET_USERS).filter(
        (u) => u.id !== userA.id
      );
      setSearchResults(candidates);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (isMockMode) {
          const lower = searchTerm.toLowerCase();
          const filtered = MOCK_TARGET_USERS.filter(
            (u) =>
              u.id !== userA.id &&
              (u.name.toLowerCase().includes(lower) ||
                u.username.toLowerCase().includes(lower) ||
                u.id.toLowerCase().includes(lower) ||
                u.profileName.toLowerCase().includes(lower))
          );
          setSearchResults(filtered);
        } else {
          const remoteUsers = await sfApi.searchUsers(searchTerm);
          setSearchResults(remoteUsers.filter((u) => u.id !== userA.id));
        }
      } catch {
        const lower = searchTerm.toLowerCase();
        const fallback = (candidateUsers.length > 0 ? candidateUsers : MOCK_TARGET_USERS).filter(
          (u) =>
            u.id !== userA.id &&
            (u.name.toLowerCase().includes(lower) ||
              u.username.toLowerCase().includes(lower) ||
              u.profileName.toLowerCase().includes(lower))
        );
        setSearchResults(fallback);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, isMockMode, candidateUsers, userA.id]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        if (userB) {
          setIsEditingUserB(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userB]);

  // Strict boolean resolution
  const canReadA = resultA.recordAccess?.read === true;
  const canEditA = resultA.recordAccess?.edit === true;
  const canDeleteA = resultA.recordAccess?.delete === true;
  const canTransferA = resultA.recordAccess?.transfer === true;

  const canReadB = resultB?.recordAccess?.read === true;
  const canEditB = resultB?.recordAccess?.edit === true;
  const canDeleteB = resultB?.recordAccess?.delete === true;
  const canTransferB = resultB?.recordAccess?.transfer === true;

  const diffPromptText = resultB ? generateDiffAiPrompt(resultA, resultB) : '';

  const handleRunDiffAi = async () => {
    if (!resultB || isGeneratingDiffAi) return;
    setIsGeneratingDiffAi(true);
    setDiffAiResult(null);

    try {
      const res = await executeAiChat(
        [
          {
            id: `diff-${Date.now()}`,
            role: 'user',
            content: diffPromptText,
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
        aiConfig
      );
      setDiffAiResult(res);
    } catch (err: unknown) {
      setDiffAiResult({
        text: '',
        provider: aiConfig.preferredProvider,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsGeneratingDiffAi(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!diffPromptText) return;
    navigator.clipboard.writeText(diffPromptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyResult = () => {
    if (diffAiResult?.text) {
      navigator.clipboard.writeText(diffAiResult.text);
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 2000);
    }
  };

  const handleLaunchApp = (app: 'chatgpt' | 'claude' | 'copilot' | 'gemini') => {
    if (!diffPromptText) return;
    openExternalAiApp(app, diffPromptText);
  };

  const renderStatus = (val: boolean | 'unknown' | undefined) => {
    if (val === true) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3 mr-0.5 text-emerald-600" /> Yes
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
          <XCircle className="w-3 h-3 mr-0.5 text-rose-600" /> No
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
        <HelpCircle className="w-3 h-3 mr-0.5 text-slate-400" /> ?
      </span>
    );
  };

  const renderDiscrepancyBadge = (valA: boolean, valB: boolean) => {
    if (valA === valB) {
      return (
        <span className="text-[10px] font-medium text-slate-400">
          Match ({valA ? 'Granted' : 'Denied'})
        </span>
      );
    }
    if (valA && !valB) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
          {userA.name} Only
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
        {userB?.name || 'User B'} Only
      </span>
    );
  };

  return (
    <div className="space-y-3 text-xs">
      {/* 1. Compare Header & Searchable User Selector Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitCompare className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-xs">User Access Diff Mode</h3>
          </div>
          <span className="text-[10px] bg-indigo-800/80 text-blue-200 px-2 py-0.5 rounded-full font-semibold">
            Side-by-Side Root Cause Comparison
          </span>
        </div>

        {/* User Comparison Grid */}
        <div className="grid grid-cols-2 gap-2 text-slate-900">
          {/* User A Card */}
          <div className="p-2.5 rounded-lg bg-white/95 border border-slate-200 space-y-1 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                Base User (User A)
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <div className="font-bold text-xs text-slate-900 truncate">{userA.name}</div>
            <div className="text-[10px] text-slate-500 truncate">
              {userA.profileName || 'Profile'} {userA.userRoleName ? `· ${userA.userRoleName}` : ''}
            </div>
          </div>

          {/* User B Searchable Selector Card */}
          <div ref={dropdownRef} className="p-2.5 rounded-lg bg-white/95 border border-slate-200 space-y-1 relative shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">
                Compare With (User B)
              </span>
              {userB && !isEditingUserB && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUserB(true);
                    setSearchTerm('');
                    setShowDropdown(true);
                  }}
                  className="text-[10px] font-semibold text-purple-600 hover:text-purple-800 transition-colors cursor-pointer"
                >
                  Change User
                </button>
              )}
            </div>

            {userB && !isEditingUserB ? (
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-slate-900 truncate flex items-center justify-between">
                  <span className="truncate">{userB.name}</span>
                  {isLoadingB && <Loader2 className="w-3 h-3 text-purple-600 animate-spin shrink-0 ml-1" />}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {userB.profileName || 'Profile'} {userB.userRoleName ? `· ${userB.userRoleName}` : ''}
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search User B by name, role, ID..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowDropdown(false);
                        if (userB) setIsEditingUserB(false);
                      }
                    }}
                    className="w-full text-xs pl-7 pr-14 py-1 bg-purple-50/50 border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium text-slate-800"
                  />
                  <div className="absolute right-1.5 flex items-center space-x-1">
                    {isSearching ? (
                      <Loader2 className="w-3 h-3 text-purple-500 animate-spin" />
                    ) : searchTerm ? (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : null}
                    {userB && isEditingUserB && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingUserB(false);
                          setShowDropdown(false);
                        }}
                        className="text-[9px] text-slate-500 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded font-medium cursor-pointer"
                        title="Cancel change"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Dropdown Results */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
                <div className="p-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Select User to Compare</span>
                  <span>{searchResults.length} found</span>
                </div>
                {searchResults.length > 0 ? (
                  searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onSelectUserB(u);
                        setIsEditingUserB(false);
                        setShowDropdown(false);
                        setSearchTerm('');
                      }}
                      className="w-full p-2 text-left hover:bg-purple-50/80 transition-colors flex items-center space-x-2 group cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-slate-900 group-hover:text-purple-900 truncate">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {u.profileName || 'Profile'} {u.userRoleName ? `· ${u.userRoleName}` : ''}
                        </div>
                      </div>
                      <UserCheck className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400">
                    {isSearching ? 'Searching users...' : 'No matching users found.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Diff Content */}
      {!userB ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-2 shadow-xs">
          <Users className="w-9 h-9 text-purple-300 mx-auto" />
          <h4 className="font-bold text-xs text-slate-800">Select User B to Compare Access</h4>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
            Use the search box above to find any user in your Salesforce org. ForceLens will analyze their permissions side-by-side with {userA.name} to explain why access differs.
          </p>
        </div>
      ) : isLoadingB ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-2 shadow-xs">
          <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
          <span className="text-xs font-semibold text-slate-700 block">
            Analyzing permissions & sharing for {userB.name}...
          </span>
          <span className="text-[10px] text-slate-400 block">
            Inspecting UserRecordAccess, Share rows, Object CRUD & Sharing rules
          </span>
        </div>
      ) : resultB ? (
        <div className="space-y-3">
          {/* AI Diff Summary Card (NEW) */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white rounded-xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-400 fill-current animate-pulse" />
                <span className="font-bold text-xs text-white">AI Access Discrepancy & Root Cause Summary</span>
              </div>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Diff Copilot
              </span>
            </div>
            <p className="text-[11px] text-indigo-200 leading-relaxed">
              Explains the exact structural security reason why {userA.name} can access/edit this record while {userB.name} is denied (or vice-versa), focusing purely on Record Sharing & Object CRUD.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleRunDiffAi}
                disabled={isGeneratingDiffAi}
                className="py-2 px-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {isGeneratingDiffAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Analyzing Diff...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300 fill-current" />
                    <span>Explain Diff with AI</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopyPrompt}
                className="py-2 px-3 bg-white/95 hover:bg-white text-slate-900 font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Diff Prompt Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-blue-600" />
                    <span>Copy Diff Prompt</span>
                  </>
                )}
              </button>
            </div>

            {/* 1-Click Web Launchers for Diff Prompt */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px]">
              <span className="text-slate-300">1-Click Launchers:</span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => handleLaunchApp('chatgpt')}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded font-semibold text-emerald-300 cursor-pointer"
                >
                  ChatGPT
                </button>
                <button
                  onClick={() => handleLaunchApp('claude')}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded font-semibold text-amber-300 cursor-pointer"
                >
                  Claude
                </button>
                <button
                  onClick={() => handleLaunchApp('gemini')}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded font-semibold text-blue-300 cursor-pointer"
                >
                  Gemini
                </button>
              </div>
            </div>
          </div>

          {/* Render Diff AI Explanation Result */}
          {diffAiResult && (
            <div className="bg-white rounded-xl border border-purple-200 p-3 shadow-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-1.5">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-xs text-slate-900">
                    AI Comparative Root Cause Verdict
                  </span>
                  {diffAiResult.modelUsed && (
                    <span className="text-[10px] bg-purple-50 text-purple-700 font-mono px-1.5 py-0.2 rounded font-semibold">
                      {diffAiResult.modelUsed}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={handleCopyResult}
                    className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Copy AI Diff"
                  >
                    {copiedResult ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setDiffAiResult(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Clear"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {diffAiResult.error ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                  <div className="font-bold text-xs flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                    Diff AI Notice
                  </div>
                  <p className="text-[11px] leading-relaxed">{diffAiResult.error}</p>
                  {onOpenSettings && (
                    <button
                      onClick={onOpenSettings}
                      className="mt-1 text-[11px] font-bold text-rose-800 underline block cursor-pointer"
                    >
                      Configure AI Settings →
                    </button>
                  )}
                </div>
              ) : (
                <RichAiResponseView content={diffAiResult.text} />
              )}
            </div>
          )}

          {/* 2. Effective Record Access Verdict Comparison Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Shield className="w-3.5 h-3.5 text-blue-600 mr-1.5" />
                Record Access Verdict Comparison
              </span>
              <span className="text-[10px] text-slate-500 font-mono">UserRecordAccess</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                <tr>
                  <th className="px-3 py-2">Capability</th>
                  <th className="px-3 py-2 text-center text-blue-800 font-bold">{userA.name}</th>
                  <th className="px-3 py-2 text-center text-purple-800 font-bold">{userB.name}</th>
                  <th className="px-3 py-2 text-center">Diff Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Read */}
                <tr className={canReadA !== canReadB ? 'bg-amber-50/60' : ''}>
                  <td className="px-3 py-2 font-medium">Record Read</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canReadA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canReadB)}</td>
                  <td className="px-3 py-2 text-center">{renderDiscrepancyBadge(canReadA, canReadB)}</td>
                </tr>

                {/* Edit */}
                <tr className={canEditA !== canEditB ? 'bg-amber-50/60' : ''}>
                  <td className="px-3 py-2 font-medium">Record Edit</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canEditA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canEditB)}</td>
                  <td className="px-3 py-2 text-center">{renderDiscrepancyBadge(canEditA, canEditB)}</td>
                </tr>

                {/* Delete */}
                <tr className={canDeleteA !== canDeleteB ? 'bg-amber-50/60' : ''}>
                  <td className="px-3 py-2 font-medium">Record Delete</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canDeleteA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canDeleteB)}</td>
                  <td className="px-3 py-2 text-center">{renderDiscrepancyBadge(canDeleteA, canDeleteB)}</td>
                </tr>

                {/* Transfer */}
                {(resultA.recordAccess?.transfer !== undefined || resultB?.recordAccess?.transfer !== undefined) && (
                  <tr className={canTransferA !== canTransferB ? 'bg-amber-50/60' : ''}>
                    <td className="px-3 py-2 font-medium">Record Transfer</td>
                    <td className="px-3 py-2 text-center">{renderStatus(canTransferA)}</td>
                    <td className="px-3 py-2 text-center">{renderStatus(canTransferB)}</td>
                    <td className="px-3 py-2 text-center">{renderDiscrepancyBadge(canTransferA, canTransferB)}</td>
                  </tr>
                )}

                {/* Max Access Level */}
                <tr className="bg-slate-50/50">
                  <td className="px-3 py-2 font-medium">Max Access Level</td>
                  <td className="px-3 py-2 text-center font-bold text-blue-700 font-mono text-[11px]">
                    {resultA.recordAccess?.maxAccessLevel || 'Unknown'}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-purple-700 font-mono text-[11px]">
                    {resultB.recordAccess?.maxAccessLevel || 'Unknown'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {resultA.recordAccess?.maxAccessLevel === resultB.recordAccess?.maxAccessLevel ? (
                      <span className="text-[10px] text-slate-400">Match</span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        Level Difference
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. Object-Level CRUD Comparison Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Key className="w-3.5 h-3.5 text-indigo-600 mr-1.5" />
                Object CRUD Permissions ({resultA.objectApiName})
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Profile & PermSets</span>
            </div>

            <div className="grid grid-cols-6 divide-x divide-slate-100 text-center py-2 text-[11px]">
              {(['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'] as const).map((action) => {
                const valA = resultA.objectPermissions[action] === true;
                const valB = resultB.objectPermissions[action] === true;
                const isDiff = valA !== valB;
                return (
                  <div key={action} className={`p-1.5 space-y-1 ${isDiff ? 'bg-amber-50/70' : ''}`}>
                    <span className="block font-bold text-[10px] text-slate-600 uppercase">
                      {action}
                    </span>
                    <div className="text-[10px] text-blue-700 font-bold">
                      A: {valA ? 'Yes' : 'No'}
                    </div>
                    <div className="text-[10px] text-purple-700 font-bold">
                      B: {valB ? 'Yes' : 'No'}
                    </div>
                    {isDiff ? (
                      <span className="inline-block text-[9px] font-bold px-1 rounded bg-amber-200 text-amber-900">
                        {valA ? 'A Only' : 'B Only'}
                      </span>
                    ) : (
                      <span className="inline-block text-[9px] text-slate-400">Match</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Access Root Cause & Sharing Provenance Comparison */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Info className="w-3.5 h-3.5 text-teal-600 mr-1.5" />
                Sharing Provenance Root Cause Comparison
              </span>
              <span className="text-[10px] text-slate-500">Why Access Differs</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {/* User A Grant Roots */}
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 text-[10px]">{userA.name} Grants:</span>
                  <span className="text-[9px] bg-white text-blue-700 px-1.5 py-0.2 rounded border font-mono">
                    Max: {resultA.recordAccess?.maxAccessLevel}
                  </span>
                </div>
                {resultA.sharingFindings.length > 0 ? (
                  resultA.sharingFindings.map((f, i) => (
                    <div key={i} className="text-[10px] text-slate-800 bg-white p-1 rounded border border-blue-100">
                      <strong>• {f.label}</strong> ({f.accessLevel})
                      {f.source && <div className="text-[9px] text-slate-500 font-mono">{f.source}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-500 italic">No explicit share rows found</div>
                )}
              </div>

              {/* User B Grant Roots */}
              <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 text-[10px]">{userB.name} Grants:</span>
                  <span className="text-[9px] bg-white text-purple-700 px-1.5 py-0.2 rounded border font-mono">
                    Max: {resultB.recordAccess?.maxAccessLevel}
                  </span>
                </div>
                {resultB.sharingFindings.length > 0 ? (
                  resultB.sharingFindings.map((f, i) => (
                    <div key={i} className="text-[10px] text-slate-800 bg-white p-1 rounded border border-purple-100">
                      <strong>• {f.label}</strong> ({f.accessLevel})
                      {f.source && <div className="text-[9px] text-slate-500 font-mono">{f.source}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-500 italic">No explicit share rows found</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

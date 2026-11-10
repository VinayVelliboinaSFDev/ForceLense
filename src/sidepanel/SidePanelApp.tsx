import React, { useState, useEffect } from 'react';
import {
  Header,
} from '../components/Header';
import { RecordContextCard } from '../components/RecordContextCard';
import { TargetUserSelector } from '../components/TargetUserSelector';
import { SummaryCard } from '../components/SummaryCard';
import { NarrativeSummaryCard } from '../components/NarrativeSummaryCard';
import { AiExplainerTab } from '../components/AiExplainerTab';
import { EvidenceCard } from '../components/EvidenceCard';
import { FieldPermissionsTable } from '../components/FieldPermissionsTable';
import { SharingEvidenceList } from '../components/SharingEvidenceList';
import { DiagnosticModal } from '../components/DiagnosticModal';
import { SettingsModal } from '../components/SettingsModal';
import { ConnectModal } from '../components/ConnectModal';
import {
  MOCK_RECORD_CONTEXT,
  MOCK_ORG_CONNECTION,
  MOCK_TARGET_USERS,
  MOCK_ANALYSIS_RESULT,
} from '../components/MockData';
import {
  SalesforceRecordContext,
  OrgConnection,
  TargetUser,
  AnalysisResult,
  OrgType,
} from '../types';
import { getOrgConnection, disconnectSession } from '../auth/token-store';
import { initiateOAuthFlow } from '../auth/oauth';
import { autoDetectSalesforceSession } from '../auth/salesforce-session';
import { runFullAnalysis } from '../analyzers/orchestrator';
import {
  Play,
  Loader2,
  AlertTriangle,
  Layers,
  Database,
  Lock,
  Share2,
  AlertCircle,
  FileSearch,
  Sparkles,
  Lightbulb,
} from 'lucide-react';

export const SidePanelApp: React.FC = () => {
  const [connection, setConnection] = useState<OrgConnection | null>(null);
  const [recordContext, setRecordContext] = useState<SalesforceRecordContext | null>(null);
  const [selectedUser, setSelectedUser] = useState<TargetUser | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'narrative' | 'ai' | 'fields' | 'sharing' | 'evidence' | 'limitations'>('narrative');

  // Modals
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Demo / Mock Mode
  const [isMockMode, setIsMockMode] = useState(false);

  // Load initial connection and record context
  useEffect(() => {
    // 1. Automatically detect active Salesforce session from current tab (Salesforce Inspector style)
    autoDetectSalesforceSession().then((autoRes) => {
      if (autoRes) {
        setConnection(autoRes.connection);
      } else {
        // Fallback to previously stored connection
        getOrgConnection().then((conn) => {
          if (conn) setConnection(conn);
        });
      }
    });

    // Request active record context from background service worker
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_RECORD_CONTEXT' }, (res) => {
        if (res?.context) {
          setRecordContext(res.context);
        }
      });
    }

    // Listen for context updates from content script
    const messageListener = (msg: { type: string; payload?: SalesforceRecordContext }) => {
      if (msg?.type === 'RECORD_DETECTED' && msg.payload) {
        setRecordContext(msg.payload);
        // Also re-verify session for new record tab
        autoDetectSalesforceSession().then((autoRes) => {
          if (autoRes) setConnection(autoRes.connection);
        });
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      return () => chrome.runtime.onMessage.removeListener(messageListener);
    }
  }, []);

  // Handle Mock Mode Toggle
  const handleToggleMockMode = (enabled: boolean) => {
    setIsMockMode(enabled);
    if (enabled) {
      setConnection(MOCK_ORG_CONNECTION);
      setRecordContext(MOCK_RECORD_CONTEXT);
      setSelectedUser(MOCK_TARGET_USERS[0]);
      setAnalysisResult(MOCK_ANALYSIS_RESULT);
    } else {
      setConnection(null);
      setRecordContext(null);
      setSelectedUser(null);
      setAnalysisResult(null);
    }
  };

  const handleRefreshContext = () => {
    // Re-detect both active session and record context from tab
    autoDetectSalesforceSession().then((autoRes) => {
      if (autoRes) setConnection(autoRes.connection);
    });

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_RECORD_CONTEXT' }, (res) => {
        if (res?.context) {
          setRecordContext(res.context);
        }
      });
    }
  };

  const handleConnectOrg = async (orgType: OrgType, customDomain?: string, clientId?: string) => {
    const conn = await initiateOAuthFlow({ orgType, customDomain, clientId });
    setConnection(conn);
    setIsMockMode(false);
  };

  const handleDisconnect = async () => {
    await disconnectSession();
    setConnection(null);
    setAnalysisResult(null);
    setIsMockMode(false);
  };

  // Run the analysis engine
  const handleRunAnalysis = async () => {
    if (!recordContext) {
      setAnalysisError('Please open or specify a Salesforce record context.');
      return;
    }
    if (!selectedUser) {
      setAnalysisError('Please select a target Salesforce user to evaluate.');
      return;
    }

    setAnalysisError(null);
    setIsAnalyzing(true);

    if (isMockMode) {
      setTimeout(() => {
        setAnalysisResult({
          ...MOCK_ANALYSIS_RESULT,
          recordId: recordContext.recordId,
          objectApiName: recordContext.objectApiName,
          targetUserId: selectedUser.id,
          targetUserName: selectedUser.name,
        });
        setIsAnalyzing(false);
      }, 600);
      return;
    }

    try {
      const res = await runFullAnalysis({
        orgId: connection?.orgId || 'unknown_org',
        recordId: recordContext.recordId,
        objectApiName: recordContext.objectApiName,
        targetUser: selectedUser,
      });
      setAnalysisResult(res);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden text-slate-800">
      {/* Top Header */}
      <Header
        connection={connection}
        onOpenConnect={() => setIsConnectOpen(true)}
        onDisconnect={handleDisconnect}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={analysisResult ? () => setIsExportOpen(true) : undefined}
        onOpenAi={analysisResult ? () => setActiveTab('ai') : undefined}
      />

      {/* Main Body */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Record Context Card */}
        <RecordContextCard
          context={recordContext}
          onRefresh={handleRefreshContext}
          onManualContextChange={(ctx) => setRecordContext(ctx)}
        />

        {/* Target User Selector */}
        <TargetUserSelector
          selectedUser={selectedUser}
          onSelectUser={(u) => setSelectedUser(u)}
          isMockMode={isMockMode}
        />

        {/* Analyze Action Bar */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="text-xs text-slate-600">
            {recordContext && selectedUser ? (
              <span>Ready to explain access for <strong className="text-slate-900">{selectedUser.name}</strong></span>
            ) : (
              <span className="text-slate-400">Select both a record and user to start analysis</span>
            )}
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={!recordContext || !selectedUser || isAnalyzing}
            className="px-4 py-2 font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow flex items-center transition-all"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Analyzing Access...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1.5 fill-current" />
                Analyze Access
              </>
            )}
          </button>
        </div>

        {/* Error Notice */}
        {analysisError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block">Analysis Interrupted</strong>
              <span>{analysisError}</span>
            </div>
          </div>
        )}

        {/* Analysis Results View */}
        {analysisResult && (
          <div className="space-y-3 pb-6">
            {/* Executive Narrative Card (Always visible at top of results) */}
            <NarrativeSummaryCard
              result={analysisResult}
              onOpenAiTab={() => setActiveTab('ai')}
            />

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-1.5 space-x-1 text-xs overflow-x-auto shadow-sm">
              <button
                onClick={() => setActiveTab('narrative')}
                className={`px-2.5 py-2 font-semibold border-b-2 transition-all flex items-center whitespace-nowrap shrink-0 ${
                  activeTab === 'narrative'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Summary
              </button>

              <button
                onClick={() => setActiveTab('ai')}
                className={`px-2.5 py-2 font-bold border-b-2 transition-all flex items-center whitespace-nowrap shrink-0 ${
                  activeTab === 'ai'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-md'
                    : 'border-transparent text-indigo-600 hover:text-indigo-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500 fill-current animate-pulse" />
                AI Explainer
              </button>

              <button
                onClick={() => setActiveTab('fields')}
                className={`px-2.5 py-2 font-semibold border-b-2 transition-all flex items-center whitespace-nowrap shrink-0 ${
                  activeTab === 'fields'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Lock className="w-3.5 h-3.5 mr-1" />
                FLS ({analysisResult.fieldPermissions.length})
              </button>

              <button
                onClick={() => setActiveTab('sharing')}
                className={`px-2.5 py-2 font-semibold border-b-2 transition-all flex items-center whitespace-nowrap shrink-0 ${
                  activeTab === 'sharing'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Share2 className="w-3.5 h-3.5 mr-1" />
                Sharing ({analysisResult.sharingFindings.length})
              </button>

              <button
                onClick={() => setActiveTab('evidence')}
                className={`px-2.5 py-2 font-semibold border-b-2 transition-all flex items-center whitespace-nowrap shrink-0 ${
                  activeTab === 'evidence'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5 mr-1" />
                Evidence ({analysisResult.evidence.length})
              </button>

              <button
                onClick={() => setActiveTab('limitations')}
                className={`px-2.5 py-2 font-semibold border-b-2 transition-all flex items-center whitespace-nowrap shrink-0 ${
                  activeTab === 'limitations'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Limits ({analysisResult.limitations.length})
              </button>
            </div>

            {/* Tab Panels */}
            {activeTab === 'narrative' && (
              <div className="space-y-3">
                <SummaryCard result={analysisResult} />
              </div>
            )}

            {activeTab === 'ai' && (
              <AiExplainerTab result={analysisResult} />
            )}

            {activeTab === 'fields' && (
              <FieldPermissionsTable fields={analysisResult.fieldPermissions} />
            )}

            {activeTab === 'sharing' && (
              <SharingEvidenceList
                findings={analysisResult.sharingFindings}
                objectApiName={analysisResult.objectApiName}
              />
            )}

            {activeTab === 'evidence' && (
              <div className="space-y-2.5">
                {analysisResult.evidence.map((ev) => (
                  <EvidenceCard key={ev.id} evidence={ev} />
                ))}
              </div>
            )}

            {activeTab === 'limitations' && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Coverage & Platform Boundaries</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Per the ForceLens technical specification, we explicitly distinguish confirmed
                  Salesforce API results from unavailable evidence so that no false conclusions are drawn.
                </p>
                <ul className="space-y-2 text-xs">
                  {analysisResult.limitations.map((lim, idx) => (
                    <li key={idx} className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-lg text-amber-900 leading-relaxed">
                      <strong>Limitation {idx + 1}:</strong> {lim}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no analysis performed yet */}
        {!analysisResult && !isAnalyzing && (
          <div className="bg-white p-6 rounded-lg border border-dashed border-slate-300 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileSearch className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">
              Evidence-Backed Access Analysis
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              ForceLens independently checks effective record flags, object-level CRUD,
              field-level security, and sharing rows to explain why a user can or cannot see a record.
            </p>
          </div>
        )}
      </main>

      {/* Modals */}
      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onConnect={handleConnectOrg}
        onEnableMockMode={() => handleToggleMockMode(true)}
        onAutoConnected={() => {
          getOrgConnection().then((conn) => {
            if (conn) setConnection(conn);
          });
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isMockMode={isMockMode}
        onToggleMockMode={handleToggleMockMode}
      />

      <DiagnosticModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        result={analysisResult}
      />
    </div>
  );
};

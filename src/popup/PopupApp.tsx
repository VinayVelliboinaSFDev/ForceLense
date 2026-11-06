import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { RecordContextCard } from '../components/RecordContextCard';
import { ConnectModal } from '../components/ConnectModal';
import { SettingsModal } from '../components/SettingsModal';
import { SalesforceRecordContext, OrgConnection, OrgType } from '../types';
import { getOrgConnection, disconnectSession } from '../auth/token-store';
import { initiateOAuthFlow } from '../auth/oauth';
import { autoDetectSalesforceSession } from '../auth/salesforce-session';
import { ExternalLink, ShieldAlert, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { MOCK_ORG_CONNECTION, MOCK_RECORD_CONTEXT } from '../components/MockData';

export const PopupApp: React.FC = () => {
  const [connection, setConnection] = useState<OrgConnection | null>(null);
  const [recordContext, setRecordContext] = useState<SalesforceRecordContext | null>(null);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);

  useEffect(() => {
    // Automatically detect active Salesforce session from current tab (Salesforce Inspector style)
    autoDetectSalesforceSession().then((autoRes) => {
      if (autoRes) {
        setConnection(autoRes.connection);
      } else {
        getOrgConnection().then((conn) => {
          if (conn) setConnection(conn);
        });
      }
    });

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_RECORD_CONTEXT' }, (res) => {
        if (res?.context) {
          setRecordContext(res.context);
        }
      });
    }
  }, []);

  const handleOpenSidePanel = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
      window.close();
    }
  };

  const handleRefreshContext = () => {
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
    setIsMockMode(false);
  };

  const handleToggleMockMode = (enabled: boolean) => {
    setIsMockMode(enabled);
    if (enabled) {
      setConnection(MOCK_ORG_CONNECTION);
      setRecordContext(MOCK_RECORD_CONTEXT);
    } else {
      setConnection(null);
      setRecordContext(null);
    }
  };

  return (
    <div className="w-[380px] min-h-[460px] bg-slate-100 flex flex-col justify-between font-sans text-slate-800">
      <div>
        <Header
          connection={connection}
          onOpenConnect={() => setIsConnectOpen(true)}
          onDisconnect={handleDisconnect}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isPopup={true}
        />

        <div className="p-3 space-y-3">
          {/* Record Context */}
          <RecordContextCard
            context={recordContext}
            onRefresh={handleRefreshContext}
            onManualContextChange={(ctx) => setRecordContext(ctx)}
          />

          {/* Side Panel Prompt */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-lg p-4 shadow-sm space-y-2.5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Full Side Panel Analysis</h3>
                <p className="text-xs text-blue-100 mt-0.5 leading-snug">
                  Analyze effective permissions, object CRUD, FLS, and sharing rows side-by-side with Salesforce Lightning.
                </p>
              </div>
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0 ml-2" />
            </div>

            <button
              onClick={handleOpenSidePanel}
              className="w-full py-2 px-3 bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs rounded-md shadow flex items-center justify-center transition-colors"
            >
              Open ForceLens in Side Panel
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>

          {/* Quick status checklist */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Readiness Status
            </span>
            <div className="flex items-center space-x-2 text-slate-700">
              <CheckCircle2
                className={`w-4 h-4 ${connection ? 'text-emerald-600' : 'text-slate-300'}`}
              />
              <span>Salesforce Org: {connection ? connection.orgAlias : 'Not Connected'}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-700">
              <CheckCircle2
                className={`w-4 h-4 ${recordContext ? 'text-emerald-600' : 'text-slate-300'}`}
              />
              <span>
                Record Context: {recordContext ? `${recordContext.objectApiName} (${recordContext.recordId})` : 'None Detected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <footer className="p-2.5 bg-white border-t border-slate-200 text-center text-[10px] text-slate-400">
        ForceLens v1.0 • Read-Only • Open & Free Edition
      </footer>

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
    </div>
  );
};

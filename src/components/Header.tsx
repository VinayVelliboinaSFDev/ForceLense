import React from 'react';
import { Shield, Settings, LogOut, Link2, ExternalLink, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { OrgConnection } from '../types';

interface HeaderProps {
  connection: OrgConnection | null;
  onOpenConnect: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
  onOpenExport?: () => void;
  isPopup?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  connection,
  onOpenConnect,
  onDisconnect,
  onOpenSettings,
  onOpenExport,
  isPopup = false,
}) => {
  const handleOpenSidePanel = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
      window.close();
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-100">
          <Shield className="w-5 h-5 text-white stroke-[2.2]" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
              ForceLens
            </h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
              Free Open
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
            Salesforce Record Access Explainer
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-1.5">
        {connection ? (
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1 space-x-2">
            <span className="flex items-center text-xs font-medium text-emerald-700" title={connection.instanceUrl}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
              <span className="max-w-[120px] truncate">{connection.orgAlias || 'Connected'}</span>
            </span>
            <button
              onClick={onDisconnect}
              title="Disconnect Org"
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenConnect}
            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
          >
            <Link2 className="w-3.5 h-3.5 mr-1" />
            Connect
          </button>
        )}

        {onOpenExport && (
          <button
            onClick={onOpenExport}
            title="Export Diagnostic Summary"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            <FileText className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenSettings}
          title="Settings & Credentials"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>

        {isPopup && (
          <button
            onClick={handleOpenSidePanel}
            title="Open in Side Panel"
            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors ml-1"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};

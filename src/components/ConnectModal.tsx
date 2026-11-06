import React, { useState } from 'react';
import { X, Cloud, Key, Globe, Shield, ArrowRight, Loader2, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { OrgType } from '../types';
import { autoDetectSalesforceSession } from '../auth/salesforce-session';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (orgType: OrgType, customDomain?: string, clientId?: string) => Promise<void>;
  onEnableMockMode: () => void;
  onAutoConnected?: () => void;
  initialClientId?: string;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onEnableMockMode,
  onAutoConnected,
  initialClientId = '',
}) => {
  const [orgType, setOrgType] = useState<OrgType>('production');
  const [customDomain, setCustomDomain] = useState('');
  const [clientId, setClientId] = useState(initialClientId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAutoConnect = async () => {
    setError(null);
    setIsAutoConnecting(true);
    try {
      const res = await autoDetectSalesforceSession();
      if (res) {
        if (onAutoConnected) onAutoConnected();
        onClose();
      } else {
        setError('No active Salesforce session detected in open browser tabs. Please ensure you are logged into Salesforce in a tab.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Auto-connection failed');
    } finally {
      setIsAutoConnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onConnect(orgType, customDomain, clientId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authorization failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Connect Salesforce Org</h3>
              <p className="text-[11px] text-slate-500 font-medium">Automatic Tab Connection • Or OAuth 2.0 PKCE</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
              <strong>Connection Notice:</strong> {error}
            </div>
          )}

          {/* Quick Automatic Connection Box (Salesforce Inspector Style) */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/90 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-bold text-slate-900 flex items-center text-xs">
                  <Zap className="w-4 h-4 text-amber-500 mr-1.5 fill-current" />
                  Auto-Connect from Open Tab
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-normal">
                  Connect instantly using your logged-in session in the active Salesforce tab (Salesforce Inspector mode).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAutoConnect}
              disabled={isAutoConnecting}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md shadow-sm flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {isAutoConnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Detecting Active Session...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Connect from Active Salesforce Tab
                </>
              )}
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Or Connect via Connected App
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Org Type Selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Org Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOrgType('production')}
                  className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                    orgType === 'production'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Production / Dev</div>
                  <div className="text-[9px] text-slate-400">login.salesforce.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => setOrgType('sandbox')}
                  className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                    orgType === 'sandbox'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Sandbox</div>
                  <div className="text-[9px] text-slate-400">test.salesforce.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => setOrgType('custom')}
                  className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                    orgType === 'custom'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Custom Domain</div>
                  <div className="text-[9px] text-slate-400">My Domain login</div>
                </button>
              </div>
            </div>

            {/* Custom Domain Input */}
            {orgType === 'custom' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Custom My Domain URL
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="https://yourcompany.my.salesforce.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                    required
                  />
                </div>
              </div>
            )}

            {/* Client ID Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-700">
                  Consumer Key (Client ID)
                </label>
                <span className="text-[10px] text-slate-400 font-mono">External Client App</span>
              </div>
              <div className="relative">
                <Key className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Paste Consumer Key / Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  onEnableMockMode();
                  onClose();
                }}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center py-1 px-2 rounded hover:bg-blue-50 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Demo Mode
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3.5 py-1.5 font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-md shadow-sm disabled:opacity-50 flex items-center transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect via OAuth
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

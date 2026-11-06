import React, { useState } from 'react';
import { X, Cloud, Key, Globe, Shield, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { OrgType } from '../types';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (orgType: OrgType, customDomain?: string, clientId?: string) => Promise<void>;
  onEnableMockMode: () => void;
  initialClientId?: string;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onEnableMockMode,
  initialClientId = '',
}) => {
  const [orgType, setOrgType] = useState<OrgType>('production');
  const [customDomain, setCustomDomain] = useState('');
  const [clientId, setClientId] = useState(initialClientId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
              <p className="text-[11px] text-slate-500 font-medium">OAuth 2.0 PKCE • Read-Only • No Secret</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
              <strong>Connection Error:</strong> {error}
            </div>
          )}

          {/* Org Type Selection */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Select Org Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOrgType('production')}
                className={`py-2 px-2.5 rounded-lg border text-center font-medium transition-all ${
                  orgType === 'production'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-800 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs">Production / Dev</div>
                <div className="text-[10px] text-slate-400 mt-0.5">login.salesforce.com</div>
              </button>

              <button
                type="button"
                onClick={() => setOrgType('sandbox')}
                className={`py-2 px-2.5 rounded-lg border text-center font-medium transition-all ${
                  orgType === 'sandbox'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-800 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs">Sandbox</div>
                <div className="text-[10px] text-slate-400 mt-0.5">test.salesforce.com</div>
              </button>

              <button
                type="button"
                onClick={() => setOrgType('custom')}
                className={`py-2 px-2.5 rounded-lg border text-center font-medium transition-all ${
                  orgType === 'custom'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-800 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs">Custom Domain</div>
                <div className="text-[10px] text-slate-400 mt-0.5">My Domain login</div>
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
                Connected App Consumer Key (Client ID)
              </label>
              <span className="text-[10px] text-slate-400 font-mono">External Client App</span>
            </div>
            <div className="relative">
              <Key className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Paste Salesforce Consumer Key / Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Uses PKCE flow with browser redirect. No client secret is ever required or stored.
            </p>
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
              Explore Demo Mode
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 flex items-center transition-colors"
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
  );
};

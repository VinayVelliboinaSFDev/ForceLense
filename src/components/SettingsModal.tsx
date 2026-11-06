import React, { useState, useEffect } from 'react';
import { X, Settings, Key, Copy, Check, Info, Trash2, Sparkles } from 'lucide-react';
import { getClientConfig, saveClientConfig, DEFAULT_API_VERSION, disconnectSession } from '../auth/token-store';
import { getRedirectUri } from '../auth/oauth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMockMode: boolean;
  onToggleMockMode: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isMockMode,
  onToggleMockMode,
}) => {
  const [clientId, setClientId] = useState('');
  const [apiVersion, setApiVersion] = useState(DEFAULT_API_VERSION);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const redirectUri = getRedirectUri();

  useEffect(() => {
    getClientConfig().then((cfg) => {
      setClientId(cfg.clientId || '');
      setApiVersion(cfg.apiVersion || DEFAULT_API_VERSION);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveClientConfig({
      clientId: clientId.trim(),
      apiVersion: apiVersion.trim() || DEFAULT_API_VERSION,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  const handleResetData = async () => {
    if (confirm('Are you sure you want to disconnect and clear stored tokens and settings?')) {
      await disconnectSession();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Settings & OAuth Configuration</h3>
              <p className="text-[11px] text-slate-500 font-medium">Salesforce External Client App Parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs flex items-center">
              <Check className="w-4 h-4 mr-1 text-emerald-600" />
              Settings saved successfully!
            </div>
          )}

          {/* Chrome Redirect URI Box */}
          <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-blue-900 flex items-center">
                <Info className="w-3.5 h-3.5 mr-1 text-blue-600" />
                OAuth Callback URL (Redirect URI)
              </span>
              <button
                type="button"
                onClick={handleCopyRedirect}
                className="text-blue-700 hover:text-blue-900 text-[11px] font-semibold flex items-center"
              >
                {copiedRedirect ? <Check className="w-3 h-3 mr-0.5 text-emerald-600" /> : <Copy className="w-3 h-3 mr-0.5" />}
                Copy URL
              </button>
            </div>
            <div className="p-1.5 bg-white border border-blue-200 rounded text-[11px] font-mono text-slate-700 break-all select-all">
              {redirectUri}
            </div>
            <p className="text-[10px] text-blue-800 mt-1.5 leading-normal">
              Add this callback URL to your Salesforce External Client App or Connected App OAuth settings.
            </p>
          </div>

          {/* Client ID */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Salesforce Client ID (Consumer Key)
            </label>
            <div className="relative">
              <Key className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="External Client App Consumer Key"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* API Version */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Salesforce REST API Version
            </label>
            <input
              type="text"
              placeholder="v60.0"
              value={apiVersion}
              onChange={(e) => setApiVersion(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-xs"
            />
          </div>

          {/* Mock Mode Toggle */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 flex items-center text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Demo / Sample Data Mode
              </span>
              <p className="text-[10px] text-slate-500">
                Explore ForceLens with simulated Case and permissions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleMockMode(!isMockMode)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isMockMode ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isMockMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetData}
              className="text-red-600 hover:text-red-800 text-xs font-medium flex items-center"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Reset All Stored Data
            </button>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

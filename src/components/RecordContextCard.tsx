import React, { useState } from 'react';
import { Database, Copy, Check, ExternalLink, RefreshCw, Edit3, ArrowRight } from 'lucide-react';
import { SalesforceRecordContext } from '../types';

interface RecordContextCardProps {
  context: SalesforceRecordContext | null;
  onRefresh: () => void;
  onManualContextChange: (ctx: SalesforceRecordContext) => void;
}

export const RecordContextCard: React.FC<RecordContextCardProps> = ({
  context,
  onRefresh,
  onManualContextChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [manualRecordId, setManualRecordId] = useState(context?.recordId || '');
  const [manualObject, setManualObject] = useState(context?.objectApiName || '');

  const handleCopyId = () => {
    if (context?.recordId) {
      navigator.clipboard.writeText(context.recordId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRecordId.trim()) return;

    const cleanId = manualRecordId.trim();
    const cleanObj = manualObject.trim() || 'Record';

    onManualContextChange({
      recordId: cleanId,
      objectApiName: cleanObj,
      url: `https://lightning.force.com/lightning/r/${cleanObj}/${cleanId}/view`,
      recordName: `Manual Record (${cleanId})`,
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Record Context
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[11px] text-slate-500 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-slate-100 flex items-center transition-colors"
            title="Specify or override record ID manually"
          >
            <Edit3 className="w-3 h-3 mr-1" />
            {isEditing ? 'Cancel' : 'Change'}
          </button>
          <button
            onClick={onRefresh}
            className="text-[11px] text-slate-500 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-slate-100 flex items-center transition-colors"
            title="Re-detect from active browser tab"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleApplyManual} className="space-y-2 mt-2 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              Salesforce Record ID (15 or 18 chars)
            </label>
            <input
              type="text"
              placeholder="e.g. 5007Q00000abc12345"
              value={manualRecordId}
              onChange={(e) => setManualRecordId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              Object API Name
            </label>
            <input
              type="text"
              placeholder="e.g. Case, Account, Custom_Object__c"
              value={manualObject}
              onChange={(e) => setManualObject(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded flex items-center"
            >
              Apply Context
              <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>
        </form>
      ) : context ? (
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
              {context.objectApiName}
            </span>
            <div className="flex items-center bg-slate-100 rounded px-2 py-0.5 font-mono text-[11px] text-slate-700 space-x-1.5">
              <span>{context.recordId}</span>
              <button
                onClick={handleCopyId}
                title="Copy Record ID"
                className="text-slate-400 hover:text-slate-700"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            {context.url && (
              <a
                href={context.url}
                target="_blank"
                rel="noreferrer"
                title="Open in Salesforce"
                className="text-slate-400 hover:text-blue-600 ml-auto"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {context.recordName && (
            <p className="text-xs font-medium text-slate-800 line-clamp-2">
              {context.recordName}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-3 bg-slate-50 rounded border border-dashed border-slate-200">
          <p className="text-xs text-slate-500 font-medium">
            No active Salesforce record detected.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Open a Lightning record page, or click <strong>Change</strong> above to enter manually.
          </p>
        </div>
      )}
    </div>
  );
};

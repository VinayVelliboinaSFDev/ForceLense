import React, { useState } from 'react';
import {
  CheckCircle2,
  Info,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
} from 'lucide-react';
import { EvidenceItem, EvidenceStatus } from '../types';

interface EvidenceCardProps {
  evidence: EvidenceItem;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = (status: EvidenceStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Confirmed
          </span>
        );
      case 'supported':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3 h-3 mr-1 text-blue-600" />
            Supported
          </span>
        );
      case 'possible':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
            Possible
          </span>
        );
      case 'unavailable':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3 h-3 mr-1 text-slate-500" />
            Unavailable
          </span>
        );
      case 'unknown':
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <HelpCircle className="w-3 h-3 mr-1 text-slate-400" />
            Unknown
          </span>
        );
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'record':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'object':
        return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      case 'field':
        return 'text-teal-700 bg-teal-50 border-teal-200';
      case 'sharing':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'restriction':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${getCategoryColor(
              evidence.category
            )}`}
          >
            {evidence.category}
          </span>
          {getStatusBadge(evidence.status)}
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {evidence.source}
          </span>
        </div>
        <div className="flex items-center text-[10px] text-slate-400 shrink-0">
          <Clock className="w-2.5 h-2.5 mr-1" />
          {new Date(evidence.retrievedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <h4 className="text-xs font-bold text-slate-900 mt-1 mb-1">
        {evidence.title}
      </h4>

      <p className="text-xs text-slate-600 leading-relaxed">
        {evidence.explanation}
      </p>

      {evidence.limitation && (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200/60 rounded text-[11px] text-amber-900">
          <strong>Limitation:</strong> {evidence.limitation}
        </div>
      )}

      {evidence.details && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center transition-colors"
          >
            <Code2 className="w-3 h-3 mr-1" />
            {expanded ? 'Hide Evidence Details' : 'View Raw Evidence Payload'}
            {expanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>
          {expanded && (
            <pre className="mt-1.5 p-2 bg-slate-900 text-emerald-400 text-[10px] font-mono rounded overflow-x-auto max-h-48">
              {JSON.stringify(evidence.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Shield,
  Key,
  Lock,
  AlertTriangle,
  Wrench,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { AnalysisResult } from '../types';
import { generateNarrativeSummary } from '../analyzers/narrative-generator';

interface NarrativeSummaryCardProps {
  result: AnalysisResult;
  onOpenAiTab?: () => void;
}

export const NarrativeSummaryCard: React.FC<NarrativeSummaryCardProps> = ({
  result,
  onOpenAiTab,
}) => {
  const [showRemediation, setShowRemediation] = useState(false);
  const narrative = generateNarrativeSummary(result);

  const getBadge = () => {
    switch (narrative.badgeType) {
      case 'granted':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Access Granted
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Partial / Read-Only
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Access Denied
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <HelpCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Inconclusive
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Header Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/20 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-0.5">
              Access Verdict & Origin Analysis
            </span>
            <h3 className="text-sm font-bold text-slate-900 leading-snug">
              {narrative.headline}
            </h3>
          </div>
          <div className="shrink-0">{getBadge()}</div>
        </div>
      </div>

      {/* Breakdown: How & Where It Came From */}
      <div className="p-4 space-y-3 text-xs">
        {/* Grant Source */}
        <div className="flex items-start space-x-2.5">
          <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 shrink-0 mt-0.5">
            <Key className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-slate-800 block text-[11px]">
              How Access is Granted (Sharing & Origin)
            </span>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              {narrative.grantSourceSummary}
            </p>
          </div>
        </div>

        {/* Object CRUD */}
        <div className="flex items-start space-x-2.5">
          <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 shrink-0 mt-0.5">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-slate-800 block text-[11px]">
              Where CRUD Permissions Originate
            </span>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              {narrative.objectCrudSummary}
            </p>
          </div>
        </div>

        {/* Field-Level Security */}
        <div className="flex items-start space-x-2.5">
          <div className="p-1.5 rounded-md bg-teal-50 text-teal-600 shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-slate-800 block text-[11px]">
              Field-Level Security (FLS) Impact
            </span>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              {narrative.flsSummary}
            </p>
          </div>
        </div>

        {/* Key Blocker Highlight (if user has object edit but record edit is denied) */}
        {narrative.blockerSummary && (
          <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-lg flex items-start space-x-2 text-[11px] text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Permission Discrepancy:</strong>
              <p className="mt-0.5 leading-relaxed">{narrative.blockerSummary}</p>
            </div>
          </div>
        )}

        {/* Actionable Remediation Accordion */}
        {narrative.remediationSuggestions.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowRemediation(!showRemediation)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-slate-700 hover:text-blue-600 py-1 transition-colors"
            >
              <span className="flex items-center">
                <Wrench className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                How an Administrator Can Grant / Fix Access ({narrative.remediationSuggestions.length} tips)
              </span>
              {showRemediation ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showRemediation && (
              <ul className="mt-2 space-y-1.5 pl-2">
                {narrative.remediationSuggestions.map((tip, idx) => (
                  <li
                    key={idx}
                    className="p-2 bg-slate-50 border border-slate-200/70 rounded-md text-[11px] text-slate-700 leading-normal"
                  >
                    <strong>Step {idx + 1}:</strong> {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Fast Trigger to AI Explainer */}
        {onOpenAiTab && (
          <div className="pt-2">
            <button
              onClick={onOpenAiTab}
              className="w-full py-1.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-[11px] rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Ask AI (ChatGPT / Claude / Copilot) for Deeper Security Analysis</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

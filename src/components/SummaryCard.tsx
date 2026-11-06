import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Layers, ShieldCheck, Lock } from 'lucide-react';
import { AnalysisResult } from '../types';

interface SummaryCardProps {
  result: AnalysisResult;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ result }) => {
  const recAccess = result.recordAccess;
  const objPerm = result.objectPermissions;

  const renderStatusPill = (status: boolean | 'unknown' | undefined, label: string) => {
    if (status === true) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
          {label}: Yes
        </span>
      );
    }
    if (status === false) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600 shrink-0" />
          {label}: No
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <HelpCircle className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />
        {label}: Unknown
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm space-y-3">
      {/* Top Banner: Effective Access Summary */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Effective Record Access
          </span>
          <span className="text-xs font-medium text-slate-700">
            Target User: <strong className="text-slate-900">{result.targetUserName}</strong>
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-medium text-slate-500 block">Max Access Level</span>
          <span className="text-xs font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {recAccess?.maxAccessLevel || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Access Pills Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 p-2 rounded-md border border-slate-100 text-center">
          <span className="text-[10px] text-slate-500 font-medium block mb-1">RECORD READ</span>
          {renderStatusPill(recAccess?.read, 'Read')}
        </div>
        <div className="bg-slate-50 p-2 rounded-md border border-slate-100 text-center">
          <span className="text-[10px] text-slate-500 font-medium block mb-1">RECORD EDIT</span>
          {renderStatusPill(recAccess?.edit, 'Edit')}
        </div>
        <div className="bg-slate-50 p-2 rounded-md border border-slate-100 text-center">
          <span className="text-[10px] text-slate-500 font-medium block mb-1">RECORD DELETE</span>
          {renderStatusPill(recAccess?.delete, 'Delete')}
        </div>
      </div>

      {/* Object CRUD & Field Summary Grid */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
        <div className="bg-slate-50/70 p-2 rounded border border-slate-200/60">
          <span className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider mb-1 flex items-center">
            <ShieldCheck className="w-3 h-3 mr-1 text-blue-600" />
            Object CRUD ({result.objectApiName})
          </span>
          <div className="flex flex-wrap gap-1 font-mono text-[10px]">
            <span className={`px-1.5 py-0.2 rounded font-semibold ${objPerm.read ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
              R:{objPerm.read ? 'Y' : 'N'}
            </span>
            <span className={`px-1.5 py-0.2 rounded font-semibold ${objPerm.create ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
              C:{objPerm.create ? 'Y' : 'N'}
            </span>
            <span className={`px-1.5 py-0.2 rounded font-semibold ${objPerm.edit ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
              E:{objPerm.edit ? 'Y' : 'N'}
            </span>
            <span className={`px-1.5 py-0.2 rounded font-semibold ${objPerm.delete ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
              D:{objPerm.delete ? 'Y' : 'N'}
            </span>
            {(objPerm.viewAll || objPerm.modifyAll) && (
              <span className="px-1.5 py-0.2 rounded font-semibold bg-purple-100 text-purple-800">
                {objPerm.modifyAll ? 'ModifyAll' : 'ViewAll'}
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-50/70 p-2 rounded border border-slate-200/60">
          <span className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider mb-1 flex items-center">
            <Lock className="w-3 h-3 mr-1 text-slate-600" />
            Field-Level Security (FLS)
          </span>
          <div className="text-[11px] text-slate-700">
            <span className="font-semibold text-emerald-700">
              {result.fieldPermissions.filter((f) => f.readable === true).length}
            </span>
            {' / '}
            <span className="text-slate-500">{result.fieldPermissions.length}</span> fields readable
            <div className="text-[10px] text-slate-500">
              ({result.fieldPermissions.filter((f) => f.editable === true).length} editable)
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Bar */}
      <div className="flex items-center justify-between bg-blue-50/50 px-2.5 py-1.5 rounded border border-blue-100 text-[11px]">
        <div className="flex items-center space-x-1.5 text-blue-900 font-medium">
          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Evidence Coverage:</span>
          <span className="font-bold text-blue-800">
            {result.coverage.completed.length} sources evaluated
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
            result.overallStatus === 'complete'
              ? 'bg-emerald-100 text-emerald-800'
              : result.overallStatus === 'partial'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {result.overallStatus} Analysis
        </span>
      </div>
    </div>
  );
};

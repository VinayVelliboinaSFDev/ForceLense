import React from 'react';
import { UserCheck, Users, GitBranch, Shield, KeyRound, AlertCircle } from 'lucide-react';
import { SharingFinding } from '../types';

interface SharingEvidenceListProps {
  findings: SharingFinding[];
  objectApiName: string;
}

export const SharingEvidenceList: React.FC<SharingEvidenceListProps> = ({
  findings,
  objectApiName,
}) => {
  const getIcon = (type: SharingFinding['type']) => {
    switch (type) {
      case 'ownership':
        return <UserCheck className="w-4 h-4 text-emerald-600" />;
      case 'share_row':
        return <KeyRound className="w-4 h-4 text-blue-600" />;
      case 'group':
        return <Users className="w-4 h-4 text-purple-600" />;
      case 'hierarchy':
      case 'role':
        return <GitBranch className="w-4 h-4 text-amber-600" />;
      default:
        return <Shield className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-3">
      {findings.length > 0 ? (
        findings.map((f, idx) => (
          <div
            key={idx}
            className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <div className="p-1.5 rounded-md bg-slate-100 shrink-0 mt-0.5">
                  {getIcon(f.type)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{f.label}</h4>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                    <span>Access: <strong className="text-slate-800">{f.accessLevel}</strong></span>
                    {f.rowCause && <span>• RowCause: <strong className="text-slate-800">{f.rowCause}</strong></span>}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    Source: {f.source}
                  </div>

                  {f.path && f.path.length > 0 && (
                    <div className="mt-2 bg-slate-50 p-2 rounded border border-slate-100 text-[11px]">
                      <span className="font-semibold text-slate-700 block mb-1">
                        Resolved Membership Path:
                      </span>
                      <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-slate-600">
                        {f.path.map((segment, pIdx) => (
                          <React.Fragment key={pIdx}>
                            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {segment}
                            </span>
                            {pIdx < f.path!.length - 1 && <span className="text-slate-400">→</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                {f.status}
              </span>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200 text-center">
          <AlertCircle className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs font-medium text-slate-700">No explicit share rows found.</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Record visibility for {objectApiName} may be granted via Organization-Wide Defaults,
            Role Hierarchy, or System Administrator permissions.
          </p>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Search,
  Key,
  Shield,
  Lock,
  Loader2,
  GitCompare,
} from 'lucide-react';
import { AnalysisResult, TargetUser } from '../types';

interface UserDiffViewProps {
  userA: TargetUser;
  resultA: AnalysisResult;
  userB: TargetUser | null;
  resultB: AnalysisResult | null;
  candidateUsers: TargetUser[];
  onSelectUserB: (user: TargetUser) => void;
  isLoadingB: boolean;
}

export const UserDiffView: React.FC<UserDiffViewProps> = ({
  userA,
  resultA,
  userB,
  resultB,
  candidateUsers,
  onSelectUserB,
  isLoadingB,
}) => {
  const [onlyDiffs, setOnlyDiffs] = useState(true);
  const [flsSearch, setFlsSearch] = useState('');

  const canReadA = resultA.recordAccess?.read === true;
  const canEditA = resultA.recordAccess?.edit === true;
  const canDeleteA = resultA.recordAccess?.delete === true;

  const canReadB = resultB?.recordAccess?.read === true;
  const canEditB = resultB?.recordAccess?.edit === true;
  const canDeleteB = resultB?.recordAccess?.delete === true;

  // Compare Field Permissions
  const allFieldKeys = Array.from(
    new Set([
      ...resultA.fieldPermissions.map((f) => f.fieldApiName),
      ...(resultB?.fieldPermissions || []).map((f) => f.fieldApiName),
    ])
  );

  const fieldDiffs = allFieldKeys.map((apiName) => {
    const fA = resultA.fieldPermissions.find((f) => f.fieldApiName === apiName);
    const fB = resultB?.fieldPermissions.find((f) => f.fieldApiName === apiName);

    const readA = fA?.readable ?? 'unknown';
    const readB = fB?.readable ?? 'unknown';
    const editA = fA?.editable ?? 'unknown';
    const editB = fB?.editable ?? 'unknown';

    const hasDiff = readA !== readB || editA !== editB;

    return {
      fieldApiName: apiName,
      label: fA?.label || fB?.label || apiName,
      readA,
      readB,
      editA,
      editB,
      sourceA: fA?.source,
      sourceB: fB?.source,
      hasDiff,
    };
  });

  const filteredFields = fieldDiffs.filter((f) => {
    if (onlyDiffs && !f.hasDiff) return false;
    if (flsSearch) {
      const q = flsSearch.toLowerCase();
      return f.fieldApiName.toLowerCase().includes(q) || f.label.toLowerCase().includes(q);
    }
    return true;
  });

  const renderStatus = (val: boolean | 'unknown' | undefined) => {
    if (val === true) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3 mr-0.5 text-emerald-600" /> Yes
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
          <XCircle className="w-3 h-3 mr-0.5 text-rose-600" /> No
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
        <HelpCircle className="w-3 h-3 mr-0.5 text-slate-400" /> ?
      </span>
    );
  };

  return (
    <div className="space-y-3 text-xs">
      {/* 1. Compare Header & User Selector Bar */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 rounded-xl shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitCompare className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-xs">User Access Diff Mode</h3>
          </div>
          <span className="text-[10px] bg-indigo-800/80 text-blue-200 px-2 py-0.5 rounded-full font-semibold">
            Side-by-Side Comparison
          </span>
        </div>

        {/* User Comparison Grid */}
        <div className="grid grid-cols-2 gap-2 text-slate-900">
          {/* User A Card */}
          <div className="p-2.5 rounded-lg bg-white/95 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
              Base User (User A)
            </span>
            <div className="font-bold text-xs truncate">{userA.name}</div>
            <div className="text-[10px] text-slate-500 truncate">
              {userA.profileName || 'Profile'} · {userA.userRoleName || 'No Role'}
            </div>
          </div>

          {/* User B Card / Selector */}
          <div className="p-2.5 rounded-lg bg-white/95 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-purple-700 block tracking-wider">
                Compare With (User B)
              </span>
              {isLoadingB && <Loader2 className="w-3 h-3 text-purple-600 animate-spin" />}
            </div>

            <select
              value={userB?.id || ''}
              onChange={(e) => {
                const found = candidateUsers.find((u) => u.id === e.target.value);
                if (found) onSelectUserB(found);
              }}
              className="w-full text-xs font-bold text-slate-900 bg-purple-50/50 border border-purple-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="" disabled>
                Select User to compare...
              </option>
              {candidateUsers
                .filter((u) => u.id !== userA.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.profileName})
                  </option>
                ))}
            </select>

            {userB && (
              <div className="text-[10px] text-slate-500 truncate">
                {userB.profileName || 'Profile'} · {userB.userRoleName || 'No Role'}
              </div>
            )}
          </div>
        </div>
      </div>

      {!userB ? (
        <div className="p-6 bg-white rounded-xl border border-slate-200 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="font-bold text-xs text-slate-800">Choose a Second User to Diff</h4>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            Select another user in the dropdown above to run a side-by-side access and permission comparison on this record.
          </p>
        </div>
      ) : isLoadingB ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-2">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
          <span className="text-xs font-semibold text-slate-700 block">
            Analyzing permissions for {userB.name}...
          </span>
        </div>
      ) : resultB ? (
        <div className="space-y-3">
          {/* 2. Effective Record Access Verdict Comparison Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Shield className="w-3.5 h-3.5 text-blue-600 mr-1.5" />
                Record Access Verdict Comparison
              </span>
              <span className="text-[10px] text-slate-500">Effective Permissions</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                <tr>
                  <th className="px-3 py-2">Capability</th>
                  <th className="px-3 py-2 text-center text-blue-800">{userA.name}</th>
                  <th className="px-3 py-2 text-center text-purple-800">{userB.name}</th>
                  <th className="px-3 py-2 text-center">Diff Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Read */}
                <tr className={canReadA !== canReadB ? 'bg-amber-50/60 font-semibold' : ''}>
                  <td className="px-3 py-2 font-medium">Record Read</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canReadA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canReadB)}</td>
                  <td className="px-3 py-2 text-center">
                    {canReadA === canReadB ? (
                      <span className="text-[10px] text-slate-400">Match</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Discrepancy
                      </span>
                    )}
                  </td>
                </tr>

                {/* Edit */}
                <tr className={canEditA !== canEditB ? 'bg-amber-50/60 font-semibold' : ''}>
                  <td className="px-3 py-2 font-medium">Record Edit</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canEditA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canEditB)}</td>
                  <td className="px-3 py-2 text-center">
                    {canEditA === canEditB ? (
                      <span className="text-[10px] text-slate-400">Match</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Discrepancy
                      </span>
                    )}
                  </td>
                </tr>

                {/* Delete */}
                <tr className={canDeleteA !== canDeleteB ? 'bg-amber-50/60 font-semibold' : ''}>
                  <td className="px-3 py-2 font-medium">Record Delete</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canDeleteA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canDeleteB)}</td>
                  <td className="px-3 py-2 text-center">
                    {canDeleteA === canDeleteB ? (
                      <span className="text-[10px] text-slate-400">Match</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Discrepancy
                      </span>
                    )}
                  </td>
                </tr>

                {/* Max Access Level */}
                <tr className="bg-slate-50/50">
                  <td className="px-3 py-2 font-medium">Max Access Level</td>
                  <td className="px-3 py-2 text-center font-bold text-blue-700 font-mono text-[11px]">
                    {resultA.recordAccess?.maxAccessLevel || 'Unknown'}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-purple-700 font-mono text-[11px]">
                    {resultB.recordAccess?.maxAccessLevel || 'Unknown'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {resultA.recordAccess?.maxAccessLevel === resultB.recordAccess?.maxAccessLevel ? (
                      <span className="text-[10px] text-slate-400">Match</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        Diff
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. Object-Level CRUD Comparison */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Key className="w-3.5 h-3.5 text-indigo-600 mr-1.5" />
                Object CRUD Permissions ({resultA.objectApiName})
              </span>
              <span className="text-[10px] text-slate-500">Profile / PermSet Level</span>
            </div>

            <div className="grid grid-cols-6 divide-x divide-slate-100 text-center py-2 text-[11px]">
              {(['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'] as const).map((action) => {
                const valA = resultA.objectPermissions[action];
                const valB = resultB.objectPermissions[action];
                const isDiff = valA !== valB;
                return (
                  <div key={action} className={`p-1 space-y-1 ${isDiff ? 'bg-amber-50/50' : ''}`}>
                    <span className="block font-bold text-[10px] text-slate-600 uppercase">
                      {action}
                    </span>
                    <div className="text-[10px] text-blue-700 font-semibold">{valA ? 'Yes' : 'No'}</div>
                    <div className="text-[10px] text-purple-700 font-semibold">{valB ? 'Yes' : 'No'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Sharing Findings Comparison */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
            <span className="font-bold text-[11px] text-slate-800 block">
              Sharing Row Grants Comparison
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-blue-50/60 border border-blue-100 space-y-1">
                <span className="font-bold text-blue-900 block text-[10px]">{userA.name} Grants:</span>
                {resultA.sharingFindings.length > 0 ? (
                  resultA.sharingFindings.map((f, i) => (
                    <div key={i} className="text-[10px] text-slate-700 font-medium">
                      • {f.label} ({f.accessLevel})
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-400">No share rows found</div>
                )}
              </div>

              <div className="p-2 rounded bg-purple-50/60 border border-purple-100 space-y-1">
                <span className="font-bold text-purple-900 block text-[10px]">{userB.name} Grants:</span>
                {resultB.sharingFindings.length > 0 ? (
                  resultB.sharingFindings.map((f, i) => (
                    <div key={i} className="text-[10px] text-slate-700 font-medium">
                      • {f.label} ({f.accessLevel})
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-400">No share rows found</div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Field-Level Security (FLS) Discrepancy Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Lock className="w-3.5 h-3.5 text-teal-600 mr-1.5" />
                Field-Level Security (FLS) Diff ({filteredFields.length})
              </span>
              <button
                onClick={() => setOnlyDiffs(!onlyDiffs)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  onlyDiffs
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {onlyDiffs ? 'Showing Only Differences' : 'Showing All Fields'}
              </button>
            </div>

            <div className="p-2 bg-slate-50/60 border-b border-slate-200">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter fields..."
                  value={flsSearch}
                  onChange={(e) => setFlsSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 text-[11px] border border-slate-300 rounded bg-white"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5">Field</th>
                    <th className="px-2 py-1.5 text-center text-blue-800">{userA.name} Read/Edit</th>
                    <th className="px-2 py-1.5 text-center text-purple-800">{userB.name} Read/Edit</th>
                    <th className="px-2 py-1.5 text-center">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFields.length > 0 ? (
                    filteredFields.map((f) => (
                      <tr key={f.fieldApiName} className={f.hasDiff ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-1.5">
                          <div className="font-semibold text-slate-900 text-[11px]">{f.label}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{f.fieldApiName}</div>
                        </td>
                        <td className="px-2 py-1.5 text-center text-[10px]">
                          R: {f.readA ? 'Yes' : 'No'} | E: {f.editA ? 'Yes' : 'No'}
                        </td>
                        <td className="px-2 py-1.5 text-center text-[10px]">
                          R: {f.readB ? 'Yes' : 'No'} | E: {f.editB ? 'Yes' : 'No'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {f.hasDiff ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Diff
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400">Same</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-[11px] text-slate-400">
                        {onlyDiffs
                          ? 'No permission differences found between User A and User B on any field!'
                          : 'No fields match your search filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

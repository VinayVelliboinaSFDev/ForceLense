import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Filter,
  Search,
  Key,
  Shield,
  Lock,
  Loader2,
  GitCompare,
  X,
  UserCheck,
  Info,
} from 'lucide-react';
import { AnalysisResult, TargetUser } from '../types';
import { sfApi } from '../salesforce/api-client';
import { MOCK_TARGET_USERS } from './MockData';

interface UserDiffViewProps {
  userA: TargetUser;
  resultA: AnalysisResult;
  userB: TargetUser | null;
  resultB: AnalysisResult | null;
  candidateUsers: TargetUser[];
  onSelectUserB: (user: TargetUser) => void;
  isLoadingB: boolean;
  isMockMode?: boolean;
}

export const UserDiffView: React.FC<UserDiffViewProps> = ({
  userA,
  resultA,
  userB,
  resultB,
  candidateUsers,
  onSelectUserB,
  isLoadingB,
  isMockMode = false,
}) => {
  // Search state for User B
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TargetUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditingUserB, setIsEditingUserB] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // FLS Diff view states
  const [filterMode, setFilterMode] = useState<'diff' | 'all' | 'userA' | 'userB'>('diff');
  const [flsSearch, setFlsSearch] = useState('');

  // Auto focus search input when entering edit mode
  useEffect(() => {
    if (isEditingUserB && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isEditingUserB]);

  // Debounced live user search for User B
  useEffect(() => {
    if (!searchTerm.trim()) {
      // When empty, show candidate users excluding User A
      const candidates = (candidateUsers.length > 0 ? candidateUsers : MOCK_TARGET_USERS).filter(
        (u) => u.id !== userA.id
      );
      setSearchResults(candidates);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (isMockMode) {
          const lower = searchTerm.toLowerCase();
          const filtered = MOCK_TARGET_USERS.filter(
            (u) =>
              u.id !== userA.id &&
              (u.name.toLowerCase().includes(lower) ||
                u.username.toLowerCase().includes(lower) ||
                u.id.toLowerCase().includes(lower) ||
                u.profileName.toLowerCase().includes(lower))
          );
          setSearchResults(filtered);
        } else {
          const remoteUsers = await sfApi.searchUsers(searchTerm);
          setSearchResults(remoteUsers.filter((u) => u.id !== userA.id));
        }
      } catch {
        const lower = searchTerm.toLowerCase();
        const fallback = (candidateUsers.length > 0 ? candidateUsers : MOCK_TARGET_USERS).filter(
          (u) =>
            u.id !== userA.id &&
            (u.name.toLowerCase().includes(lower) ||
              u.username.toLowerCase().includes(lower) ||
              u.profileName.toLowerCase().includes(lower))
        );
        setSearchResults(fallback);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, isMockMode, candidateUsers, userA.id]);

  // Click outside to close dropdown and exit editing mode if userB already selected
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        if (userB) {
          setIsEditingUserB(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userB]);

  // Strict boolean resolution (avoids truthy 'unknown' bug)
  const canReadA = resultA.recordAccess?.read === true;
  const canEditA = resultA.recordAccess?.edit === true;
  const canDeleteA = resultA.recordAccess?.delete === true;
  const canTransferA = resultA.recordAccess?.transfer === true;

  const canReadB = resultB?.recordAccess?.read === true;
  const canEditB = resultB?.recordAccess?.edit === true;
  const canDeleteB = resultB?.recordAccess?.delete === true;
  const canTransferB = resultB?.recordAccess?.transfer === true;

  // Compare Field-Level Security
  const allFieldKeys = Array.from(
    new Set([
      ...resultA.fieldPermissions.map((f) => f.fieldApiName),
      ...(resultB?.fieldPermissions || []).map((f) => f.fieldApiName),
    ])
  );

  const fieldDiffs = allFieldKeys.map((apiName) => {
    const fA = resultA.fieldPermissions.find((f) => f.fieldApiName === apiName);
    const fB = resultB?.fieldPermissions.find((f) => f.fieldApiName === apiName);

    const readA = fA?.readable === true ? 'Yes' : fA?.readable === false ? 'No' : 'Unknown';
    const readB = fB?.readable === true ? 'Yes' : fB?.readable === false ? 'No' : 'Unknown';
    const editA = fA?.editable === true ? 'Yes' : fA?.editable === false ? 'No' : 'Unknown';
    const editB = fB?.editable === true ? 'Yes' : fB?.editable === false ? 'No' : 'Unknown';

    const hasDiff = readA !== readB || editA !== editB;
    const userAHigher = (readA === 'Yes' && readB === 'No') || (editA === 'Yes' && editB === 'No');
    const userBHigher = (readB === 'Yes' && readA === 'No') || (editB === 'Yes' && editA === 'No');

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
      userAHigher,
      userBHigher,
    };
  });

  const filteredFields = fieldDiffs.filter((f) => {
    if (filterMode === 'diff' && !f.hasDiff) return false;
    if (filterMode === 'userA' && !f.userAHigher) return false;
    if (filterMode === 'userB' && !f.userBHigher) return false;
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

  const renderDiscrepancyBadge = (valA: boolean, valB: boolean) => {
    if (valA === valB) {
      return (
        <span className="text-[10px] font-medium text-slate-400">
          Match ({valA ? 'Granted' : 'Denied'})
        </span>
      );
    }
    if (valA && !valB) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
          {userA.name} Only
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
        {userB?.name || 'User B'} Only
      </span>
    );
  };

  return (
    <div className="space-y-3 text-xs">
      {/* 1. Compare Header & Searchable User Selector Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitCompare className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-xs">User Access Diff Mode</h3>
          </div>
          <span className="text-[10px] bg-indigo-800/80 text-blue-200 px-2 py-0.5 rounded-full font-semibold">
            Side-by-Side Root Cause Comparison
          </span>
        </div>

        {/* User Comparison Grid */}
        <div className="grid grid-cols-2 gap-2 text-slate-900">
          {/* User A Card */}
          <div className="p-2.5 rounded-lg bg-white/95 border border-slate-200 space-y-1 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                Base User (User A)
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <div className="font-bold text-xs text-slate-900 truncate">{userA.name}</div>
            <div className="text-[10px] text-slate-500 truncate">
              {userA.profileName || 'Profile'} {userA.userRoleName ? `· ${userA.userRoleName}` : ''}
            </div>
          </div>

          {/* User B Searchable Selector Card */}
          <div ref={dropdownRef} className="p-2.5 rounded-lg bg-white/95 border border-slate-200 space-y-1 relative shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">
                Compare With (User B)
              </span>
              {userB && !isEditingUserB && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUserB(true);
                    setSearchTerm('');
                    setShowDropdown(true);
                  }}
                  className="text-[10px] font-semibold text-purple-600 hover:text-purple-800 transition-colors"
                >
                  Change User
                </button>
              )}
            </div>

            {userB && !isEditingUserB ? (
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-slate-900 truncate flex items-center justify-between">
                  <span className="truncate">{userB.name}</span>
                  {isLoadingB && <Loader2 className="w-3 h-3 text-purple-600 animate-spin shrink-0 ml-1" />}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {userB.profileName || 'Profile'} {userB.userRoleName ? `· ${userB.userRoleName}` : ''}
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search User B by name, role, ID..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowDropdown(false);
                        if (userB) setIsEditingUserB(false);
                      }
                    }}
                    className="w-full text-xs pl-7 pr-14 py-1 bg-purple-50/50 border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium text-slate-800"
                  />
                  <div className="absolute right-1.5 flex items-center space-x-1">
                    {isSearching ? (
                      <Loader2 className="w-3 h-3 text-purple-500 animate-spin" />
                    ) : searchTerm ? (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : null}
                    {userB && isEditingUserB && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingUserB(false);
                          setShowDropdown(false);
                        }}
                        className="text-[9px] text-slate-500 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded font-medium"
                        title="Cancel change"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Dropdown Results */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
                <div className="p-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Select User to Compare</span>
                  <span>{searchResults.length} found</span>
                </div>
                {searchResults.length > 0 ? (
                  searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onSelectUserB(u);
                        setIsEditingUserB(false);
                        setShowDropdown(false);
                        setSearchTerm('');
                      }}
                      className="w-full p-2 text-left hover:bg-purple-50/80 transition-colors flex items-center space-x-2 group cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-slate-900 group-hover:text-purple-900 truncate">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {u.profileName || 'Profile'} {u.userRoleName ? `· ${u.userRoleName}` : ''}
                        </div>
                      </div>
                      <UserCheck className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400">
                    {isSearching ? 'Searching users...' : 'No matching users found.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Diff Content */}
      {!userB ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-2 shadow-xs">
          <Users className="w-9 h-9 text-purple-300 mx-auto" />
          <h4 className="font-bold text-xs text-slate-800">Select User B to Compare Access</h4>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
            Use the search box above to find any user in your Salesforce org. ForceLens will analyze their permissions side-by-side with {userA.name} to explain why access differs.
          </p>
        </div>
      ) : isLoadingB ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-2 shadow-xs">
          <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
          <span className="text-xs font-semibold text-slate-700 block">
            Analyzing permissions & sharing for {userB.name}...
          </span>
          <span className="text-[10px] text-slate-400 block">
            Inspecting UserRecordAccess, Share rows, Object CRUD & Field permissions
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
              <span className="text-[10px] text-slate-500 font-mono">UserRecordAccess</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                <tr>
                  <th className="px-3 py-2">Capability</th>
                  <th className="px-3 py-2 text-center text-blue-800 font-bold">{userA.name}</th>
                  <th className="px-3 py-2 text-center text-purple-800 font-bold">{userB.name}</th>
                  <th className="px-3 py-2 text-center">Diff Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Read */}
                <tr className={canReadA !== canReadB ? 'bg-amber-50/60' : ''}>
                  <td className="px-3 py-2 font-medium">Record Read</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canReadA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canReadB)}</td>
                  <td className="px-3 py-2 text-center">{renderDiscrepancyBadge(canReadA, canReadB)}</td>
                </tr>

                {/* Edit */}
                <tr className={canEditA !== canEditB ? 'bg-amber-50/60' : ''}>
                  <td className="px-3 py-2 font-medium">Record Edit</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canEditA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canEditB)}</td>
                  <td className="px-3 py-2 text-center">{renderDiscrepancyBadge(canEditA, canEditB)}</td>
                </tr>

                {/* Delete */}
                <tr className={canDeleteA !== canDeleteB ? 'bg-amber-50/60' : ''}>
                  <td className="px-3 py-2 font-medium">Record Delete</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canDeleteA)}</td>
                  <td className="px-3 py-2 text-center">{renderStatus(canDeleteB)}</td>
                  <td className="px-3 py-2 text-center">{renderDiscrepancyBadge(canDeleteA, canDeleteB)}</td>
                </tr>

                {/* Transfer (if supported/present) */}
                {(resultA.recordAccess?.transfer !== undefined || resultB?.recordAccess?.transfer !== undefined) && (
                  <tr className={canTransferA !== canTransferB ? 'bg-amber-50/60' : ''}>
                    <td className="px-3 py-2 font-medium">Record Transfer</td>
                    <td className="px-3 py-2 text-center">{renderStatus(canTransferA)}</td>
                    <td className="px-3 py-2 text-center">{renderStatus(canTransferB)}</td>
                    <td className="px-3 py-2 text-center">{renderDiscrepancyBadge(canTransferA, canTransferB)}</td>
                  </tr>
                )}

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
                      <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        Level Difference
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. Object-Level CRUD Comparison Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Key className="w-3.5 h-3.5 text-indigo-600 mr-1.5" />
                Object CRUD Permissions ({resultA.objectApiName})
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Profile & PermSets</span>
            </div>

            <div className="grid grid-cols-6 divide-x divide-slate-100 text-center py-2 text-[11px]">
              {(['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'] as const).map((action) => {
                const valA = resultA.objectPermissions[action] === true;
                const valB = resultB.objectPermissions[action] === true;
                const isDiff = valA !== valB;
                return (
                  <div key={action} className={`p-1.5 space-y-1 ${isDiff ? 'bg-amber-50/70' : ''}`}>
                    <span className="block font-bold text-[10px] text-slate-600 uppercase">
                      {action}
                    </span>
                    <div className="text-[10px] text-blue-700 font-bold">
                      A: {valA ? 'Yes' : 'No'}
                    </div>
                    <div className="text-[10px] text-purple-700 font-bold">
                      B: {valB ? 'Yes' : 'No'}
                    </div>
                    {isDiff ? (
                      <span className="inline-block text-[9px] font-bold px-1 rounded bg-amber-200 text-amber-900">
                        {valA ? 'A Only' : 'B Only'}
                      </span>
                    ) : (
                      <span className="inline-block text-[9px] text-slate-400">Match</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Access Root Cause & Sharing Provenance Comparison */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Info className="w-3.5 h-3.5 text-teal-600 mr-1.5" />
                Sharing Provenance Root Cause Comparison
              </span>
              <span className="text-[10px] text-slate-500">Why Access Differs</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {/* User A Grant Roots */}
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 text-[10px]">{userA.name} Grants:</span>
                  <span className="text-[9px] bg-white text-blue-700 px-1.5 py-0.2 rounded border font-mono">
                    Max: {resultA.recordAccess?.maxAccessLevel}
                  </span>
                </div>
                {resultA.sharingFindings.length > 0 ? (
                  resultA.sharingFindings.map((f, i) => (
                    <div key={i} className="text-[10px] text-slate-800 bg-white p-1 rounded border border-blue-100">
                      <strong>• {f.label}</strong> ({f.accessLevel})
                      {f.source && <div className="text-[9px] text-slate-500 font-mono">{f.source}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-500 italic">No explicit share rows found</div>
                )}
              </div>

              {/* User B Grant Roots */}
              <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 text-[10px]">{userB.name} Grants:</span>
                  <span className="text-[9px] bg-white text-purple-700 px-1.5 py-0.2 rounded border font-mono">
                    Max: {resultB.recordAccess?.maxAccessLevel}
                  </span>
                </div>
                {resultB.sharingFindings.length > 0 ? (
                  resultB.sharingFindings.map((f, i) => (
                    <div key={i} className="text-[10px] text-slate-800 bg-white p-1 rounded border border-purple-100">
                      <strong>• {f.label}</strong> ({f.accessLevel})
                      {f.source && <div className="text-[9px] text-slate-500 font-mono">{f.source}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-500 italic">No explicit share rows found</div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Field-Level Security (FLS) Discrepancy Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800 flex items-center">
                <Lock className="w-3.5 h-3.5 text-teal-600 mr-1.5" />
                Field-Level Security (FLS) Diff ({filteredFields.length} of {allFieldKeys.length} fields)
              </span>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setFilterMode('diff')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    filterMode === 'diff'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  Discrepancies ({fieldDiffs.filter((f) => f.hasDiff).length})
                </button>
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    filterMode === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  All ({allFieldKeys.length})
                </button>
              </div>
            </div>

            {/* Filter Search */}
            <div className="p-2 bg-slate-50/60 border-b border-slate-200">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter fields by name or label..."
                  value={flsSearch}
                  onChange={(e) => setFlsSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 text-[11px] border border-slate-300 rounded bg-white"
                />
              </div>
            </div>

            {/* Table */}
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-1.5">Field</th>
                    <th className="px-2 py-1.5 text-center text-blue-900 font-bold">{userA.name}</th>
                    <th className="px-2 py-1.5 text-center text-purple-900 font-bold">{userB.name}</th>
                    <th className="px-2 py-1.5 text-center">Diff Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFields.length > 0 ? (
                    filteredFields.map((f) => (
                      <tr
                        key={f.fieldApiName}
                        className={f.hasDiff ? 'bg-amber-50/40 hover:bg-amber-50 transition-colors' : 'hover:bg-slate-50'}
                      >
                        <td className="px-3 py-1.5">
                          <div className="font-semibold text-slate-900 text-[11px]">{f.label}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{f.fieldApiName}</div>
                        </td>
                        <td className="px-2 py-1.5 text-center text-[10px]">
                          <span className={f.readA === 'Yes' ? 'text-emerald-700 font-semibold' : 'text-rose-600'}>
                            R: {f.readA}
                          </span>
                          <span className="text-slate-300 mx-1">|</span>
                          <span className={f.editA === 'Yes' ? 'text-emerald-700 font-semibold' : 'text-rose-600'}>
                            E: {f.editA}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center text-[10px]">
                          <span className={f.readB === 'Yes' ? 'text-emerald-700 font-semibold' : 'text-rose-600'}>
                            R: {f.readB}
                          </span>
                          <span className="text-slate-300 mx-1">|</span>
                          <span className={f.editB === 'Yes' ? 'text-emerald-700 font-semibold' : 'text-rose-600'}>
                            E: {f.editB}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {f.hasDiff ? (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                              {f.userAHigher ? `${userA.name} Higher` : f.userBHigher ? `${userB.name} Higher` : 'Diff'}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-medium">Identical</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-[11px] text-slate-400">
                        {filterMode === 'diff'
                          ? 'Zero permission discrepancies found! Both users have identical field security.'
                          : 'No fields match your filter.'}
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

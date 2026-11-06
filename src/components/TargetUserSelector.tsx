import React, { useState, useEffect, useRef } from 'react';
import { User, Search, CheckCircle, ShieldCheck, Briefcase, X, Loader2 } from 'lucide-react';
import { TargetUser } from '../types';
import { sfApi } from '../salesforce/api-client';
import { MOCK_TARGET_USERS } from './MockData';

interface TargetUserSelectorProps {
  selectedUser: TargetUser | null;
  onSelectUser: (user: TargetUser | null) => void;
  isMockMode?: boolean;
}

export const TargetUserSelector: React.FC<TargetUserSelectorProps> = ({
  selectedUser,
  onSelectUser,
  isMockMode = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TargetUser[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced user search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      if (isMockMode) {
        const lower = searchTerm.toLowerCase();
        const filtered = MOCK_TARGET_USERS.filter(
          (u) =>
            u.name.toLowerCase().includes(lower) ||
            u.username.toLowerCase().includes(lower) ||
            u.id.toLowerCase().includes(lower)
        );
        setResults(filtered);
        setIsLoading(false);
        return;
      }

      try {
        const users = await sfApi.searchUsers(searchTerm);
        setResults(users);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'User search query failed.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, isMockMode]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Target User to Explain
          </span>
        </div>
        {selectedUser && (
          <button
            onClick={() => {
              onSelectUser(null);
              setSearchTerm('');
            }}
            className="text-[11px] text-slate-400 hover:text-red-600 flex items-center transition-colors"
          >
            <X className="w-3 h-3 mr-0.5" />
            Clear
          </button>
        )}
      </div>

      {selectedUser ? (
        <div className="flex items-start justify-between bg-blue-50/60 border border-blue-200/80 rounded-md p-2.5">
          <div className="flex items-start space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
              {selectedUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-900">{selectedUser.name}</span>
                {selectedUser.isActive && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono leading-tight mt-0.5">
                {selectedUser.username}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-slate-700 border border-slate-200">
                  <ShieldCheck className="w-3 h-3 mr-1 text-blue-600" />
                  {selectedUser.profileName}
                </span>
                {selectedUser.userRoleName && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-slate-700 border border-slate-200">
                    <Briefcase className="w-3 h-3 mr-1 text-slate-500" />
                    {selectedUser.userRoleName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search user by name, username, or 005... ID"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full text-xs pl-8 pr-8 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
            />
            {isLoading && (
              <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-blue-600 animate-spin" />
            )}
          </div>

          {/* User Search Dropdown */}
          {showDropdown && (
            <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg z-20">
              {error ? (
                <div className="p-2.5 text-[11px] text-red-600">
                  {error}
                </div>
              ) : results.length > 0 ? (
                results.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onSelectUser(u);
                      setShowDropdown(false);
                      setSearchTerm('');
                    }}
                    className="w-full text-left p-2.5 hover:bg-blue-50/70 border-b border-slate-100 last:border-0 flex items-start space-x-2 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {u.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {u.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                          {u.id.slice(0, 15)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {u.username}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        Profile: {u.profileName}
                      </div>
                    </div>
                  </button>
                ))
              ) : searchTerm.trim().length > 0 && !isLoading ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  No active users found matching "{searchTerm}".
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">
                  {isMockMode ? (
                    <div>
                      <p className="font-medium text-slate-600 mb-1">Demo Quick Pick:</p>
                      <div className="flex flex-col gap-1 text-left mt-1">
                        {MOCK_TARGET_USERS.map((mu) => (
                          <button
                            key={mu.id}
                            onClick={() => {
                              onSelectUser(mu);
                              setShowDropdown(false);
                            }}
                            className="p-1 hover:bg-blue-50 text-blue-700 rounded text-[11px]"
                          >
                            {mu.name} ({mu.profileName})
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    'Type at least 2 characters to search Salesforce users'
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Search, CheckCircle2, XCircle, HelpCircle, Filter, Info, ShieldCheck, ShieldAlert } from 'lucide-react';
import { FieldPermissionResult } from '../types';

interface FieldPermissionsTableProps {
  fields: FieldPermissionResult[];
}

export const FieldPermissionsTable: React.FC<FieldPermissionsTableProps> = ({ fields }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'readable' | 'editable' | 'denied'>('all');

  // Migration Readiness: Count profile-based vs permset-based grants
  const profileGrantsCount = fields.filter((f) => f.source?.toLowerCase().includes('profile')).length;
  const permSetGrantsCount = fields.filter(
    (f) =>
      f.source?.toLowerCase().includes('permission set') ||
      f.source?.toLowerCase().includes('psg') ||
      f.source?.toLowerCase().includes('permset')
  ).length;
  const totalGrantSources = profileGrantsCount + permSetGrantsCount;
  const permSetModernizedPct = totalGrantSources > 0 ? Math.round((permSetGrantsCount / totalGrantSources) * 100) : 0;

  const filtered = fields.filter((f) => {
    const matchesSearch =
      f.fieldApiName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.label.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'readable') return f.readable === true;
    if (filterType === 'editable') return f.editable === true;
    if (filterType === 'denied') return f.readable === false && f.editable === false;
    return true;
  });

  const renderBadge = (val: boolean | 'unknown') => {
    if (val === true) {
      return (
        <span className="inline-flex items-center text-emerald-700 text-[11px] font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 mr-0.5 text-emerald-600" /> Yes
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center text-rose-700 text-[11px] font-semibold">
          <XCircle className="w-3.5 h-3.5 mr-0.5 text-rose-600" /> No
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-amber-700 text-[11px] font-semibold">
        <HelpCircle className="w-3.5 h-3.5 mr-0.5 text-amber-600" /> Unknown
      </span>
    );
  };

  const getSourceBadge = (source?: string) => {
    if (!source) return null;
    const lower = source.toLowerCase();
    if (lower.includes('profile')) {
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0 mr-1">
          Profile
        </span>
      );
    }
    if (lower.includes('permission set') || lower.includes('permset') || lower.includes('psg')) {
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 mr-1">
          PermSet
        </span>
      );
    }
    if (lower.includes('system') || lower.includes('standard')) {
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0 mr-1">
          System
        </span>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm space-y-0">
      {/* 1. Dynamic Forms Component Visibility Advisory Notice */}
      <div className="p-2.5 bg-blue-50/80 border-b border-blue-100 flex items-start space-x-2 text-[11px] text-blue-900">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Dynamic Forms Advisory:</strong> If a field shows FLS Read = Yes here but is missing on screen, check Lightning App Builder for <em>Dynamic Forms Component Visibility Rules</em> or Page Layout assignments.
        </div>
      </div>

      {/* 2. Profile-to-Permission Set Migration Readiness Banner */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px]">
        <div className="flex items-center space-x-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-semibold text-slate-800">
            Migration Readiness: {permSetModernizedPct}% via Permission Sets
          </span>
          <span className="text-[10px] text-slate-500">
            ({profileGrantsCount} legacy Profile grants, {permSetGrantsCount} modern PermSets)
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
          Salesforce Profile Retirement
        </span>
      </div>

      {/* 3. Search and Filters Bar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/50 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter fields by API name or label..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
        </div>

        <div className="flex items-center space-x-1.5 text-xs">
          <Filter className="w-3 h-3 text-slate-400 mr-0.5" />
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
            }`}
          >
            All ({fields.length})
          </button>
          <button
            onClick={() => setFilterType('readable')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
              filterType === 'readable'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Readable ({fields.filter((f) => f.readable === true).length})
          </button>
          <button
            onClick={() => setFilterType('editable')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
              filterType === 'editable'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Editable ({fields.filter((f) => f.editable === true).length})
          </button>
          <button
            onClick={() => setFilterType('denied')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
              filterType === 'denied'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Restricted ({fields.filter((f) => f.readable === false).length})
          </button>
        </div>
      </div>

      {/* 4. Table Body */}
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-100 text-slate-600 sticky top-0 text-[10px] uppercase font-bold tracking-wider z-10">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-2 py-2 text-center">Read</th>
              <th className="px-2 py-2 text-center">Edit</th>
              <th className="px-3 py-2">Origin & Grant Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((f) => (
                <tr key={f.fieldApiName} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <div>{f.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{f.fieldApiName}</div>
                  </td>
                  <td className="px-2 py-2 text-center">{renderBadge(f.readable)}</td>
                  <td className="px-2 py-2 text-center">{renderBadge(f.editable)}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-600 max-w-[200px]" title={f.source}>
                    <div className="flex items-center">
                      {getSourceBadge(f.source)}
                      <span className="truncate">{f.source || '-'}</span>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-4 text-center text-xs text-slate-400">
                  No fields match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

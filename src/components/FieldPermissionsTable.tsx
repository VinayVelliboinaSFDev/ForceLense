import React, { useState } from 'react';
import { Search, CheckCircle2, XCircle, HelpCircle, Filter } from 'lucide-react';
import { FieldPermissionResult } from '../types';

interface FieldPermissionsTableProps {
  fields: FieldPermissionResult[];
}

export const FieldPermissionsTable: React.FC<FieldPermissionsTableProps> = ({ fields }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'readable' | 'editable' | 'denied'>('all');

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

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
      {/* Search and Filters Bar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
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

      {/* Table Body */}
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-100 text-slate-600 sticky top-0 text-[10px] uppercase font-bold tracking-wider z-10">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-2 py-2 text-center">Read</th>
              <th className="px-2 py-2 text-center">Edit</th>
              <th className="px-3 py-2">Source / Reason</th>
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
                  <td className="px-3 py-2 text-[11px] text-slate-500 max-w-[150px] truncate" title={f.source}>
                    {f.source || '-'}
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

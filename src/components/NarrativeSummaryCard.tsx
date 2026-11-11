import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Shield,
  Key,
  Lock,
  AlertTriangle,
  Sparkles,
  Database,
  ArrowRight,
  Eye,
  Edit3,
  Trash2,
  Users,
  GitFork,
  FileCheck2,
  Layers,
  ArrowLeftRight,
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
  const narrative = generateNarrativeSummary(result);
  const canRead = result.recordAccess?.read === true;
  const canEdit = result.recordAccess?.edit === true;
  const canDelete = result.recordAccess?.delete === true;
  const canTransfer = result.recordAccess?.transfer === true;

  const isDirectOwner = result.sharingFindings.some(
    (f) => f.type === 'ownership' && (f.label === 'Direct Record Owner' || f.label.includes(result.targetUserName))
  );
  const directShare = result.sharingFindings.find((f) => f.type === 'share_row');
  const groupShare = result.sharingFindings.find((f) => f.type === 'group');
  const hierarchyShare = result.sharingFindings.find((f) => f.type === 'hierarchy');
  const shareFinding = directShare || groupShare || hierarchyShare;

  const readOrigin = isDirectOwner
    ? 'Direct Record Owner'
    : directShare
    ? `Share Row (${directShare.rowCause || 'Manual'})`
    : groupShare
    ? `Group (${groupShare.rowCause || 'Rule'})`
    : hierarchyShare
    ? 'Role Hierarchy'
    : 'Baseline OWD Visibility';

  const editOrigin = canEdit
    ? isDirectOwner
      ? 'Record Owner'
      : shareFinding
      ? `Share Row (${shareFinding.rowCause || 'Rule'})`
      : 'Read/Write OWD'
    : result.objectPermissions.edit
    ? 'Missing Write Share'
    : 'Profile CRUD: No Edit';

  const deleteOrigin = canDelete
    ? isDirectOwner
      ? 'Record Owner'
      : 'Delete Granted'
    : result.objectPermissions.delete
    ? 'Owner/Share Required'
    : 'Profile CRUD: No Delete';

  const transferOrigin = canTransfer
    ? 'Can Transfer Owner'
    : 'Transfer Blocked';

  const getBadge = () => {
    switch (narrative.badgeType) {
      case 'granted':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Access Confirmed
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
            <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Partial / Read-Only
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-xs">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Access Denied
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">
            <HelpCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Inconclusive
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all space-y-0">
      {/* 1. Header Banner: Renamed to "Summary" as requested */}
      <div className="p-3.5 bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/30 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center space-x-1.5 mb-1">
              <span className="text-[12px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                Summary
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Verified Access Provenance & Verdict
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-900 leading-snug">
              {narrative.headline}
            </h3>
          </div>
          <div className="shrink-0">{getBadge()}</div>
        </div>
      </div>

      {/* Main Body: Rich Visual Scorecards, Provenance Breadcrumb & Attribution */}
      <div className="p-3.5 space-y-3 text-xs">
        {/* 2. Visual Executive Access Scorecard (Cards & Tiles) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 flex items-center">
              <Shield className="w-3.5 h-3.5 text-blue-600 mr-1.5" />
              Executive Access Scorecard
            </span>
            <div className="flex items-center space-x-1.5 text-[10px]">
              <span className="text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                Share Rows: {result.sharingFindings.length} verified
              </span>
              <span className="text-blue-700 font-mono bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                Max: {result.recordAccess?.maxAccessLevel || 'Unknown'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Record Read Tile */}
            <div
              className={`p-2 rounded-lg border transition-all ${
                canRead
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/70 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Eye className={`w-3.5 h-3.5 ${canRead ? 'text-emerald-600' : 'text-rose-500'}`} />
                <span className="font-bold text-[11px]">Record Read</span>
              </div>
              <span
                className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  canRead ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}
              >
                {canRead ? 'GRANTED' : 'DENIED'}
              </span>
              <span className="block text-[9px] text-slate-500 mt-1 font-medium truncate" title={readOrigin}>
                {readOrigin}
              </span>
            </div>

            {/* Record Edit Tile */}
            <div
              className={`p-2 rounded-lg border transition-all ${
                canEdit
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/70 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Edit3 className={`w-3.5 h-3.5 ${canEdit ? 'text-emerald-600' : 'text-rose-500'}`} />
                <span className="font-bold text-[11px]">Record Edit</span>
              </div>
              <span
                className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  canEdit ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}
              >
                {canEdit ? 'GRANTED' : 'DENIED'}
              </span>
              <span className="block text-[9px] text-slate-500 mt-1 font-medium truncate" title={editOrigin}>
                {editOrigin}
              </span>
            </div>

            {/* Record Delete Tile */}
            <div
              className={`p-2 rounded-lg border transition-all ${
                canDelete
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/70 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Trash2 className={`w-3.5 h-3.5 ${canDelete ? 'text-emerald-600' : 'text-rose-500'}`} />
                <span className="font-bold text-[11px]">Record Delete</span>
              </div>
              <span
                className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  canDelete ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}
              >
                {canDelete ? 'GRANTED' : 'DENIED'}
              </span>
              <span className="block text-[9px] text-slate-500 mt-1 font-medium truncate" title={deleteOrigin}>
                {deleteOrigin}
              </span>
            </div>

            {/* Record Transfer Tile */}
            <div
              className={`p-2 rounded-lg border transition-all ${
                canTransfer
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/70 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-center space-x-1 mb-1">
                <ArrowLeftRight className={`w-3.5 h-3.5 ${canTransfer ? 'text-emerald-600' : 'text-rose-500'}`} />
                <span className="font-bold text-[11px]">Record Transfer</span>
              </div>
              <span
                className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  canTransfer ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}
              >
                {canTransfer ? 'GRANTED' : 'DENIED'}
              </span>
              <span className="block text-[9px] text-slate-500 mt-1 font-medium truncate" title={transferOrigin}>
                {transferOrigin}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Object-Level CRUD Permissions Pill Strip */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 flex items-center">
              <Database className="w-3.5 h-3.5 text-slate-600 mr-1.5" />
              Object CRUD Permissions ({result.objectApiName})
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Profile & Permission Sets</span>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
            <span
              className={`px-2 py-0.5 rounded border ${
                result.objectPermissions.read
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              Read: {result.objectPermissions.read ? 'Yes' : 'No'}
            </span>
            <span
              className={`px-2 py-0.5 rounded border ${
                result.objectPermissions.create
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              Create: {result.objectPermissions.create ? 'Yes' : 'No'}
            </span>
            <span
              className={`px-2 py-0.5 rounded border ${
                result.objectPermissions.edit
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              Edit: {result.objectPermissions.edit ? 'Yes' : 'No'}
            </span>
            <span
              className={`px-2 py-0.5 rounded border ${
                result.objectPermissions.delete
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              Delete: {result.objectPermissions.delete ? 'Yes' : 'No'}
            </span>
            <span
              className={`px-2 py-0.5 rounded border ${
                result.objectPermissions.viewAll
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              View All: {result.objectPermissions.viewAll ? 'Yes' : 'No'}
            </span>
            <span
              className={`px-2 py-0.5 rounded border ${
                result.objectPermissions.modifyAll
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              Modify All: {result.objectPermissions.modifyAll ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* 4. Visual Provenance Breadcrumb Flow */}
        <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-900 flex items-center">
              <Key className="w-3.5 h-3.5 text-indigo-600 mr-1.5" />
              Visual Provenance Breadcrumb (How Access Was Granted)
            </span>
            <span className="text-[10px] text-indigo-600 font-semibold">Provenance Chain</span>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-800 overflow-x-auto py-1">
            {narrative.breadcrumbNodes.map((node, idx) => (
              <React.Fragment key={node.id || idx}>
                {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                <div
                  className={`px-2.5 py-1 rounded-md border shrink-0 text-left shadow-2xs ${
                    node.status === 'active'
                      ? 'bg-white border-indigo-200 text-slate-900'
                      : node.status === 'denied'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-1">
                    {node.type === 'user' && <Users className="w-3 h-3 text-blue-600 shrink-0" />}
                    {node.type === 'role' && <GitFork className="w-3 h-3 text-indigo-600 shrink-0" />}
                    {node.type === 'group' && <Layers className="w-3 h-3 text-purple-600 shrink-0" />}
                    {node.type === 'share' && <FileCheck2 className="w-3 h-3 text-teal-600 shrink-0" />}
                    {node.type === 'verdict' && (
                      <CheckCircle2
                        className={`w-3 h-3 shrink-0 ${
                          node.status === 'active' ? 'text-emerald-600' : 'text-rose-500'
                        }`}
                      />
                    )}
                    <span className="font-bold text-[10px] truncate max-w-[150px]">{node.label}</span>
                  </div>
                  {node.subLabel && (
                    <span className="block text-[9px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                      {node.subLabel}
                    </span>
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 5. Causal Access Attribution List: Groups, Roles, Sharing Settings & Permission Sets */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <span className="text-[11px] font-bold text-slate-800 block">
            Causal Grant Attribution (Exact Entities Granting Access)
          </span>

          <div className="grid grid-cols-1 gap-1.5 text-[11px]">
            {/* Causal Public Groups */}
            {narrative.attribution.groups.length > 0 && (
              <div className="flex items-start space-x-2">
                <span className="text-slate-500 font-semibold w-28 shrink-0 text-[10px]">
                  Public Groups:
                </span>
                <div className="flex flex-wrap gap-1">
                  {narrative.attribution.groups.map((grp) => (
                    <span
                      key={grp}
                      className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-medium text-[10px]"
                    >
                      {grp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Causal User Roles */}
            {narrative.attribution.roles.length > 0 && (
              <div className="flex items-start space-x-2">
                <span className="text-slate-500 font-semibold w-28 shrink-0 text-[10px]">
                  User Role(s):
                </span>
                <div className="flex flex-wrap gap-1">
                  {narrative.attribution.roles.map((role) => (
                    <span
                      key={role}
                      className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium text-[10px]"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Causal Sharing Rules / Settings */}
            {narrative.attribution.sharingSettings.length > 0 && (
              <div className="flex items-start space-x-2">
                <span className="text-slate-500 font-semibold w-28 shrink-0 text-[10px]">
                  Share Rule / Row:
                </span>
                <div className="flex flex-wrap gap-1">
                  {narrative.attribution.sharingSettings.map((setting, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-medium text-[10px]"
                    >
                      {setting.table} · {setting.rowCause} ({setting.accessLevel})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Causal Profiles & Permission Sets */}
            {(narrative.attribution.profiles.length > 0 ||
              narrative.attribution.permissionSets.length > 0) && (
              <div className="flex items-start space-x-2">
                <span className="text-slate-500 font-semibold w-28 shrink-0 text-[10px]">
                  Profile / Perm Sets:
                </span>
                <div className="flex flex-wrap gap-1">
                  {narrative.attribution.profiles.map((prof) => (
                    <span
                      key={prof}
                      className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium text-[10px]"
                    >
                      Profile: {prof.replace(/^Profile:\s*/i, '')}
                    </span>
                  ))}
                  {narrative.attribution.permissionSets.map((ps) => (
                    <span
                      key={ps}
                      className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[10px]"
                    >
                      PermSet: {ps.replace(/^(Permission Set|PermSet):\s*/i, '')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Link to AI Explainer */}
        {onOpenAiTab && (
          <div className="pt-1 border-t border-slate-100">
            <button
              onClick={onOpenAiTab}
              className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-[11px] rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Ask AI (ChatGPT / Claude / Copilot) for Deep Root Cause & Remediation</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

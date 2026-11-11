import React, { useState } from 'react';
import {
  Shield,
  GitFork,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  Lock,
  Copy,
  Check,
  Eye,
  Edit3,
  Trash2,
  ArrowLeftRight,
  User,
  Key,
  Layers,
  Sparkles,
} from 'lucide-react';

interface RichAiResponseViewProps {
  content: string;
}

/**
 * Normalizes text and splits AI response into structured cards.
 * Resilient against missing '---' dividers, CRLF, varying heading levels (###, ##, **),
 * and bullet-based formatting from smaller local models like Ollama llama3.2:3b.
 */
function splitIntoCards(rawText: string): string[] {
  if (!rawText) return [];
  const normalized = rawText.replace(/\r\n/g, '\n').trim();

  // Pattern matching card header boundaries (e.g. ### CARD 1, ## CARD 2, **CARD 1**, CARD 1:)
  const cardBoundaryRegex = /(?:\n\s*[-*_]{3,}\s*\n+|\n+)(?=(?:###|##|#|\*\*|^)\s*(?:[🎯⛓️⚠️🛠️🔒📌👁️🏆]\s*)?(?:CARD\s*[1-4]|Executive Access Scorecard|Visual Provenance Chain|Provenance Chain|Discrepancy|Blocker Callout|Administrator Remediation|Remediation Tile|Executive Access Diff Matrix))/im;

  const rawSections = normalized.split(cardBoundaryRegex);
  if (rawSections.length > 1) {
    return rawSections
      .map((s) => s.trim().replace(/^[-*_]{3,}\s*/, '').trim())
      .filter(Boolean);
  }

  // Fallback 1: split by horizontal rule lines
  const dividerSections = normalized.split(/\n\s*[-*_]{3,}\s*\n/);
  if (dividerSections.length > 1) {
    return dividerSections.map((s) => s.trim()).filter(Boolean);
  }

  // Fallback 2: split by markdown H3 headers
  const h3Sections = normalized.split(/\n(?=###\s+)/);
  if (h3Sections.length > 1) {
    return h3Sections.map((s) => s.trim()).filter(Boolean);
  }

  return [normalized];
}

/**
 * Helper to parse markdown table row without losing columns
 */
function parseMarkdownTableRow(rowStr: string): string[] {
  let cleaned = rowStr.trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map((c) => c.trim());
}

/**
 * Universal badge renderer for status signals
 */
export const renderStatusBadge = (cellText: string): React.ReactNode => {
  const t = cellText.trim();
  if (/🟢|GRANTED|FULL|ALLOWED/i.test(t)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-black text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 tracking-wider shadow-2xs">
        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
        GRANTED
      </span>
    );
  }
  if (/🔴|DENIED|BLOCKED|RESTRICTED(?!\s*fields)/i.test(t)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-black text-[10px] bg-rose-100 text-rose-800 border border-rose-200 tracking-wider shadow-2xs">
        <XCircle className="w-3 h-3 mr-1 text-rose-600 shrink-0" />
        DENIED
      </span>
    );
  }
  if (/🟡|PARTIAL|LIMITED/i.test(t)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-black text-[10px] bg-amber-100 text-amber-900 border border-amber-200 tracking-wider shadow-2xs">
        <AlertTriangle className="w-3 h-3 mr-1 text-amber-600 shrink-0" />
        PARTIAL
      </span>
    );
  }
  return <MarkdownInline text={cellText} />;
};

export const RichAiResponseView: React.FC<RichAiResponseViewProps> = ({ content }) => {
  if (!content) return null;

  // Detect whether content contains card structures
  const hasStructuredCards = /(?:###|##|#|\*\*|^)\s*(?:[🎯⛓️⚠️🛠️🔒📌👁️🏆]\s*)?(?:CARD\s*[1-4]|Executive Access Scorecard|Visual Provenance Chain|Discrepancy|Blocker|Administrator Remediation|Remediation Tile|Executive Access Diff Matrix)/im.test(content);

  if (hasStructuredCards) {
    return <StructuredCardViewer rawText={content} />;
  }

  // Otherwise render conversational markdown with full table & list support
  return <MarkdownContent content={content} />;
};

/**
 * Parses and renders the structured AI Verdict cards (Card 1, 2, 3, 4)
 */
const StructuredCardViewer: React.FC<{ rawText: string }> = ({ rawText }) => {
  const sections = splitIntoCards(rawText);

  return (
    <div className="space-y-3.5">
      {sections.map((sec, idx) => {
        // Detect Card Type
        if (/CARD\s*1|Executive Access Scorecard|Executive Access Diff Matrix/i.test(sec)) {
          return <Card1Scorecard key={idx} sectionText={sec} />;
        }
        if (/CARD\s*2|Provenance Chain|Visual Provenance/i.test(sec)) {
          return <Card2Provenance key={idx} sectionText={sec} />;
        }
        if (/CARD\s*3|Discrepancy|Blocker/i.test(sec)) {
          return <Card3Blocker key={idx} sectionText={sec} />;
        }
        if (/CARD\s*4|Remediation|Administrator Remediation/i.test(sec)) {
          return <Card4Remediation key={idx} sectionText={sec} />;
        }
        return (
          <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <MarkdownContent content={sec} />
          </div>
        );
      })}
    </div>
  );
};

interface ScorecardBulletItem {
  capability: string;
  icon?: string;
  status: string;
  grant: string;
  provenance: string;
}

/**
 * Extracts bulleted capability lines from Card 1 when a model (like llama3.2:3b)
 * formats items as list bullets instead of a Markdown table.
 */
function parseBulletScorecard(lines: string[]): ScorecardBulletItem[] {
  const items: ScorecardBulletItem[] = [];

  for (const line of lines) {
    const l = line.trim();
    if (!l.startsWith('-') && !l.startsWith('*') && !/^\d+\./.test(l)) continue;

    // Detect capability keyword
    const match = l.match(/(👁️|✏️|🗑️|🔄|🔒)?\s*\*{0,2}(Record Read|Record Edit|Record Delete|Record Transfer|Field-Level Security|FLS|Read Access|Edit Access|Delete Access|Transfer Access)\*{0,2}/i);
    if (!match) continue;

    const icon = match[1] || '';
    const capability = match[2];

    let status = 'UNKNOWN';
    if (/🟢|GRANTED|FULL/i.test(l)) status = '🟢 GRANTED';
    else if (/🔴|DENIED|BLOCKED/i.test(l)) status = '🔴 DENIED';
    else if (/🟡|PARTIAL|RESTRICTED/i.test(l)) status = '🟡 PARTIAL';

    // Strip capability and bullet to extract grant and origin
    let remainder = l
      .replace(/^[-*•\d.]+\s*/, '')
      .replace(match[0], '')
      .replace(/^[:\-–—]\s*/, '')
      .replace(/🟢|🔴|🟡|GRANTED|DENIED|PARTIAL/gi, '')
      .trim();

    const parts = remainder
      .split(/\s+[-–—]\s+|\s*[|/]\s*|\s*\(/)
      .map((p) => p.replace(/[()]/g, '').trim())
      .filter(Boolean);

    const grant = parts[0] || (status.includes('GRANTED') ? 'Granted' : 'Blocked');
    const provenance = parts.slice(1).join(' / ') || 'Baseline Security Architecture';

    items.push({
      capability: `${icon} ${capability}`.trim(),
      icon,
      status,
      grant,
      provenance,
    });
  }

  return items;
}

/**
 * CARD 1: Executive Access Scorecard (Table & Resilient Bullet Card View)
 */
const Card1Scorecard: React.FC<{ sectionText: string }> = ({ sectionText }) => {
  const lines = sectionText.split('\n');
  const tableLines = lines.filter((l) => l.trim().startsWith('|'));

  const titleLine =
    lines.find((l) => /CARD\s*1|Executive Access Scorecard|Executive Access Diff Matrix/i.test(l)) ||
    '### 🎯 CARD 1: Executive Access Scorecard';
  const cleanTitle = titleLine.replace(/^[#*]+\s*/, '').replace(/\*+$/, '').trim();

  // If Markdown table lines exist (at least header + 1 row)
  if (tableLines.length >= 2) {
    const headerCells = parseMarkdownTableRow(tableLines[0]);
    const dataRows = tableLines
      .slice(1)
      .filter((l) => !/^[|\s:-]+$/.test(l))
      .map(parseMarkdownTableRow);

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-900 flex items-center">
            <Shield className="w-4 h-4 text-blue-600 mr-1.5 shrink-0" />
            {cleanTitle}
          </span>
          <span className="text-[10px] bg-blue-100/80 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
            Verified Verdict
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                {headerCells.map((h, i) => (
                  <th key={i} className={`px-3 py-2.5 ${i === 1 || i === 2 ? 'text-center' : ''}`}>
                    {h.replace(/\*\*/g, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                  {row.map((cell, cIdx) => {
                    const isStatusCol = /GRANTED|DENIED|PARTIAL|🟢|🔴|🟡/i.test(cell) || cIdx === 1 || (row.length === 4 && cIdx === 2 && /GRANTED|DENIED/i.test(cell));
                    const isProvenanceCol = cIdx === row.length - 1 && row.length > 2;

                    return (
                      <td
                        key={cIdx}
                        className={`px-3 py-2.5 ${isStatusCol ? 'text-center' : 'text-slate-800'}`}
                      >
                        {isStatusCol ? (
                          renderStatusBadge(cell)
                        ) : isProvenanceCol ? (
                          <span className="font-mono text-[10px] text-slate-700 bg-slate-100/90 border border-slate-200/80 px-1.5 py-0.5 rounded leading-tight inline-block">
                            <MarkdownInline text={cell} />
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-900">
                            <MarkdownInline text={cell} />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Fallback: If smaller models formatted as bullet points, render rich capability scorecard grid!
  const bulletItems = parseBulletScorecard(lines);
  if (bulletItems.length > 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-900 flex items-center">
            <Shield className="w-4 h-4 text-blue-600 mr-1.5 shrink-0" />
            {cleanTitle}
          </span>
          <span className="text-[10px] bg-blue-100/80 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
            Scorecard View
          </span>
        </div>

        <div className="p-3 grid grid-cols-1 gap-2">
          {bulletItems.map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-200 hover:shadow-xs transition-all flex items-start justify-between gap-2"
            >
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-slate-900 flex items-center">
                  <MarkdownInline text={item.capability} />
                </span>
                <p className="text-[11px] text-slate-700">{item.grant}</p>
                <div className="pt-0.5">
                  <span className="font-mono text-[10px] text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    {item.provenance}
                  </span>
                </div>
              </div>
              <div className="shrink-0">{renderStatusBadge(item.status)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback to formatted markdown card
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
      <MarkdownContent content={sectionText} />
    </div>
  );
};

/**
 * CARD 2: Visual Provenance Chain & Restricted Fields Cloud
 */
const Card2Provenance: React.FC<{ sectionText: string }> = ({ sectionText }) => {
  const [showAllFields, setShowAllFields] = useState(false);

  const lines = sectionText.split('\n');
  const titleLine =
    lines.find((l) => /CARD\s*2|Provenance Chain|Visual Provenance/i.test(l)) ||
    '### ⛓️ CARD 2: Visual Provenance Chain';
  const cleanTitle = titleLine.replace(/^[#*]+\s*/, '').replace(/\*+$/, '').trim();

  // Step item line matcher (resilient to with/without emojis, bullet styles)
  const stepItems = lines.filter((l) => {
    const t = l.trim();
    if (/⬇️|-->|->/i.test(t)) return false;
    return (
      /^[*-•\d.]/i.test(t) &&
      /Target User|Public Group|Role Membership|Role:|Share Table|Effective Record Access|MaxAccessLevel/i.test(t)
    );
  });

  // Provenance narrative bullets (Ownership, Share Row Evidence, Object CRUD, Restricted Fields)
  const detailBullets = lines.filter((l) => {
    const t = l.trim();
    return (
      /^[*-•\d.]/i.test(t) &&
      /Ownership|Share Row Evidence|Share Row|Object CRUD|CRUD Baseline|Restricted Fields/i.test(t)
    );
  });

  // Extract restricted fields list if present
  const restrictedFieldLine = lines.find((l) => /Restricted Fields/i.test(l));
  let fieldPills: string[] = [];
  if (restrictedFieldLine) {
    const rawFields = restrictedFieldLine
      .replace(/.*(?:include|fields):\s*/i, '')
      .replace(/Restricted Fields:?\s*/i, '');
    fieldPills = rawFields
      .split(',')
      .map((f) => f.trim().replace(/[`.*]/g, ''))
      .filter(Boolean);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
      <div className="p-3 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-purple-50/50 border-b border-slate-200 flex items-center justify-between">
        <span className="font-bold text-xs text-slate-900 flex items-center">
          <GitFork className="w-4 h-4 text-indigo-600 mr-1.5 shrink-0" />
          {cleanTitle}
        </span>
        <span className="text-[10px] bg-indigo-100/70 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
          Provenance Path
        </span>
      </div>

      <div className="p-3 space-y-3 text-xs">
        {/* Step-by-step Flow Tiles */}
        {stepItems.length > 0 ? (
          <div className="space-y-1.5">
            {stepItems.map((step, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="w-full p-2.5 bg-slate-50/90 rounded-lg border border-slate-200 text-[11px] text-slate-800 font-medium shadow-2xs hover:border-indigo-200 hover:bg-white transition-all">
                  <MarkdownInline text={step.replace(/^[-*•\d.]+\s*/, '')} />
                </div>
                {idx < stepItems.length - 1 && (
                  <ArrowDown className="w-3.5 h-3.5 text-indigo-400 my-0.5 shrink-0" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
            <MarkdownContent content={sectionText.replace(/^[#*].*?\n/, '')} />
          </div>
        )}

        {/* Provenance Detail Cards */}
        {detailBullets.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            {detailBullets.map((bullet, idx) => {
              const isRestrictedFields = /Restricted Fields/i.test(bullet);

              if (isRestrictedFields && fieldPills.length > 0) {
                const displayedPills = showAllFields ? fieldPills : fieldPills.slice(0, 8);
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-amber-950 flex items-center">
                        <Lock className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />
                        Restricted Fields ({fieldPills.length} hidden by FLS)
                      </span>
                      {fieldPills.length > 8 && (
                        <button
                          type="button"
                          onClick={() => setShowAllFields(!showAllFields)}
                          className="text-[10px] font-bold text-amber-800 hover:text-amber-950 flex items-center bg-amber-100/90 px-2 py-0.5 rounded cursor-pointer"
                        >
                          {showAllFields ? (
                            <>
                              Show Less <ChevronUp className="w-3 h-3 ml-0.5" />
                            </>
                          ) : (
                            <>
                              View All {fieldPills.length} <ChevronDown className="w-3 h-3 ml-0.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto pt-1">
                      {displayedPills.map((fp, fIdx) => (
                        <span
                          key={fIdx}
                          className="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-[10px] text-slate-700 font-mono shadow-2xs"
                        >
                          {fp}
                        </span>
                      ))}
                      {!showAllFields && fieldPills.length > 8 && (
                        <span className="px-1.5 py-0.5 bg-amber-200/60 text-amber-900 rounded text-[10px] font-bold">
                          +{fieldPills.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // Card icons based on content
              const isOwner = /Ownership/i.test(bullet);
              const isShare = /Share Row/i.test(bullet);
              const isCrud = /CRUD/i.test(bullet);

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200 text-[11px] text-slate-800 flex items-start space-x-2"
                >
                  {isOwner ? (
                    <User className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                  ) : isShare ? (
                    <Key className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                  ) : isCrud ? (
                    <Shield className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 mt-0.5 shrink-0" />
                  )}
                  <div className="leading-snug">
                    <MarkdownInline text={bullet.replace(/^[-*•\d.]+\s*/, '')} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * CARD 3: Discrepancy & Blocker Callout
 */
const Card3Blocker: React.FC<{ sectionText: string }> = ({ sectionText }) => {
  const lines = sectionText.split('\n');
  const titleLine =
    lines.find((l) => /CARD\s*3|Discrepancy|Blocker/i.test(l)) ||
    '### ⚠️ CARD 3: Discrepancy & Blocker Callout';
  const cleanTitle = titleLine.replace(/^[#*]+\s*/, '').replace(/\*+$/, '').trim();

  // Strip blockquote '>' and heading lines to extract pure blocker text
  const cleanBodyLines = lines
    .filter((l) => !/^[#*]+\s*(?:CARD\s*3|Discrepancy|Blocker)/i.test(l.trim()))
    .map((l) => l.replace(/^>\s*/, '').trim())
    .filter(Boolean);

  const bodyText = cleanBodyLines.join('\n\n') || sectionText;

  return (
    <div className="bg-gradient-to-r from-amber-50/95 via-orange-50/80 to-amber-50/95 rounded-xl border border-amber-300 shadow-xs p-3.5 space-y-2.5">
      <div className="flex items-center space-x-2 text-amber-950 font-bold text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>{cleanTitle}</span>
      </div>
      <div className="p-3 bg-white/95 border border-amber-200/90 rounded-lg text-[11px] text-amber-950 leading-relaxed shadow-2xs space-y-2">
        <MarkdownContent content={bodyText} />
      </div>
    </div>
  );
};

/**
 * CARD 4: Administrator Remediation Tile (Actionable Fix Steps)
 */
const Card4Remediation: React.FC<{ sectionText: string }> = ({ sectionText }) => {
  const lines = sectionText.split('\n');
  const titleLine =
    lines.find((l) => /CARD\s*4|Remediation|Administrator Remediation/i.test(l)) ||
    '### 🛠️ CARD 4: Administrator Remediation Tile';
  const cleanTitle = titleLine.replace(/^[#*]+\s*/, '').replace(/\*+$/, '').trim();

  // Parse sharing fix and permission fix resiliently
  const sharingFixIndex = lines.findIndex((l) => /Sharing (?:Fix|Architecture|Rule)/i.test(l));
  const permFixIndex = lines.findIndex((l) => /Permission (?:Fix|Setting|FLS)/i.test(l));

  let sharingSteps: string[] = [];
  let permSteps: string[] = [];

  if (sharingFixIndex !== -1) {
    const end = permFixIndex !== -1 && permFixIndex > sharingFixIndex ? permFixIndex : lines.length;
    sharingSteps = lines
      .slice(sharingFixIndex + 1, end)
      .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter((l) => l && !/^[#*]+/.test(l));
  }

  if (permFixIndex !== -1) {
    permSteps = lines
      .slice(permFixIndex + 1)
      .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter((l) => l && !/^[#*]+/.test(l));
  }

  // If no labeled blocks found, extract any numbered or bullet steps in the section
  if (sharingSteps.length === 0 && permSteps.length === 0) {
    const generalSteps = lines
      .filter((l) => /^[*-•\d.]/.test(l.trim()) && !/CARD\s*4/i.test(l))
      .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter(Boolean);
    if (generalSteps.length > 0) {
      sharingSteps = generalSteps;
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-3 bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/50 border-b border-slate-200 flex items-center justify-between">
        <span className="font-bold text-xs text-slate-900 flex items-center">
          <Wrench className="w-4 h-4 text-teal-600 mr-1.5 shrink-0" />
          {cleanTitle}
        </span>
        <span className="text-[10px] bg-emerald-100/80 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
          Setup Action Plan
        </span>
      </div>

      <div className="p-3 space-y-2.5 text-xs">
        {/* Sharing Fix Block */}
        <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-200/80 space-y-1.5 shadow-2xs">
          <span className="font-bold text-[11px] text-teal-950 flex items-center">
            📌 Sharing Architecture Fix (Grant Specific Record Access)
          </span>
          <ol className="space-y-1.5 text-[11px] text-slate-800 pt-0.5">
            {sharingSteps.length > 0 ? (
              sharingSteps.map((step, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-teal-200 text-teal-900 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="leading-snug">
                    <MarkdownInline text={step} />
                  </div>
                </li>
              ))
            ) : (
              <li className="flex items-start space-x-2">
                <span className="w-4 h-4 rounded-full bg-teal-200 text-teal-900 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>Create a Sharing Rule or add a Manual Share granting Read/Write access.</span>
              </li>
            )}
          </ol>
        </div>

        {/* Permission Fix Block */}
        <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/80 space-y-1.5 shadow-2xs">
          <span className="font-bold text-[11px] text-blue-950 flex items-center">
            📌 Permission & FLS Fix (Grant Object / Field Rights)
          </span>
          <ol className="space-y-1.5 text-[11px] text-slate-800 pt-0.5">
            {permSteps.length > 0 ? (
              permSteps.map((step, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-900 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="leading-snug">
                    <MarkdownInline text={step} />
                  </div>
                </li>
              ))
            ) : (
              <li className="flex items-start space-x-2">
                <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-900 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>Inspect Profile or Permission Set Object Permissions & Field-Level Security.</span>
              </li>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
};

/**
 * Universal Markdown text renderer with full Markdown Table, Code Block,
 * List, Blockquote, and Badge support for follow-up turns or unstructured chat.
 */
export const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  const blocks = content.split(/\n\n+/).filter(Boolean);

  return (
    <div className="space-y-2.5 text-[11px] text-slate-800 leading-relaxed font-sans">
      {blocks.map((b, idx) => {
        const trimmed = b.trim();

        // 1. Detect Markdown Table block (| col1 | col2 |)
        const lines = trimmed.split('\n').map((l) => l.trim());
        const isTable = lines.length >= 2 && lines.filter((l) => l.startsWith('|')).length >= 2;

        if (isTable) {
          const tableLines = lines.filter((l) => l.startsWith('|'));
          const headerCells = parseMarkdownTableRow(tableLines[0]);
          const dataRows = tableLines
            .slice(1)
            .filter((l) => !/^[|\s:-]+$/.test(l))
            .map(parseMarkdownTableRow);

          return (
            <div key={idx} className="my-2 rounded-lg border border-slate-200 overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    {headerCells.map((h, i) => (
                      <th key={i} className="px-3 py-2">
                        {h.replace(/\*\*/g, '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-800">
                          {renderStatusBadge(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 2. Code Block (```...```)
        if (trimmed.startsWith('```')) {
          const codeLines = trimmed.split('\n');
          const codeContent = codeLines.slice(1, -1).join('\n') || trimmed.replace(/```[a-z]*\n?|```/g, '');
          return (
            <div key={idx} className="my-2 p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[10px] overflow-x-auto shadow-xs border border-slate-800">
              <pre>{codeContent}</pre>
            </div>
          );
        }

        // 3. Header ###
        if (trimmed.startsWith('###')) {
          return (
            <h4 key={idx} className="font-bold text-xs text-slate-900 pt-1 flex items-center">
              <MarkdownInline text={trimmed.replace(/^###\s*/, '')} />
            </h4>
          );
        }

        // 4. Header ##
        if (trimmed.startsWith('##')) {
          return (
            <h3 key={idx} className="font-bold text-sm text-slate-900 pt-2 border-b border-slate-200 pb-1 flex items-center">
              <MarkdownInline text={trimmed.replace(/^##\s*/, '')} />
            </h3>
          );
        }

        // 5. Blockquote
        if (trimmed.startsWith('>')) {
          const quoteText = lines.map((l) => l.replace(/^>\s*/, '')).join(' ');
          return (
            <blockquote
              key={idx}
              className="border-l-3 border-amber-500 pl-3 py-1.5 bg-amber-50/60 rounded-r text-amber-950 text-[11px] my-1.5"
            >
              <MarkdownInline text={quoteText} />
            </blockquote>
          );
        }

        // 6. Bullet List
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const listItems = lines.filter((l) => l.startsWith('- ') || l.startsWith('* '));
          return (
            <ul key={idx} className="space-y-1 pl-2 my-1">
              {listItems.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start space-x-1.5">
                  <span className="text-blue-500 mt-1 shrink-0">•</span>
                  <div className="leading-snug">
                    <MarkdownInline text={item.replace(/^[-*]\s*/, '')} />
                  </div>
                </li>
              ))}
            </ul>
          );
        }

        // 7. Numbered List
        if (/^\d+\./.test(trimmed)) {
          const numItems = lines.filter((l) => /^\d+\./.test(l));
          return (
            <ol key={idx} className="space-y-1 pl-2 my-1">
              {numItems.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start space-x-1.5">
                  <span className="font-bold text-blue-600 text-[10px] mt-0.5 shrink-0">
                    {itemIdx + 1}.
                  </span>
                  <div className="leading-snug">
                    <MarkdownInline text={item.replace(/^\d+\.\s*/, '')} />
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        // 8. Standard Paragraph
        return (
          <p key={idx} className="leading-relaxed">
            <MarkdownInline text={trimmed} />
          </p>
        );
      })}
    </div>
  );
};

/**
 * Formats inline Markdown: **bold**, `code`, and Setup click paths
 */
export const MarkdownInline: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split by code, bold, or badges
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="bg-slate-100 text-indigo-700 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-bold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      })}
    </>
  );
};

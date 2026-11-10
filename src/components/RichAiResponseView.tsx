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
  Layers,
  Lock,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

interface RichAiResponseViewProps {
  content: string;
}

export const RichAiResponseView: React.FC<RichAiResponseViewProps> = ({ content }) => {
  // If content contains standard CARD sections, render in modular card format
  const hasStructuredCards = /###\s*(.*CARD\s*\d|Executive Access Scorecard|Visual Provenance Chain|Discrepancy & Blocker|Remediation)/i.test(content);

  if (hasStructuredCards) {
    return <StructuredCardViewer rawText={content} />;
  }

  // Otherwise render conversational markdown
  return <MarkdownContent content={content} />;
};

/**
 * Parses and renders the structured AI Verdict cards (Card 1, 2, 3, 4)
 */
const StructuredCardViewer: React.FC<{ rawText: string }> = ({ rawText }) => {
  // Split content by Markdown divider '---' or '### CARD'
  const sections = rawText
    .split(/\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {sections.map((sec, idx) => {
        // Detect Card Type
        if (/CARD\s*1|Executive Access Scorecard/i.test(sec)) {
          return <Card1Scorecard key={idx} sectionText={sec} />;
        }
        if (/CARD\s*2|Provenance Chain/i.test(sec)) {
          return <Card2Provenance key={idx} sectionText={sec} />;
        }
        if (/CARD\s*3|Discrepancy|Blocker/i.test(sec)) {
          return <Card3Blocker key={idx} sectionText={sec} />;
        }
        if (/CARD\s*4|Remediation/i.test(sec)) {
          return <Card4Remediation key={idx} sectionText={sec} />;
        }
        return (
          <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <MarkdownContent content={sec} />
          </div>
        );
      })}
    </div>
  );
};

/**
 * CARD 1: Executive Access Scorecard (Interactive Table View)
 */
const Card1Scorecard: React.FC<{ sectionText: string }> = ({ sectionText }) => {
  // Extract table rows
  const lines = sectionText.split('\n');
  const tableLines = lines.filter((l) => l.trim().startsWith('|'));

  const titleLine = lines.find((l) => l.startsWith('###')) || '### 🎯 CARD 1: Executive Access Scorecard';
  const cleanTitle = titleLine.replace(/^###\s*/, '').trim();

  // If no table lines found, fallback to markdown
  if (tableLines.length < 2) {
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <MarkdownContent content={sectionText} />
      </div>
    );
  }

  const headerCells = tableLines[0]
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);

  const dataRows = tableLines
    .slice(1)
    .filter((l) => !/^[|\s:-]+$/.test(l)) // Filter out markdown delimiter line | :--- | :---: |
    .map((row) =>
      row
        .split('|')
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length) // strip outer empty splits
    );

  const renderBadge = (cellText: string) => {
    if (/🟢|GRANTED|FULL/i.test(cellText)) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-black text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 tracking-wider">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
          GRANTED
        </span>
      );
    }
    if (/🔴|DENIED|BLOCKED/i.test(cellText)) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-black text-[10px] bg-rose-100 text-rose-800 border border-rose-200 tracking-wider">
          <XCircle className="w-3 h-3 mr-1 text-rose-600" />
          DENIED
        </span>
      );
    }
    if (/🟡|PARTIAL|RESTRICTED/i.test(cellText)) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-black text-[10px] bg-amber-100 text-amber-900 border border-amber-200 tracking-wider">
          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
          PARTIAL
        </span>
      );
    }
    return <span className="font-semibold text-slate-700">{cellText}</span>;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-3 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/50 border-b border-slate-200 flex items-center justify-between">
        <span className="font-bold text-xs text-slate-900 flex items-center">
          <Shield className="w-4 h-4 text-blue-600 mr-1.5" />
          {cleanTitle}
        </span>
        <span className="text-[10px] bg-blue-100/70 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
          Verified Verdict
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/80 text-slate-600 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
            <tr>
              {headerCells.map((h, i) => (
                <th key={i} className={`px-3 py-2 ${i === 1 ? 'text-center' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={`px-3 py-2 text-[11px] ${
                      cIdx === 1 ? 'text-center' : 'text-slate-800'
                    }`}
                  >
                    {cIdx === 1 ? (
                      renderBadge(cell)
                    ) : (
                      <span className="leading-snug">{cell.replace(/\*\*/g, '')}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * CARD 2: Visual Provenance Chain & Restricted Fields Cloud
 */
const Card2Provenance: React.FC<{ sectionText: string }> = ({ sectionText }) => {
  const [showAllFields, setShowAllFields] = useState(false);

  const lines = sectionText.split('\n');
  const titleLine = lines.find((l) => l.startsWith('###')) || '### ⛓️ CARD 2: Visual Provenance Chain';
  const cleanTitle = titleLine.replace(/^###\s*/, '').trim();

  // Find step lines (Target User, Group/Role, Share Table, Effective Access)
  const stepItems = lines.filter((l) => l.trim().startsWith('- 👤') || l.trim().startsWith('- 👥') || l.trim().startsWith('- 🔑') || l.trim().startsWith('- 🎯'));

  // Find narrative bullets (Ownership, Share Row Evidence, Object CRUD, Restricted Fields)
  const detailBullets = lines.filter(
    (l) =>
      l.trim().startsWith('- 👤 **Ownership**') ||
      l.trim().startsWith('- 🔑 **Share Row') ||
      l.trim().startsWith('- 🛡️ **Object CRUD') ||
      l.trim().startsWith('- 🔒 **Restricted Fields')
  );

  // Extract restricted fields list if present
  const restrictedFieldLine = lines.find((l) => l.includes('Restricted Fields'));
  let fieldPills: string[] = [];
  if (restrictedFieldLine) {
    const rawFields = restrictedFieldLine.replace(/.*include:\s*/i, '').replace(/.*fields:\s*/i, '');
    fieldPills = rawFields
      .split(',')
      .map((f) => f.trim().replace(/[`.]/g, ''))
      .filter(Boolean);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
      <div className="p-3 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-purple-50/50 border-b border-slate-200 flex items-center justify-between">
        <span className="font-bold text-xs text-slate-900 flex items-center">
          <GitFork className="w-4 h-4 text-indigo-600 mr-1.5" />
          {cleanTitle}
        </span>
        <span className="text-[10px] bg-indigo-100/70 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
          Provenance Path
        </span>
      </div>

      <div className="p-3 space-y-3 text-xs">
        {/* Step-by-step Flow Tiles */}
        {stepItems.length > 0 && (
          <div className="space-y-1.5">
            {stepItems.map((step, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-800 font-medium">
                  <MarkdownInline text={step.replace(/^- /, '')} />
                </div>
                {idx < stepItems.length - 1 && (
                  <ArrowDown className="w-3.5 h-3.5 text-slate-400 my-0.5 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Provenance Detail Cards */}
        {detailBullets.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            {detailBullets.map((bullet, idx) => {
              const isRestrictedFields = bullet.includes('Restricted Fields');
              if (isRestrictedFields && fieldPills.length > 5) {
                const displayedPills = showAllFields ? fieldPills : fieldPills.slice(0, 8);
                return (
                  <div key={idx} className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-amber-950 flex items-center">
                        <Lock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        Restricted Fields ({fieldPills.length} hidden by FLS)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAllFields(!showAllFields)}
                        className="text-[10px] font-bold text-amber-800 hover:text-amber-950 flex items-center bg-amber-100/80 px-2 py-0.5 rounded cursor-pointer"
                      >
                        {showAllFields ? (
                          <>
                            Show Less <ChevronUp className="w-3 h-3 ml-0.5" />
                          </>
                        ) : (
                          <>
                            View All {fieldPills.length} Fields <ChevronDown className="w-3 h-3 ml-0.5" />
                          </>
                        )}
                      </button>
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

              return (
                <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-800">
                  <MarkdownInline text={bullet.replace(/^- /, '')} />
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
  const titleLine = lines.find((l) => l.startsWith('###')) || '### ⚠️ CARD 3: Discrepancy & Blocker Callout';
  const cleanTitle = titleLine.replace(/^###\s*/, '').trim();

  // Extract blockquote text
  const blockquoteLines = lines
    .filter((l) => l.trim().startsWith('>'))
    .map((l) => l.replace(/^>\s*/, '').replace(/\*\*/g, '').trim());

  const explanationText = blockquoteLines.join(' ') || sectionText.replace(/^###.*?\n/, '').trim();

  return (
    <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 rounded-xl border border-amber-300/80 shadow-xs p-3.5 space-y-2">
      <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>{cleanTitle}</span>
      </div>
      <div className="p-2.5 bg-white/90 border border-amber-200 rounded-lg text-[11px] text-amber-950 leading-relaxed shadow-2xs">
        <MarkdownInline text={explanationText} />
      </div>
    </div>
  );
};

/**
 * CARD 4: Administrator Remediation Tile (Actionable Fix Steps)
 */
const Card4Remediation: React.FC<{ sectionText: string }> = ({ sectionText }) => {
  const lines = sectionText.split('\n');
  const titleLine = lines.find((l) => l.startsWith('###')) || '### 🛠️ CARD 4: Administrator Remediation Tile';
  const cleanTitle = titleLine.replace(/^###\s*/, '').trim();

  // Parse sharing fix and permission fix
  const sharingFixIndex = lines.findIndex((l) => /Sharing Fix/i.test(l));
  const permFixIndex = lines.findIndex((l) => /Permission Fix/i.test(l));

  let sharingSteps: string[] = [];
  let permSteps: string[] = [];

  if (sharingFixIndex !== -1) {
    const end = permFixIndex !== -1 && permFixIndex > sharingFixIndex ? permFixIndex : lines.length;
    sharingSteps = lines
      .slice(sharingFixIndex + 1, end)
      .map((l) => l.trim().replace(/^\d+\.\s*/, '').replace(/^- \s*/, ''))
      .filter(Boolean);
  }

  if (permFixIndex !== -1) {
    permSteps = lines
      .slice(permFixIndex + 1)
      .map((l) => l.trim().replace(/^\d+\.\s*/, '').replace(/^- \s*/, ''))
      .filter(Boolean);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-3 bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/50 border-b border-slate-200 flex items-center justify-between">
        <span className="font-bold text-xs text-slate-900 flex items-center">
          <Wrench className="w-4 h-4 text-teal-600 mr-1.5" />
          {cleanTitle}
        </span>
        <span className="text-[10px] bg-emerald-100/70 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
          Setup Action Plan
        </span>
      </div>

      <div className="p-3 space-y-2.5 text-xs">
        {/* Sharing Fix Block */}
        <div className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-200/80 space-y-1.5">
          <span className="font-bold text-[11px] text-teal-950 flex items-center">
            📌 Sharing Architecture Fix (Grant Specific Record Access)
          </span>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-800 pl-1">
            {sharingSteps.length > 0 ? (
              sharingSteps.map((step, idx) => (
                <li key={idx}>
                  <MarkdownInline text={step} />
                </li>
              ))
            ) : (
              <li>Create a Sharing Rule or add a Manual Share granting Read/Write access.</li>
            )}
          </ol>
        </div>

        {/* Permission Fix Block */}
        <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200/80 space-y-1.5">
          <span className="font-bold text-[11px] text-blue-950 flex items-center">
            📌 Permission & FLS Fix (Grant Object / Field Rights)
          </span>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-800 pl-1">
            {permSteps.length > 0 ? (
              permSteps.map((step, idx) => (
                <li key={idx}>
                  <MarkdownInline text={step} />
                </li>
              ))
            ) : (
              <li>Inspect Profile or Permission Set Object Permissions & Field-Level Security.</li>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
};

/**
 * Universal Markdown text renderer for headers, tables, lists, code, and bold spans
 */
const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const paragraphs = content.split('\n\n').filter(Boolean);

  return (
    <div className="space-y-2 text-[11px] text-slate-800 leading-relaxed font-sans">
      {paragraphs.map((p, idx) => {
        const trimmed = p.trim();

        // Header ###
        if (trimmed.startsWith('###')) {
          return (
            <h4 key={idx} className="font-bold text-xs text-slate-900 pt-1 flex items-center">
              <MarkdownInline text={trimmed.replace(/^###\s*/, '')} />
            </h4>
          );
        }

        // Header ##
        if (trimmed.startsWith('##')) {
          return (
            <h3 key={idx} className="font-bold text-sm text-slate-900 pt-2 border-b border-slate-200 pb-1">
              <MarkdownInline text={trimmed.replace(/^##\s*/, '')} />
            </h3>
          );
        }

        // Blockquote
        if (trimmed.startsWith('>')) {
          return (
            <blockquote key={idx} className="border-l-3 border-amber-500 pl-3 py-1 bg-amber-50/50 rounded-r text-amber-950 text-[11px]">
              <MarkdownInline text={trimmed.replace(/^>\s*/, '')} />
            </blockquote>
          );
        }

        // Bullet list
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split('\n').filter((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '));
          return (
            <ul key={idx} className="space-y-1 pl-2">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start space-x-1.5">
                  <span className="text-slate-400 mt-1">•</span>
                  <span>
                    <MarkdownInline text={item.replace(/^[-*]\s*/, '')} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        // Standard Paragraph
        return (
          <p key={idx}>
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
const MarkdownInline: React.FC<{ text: string }> = ({ text }) => {
  // Replace Setup click-paths like **Setup** > **Sharing Settings** with styled pills
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="bg-slate-100 text-indigo-700 font-mono text-[10px] px-1 py-0.5 rounded border border-slate-200"
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

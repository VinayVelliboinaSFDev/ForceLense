import { AnalysisResult } from '../types';

/**
 * Generates a concise, straight, and strong prompt for external AI apps (ChatGPT, Claude, Copilot, Gemini).
 * Formatted to produce an exact summary of permissions and exact access provenance without unnecessary fluff.
 */
export function generateAiPrompt(result: AnalysisResult): string {
  const {
    objectApiName,
    recordId,
    recordName,
    targetUserId,
    targetUserName,
    recordAccess,
    objectPermissions,
    fieldPermissions,
    sharingFindings,
    limitations,
  } = result;

  const restrictedFields = fieldPermissions.filter((f) => f.readable === false);
  const editableFields = fieldPermissions.filter((f) => f.editable === true);

  return `# Salesforce Access Summary & Provenance Request

Analyze this verified Salesforce REST API evidence for **${targetUserName}** on **${objectApiName}** (${recordId}).
Answer strictly and concisely in a direct, strong context. Avoid generic introductions, pleasantries, and lengthy Salesforce tutorials.

---

## 1. Context & Verified Signals
- **Record**: ${objectApiName} [${recordId}] ${recordName ? `("${recordName}")` : ''}
- **User**: ${targetUserName} (ID: ${targetUserId})
- **UserRecordAccess API**: Read: ${recordAccess?.read ?? 'Unknown'} | Edit: ${recordAccess?.edit ?? 'Unknown'} | Delete: ${recordAccess?.delete ?? 'Unknown'} | Transfer: ${recordAccess?.transfer ?? 'Unknown'} | MaxAccessLevel: ${recordAccess?.maxAccessLevel ?? 'Unknown'}
- **Object CRUD (${objectApiName})**: Read: ${objectPermissions.read} | Create: ${objectPermissions.create} | Edit: ${objectPermissions.edit} | Delete: ${objectPermissions.delete} | ViewAll: ${objectPermissions.viewAll} | ModifyAll: ${objectPermissions.modifyAll}
- **Field-Level Security (FLS)**: ${fieldPermissions.length - restrictedFields.length}/${fieldPermissions.length} fields readable, ${editableFields.length} editable.${
    restrictedFields.length > 0
      ? ` Restricted: ${restrictedFields.map((f) => f.fieldApiName).join(', ')}`
      : ' All fields readable.'
  }

## 2. Share Table & Hierarchy Findings
${
  sharingFindings.length > 0
    ? sharingFindings
        .map(
          (f, idx) =>
            `${idx + 1}. [${f.status.toUpperCase()}] ${f.label} -> AccessLevel: ${f.accessLevel} (RowCause: ${
              f.rowCause || 'N/A'
            }, Source: ${f.source}${f.path && f.path.length > 0 ? `, Path: ${f.path.join(' → ')}` : ''})`
        )
        .join('\n')
    : 'No share table rows found. Access governed by OWD or system admin permissions.'
}

${
  limitations.length > 0
    ? `## 3. Platform Limitations\n${limitations.map((l) => `- ${l}`).join('\n')}\n`
    : ''
}
---

## Required Response Format (Keep Simple, Straight & Strong):
Provide ONLY the following 2 bulleted sections:

### 1. Exact Access Verdict
- Clear, 1-2 sentence statement of what ${targetUserName} can and cannot do on this record (Read, Edit, Delete, FLS).

### 2. Exact Access Provenance (How Access Came)
- Bullet points detailing exactly how and where each access originated (Record Ownership, Share table row, Public Group / Role chain, Profile/Permission Set CRUD, or OWD).
- If any permission discrepancy exists (e.g. Object Edit granted but Record Edit blocked), state the exact missing link.
`;
}

export function openExternalAiApp(app: 'chatgpt' | 'claude' | 'copilot' | 'gemini', promptText: string) {
  // Always copy prompt to clipboard so it's instantly pasteable
  if (navigator.clipboard) {
    navigator.clipboard.writeText(promptText).catch(() => {});
  }

  let targetUrl = '';
  switch (app) {
    case 'chatgpt':
      if (promptText.length < 1800) {
        targetUrl = `https://chatgpt.com/?q=${encodeURIComponent(promptText)}`;
      } else {
        targetUrl = 'https://chatgpt.com/';
      }
      break;
    case 'claude':
      targetUrl = 'https://claude.ai/new';
      break;
    case 'copilot':
      targetUrl = 'https://copilot.microsoft.com/';
      break;
    case 'gemini':
      targetUrl = 'https://gemini.google.com/app';
      break;
  }

  if (targetUrl) {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
}

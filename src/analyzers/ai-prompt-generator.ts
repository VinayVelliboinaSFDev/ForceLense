import { AnalysisResult } from '../types';

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
    evidence,
    limitations,
  } = result;

  const restrictedFields = fieldPermissions.filter((f) => f.readable === false);
  const editableFields = fieldPermissions.filter((f) => f.editable === true);

  return `# Salesforce Security & Record Access Analysis Request

You are an expert Salesforce Certified Technical Architect (CTA) and Security Specialist.
Analyze the following evidence collected directly from the Salesforce REST API and explain the access model, the exact grant paths, why restrictions apply, and how an administrator can modify or grant access.

---

## 1. Context Information
- **Salesforce Object**: ${objectApiName}
- **Record ID**: ${recordId}
- **Record Name**: ${recordName || 'N/A'}
- **Target User**: ${targetUserName} (User ID: ${targetUserId})
- **Analysis Timestamp**: ${result.completedAt || result.startedAt}

---

## 2. Effective Record Access (UserRecordAccess API Evidence)
- **HasReadAccess**: ${recordAccess?.read ?? 'Unknown'}
- **HasEditAccess**: ${recordAccess?.edit ?? 'Unknown'}
- **HasDeleteAccess**: ${recordAccess?.delete ?? 'Unknown'}
- **HasTransferAccess**: ${recordAccess?.transfer ?? 'Unknown'}
- **HasAllAccess**: ${recordAccess?.all ?? 'Unknown'}
- **MaxAccessLevel**: ${recordAccess?.maxAccessLevel ?? 'Unknown'}

---

## 3. Object-Level CRUD Permissions (${objectApiName})
- **Read**: ${objectPermissions.read}
- **Create**: ${objectPermissions.create}
- **Edit**: ${objectPermissions.edit}
- **Delete**: ${objectPermissions.delete}
- **View All Records**: ${objectPermissions.viewAll}
- **Modify All Records**: ${objectPermissions.modifyAll}

---

## 4. Field-Level Security (FLS) Summary
- **Total Fields Analyzed**: ${fieldPermissions.length}
- **Editable Fields**: ${editableFields.length}
- **Restricted/Hidden Fields (${restrictedFields.length})**: ${
    restrictedFields.length > 0
      ? restrictedFields.map((f) => `\`${f.fieldApiName}\` (${f.label})`).join(', ')
      : 'None (all fields readable)'
  }

---

## 5. Sharing Evidence & Grant Paths
${
  sharingFindings.length > 0
    ? sharingFindings
        .map(
          (f, idx) =>
            `${idx + 1}. **[${f.status.toUpperCase()}] ${f.label}**\n   - Access Level: ${f.accessLevel}\n   - RowCause: ${
              f.rowCause || 'N/A'
            }\n   - Source: \`${f.source}\`${
              f.path && f.path.length > 0 ? `\n   - Resolved Path: ${f.path.join(' → ')}` : ''
            }`
        )
        .join('\n\n')
    : 'No explicit share table rows found. Access may be governed by OWD (Org-Wide Defaults) or System Administrator privileges.'
}

---

## 6. Known Limitations & Platform Boundaries
${limitations.map((l) => `- ${l}`).join('\n')}

---

## Instructions for your response:
1. **Executive Verdict**: Summarize what ${targetUserName} can and cannot do on this record in plain English.
2. **Access Root Cause**: Detail exactly *how* and *where* their access originated (Profile vs. Permission Set vs. Share Table vs. Role Hierarchy vs. OWD).
3. **Blockers & Discrepancies**: If the user has object Edit but cannot edit this record (or if FLS hides specific fields), clearly explain why.
4. **Remediation Action Plan**: Provide exact, step-by-step instructions for a Salesforce Administrator on how to grant Edit/Delete access or unblock fields if needed (including Salesforce Setup click-paths and sharing rule configurations).
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
      // ChatGPT allows pre-filling the prompt via URL query param 'q' (for up to ~2KB)
      // We encode a concise version or full query
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

import { AnalysisResult } from '../types';

/**
 * Generates a visual, colorful, and rich-in-view prompt for external AI apps (ChatGPT, Claude, Copilot, Gemini).
 * Commands the AI to render structured cards, scorecard tiles, badges, status emojis, and provenance chains.
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

  return `# Salesforce Access Summary & Provenance Analysis Request

You are an expert Salesforce CTA and Security Architect.
Analyze this verified Salesforce REST API evidence for **${targetUserName}** on **${objectApiName}** (\`${recordId}\`).

**Output Instructions**:
Present your answer in a **highly visual, colorful, and rich view** using **Markdown cards, scorecard tables, status badges, emojis, and visual arrows**. Keep it concise, straight, and authoritative (no generic filler or introductory essays).

---

## 📇 REQUIRED OUTPUT FORMAT:

### 🎯 CARD 1: Executive Access Scorecard (Visual Table)
Create a clean scorecard table using these exact visual badges (🟢 GRANTED, 🔴 DENIED, 🟡 RESTRICTED):

| Capability | Status | Effective Grant | Provenance Origin |
| :--- | :---: | :--- | :--- |
| 👁️ **Record Read** | ${recordAccess?.read ? '🟢 GRANTED' : '🔴 DENIED'} | ${recordAccess?.read ? 'Can View Record' : 'No View Access'} | [Cite exact Share row / Owner / OWD] |
| ✏️ **Record Edit** | ${recordAccess?.edit ? '🟢 GRANTED' : '🔴 DENIED'} | ${recordAccess?.edit ? 'Can Edit Record' : 'Edit Blocked'} | [Cite exact Write grant or missing share] |
| 🗑️ **Record Delete** | ${recordAccess?.delete ? '🟢 GRANTED' : '🔴 DENIED'} | ${recordAccess?.delete ? 'Can Delete Record' : 'Delete Blocked'} | [Cite Profile Delete CRUD / Ownership] |
| 🔄 **Record Transfer** | ${recordAccess?.transfer ? '🟢 GRANTED' : '🔴 DENIED'} | ${recordAccess?.transfer ? 'Can Change Owner' : 'Transfer Blocked'} | [Cite Transfer Record permissions] |
| 🔒 **Field-Level Security** | ${restrictedFields.length === 0 ? '🟢 FULL' : '🟡 PARTIAL'} | ${fieldPermissions.length - restrictedFields.length}/${fieldPermissions.length} Fields Readable | Profile & Permission Sets |

---

### ⛓️ CARD 2: Visual Provenance Chain (How Access Was Granted)
Map the exact grant path from User to Record using a visual step-by-step breadcrumb tile:
- 👤 **Target User**: \`${targetUserName}\` (\`${targetUserId}\`)
- ⬇️
- 👥 **Public Group / Role Membership**: [State matched Public Group or Role]
- ⬇️
- 🔑 **Share Table Grant**: [State Share Table, RowCause, AccessLevel]
- ⬇️
- 🎯 **Effective Record Access**: [MaxAccessLevel: ${recordAccess?.maxAccessLevel || 'None'}]

Provide 3-4 bullet points detailing:
- 👤 **Ownership**: Whether user is the direct record owner or queue member.
- 🔑 **Share Row Evidence**: Specific share record findings and RowCause.
- 🛡️ **Object CRUD Baseline**: Granted object permissions via Profile/Permission Sets.
- 🔒 **Restricted Fields**: Explicitly list denied fields (${restrictedFields.length > 0 ? restrictedFields.map((f) => f.fieldApiName).join(', ') : 'None'}).

---

### ⚠️ CARD 3: Discrepancy & Blocker Callout
${
  recordAccess?.read && !recordAccess?.edit && objectPermissions.edit
    ? `Highlight in an alert box why Object Edit is granted on ${objectApiName} but Record Edit is blocked on this specific record.`
    : !recordAccess?.read && objectPermissions.read
    ? `Highlight in an alert box why Object Read is granted on ${objectApiName} but Record Read is blocked on this specific record.`
    : `State whether any permission blockers or FLS restrictions exist.`
}

---

### 🛠️ CARD 4: Administrator Remediation Tile
Provide a 2-step direct Salesforce Setup click-path if an admin needs to modify or grant access:
- 📌 **Sharing Fix**: Exact Setup path to add Sharing Rule or Manual Share.
- 📌 **Permission Fix**: Exact Setup path for Profile or Permission Set.

---

## 📊 RAW VERIFIED EVIDENCE FROM SALESFORCE API:

### 1. Record & User Context
- **Object**: \`${objectApiName}\`
- **Record ID**: \`${recordId}\`
- **Record Name**: ${recordName ? `"${recordName}"` : 'N/A'}
- **Target User**: \`${targetUserName}\` (ID: \`${targetUserId}\`)

### 2. UserRecordAccess API Signals
- HasReadAccess: \`${recordAccess?.read ?? false}\`
- HasEditAccess: \`${recordAccess?.edit ?? false}\`
- HasDeleteAccess: \`${recordAccess?.delete ?? false}\`
- HasTransferAccess: \`${recordAccess?.transfer ?? false}\`
- MaxAccessLevel: \`${recordAccess?.maxAccessLevel ?? 'None'}\`

### 3. Object CRUD Permissions (\`${objectApiName}\`)
- Read: \`${objectPermissions.read}\` | Create: \`${objectPermissions.create}\` | Edit: \`${objectPermissions.edit}\` | Delete: \`${objectPermissions.delete}\` | ViewAll: \`${objectPermissions.viewAll}\` | ModifyAll: \`${objectPermissions.modifyAll}\`

### 4. Field-Level Security (FLS)
- Total Fields: ${fieldPermissions.length} | Editable: ${editableFields.length} | Restricted: ${restrictedFields.length}
${
  restrictedFields.length > 0
    ? `- Restricted Field Details: ${restrictedFields
        .map((f) => `\`${f.fieldApiName}\` (${f.label})`)
        .join(', ')}`
    : '- All tested fields are readable.'
}

### 5. Share Table & Hierarchy Findings
${
  sharingFindings.length > 0
    ? sharingFindings
        .map(
          (f, idx) =>
            `${idx + 1}. [${f.status.toUpperCase()}] **${f.label}**\n   - AccessLevel: \`${f.accessLevel}\` | RowCause: \`${f.rowCause || 'N/A'}\` | Source: \`${f.source}\`${
              f.path && f.path.length > 0 ? `\n   - Traversal Path: ${f.path.join(' → ')}` : ''
            }`
        )
        .join('\n')
    : 'No explicit share table rows found. Access governed by OWD or system admin permissions.'
}

${
  limitations.length > 0
    ? `### 6. Platform Limitations\n${limitations.map((l) => `- ${l}`).join('\n')}\n`
    : ''
}
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

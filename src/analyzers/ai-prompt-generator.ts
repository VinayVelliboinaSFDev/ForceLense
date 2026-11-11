import { AnalysisResult } from '../types';

/**
 * Generates a visual, colorful, and rich-in-view prompt for external AI apps (ChatGPT, Claude, Copilot, Gemini)
 * and in-extension AI Copilot. Focuses strictly on Record Access, Object CRUD, and Sharing Provenance (FLS excluded).
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
    sharingFindings,
    limitations,
  } = result;

  return `# Salesforce Access Summary & Provenance Analysis Request

You are an expert Salesforce CTA and Security Architect.
Analyze this verified Salesforce REST API evidence for **${targetUserName}** on **${objectApiName}** (\`${recordId}\`).

**Output Instructions**:
Present your answer in a **highly visual, colorful, and rich view** using **Markdown cards, scorecard tables, status badges, emojis, and visual arrows**. Keep it concise, straight, and authoritative (no generic filler or introductory essays). Focus strictly on Record Access, Object CRUD, and Sharing Provenance.
Always output the exact 4 cards (CARD 1, CARD 2, CARD 3, CARD 4) separated by '---' dividers. In CARD 1, always output the Markdown table format with pipes (|) and status badges (🟢 GRANTED, 🔴 DENIED, 🟡 PARTIAL).

---

## 📇 REQUIRED OUTPUT FORMAT:

### 🎯 CARD 1: Executive Access Scorecard (Visual Table)
Create a clean scorecard table using these exact visual badges (🟢 GRANTED, 🔴 DENIED):

| Capability | Status | Effective Grant | Provenance Origin |
| :--- | :---: | :--- | :--- |
| 👁️ **Record Read** | ${recordAccess?.read ? '🟢 GRANTED' : '🔴 DENIED'} | ${recordAccess?.read ? 'Can View Record' : 'No View Access'} | [Cite exact Share row / Owner / OWD] |
| ✏️ **Record Edit** | ${recordAccess?.edit ? '🟢 GRANTED' : '🔴 DENIED'} | ${recordAccess?.edit ? 'Can Edit Record' : 'Edit Blocked'} | [Cite exact Write grant or missing share] |
| 🗑️ **Record Delete** | ${recordAccess?.delete ? '🟢 GRANTED' : '🔴 DENIED'} | ${recordAccess?.delete ? 'Can Delete Record' : 'Delete Blocked'} | [Cite Profile Delete CRUD / Ownership] |
| 🔄 **Record Transfer** | ${recordAccess?.transfer ? '🟢 GRANTED' : '🔴 DENIED'} | ${recordAccess?.transfer ? 'Can Change Owner' : 'Transfer Blocked'} | [Cite Transfer Record permissions] |

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

Provide 3 bullet points detailing:
- 👤 **Ownership**: Whether user is the direct record owner or queue member.
- 🔑 **Share Row Evidence**: Specific share record findings and RowCause.
- 🛡️ **Object CRUD Baseline**: Granted object permissions via Profile/Permission Sets.

---

### ⚠️ CARD 3: Discrepancy & Blocker Callout
${
  recordAccess?.read && !recordAccess?.edit && objectPermissions.edit
    ? `Highlight in an alert box why Object Edit is granted on ${objectApiName} but Record Edit is blocked on this specific record (intersection of Object CRUD and Sharing).`
    : !recordAccess?.read && objectPermissions.read
    ? `Highlight in an alert box why Object Read is granted on ${objectApiName} but Record Read is blocked on this specific record.`
    : `State whether any permission blockers exist between Object CRUD and Record Sharing.`
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

### 4. Share Table & Hierarchy Findings
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
    ? `### 5. Platform Limitations\n${limitations.map((l) => `- ${l}`).join('\n')}\n`
    : ''
}
`;
}

/**
 * Generates an AI prompt comparing access differences between User A and User B
 * on the current Salesforce record, focusing strictly on Record Access, Object CRUD, and Sharing Provenance.
 */
export function generateDiffAiPrompt(resultA: AnalysisResult, resultB: AnalysisResult): string {
  const userAName = resultA.targetUserName || 'User A';
  const userBName = resultB.targetUserName || 'User B';
  const objectApiName = resultA.objectApiName;
  const recordId = resultA.recordId;

  return `# Salesforce User Access Discrepancy (Diff) Analysis Request

You are an expert Salesforce CTA and Security Architect.
Explain why **${userAName}** and **${userBName}** have different access levels on **${objectApiName}** (\`${recordId}\`).

**Output Instructions**:
Present your answer in a **clean, structured executive format** using **cards, comparative tables, and status badges (🟢 / 🔴)**.
Focus strictly on Record Access, Object CRUD, and Sharing Provenance (OWD, Share Rows, Groups, Roles, Queues, Record Ownership).

---

## 📇 REQUIRED OUTPUT FORMAT:

### 🎯 CARD 1: Executive Access Diff Matrix
| Capability | ${userAName} | ${userBName} | Discrepancy Reason |
| :--- | :---: | :---: | :--- |
| 👁️ **Record Read** | ${resultA.recordAccess?.read ? '🟢 GRANTED' : '🔴 DENIED'} | ${resultB.recordAccess?.read ? '🟢 GRANTED' : '🔴 DENIED'} | [Cite exact difference in share row or OWD] |
| ✏️ **Record Edit** | ${resultA.recordAccess?.edit ? '🟢 GRANTED' : '🔴 DENIED'} | ${resultB.recordAccess?.edit ? '🟢 GRANTED' : '🔴 DENIED'} | [Cite exact difference in edit share or ownership] |
| 🗑️ **Record Delete** | ${resultA.recordAccess?.delete ? '🟢 GRANTED' : '🔴 DENIED'} | ${resultB.recordAccess?.delete ? '🟢 GRANTED' : '🔴 DENIED'} | [Cite Profile delete CRUD or record ownership] |
| 🔄 **Record Transfer** | ${resultA.recordAccess?.transfer ? '🟢 GRANTED' : '🔴 DENIED'} | ${resultB.recordAccess?.transfer ? '🟢 GRANTED' : '🔴 DENIED'} | [Cite ownership or transfer rights] |
| 🏆 **Max Access** | \`${resultA.recordAccess?.maxAccessLevel || 'None'}\` | \`${resultB.recordAccess?.maxAccessLevel || 'None'}\` | [Explain difference in ceiling level] |

---

### ⛓️ CARD 2: Provenance Root Cause Comparison
Explain the exact structural reason why access differs:
- 👤 **Record Ownership**: Compare whether either user is the direct owner or in the owning queue.
- 🔑 **Share Table Grants**: Compare explicit Share rows (Rule, Manual, Role, Group) granting access to ${userAName} vs ${userBName}.
- 🛡️ **Object CRUD Baseline**: Compare Profile/Permission Set Create/Read/Edit/Delete permissions on ${objectApiName}.

---

### ⚠️ CARD 3: Discrepancy & Blocker Callout
Provide an authoritative summary explaining: "Why can ${userAName} perform actions that ${userBName} cannot (or vice-versa)?" Highlight any intersection model blockers.

---

### 🛠️ CARD 4: Administrator Remediation Tile
Provide direct Salesforce Setup steps if an administrator needs to align ${userBName}'s access to match ${userAName}:
- 📌 **Sharing Fix**: Exact Setup click-path (Sharing Rules or Manual Sharing).
- 📌 **Permission Fix**: Exact Setup click-path (Profile or Permission Sets).

---

## 📊 RAW VERIFIED EVIDENCE FROM SALESFORCE API:

### User A: ${userAName} (${resultA.targetUserId})
- Profile: \`${resultA.targetUserProfileName || 'N/A'}\` | Role: \`${resultA.targetUserRoleName || 'N/A'}\`
- Record Access: Read=${resultA.recordAccess?.read}, Edit=${resultA.recordAccess?.edit}, Delete=${resultA.recordAccess?.delete}, Transfer=${resultA.recordAccess?.transfer}, Max=${resultA.recordAccess?.maxAccessLevel}
- Object CRUD: Read=${resultA.objectPermissions.read}, Create=${resultA.objectPermissions.create}, Edit=${resultA.objectPermissions.edit}, Delete=${resultA.objectPermissions.delete}, ViewAll=${resultA.objectPermissions.viewAll}, ModifyAll=${resultA.objectPermissions.modifyAll}
- Sharing Findings:
${resultA.sharingFindings.map((f) => `  - [${f.status}] ${f.label} (${f.accessLevel}, RowCause: ${f.rowCause}, Source: ${f.source})`).join('\n') || '  - None'}

### User B: ${userBName} (${resultB.targetUserId})
- Profile: \`${resultB.targetUserProfileName || 'N/A'}\` | Role: \`${resultB.targetUserRoleName || 'N/A'}\`
- Record Access: Read=${resultB.recordAccess?.read}, Edit=${resultB.recordAccess?.edit}, Delete=${resultB.recordAccess?.delete}, Transfer=${resultB.recordAccess?.transfer}, Max=${resultB.recordAccess?.maxAccessLevel}
- Object CRUD: Read=${resultB.objectPermissions.read}, Create=${resultB.objectPermissions.create}, Edit=${resultB.objectPermissions.edit}, Delete=${resultB.objectPermissions.delete}, ViewAll=${resultB.objectPermissions.viewAll}, ModifyAll=${resultB.objectPermissions.modifyAll}
- Sharing Findings:
${resultB.sharingFindings.map((f) => `  - [${f.status}] ${f.label} (${f.accessLevel}, RowCause: ${f.rowCause}, Source: ${f.source})`).join('\n') || '  - None'}
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

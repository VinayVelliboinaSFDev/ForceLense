import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichAiResponseView } from '../src/components/RichAiResponseView';

describe('RichAiResponseView Component', () => {
  const sampleGeminiOutput = `### 🎯 CARD 1: Executive Access Scorecard (Visual Table)

| Capability | Status | Effective Grant | Provenance Origin |
| :--- | :---: | :--- | :--- |
| 👁️ **Record Read** | 🟢 GRANTED | Can View Record | Organization-Wide Defaults (OWD) / Standard Read Access |
| ✏️ **Record Edit** | 🔴 DENIED | Edit Blocked | Missing Write Share / Read-Only OWD Access |
| 🗑️ **Record Delete** | 🔴 DENIED | Delete Blocked | Profile Delete CRUD Disabled (\`Delete: false\`) |
| 🔄 **Record Transfer** | 🔴 DENIED | Transfer Blocked | Transfer Record Permission / Ownership Restrictions |
| 🔒 **Field-Level Security** | 🟡 PARTIAL | 159/279 Fields Readable | Profile & Permission Sets (120 Restricted Fields) |

---

### ⛓️ CARD 2: Visual Provenance Chain (How Access Was Granted)

- 👤 **Target User**: \`Melissa King\` (\`005On000004W1mfIAC\`)
- ⬇️
- 👥 **Public Group / Role Membership**: [No explicit Public Group or Role match found in Share tables]
- ⬇️
- 🔑 **Share Table Grant**: [No explicit \`CaseShare\` row found; governed by baseline sharing architecture]
- ⬇️
- 🎯 **Effective Record Access**: [MaxAccessLevel: Read]

- 👤 **Ownership**: Melissa King is **not** the direct record owner or a queue member of Case \`5009r00000b3tgzAAA\`.
- 🔑 **Share Row Evidence**: No explicit manual or rule-based share rows exist in \`CaseShare\`. Access is restricted to baseline visibility.
- 🛡️ **Object CRUD Baseline**: Melissa holds standard Create (\`true\`) and Edit (\`true\`) object permissions on \`Case\`, but lacks Delete (\`false\`), ViewAll (\`false\`), and ModifyAll (\`false\`).
- 🔒 **Restricted Fields**: Explicitly denied/restricted fields include: \`SourceId\`, \`AMP_Original_Salesforce_ID__c\`, \`Account_Name__c\`, \`BPMS_Mini_Enrichment_Failed__c\`, \`Claim_Number__c\`, \`Contact_Address_1__c\`.

---

### ⚠️ CARD 3: Discrepancy & Blocker Callout

> **BLOCKER EXPLANATION**: 
> While Melissa King's Profile grants global object-level **Edit** rights for the \`Case\` object, Salesforce security architecture enforces a strict intersection model: **Object CRUD grants the *capability* to edit, but Sharing (OWD / Share Tables / Role Hierarchy) grants access to the *specific record*.** Because \`Case\` OWD restricts her to Read-only and no sharing rule or manual share grants Read/Write access to record \`5009r00000b3tgzAAA\`, her effective access (\`UserRecordAccess.HasEditAccess\`) evaluates to \`false\`.

---

### 🛠️ CARD 4: Administrator Remediation Tile

- 📌 **Sharing Fix**: 
  1. Navigate to **Setup** > **Sharing Settings**.
  2. Locate **Case Sharing Rules** and click **New** (or use **Manual Sharing** directly on the Case record \`5009r00000b3tgzAAA\`).
  3. Grant Read/Write access to Melissa King (or a Public Group/Role she belongs to).

- 📌 **Permission Fix**: 
  1. Navigate to **Setup** > **Profiles** (or **Permission Sets**).
  2. Select Melissa's Profile/Permission Set and go to **Object Settings** > **Cases**.
  3. Adjust FLS to uncheck restrictions on required fields, or enable **Modify All** if broader administrative override is intended.`;

  it('renders structured 4-Card view with scorecard table, badges, and remediation steps', () => {
    const html = renderToStaticMarkup(React.createElement(RichAiResponseView, { content: sampleGeminiOutput }));

    // Card 1 Checks
    expect(html).toContain('CARD 1: Executive Access Scorecard');
    expect(html).toContain('GRANTED');
    expect(html).toContain('DENIED');
    expect(html).toContain('PARTIAL');
    expect(html).toContain('Record Read');
    expect(html).toContain('Record Edit');

    // Card 2 Checks
    expect(html).toContain('CARD 2: Visual Provenance Chain');
    expect(html).toContain('Melissa King');
    expect(html).toContain('Restricted Fields');
    expect(html).toContain('AMP_Original_Salesforce_ID__c');

    // Card 3 Checks
    expect(html).toContain('CARD 3: Discrepancy &amp; Blocker Callout');
    expect(html).toContain('BLOCKER EXPLANATION');

    // Card 4 Checks
    expect(html).toContain('CARD 4: Administrator Remediation Tile');
    expect(html).toContain('Sharing Architecture Fix');
    expect(html).toContain('Setup');
    expect(html).toContain('Sharing Settings');
  });

  it('renders regular conversational markdown for follow-up turns', () => {
    const followUpText = `Here is how you can create an Owner-Based Sharing Rule:

1. Go to **Setup** > **Sharing Settings**
2. In Case Sharing Rules, choose **Based on record owner**
3. Select the public group to share with`;

    const html = renderToStaticMarkup(React.createElement(RichAiResponseView, { content: followUpText }));

    expect(html).toContain('Here is how you can create an Owner-Based Sharing Rule:');
    expect(html).toContain('Sharing Settings');
    expect(html).toContain('Based on record owner');
  });
});

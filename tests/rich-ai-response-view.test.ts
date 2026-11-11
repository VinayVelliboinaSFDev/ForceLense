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

  it('renders rich cards from Ollama llama3.2:3b even without divider lines (---) and with varying headers', () => {
    const rawOllamaNoDividers = `### CARD 1: Executive Access Scorecard
| Capability | Status | Effective Grant | Provenance Origin |
| --- | --- | --- | --- |
| Record Read | 🟢 GRANTED | Can View Record | Organization-Wide Defaults |
| Record Edit | 🔴 DENIED | Edit Blocked | Missing Write Share |
| Record Delete | 🔴 DENIED | Delete Blocked | Profile Delete CRUD Disabled |
| Record Transfer | 🔴 DENIED | Transfer Blocked | Transfer Record Permission |

### CARD 2: Visual Provenance Chain
- Target User: Melissa King (005On000004W1mfIAC)
- Public Group / Role Membership: None
- Share Table Grant: Governed by baseline sharing
- Effective Record Access: MaxAccessLevel: Read
- Ownership: Melissa King is not the direct record owner.
- Share Row Evidence: No explicit manual or rule-based share rows exist.
- Object CRUD Baseline: Melissa holds standard Create and Edit object permissions.

### CARD 3: Discrepancy & Blocker Callout
While Melissa King's Profile grants global object-level Edit rights for the Case object, Salesforce security architecture enforces a strict intersection model: Object CRUD grants the capability to edit, but Sharing grants access to the specific record.

### CARD 4: Administrator Remediation Tile
1. Sharing Fix: Navigate to Setup > Sharing Settings and add a Case Sharing Rule granting Read/Write access.
2. Permission Fix: Navigate to Setup > Profiles and adjust Object Settings.`;

    const html = renderToStaticMarkup(React.createElement(RichAiResponseView, { content: rawOllamaNoDividers }));

    // Verifies all 4 cards are parsed and rendered as rich UI tiles even with NO '---' dividers
    expect(html).toContain('CARD 1: Executive Access Scorecard');
    expect(html).toContain('GRANTED');
    expect(html).toContain('DENIED');
    expect(html).toContain('CARD 2: Visual Provenance Chain');
    expect(html).toContain('Melissa King');
    expect(html).toContain('CARD 3: Discrepancy &amp; Blocker Callout');
    expect(html).toContain('CARD 4: Administrator Remediation Tile');
    expect(html).toContain('Sharing Architecture Fix');
  });

  it('transforms bullet-formatted Card 1 from smaller local models into rich scorecard view', () => {
    const rawBulletScorecard = `### CARD 1: Executive Access Scorecard
- 👁️ Record Read: 🟢 GRANTED - Can View Record (Organization-Wide Defaults)
- ✏️ Record Edit: 🔴 DENIED - Edit Blocked (Missing Write Share)
- 🗑️ Record Delete: 🔴 DENIED - Delete Blocked (Profile Delete CRUD Disabled)
- 🔄 Record Transfer: 🔴 DENIED - Transfer Blocked (Transfer Record Permission)

### CARD 3: Discrepancy & Blocker Callout
Record is Read-only due to Case OWD.`;

    const html = renderToStaticMarkup(React.createElement(RichAiResponseView, { content: rawBulletScorecard }));

    // Verifies bullet list was transformed into rich capability cards with glowing badges
    expect(html).toContain('Scorecard View');
    expect(html).toContain('Record Read');
    expect(html).toContain('Record Edit');
    expect(html).toContain('GRANTED');
    expect(html).toContain('DENIED');
    expect(html).toContain('Organization-Wide Defaults');
  });

  it('renders Markdown tables inside conversational follow-up turns with rich badges', () => {
    const tableChatOutput = `Here is a summary of the active sharing rules on this Case:

| Rule Name | Share With | Access Level | RowCause |
| :--- | :--- | :---: | :--- |
| Case Tier 2 Escalations | Tier 2 Support Queue | 🟢 GRANTED | Rule |
| VIP Case Sharing | Executive VIP Group | 🔴 DENIED | Manual |`;

    const html = renderToStaticMarkup(React.createElement(RichAiResponseView, { content: tableChatOutput }));

    expect(html).toContain('Case Tier 2 Escalations');
    expect(html).toContain('Tier 2 Support Queue');
    expect(html).toContain('GRANTED');
    expect(html).toContain('DENIED');
    expect(html).toContain('<table');
  });
});

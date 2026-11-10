import { describe, it, expect } from 'vitest';
import { generateAiPrompt, generateDiffAiPrompt } from '../src/analyzers/ai-prompt-generator';
import { MOCK_ANALYSIS_RESULT, MOCK_TARGET_USERS } from '../src/components/MockData';
import { AnalysisResult } from '../src/types';

describe('AI Security Prompt Generator', () => {
  it('generates a rich, visual card & tile structured prompt focusing on Record Access and Sharing Provenance (excluding FLS)', () => {
    const prompt = generateAiPrompt(MOCK_ANALYSIS_RESULT);

    // Header and context
    expect(prompt).toContain('# Salesforce Access Summary & Provenance Analysis Request');
    expect(prompt).toContain('Case');
    expect(prompt).toContain('5007Q00000abc12345');
    expect(prompt).toContain('Alex Rivera');

    // Visual Card Structure Commands
    expect(prompt).toContain('CARD 1: Executive Access Scorecard (Visual Table)');
    expect(prompt).toContain('CARD 2: Visual Provenance Chain (How Access Was Granted)');
    expect(prompt).toContain('CARD 3: Discrepancy & Blocker Callout');
    expect(prompt).toContain('CARD 4: Administrator Remediation Tile');

    // Visual indicators & badges
    expect(prompt).toContain('🟢 GRANTED');
    expect(prompt).toContain('🔴 DENIED');
    expect(prompt).toContain('👁️ **Record Read**');
    expect(prompt).toContain('✏️ **Record Edit**');

    // FLS is strictly excluded per user specification
    expect(prompt).not.toContain('Field-Level Security');
    expect(prompt).not.toContain('Internal_Comments__c');

    // Raw Verified API Evidence
    expect(prompt).toContain('## 📊 RAW VERIFIED EVIDENCE FROM SALESFORCE API:');
    expect(prompt).toContain('UserRecordAccess API Signals');
    expect(prompt).toContain('HasReadAccess: `true`');
    expect(prompt).toContain('HasEditAccess: `false`');
    expect(prompt).toContain('Object CRUD Permissions (`Case`)');
    expect(prompt).toContain('Global Support Tier 1');
  });

  it('generates a structured User Access Discrepancy (Diff) prompt for comparative analysis', () => {
    const userB = MOCK_TARGET_USERS[1];
    const resultB: AnalysisResult = {
      ...MOCK_ANALYSIS_RESULT,
      targetUserId: userB.id,
      targetUserName: userB.name,
      targetUserProfileName: userB.profileName,
      targetUserRoleName: userB.userRoleName,
      recordAccess: {
        read: true,
        edit: true,
        delete: true,
        transfer: true,
        maxAccessLevel: 'All',
      },
    };

    const diffPrompt = generateDiffAiPrompt(MOCK_ANALYSIS_RESULT, resultB);

    expect(diffPrompt).toContain('# Salesforce User Access Discrepancy (Diff) Analysis Request');
    expect(diffPrompt).toContain('Alex Rivera');
    expect(diffPrompt).toContain('Sarah Chen');
    expect(diffPrompt).toContain('CARD 1: Executive Access Diff Matrix');
    expect(diffPrompt).toContain('CARD 2: Provenance Root Cause Comparison');
    expect(diffPrompt).toContain('CARD 3: Discrepancy & Blocker Callout');
    expect(diffPrompt).toContain('CARD 4: Administrator Remediation Tile');

    // FLS is excluded in Diff Prompt as well
    expect(diffPrompt).not.toContain('Field-Level Security');
  });

  it('guarantees tokens and sensitive secrets are never included in the prompt', () => {
    const prompt = generateAiPrompt(MOCK_ANALYSIS_RESULT);

    expect(prompt).not.toContain('Bearer');
    expect(prompt).not.toContain('access_token');
    expect(prompt).not.toContain('refresh_token');
    expect(prompt).not.toContain('client_secret');
  });
});

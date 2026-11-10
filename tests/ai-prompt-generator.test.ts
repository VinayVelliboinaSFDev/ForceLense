import { describe, it, expect } from 'vitest';
import { generateAiPrompt } from '../src/analyzers/ai-prompt-generator';
import { MOCK_ANALYSIS_RESULT } from '../src/components/MockData';

describe('AI Security Prompt Generator', () => {
  it('generates a rich, visual, colorful card & tile structured prompt for external AI apps', () => {
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
    expect(prompt).toContain('🔒 **Field-Level Security**');

    // Raw Verified API Evidence
    expect(prompt).toContain('## 📊 RAW VERIFIED EVIDENCE FROM SALESFORCE API:');
    expect(prompt).toContain('UserRecordAccess API Signals');
    expect(prompt).toContain('HasReadAccess: `true`');
    expect(prompt).toContain('HasEditAccess: `false`');
    expect(prompt).toContain('Object CRUD Permissions (`Case`)');
    expect(prompt).toContain('Field-Level Security (FLS)');
    expect(prompt).toContain('Internal_Comments__c');
    expect(prompt).toContain('Global Support Tier 1');
  });

  it('guarantees tokens and sensitive secrets are never included in the prompt', () => {
    const prompt = generateAiPrompt(MOCK_ANALYSIS_RESULT);

    expect(prompt).not.toContain('Bearer');
    expect(prompt).not.toContain('access_token');
    expect(prompt).not.toContain('refresh_token');
    expect(prompt).not.toContain('client_secret');
  });
});

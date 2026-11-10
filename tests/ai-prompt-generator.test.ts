import { describe, it, expect } from 'vitest';
import { generateAiPrompt } from '../src/analyzers/ai-prompt-generator';
import { MOCK_ANALYSIS_RESULT } from '../src/components/MockData';

describe('AI Security Prompt Generator', () => {
  it('generates a concise, straight and strong prompt for external AI apps', () => {
    const prompt = generateAiPrompt(MOCK_ANALYSIS_RESULT);

    // Header and context
    expect(prompt).toContain('# Salesforce Access Summary & Provenance Request');
    expect(prompt).toContain('Case');
    expect(prompt).toContain('5007Q00000abc12345');
    expect(prompt).toContain('Alex Rivera');

    // Section 1: Context & Verified Signals
    expect(prompt).toContain('## 1. Context & Verified Signals');
    expect(prompt).toContain('UserRecordAccess API');
    expect(prompt).toContain('Read: true');
    expect(prompt).toContain('Edit: false');
    expect(prompt).toContain('Object CRUD (Case)');
    expect(prompt).toContain('Field-Level Security (FLS)');
    expect(prompt).toContain('Internal_Comments__c');

    // Section 2: Share Table & Hierarchy Findings
    expect(prompt).toContain('## 2. Share Table & Hierarchy Findings');
    expect(prompt).toContain('Global Support Tier 1');

    // Required response sections: Exact Access Verdict & Exact Access Provenance
    expect(prompt).toContain('### 1. Exact Access Verdict');
    expect(prompt).toContain('### 2. Exact Access Provenance (How Access Came)');
  });

  it('guarantees tokens and sensitive secrets are never included in the prompt', () => {
    const prompt = generateAiPrompt(MOCK_ANALYSIS_RESULT);

    expect(prompt).not.toContain('Bearer');
    expect(prompt).not.toContain('access_token');
    expect(prompt).not.toContain('refresh_token');
    expect(prompt).not.toContain('client_secret');
  });
});

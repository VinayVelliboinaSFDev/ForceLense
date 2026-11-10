import { describe, it, expect } from 'vitest';
import { generateAiPrompt } from '../src/analyzers/ai-prompt-generator';
import { MOCK_ANALYSIS_RESULT } from '../src/components/MockData';

describe('AI Security Prompt Generator', () => {
  it('generates a complete, structured prompt for external AI apps', () => {
    const prompt = generateAiPrompt(MOCK_ANALYSIS_RESULT);

    // Section verifications
    expect(prompt).toContain('# Salesforce Security & Record Access Analysis Request');
    expect(prompt).toContain('## 1. Context Information');
    expect(prompt).toContain('Case');
    expect(prompt).toContain('5007Q00000abc12345');
    expect(prompt).toContain('Alex Rivera');
    expect(prompt).toContain('## 2. Effective Record Access (UserRecordAccess API Evidence)');
    expect(prompt).toContain('**HasReadAccess**: true');
    expect(prompt).toContain('**HasEditAccess**: false');
    expect(prompt).toContain('## 3. Object-Level CRUD Permissions');
    expect(prompt).toContain('## 4. Field-Level Security (FLS) Summary');
    expect(prompt).toContain('Internal_Comments__c');
    expect(prompt).toContain('## 5. Sharing Evidence & Grant Paths');
    expect(prompt).toContain('Global Support Tier 1');
    expect(prompt).toContain('## 6. Known Limitations & Platform Boundaries');
    expect(prompt).toContain('## Instructions for your response:');
    expect(prompt).toContain('Remediation Action Plan');
  });

  it('guarantees tokens and sensitive secrets are never included in the prompt', () => {
    const prompt = generateAiPrompt(MOCK_ANALYSIS_RESULT);

    expect(prompt).not.toContain('Bearer');
    expect(prompt).not.toContain('access_token');
    expect(prompt).not.toContain('refresh_token');
    expect(prompt).not.toContain('client_secret');
  });
});

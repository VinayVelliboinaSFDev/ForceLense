import { describe, it, expect } from 'vitest';
import { detectRecordFromUrl } from '../src/content/record-detector';

describe('Record Detector URL Parser', () => {
  it('correctly detects standard Lightning record view URL', () => {
    const url = 'https://myorg.lightning.force.com/lightning/r/Case/5007Q00000abc12345/view';
    const result = detectRecordFromUrl(url);

    expect(result).not.toBeNull();
    expect(result?.objectApiName).toBe('Case');
    expect(result?.recordId).toBe('5007Q00000abc12345');
    expect(result?.url).toBe(url);
  });

  it('detects custom object edit URL', () => {
    const url = 'https://myorg.lightning.force.com/lightning/r/Custom_Object__c/a007Q00000xyz98765/edit';
    const result = detectRecordFromUrl(url);

    expect(result).not.toBeNull();
    expect(result?.objectApiName).toBe('Custom_Object__c');
    expect(result?.recordId).toBe('a007Q00000xyz98765');
  });

  it('detects record URL with related list or query params', () => {
    const url = 'https://myorg.lightning.force.com/lightning/r/Account/0017Q00000test123/related/Contacts/view?tab=0';
    const result = detectRecordFromUrl(url);

    expect(result).not.toBeNull();
    expect(result?.objectApiName).toBe('Account');
    expect(result?.recordId).toBe('0017Q00000test123');
  });

  it('returns null for non-record Lightning URLs (Home, Setup, Object Home)', () => {
    expect(detectRecordFromUrl('https://myorg.lightning.force.com/lightning/page/home')).toBeNull();
    expect(detectRecordFromUrl('https://myorg.lightning.force.com/lightning/setup/SetupOneHome/home')).toBeNull();
    expect(detectRecordFromUrl('https://myorg.lightning.force.com/lightning/o/Case/list?filterName=Recent')).toBeNull();
  });
});

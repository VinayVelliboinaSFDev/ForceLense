import { describe, it, expect } from 'vitest';
import { getCandidateApiHosts } from '../src/auth/salesforce-session';

describe('Salesforce Active Tab Session Resolver (Salesforce Inspector Style)', () => {
  it('correctly maps Lightning domain to candidate REST API domains', () => {
    const url = 'https://acmecorp.lightning.force.com/lightning/r/Case/5007Q00000abc12345/view';
    const hosts = getCandidateApiHosts(url);

    expect(hosts).toContain('https://acmecorp.my.salesforce.com');
    expect(hosts).toContain('https://acmecorp.sandbox.my.salesforce.com');
    expect(hosts).toContain('https://acmecorp.develop.my.salesforce.com');
  });

  it('correctly maps Visualforce domain to parent My Domain API host', () => {
    const url = 'https://acmecorp--c.vf.force.com/apex/MyVisualforcePage';
    const hosts = getCandidateApiHosts(url);

    expect(hosts).toContain('https://acmecorp.my.salesforce.com');
  });

  it('keeps standard my.salesforce.com host unchanged', () => {
    const url = 'https://acmecorp.my.salesforce.com/services/data/v60.0/';
    const hosts = getCandidateApiHosts(url);

    expect(hosts).toContain('https://acmecorp.my.salesforce.com');
  });

  it('returns empty array for non-Salesforce URLs', () => {
    expect(getCandidateApiHosts('https://google.com')).toEqual([]);
    expect(getCandidateApiHosts('https://github.com')).toEqual([]);
    expect(getCandidateApiHosts('chrome://extensions')).toEqual([]);
  });
});

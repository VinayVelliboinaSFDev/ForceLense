import { describe, it, expect } from 'vitest';
import { validateAndSanitizeSoql } from '../src/salesforce/soql-safety';

describe('SOQL Safety Validator & Sanitizer', () => {
  it('accepts clean read-only SELECT queries and enforces row limit', () => {
    const res = validateAndSanitizeSoql('SELECT Id, Name FROM User WHERE IsActive = true');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toContain('LIMIT 50');
  });

  it('preserves reasonable existing limits and caps excessive limits', () => {
    const res1 = validateAndSanitizeSoql('SELECT Id FROM Account LIMIT 10');
    expect(res1.valid).toBe(true);
    expect(res1.sanitized).toBe('SELECT Id FROM Account LIMIT 10');

    const res2 = validateAndSanitizeSoql('SELECT Id FROM Contact LIMIT 500');
    expect(res2.valid).toBe(true);
    expect(res2.sanitized).toBe('SELECT Id FROM Contact LIMIT 100');
  });

  it('strips code fences and semicolons', () => {
    const res = validateAndSanitizeSoql('```soql\nSELECT Id, Name FROM UserRole;\n```');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('SELECT Id, Name FROM UserRole LIMIT 50');
  });

  it('rejects non-SELECT statements', () => {
    const res1 = validateAndSanitizeSoql('UPDATE Contact SET Email = "hack@test.com"');
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain('SELECT');

    const res2 = validateAndSanitizeSoql('DELETE FROM Case');
    expect(res2.valid).toBe(false);
  });

  it('rejects queries containing mutation keywords', () => {
    const res = validateAndSanitizeSoql('SELECT Id FROM User WHERE Name = "test" AND Id IN (DELETE FROM User)');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Mutation keywords are strictly forbidden');
  });

  it('rejects empty or whitespace queries', () => {
    const res = validateAndSanitizeSoql('');
    expect(res.valid).toBe(false);
  });
});

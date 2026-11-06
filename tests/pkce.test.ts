import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../src/auth/pkce';

describe('PKCE and OAuth Security Helpers', () => {
  it('generates a valid code verifier compliant with RFC 7636', () => {
    const verifier = generateCodeVerifier();
    // RFC 7636: between 43 and 128 characters, base64url characters only
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(/^[A-Za-z0-9_-]+$/.test(verifier)).toBe(true);
  });

  it('generates a valid S256 code challenge from a verifier', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await generateCodeChallenge(verifier);

    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
    expect(/^[A-Za-z0-9_-]+$/.test(challenge)).toBe(true);
  });

  it('generates unique random states for CSRF protection', () => {
    const state1 = generateState();
    const state2 = generateState();

    expect(state1).not.toBe(state2);
    expect(state1.length).toBeGreaterThanOrEqual(20);
  });
});

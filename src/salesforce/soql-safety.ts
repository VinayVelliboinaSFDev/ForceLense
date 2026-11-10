/**
 * SOQL Safety Validator & Sanitizer
 * Guarantees strictly read-only, non-destructive SOQL queries against Salesforce.
 */

export interface SoqlValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
}

const FORBIDDEN_KEYWORDS = [
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bUPSERT\b/i,
  /\bMERGE\b/i,
  /\bUNDELETE\b/i,
  /\bDROP\b/i,
  /\bALTER\b/i,
  /\bTRUNCATE\b/i,
  /\bEXECUTE\b/i,
];

export function validateAndSanitizeSoql(rawSoql: string): SoqlValidationResult {
  if (!rawSoql || typeof rawSoql !== 'string') {
    return { valid: false, sanitized: '', error: 'Query string cannot be empty.' };
  }

  // Strip wrapping markdown code fences or quotes if any
  let clean = rawSoql
    .replace(/^```(?:soql|sql)?/i, '')
    .replace(/```$/, '')
    .trim();

  // Strip multiple statements or semicolons
  if (clean.includes(';')) {
    clean = clean.split(';')[0].trim();
  }

  // Check starts with SELECT
  if (!/^SELECT\s+/i.test(clean)) {
    return {
      valid: false,
      sanitized: '',
      error: 'Query must be a read-only SELECT statement.',
    };
  }

  // Check forbidden mutation keywords
  for (const regex of FORBIDDEN_KEYWORDS) {
    if (regex.test(clean)) {
      return {
        valid: false,
        sanitized: '',
        error: `Mutation keywords are strictly forbidden in read-only queries.`,
      };
    }
  }

  // Ensure reasonable LIMIT (max 100 rows to prevent overwhelming extension memory)
  const limitMatch = clean.match(/\bLIMIT\s+(\d+)/i);
  if (!limitMatch) {
    clean += ' LIMIT 50';
  } else {
    const limitVal = parseInt(limitMatch[1], 10);
    if (limitVal > 100) {
      clean = clean.replace(/\bLIMIT\s+\d+/i, 'LIMIT 100');
    }
  }

  return {
    valid: true,
    sanitized: clean,
  };
}

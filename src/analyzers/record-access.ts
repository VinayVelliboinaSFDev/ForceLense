import { sfApi } from '../salesforce/api-client';
import { UserRecordAccessRecord } from '../salesforce/types';
import { EvidenceItem, RecordAccessFlags } from '../types';

export interface RecordAccessAnalyzerResult {
  flags?: RecordAccessFlags;
  evidence: EvidenceItem[];
  warnings: string[];
}

export async function analyzeRecordAccess(
  targetUserId: string,
  recordId: string,
  objectApiName: string
): Promise<RecordAccessAnalyzerResult> {
  const evidence: EvidenceItem[] = [];
  const warnings: string[] = [];

  try {
    const soql = `
      SELECT RecordId, HasReadAccess, HasEditAccess, HasDeleteAccess,
             HasTransferAccess, HasAllAccess, MaxAccessLevel
      FROM UserRecordAccess
      WHERE UserId = '${targetUserId}'
        AND RecordId = '${recordId}'
      LIMIT 1
    `;

    const records = await sfApi.query<UserRecordAccessRecord>(soql);

    if (!records || records.length === 0) {
      warnings.push(`UserRecordAccess returned no rows for record ${recordId} and user ${targetUserId}.`);
      evidence.push({
        id: `rec-access-unknown-${recordId}`,
        category: 'record',
        status: 'unknown',
        title: 'Effective Record Access Query Inconclusive',
        explanation: 'UserRecordAccess returned no records. The record may not exist or may not support UserRecordAccess.',
        source: 'UserRecordAccess',
        retrievedAt: new Date().toISOString(),
        targetUserId,
        recordId,
      });

      return { evidence, warnings };
    }

    const row = records[0];
    const flags: RecordAccessFlags = {
      read: row.HasReadAccess,
      edit: row.HasEditAccess,
      delete: row.HasDeleteAccess,
      transfer: row.HasTransferAccess,
      all: row.HasAllAccess,
      maxAccessLevel: row.MaxAccessLevel,
    };

    const grantedSummary = [
      row.HasReadAccess ? 'Read' : null,
      row.HasEditAccess ? 'Edit' : null,
      row.HasDeleteAccess ? 'Delete' : null,
      row.HasTransferAccess ? 'Transfer' : null,
      row.HasAllAccess ? 'All' : null,
    ].filter(Boolean).join(', ') || 'None';

    evidence.push({
      id: `rec-access-confirmed-${recordId}`,
      category: 'record',
      status: 'confirmed',
      title: `Effective Access Flags (${row.MaxAccessLevel})`,
      explanation: `Salesforce UserRecordAccess confirms: ${grantedSummary}. (MaxAccessLevel: ${row.MaxAccessLevel}). Note: This confirms effective permission flags but does not by itself explain the grant path.`,
      source: 'UserRecordAccess',
      retrievedAt: new Date().toISOString(),
      targetUserId,
      recordId,
      details: {
        HasReadAccess: row.HasReadAccess,
        HasEditAccess: row.HasEditAccess,
        HasDeleteAccess: row.HasDeleteAccess,
        HasTransferAccess: row.HasTransferAccess,
        HasAllAccess: row.HasAllAccess,
        MaxAccessLevel: row.MaxAccessLevel,
      },
    });

    return { flags, evidence, warnings };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    warnings.push(`UserRecordAccess query failed: ${errorMsg}`);

    evidence.push({
      id: `rec-access-failed-${recordId}`,
      category: 'record',
      status: 'unavailable',
      title: 'Record Access Query Unavailable',
      explanation: `Could not query UserRecordAccess for ${objectApiName}. Salesforce error: ${errorMsg}`,
      source: 'UserRecordAccess',
      retrievedAt: new Date().toISOString(),
      targetUserId,
      recordId,
      limitation: 'The connected user may lack sufficient API permissions, or the target object does not support UserRecordAccess.',
    });

    return { evidence, warnings };
  }
}

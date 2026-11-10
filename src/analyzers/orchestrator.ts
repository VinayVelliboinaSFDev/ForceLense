import { analyzeRecordAccess } from './record-access';
import { analyzeObjectPermissions } from './object-permissions';
import { analyzeFieldPermissions } from './field-permissions';
import { analyzeSharingEvidence } from './sharing-evidence';
import { AnalysisResult, TargetUser, EvidenceItem, SharingFinding } from '../types';

export interface RunAnalysisOptions {
  orgId: string;
  recordId: string;
  objectApiName: string;
  targetUser: TargetUser;
}

export async function runFullAnalysis(options: RunAnalysisOptions): Promise<AnalysisResult> {
  const { orgId, recordId, objectApiName, targetUser } = options;
  const startedAt = new Date().toISOString();
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const completedSections: string[] = [];
  const unavailableSections: string[] = [];
  const skippedSections: string[] = [];
  const allEvidence: EvidenceItem[] = [];
  const limitations: string[] = [];

  // Run Analyzers in parallel where independent, maintaining needed dependencies
  // 1. Record Access & Sharing run concurrently with Object Permissions
  const [recAccessRes, objPermRes, sharingRes] = await Promise.allSettled([
    analyzeRecordAccess(targetUser.id, recordId, objectApiName),
    analyzeObjectPermissions(targetUser, objectApiName),
    analyzeSharingEvidence(targetUser, recordId, objectApiName),
  ]);

  // Process Record Access
  let recordAccessFlags = undefined;
  if (recAccessRes.status === 'fulfilled') {
    recordAccessFlags = recAccessRes.value.flags;
    allEvidence.push(...recAccessRes.value.evidence);
    if (recAccessRes.value.flags) {
      completedSections.push('Record Access (UserRecordAccess)');
    } else {
      unavailableSections.push('Record Access (UserRecordAccess)');
    }
  } else {
    unavailableSections.push('Record Access (UserRecordAccess)');
    limitations.push(`Record Access analyzer encountered an error: ${recAccessRes.reason?.message || 'Unknown'}`);
  }

  // Process Object Permissions
  let objectPermissions = {
    read: false as boolean | 'unknown',
    create: false as boolean | 'unknown',
    edit: false as boolean | 'unknown',
    delete: false as boolean | 'unknown',
    viewAll: false as boolean | 'unknown',
    modifyAll: false as boolean | 'unknown',
  };
  let permissionSetIds: string[] = [];

  if (objPermRes.status === 'fulfilled') {
    objectPermissions = objPermRes.value.permissions;
    permissionSetIds = objPermRes.value.permissionSetIds;
    allEvidence.push(...objPermRes.value.evidence);
    completedSections.push('Object Permissions (CRUD)');
  } else {
    unavailableSections.push('Object Permissions (CRUD)');
    limitations.push(`Object permissions analyzer encountered an error: ${objPermRes.reason?.message || 'Unknown'}`);
  }

  // Process Sharing Evidence
  let sharingFindings: SharingFinding[] = [];
  let recordName: string | undefined = undefined;

  if (sharingRes.status === 'fulfilled') {
    sharingFindings = sharingRes.value.findings;
    recordName = sharingRes.value.recordName;
    allEvidence.push(...sharingRes.value.evidence);
    completedSections.push('Sharing Evidence (Owner, Share Rows & Groups)');
  } else {
    unavailableSections.push('Sharing Evidence');
    limitations.push(`Sharing evidence analyzer encountered an error: ${sharingRes.reason?.message || 'Unknown'}`);
  }

  // Process Field Permissions (FLS) using retrieved permissionSetIds
  let fieldPermissions: AnalysisResult['fieldPermissions'] = [];
  try {
    const fieldRes = await analyzeFieldPermissions(
      targetUser.id,
      objectApiName,
      permissionSetIds,
      undefined,
      targetUser.profileName
    );
    fieldPermissions = fieldRes.fields;
    allEvidence.push(...fieldRes.evidence);
    completedSections.push('Field-Level Security (FLS)');
  } catch (flsErr: unknown) {
    unavailableSections.push('Field-Level Security (FLS)');
    const msg = flsErr instanceof Error ? flsErr.message : String(flsErr);
    limitations.push(`Field-level permissions analyzer failed: ${msg}`);
  }

  // Overall status evaluation
  let overallStatus: 'complete' | 'partial' | 'failed' = 'complete';
  if (completedSections.length === 0) {
    overallStatus = 'failed';
  } else if (unavailableSections.length > 0) {
    overallStatus = 'partial';
  }

  return {
    analysisId,
    orgId,
    recordId,
    objectApiName,
    recordName,
    targetUserId: targetUser.id,
    targetUserName: targetUser.name,
    targetUserProfileName: targetUser.profileName,
    targetUserRoleName: targetUser.userRoleName,
    startedAt,
    completedAt: new Date().toISOString(),
    recordAccess: recordAccessFlags,
    objectPermissions,
    fieldPermissions,
    sharingFindings,
    evidence: allEvidence,
    coverage: {
      completed: completedSections,
      unavailable: unavailableSections,
      skipped: skippedSections,
    },
    overallStatus,
    limitations,
  };
}

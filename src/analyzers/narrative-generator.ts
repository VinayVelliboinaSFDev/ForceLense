import { AnalysisResult } from '../types';

export interface NarrativeSummary {
  headline: string;
  badgeType: 'granted' | 'partial' | 'denied' | 'unknown';
  recordVerdict: string;
  grantSourceSummary: string;
  objectCrudSummary: string;
  flsSummary: string;
  blockerSummary?: string;
  remediationSuggestions: string[];
}

export function generateNarrativeSummary(result: AnalysisResult): NarrativeSummary {
  const { targetUserName, objectApiName, recordAccess, objectPermissions, fieldPermissions, sharingFindings } = result;

  const canRead = recordAccess?.read === true;
  const canEdit = recordAccess?.edit === true;
  const canDelete = recordAccess?.delete === true;

  let headline = '';
  let badgeType: 'granted' | 'partial' | 'denied' | 'unknown' = 'unknown';

  if (canRead && canEdit && canDelete) {
    headline = `${targetUserName} has Full (Read, Edit & Delete) access to this ${objectApiName}.`;
    badgeType = 'granted';
  } else if (canRead && canEdit) {
    headline = `${targetUserName} has Read & Edit access to this ${objectApiName}.`;
    badgeType = 'granted';
  } else if (canRead) {
    headline = `${targetUserName} has Read-Only access to this ${objectApiName}.`;
    badgeType = 'partial';
  } else if (recordAccess?.read === false) {
    headline = `${targetUserName} is Denied access to this ${objectApiName}.`;
    badgeType = 'denied';
  } else {
    headline = `Access status for ${targetUserName} on this ${objectApiName} is Inconclusive.`;
    badgeType = 'unknown';
  }

  // 1. Record Verdict
  const verdictParts = [];
  if (canRead) verdictParts.push('View/Read');
  if (canEdit) verdictParts.push('Edit');
  if (canDelete) verdictParts.push('Delete');
  const recordVerdict = verdictParts.length > 0
    ? `User is confirmed to have ${verdictParts.join(' & ')} access at the record level (MaxAccessLevel: ${recordAccess?.maxAccessLevel || 'Unknown'}).`
    : 'User does not have confirmed record-level visibility.';

  // 2. Grant Source: Where did access come from?
  let grantSourceSummary = '';
  const isDirectOwner = sharingFindings.some(
    (f) => f.type === 'ownership' && (f.label === 'Direct Record Owner' || f.label.includes(targetUserName))
  );
  const directShare = sharingFindings.find((f) => f.type === 'share_row');
  const groupShare = sharingFindings.find((f) => f.type === 'group');
  const hierarchyShare = sharingFindings.find((f) => f.type === 'hierarchy');
  const owdFinding = sharingFindings.find((f) => f.type === 'owd');

  if (isDirectOwner) {
    grantSourceSummary = `Direct Ownership: ${targetUserName} is the direct owner of this record, granting Full access under standard Salesforce sharing.`;
  } else if (directShare) {
    grantSourceSummary = `Explicit Share Row: Access is granted directly to ${targetUserName} via a share row in ${directShare.source} (${directShare.rowCause || 'Manual'}).`;
  } else if (groupShare) {
    const pathStr = groupShare.path ? ` via membership path: ${groupShare.path.join(' → ')}` : '';
    grantSourceSummary = `Public Group / Rule: Access is granted to Public Group "${groupShare.label}"${pathStr}.`;
  } else if (hierarchyShare) {
    grantSourceSummary = `Role Hierarchy: Access is inherited because ${targetUserName}'s role is an ancestor of the record owner in the role hierarchy.`;
  } else if (owdFinding) {
    grantSourceSummary = `Baseline Organization-Wide Defaults: Access is provided by the ${owdFinding.label} baseline model.`;
  } else if (canRead) {
    grantSourceSummary = `Salesforce UserRecordAccess confirms visibility, but no explicit share row was found. Access is likely granted via Organization-Wide Defaults or System Administrator privileges.`;
  } else {
    grantSourceSummary = `No active grant path was found on the share table or via role hierarchy for this record.`;
  }

  // 3. Object CRUD Summary
  const grantedCrud: string[] = [];
  if (objectPermissions.read) grantedCrud.push('Read');
  if (objectPermissions.create) grantedCrud.push('Create');
  if (objectPermissions.edit) grantedCrud.push('Edit');
  if (objectPermissions.delete) grantedCrud.push('Delete');
  if (objectPermissions.viewAll) grantedCrud.push('View All Records');
  if (objectPermissions.modifyAll) grantedCrud.push('Modify All Records');

  const objectCrudSummary = grantedCrud.length > 0
    ? `Object-level permissions: Granted [${grantedCrud.join(', ')}] across assigned profile and permission sets.`
    : `Object-level permissions: No CRUD access granted for object ${objectApiName}.`;

  // 4. Field-Level Security Summary
  const readableCount = fieldPermissions.filter((f) => f.readable === true).length;
  const editableCount = fieldPermissions.filter((f) => f.editable === true).length;
  const restrictedFields = fieldPermissions.filter((f) => f.readable === false).map((f) => f.label || f.fieldApiName);

  let flsSummary = `${readableCount} of ${fieldPermissions.length} fields are readable (${editableCount} editable).`;
  if (restrictedFields.length > 0) {
    flsSummary += ` Restricted fields: ${restrictedFields.slice(0, 3).join(', ')}${restrictedFields.length > 3 ? ` and ${restrictedFields.length - 3} more` : ''}.`;
  }

  // 5. Blocker Summary (Why can't user edit/delete if object allows it?)
  let blockerSummary: string | undefined = undefined;
  if (canRead && !canEdit && objectPermissions.edit) {
    blockerSummary = `Record Edit is blocked: Although ${targetUserName} has object-level Edit permissions on ${objectApiName}, they do not have Edit access to this specific record because they are not the record owner and no Read/Write share row exists.`;
  } else if (!canRead && objectPermissions.read) {
    blockerSummary = `Record Read is blocked: Although the user has object-level Read permission on ${objectApiName}, the record's sharing model (OWD / Private) has not shared this specific record with them.`;
  }

  // 6. Actionable Remediation Suggestions for Admins
  const remediationSuggestions: string[] = [];
  if (!canRead) {
    remediationSuggestions.push(`To grant Read access: Add a manual share on ${objectApiName} for ${targetUserName}, or add them to a Public Group included in a Sharing Rule.`);
  }
  if (canRead && !canEdit) {
    remediationSuggestions.push(`To grant Edit access: Change the record share level to 'Read/Write', add a Sharing Rule granting Edit, or transfer record ownership.`);
  }
  if (restrictedFields.length > 0) {
    remediationSuggestions.push(`To grant access to restricted fields: Assign a Permission Set granting Field-Level Security for ${restrictedFields.slice(0, 2).join(', ')}.`);
  }

  return {
    headline,
    badgeType,
    recordVerdict,
    grantSourceSummary,
    objectCrudSummary,
    flsSummary,
    blockerSummary,
    remediationSuggestions,
  };
}

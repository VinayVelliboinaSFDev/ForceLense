import { AnalysisResult } from '../types';

export interface ExactAccessProvenance {
  headline: string;
  badgeType: 'granted' | 'partial' | 'denied' | 'unknown';
  userRecordAccessFact: string;
  sharingRowFact: string;
  objectCrudFact: string;
  flsFact: string;
  blockerFact?: string;
}

/**
 * Generates exact, non-speculative access provenance facts based strictly on verified API evidence.
 * Zero placeholder or imaginary data.
 */
export function generateNarrativeSummary(result: AnalysisResult): ExactAccessProvenance {
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

  // 1. UserRecordAccess API Fact
  const confirmedFlags: string[] = [];
  if (recordAccess?.read !== undefined) confirmedFlags.push(`Read: ${recordAccess.read ? 'Yes' : 'No'}`);
  if (recordAccess?.edit !== undefined) confirmedFlags.push(`Edit: ${recordAccess.edit ? 'Yes' : 'No'}`);
  if (recordAccess?.delete !== undefined) confirmedFlags.push(`Delete: ${recordAccess.delete ? 'Yes' : 'No'}`);
  if (recordAccess?.maxAccessLevel) confirmedFlags.push(`MaxAccessLevel: ${recordAccess.maxAccessLevel}`);

  const userRecordAccessFact = confirmedFlags.length > 0
    ? `Salesforce UserRecordAccess reports: ${confirmedFlags.join(', ')}.`
    : 'UserRecordAccess flags were not returned for this object.';

  // 2. Sharing & Group Membership Fact
  let sharingRowFact = '';
  const isDirectOwner = sharingFindings.some(
    (f) => f.type === 'ownership' && (f.label === 'Direct Record Owner' || f.label.includes(targetUserName))
  );
  const directShare = sharingFindings.find((f) => f.type === 'share_row');
  const groupShare = sharingFindings.find((f) => f.type === 'group');
  const hierarchyShare = sharingFindings.find((f) => f.type === 'hierarchy');
  const owdFinding = sharingFindings.find((f) => f.type === 'owd');

  if (isDirectOwner) {
    sharingRowFact = `Ownership: ${targetUserName} is the verified OwnerId on this record (grants All access).`;
  } else if (directShare) {
    sharingRowFact = `Share Row: Found direct share row in ${directShare.source} granting ${directShare.accessLevel} (RowCause: ${directShare.rowCause || 'Manual'}).`;
  } else if (groupShare) {
    const path = groupShare.path && groupShare.path.length > 0 ? ` [Chain: ${groupShare.path.join(' → ')}]` : '';
    sharingRowFact = `Public Group Share: Matched share row for "${groupShare.label}" granting ${groupShare.accessLevel} (RowCause: ${groupShare.rowCause || 'Rule'})${path}.`;
  } else if (hierarchyShare) {
    const path = hierarchyShare.path && hierarchyShare.path.length > 0 ? ` [Role Path: ${hierarchyShare.path.join(' → ')}]` : '';
    sharingRowFact = `Role Hierarchy: Inherited access because user's role is above record owner's role in UserRole hierarchy${path}.`;
  } else if (owdFinding) {
    sharingRowFact = `OWD Baseline: EntityDefinition confirms InternalSharingModel is ${owdFinding.label}.`;
  } else {
    sharingRowFact = `No share row found on the share table for ${targetUserName} or their assigned groups. Record-level access is governed by OWD or system permissions.`;
  }

  // 3. Object-level CRUD Fact
  const grantedCrud: string[] = [];
  if (objectPermissions.read) grantedCrud.push('Read');
  if (objectPermissions.create) grantedCrud.push('Create');
  if (objectPermissions.edit) grantedCrud.push('Edit');
  if (objectPermissions.delete) grantedCrud.push('Delete');
  if (objectPermissions.viewAll) grantedCrud.push('View All');
  if (objectPermissions.modifyAll) grantedCrud.push('Modify All');

  const objectCrudFact = grantedCrud.length > 0
    ? `Object permissions: Granted [${grantedCrud.join(', ')}] via assigned Profile and Permission Sets.`
    : `Object permissions: No CRUD permissions granted on object ${objectApiName}.`;

  // 4. Field-Level Security Fact
  const readableCount = fieldPermissions.filter((f) => f.readable === true).length;
  const editableCount = fieldPermissions.filter((f) => f.editable === true).length;
  const restrictedFields = fieldPermissions
    .filter((f) => f.readable === false)
    .map((f) => (f.label && f.label !== f.fieldApiName ? `${f.label} (${f.fieldApiName})` : f.fieldApiName));

  let flsFact = `Field security: ${readableCount} of ${fieldPermissions.length} fields readable, ${editableCount} editable.`;
  if (restrictedFields.length > 0) {
    flsFact += ` Restricted fields: ${restrictedFields.slice(0, 3).join(', ')}${restrictedFields.length > 3 ? ` (+${restrictedFields.length - 3} more)` : ''}.`;
  }

  // 5. Exact Blocker Fact
  let blockerFact: string | undefined = undefined;
  if (canRead && !canEdit && objectPermissions.edit) {
    blockerFact = `Record Edit blocked: User has object-level Edit on ${objectApiName}, but lacks an Edit grant on this specific record (no Read/Write share row, not record owner).`;
  } else if (!canRead && objectPermissions.read) {
    blockerFact = `Record Read blocked: User has object-level Read on ${objectApiName}, but the record has not been shared with them under the current sharing model.`;
  }

  return {
    headline,
    badgeType,
    userRecordAccessFact,
    sharingRowFact,
    objectCrudFact,
    flsFact,
    blockerFact,
  };
}

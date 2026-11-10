import { AnalysisResult } from '../types';

export interface ProvenanceBreadcrumbNode {
  id: string;
  type: 'user' | 'role' | 'group' | 'share' | 'verdict';
  label: string;
  subLabel?: string;
  status: 'active' | 'denied' | 'neutral';
}

export interface CausalAccessAttribution {
  groups: string[];
  roles: string[];
  sharingSettings: Array<{
    table: string;
    rowCause: string;
    accessLevel: string;
    label?: string;
  }>;
  profiles: string[];
  permissionSets: string[];
}

export interface ExactAccessProvenance {
  headline: string;
  badgeType: 'granted' | 'partial' | 'denied' | 'unknown';
  userRecordAccessFact: string;
  sharingRowFact: string;
  objectCrudFact: string;
  flsFact: string;
  blockerFact?: string;
  breadcrumbNodes: ProvenanceBreadcrumbNode[];
  attribution: CausalAccessAttribution;
}

/**
 * Generates exact, non-speculative access provenance facts based strictly on verified API evidence.
 * Extracts causal public groups, roles, sharing settings, profiles, and permission sets.
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

  // 6. Extraction of Causal Groups, Roles, Sharing Settings, Profiles & Permission Sets
  const groupsSet = new Set<string>();
  const rolesSet = new Set<string>();
  const profilesSet = new Set<string>();
  const permissionSetsSet = new Set<string>();
  const sharingSettingsList: Array<{ table: string; rowCause: string; accessLevel: string; label?: string }> = [];

  for (const finding of sharingFindings) {
    if (finding.type === 'group') {
      const match = finding.label.match(/Public Group Share \((.*?)\)/i) || finding.label.match(/\((.*?)\)/);
      if (match && match[1]) {
        groupsSet.add(match[1].trim());
      } else if (finding.label) {
        groupsSet.add(finding.label.replace(/^Public Group Share:?\s*/i, '').trim());
      }

      if (finding.path && Array.isArray(finding.path)) {
        for (const p of finding.path) {
          if (typeof p === 'string') {
            if (p.startsWith('Role:')) {
              rolesSet.add(p.replace(/^Role:\s*/, '').trim());
            } else if (!p.startsWith('005') && !p.startsWith('00G') && !p.startsWith('00E')) {
              groupsSet.add(p.trim());
            }
          }
        }
      }

      sharingSettingsList.push({
        table: finding.source ? finding.source.split(' ')[0] : `${objectApiName}Share`,
        rowCause: finding.rowCause ? `Rule (${finding.rowCause})` : 'Sharing Rule',
        accessLevel: finding.accessLevel,
        label: finding.label,
      });
    } else if (finding.type === 'hierarchy') {
      if (finding.path && Array.isArray(finding.path)) {
        for (const p of finding.path) {
          if (typeof p === 'string' && p.startsWith('Role:')) {
            rolesSet.add(p.replace(/^Role:\s*/, '').trim());
          }
        }
      } else {
        rolesSet.add('UserRole Hierarchy Manager');
      }
      sharingSettingsList.push({
        table: 'UserRole Hierarchy',
        rowCause: 'Manager Subordinate Inheritance',
        accessLevel: finding.accessLevel,
        label: finding.label,
      });
    } else if (finding.type === 'ownership') {
      sharingSettingsList.push({
        table: `${objectApiName}.OwnerId`,
        rowCause: 'Record Ownership',
        accessLevel: 'All',
        label: finding.label,
      });
    } else if (finding.type === 'share_row') {
      sharingSettingsList.push({
        table: finding.source,
        rowCause: finding.rowCause || 'Manual',
        accessLevel: finding.accessLevel,
        label: finding.label,
      });
    } else if (finding.type === 'owd') {
      sharingSettingsList.push({
        table: 'EntityDefinition',
        rowCause: 'Org-Wide Default',
        accessLevel: finding.accessLevel,
        label: finding.label,
      });
    }
  }

  // Inspect evidence details for additional roles or grant sources
  for (const ev of result.evidence || []) {
    if (ev.details) {
      if (typeof ev.details.ownerRoleName === 'string') rolesSet.add(ev.details.ownerRoleName);
      if (typeof ev.details.targetRoleName === 'string') rolesSet.add(ev.details.targetRoleName);
      if (Array.isArray(ev.details.path)) {
        for (const p of ev.details.path) {
          if (typeof p === 'string' && p.startsWith('Role:')) {
            rolesSet.add(p.replace(/^Role:\s*/, '').trim());
          }
        }
      }
      if (ev.details.grantSources && typeof ev.details.grantSources === 'object') {
        const gs = ev.details.grantSources as Record<string, string[]>;
        for (const act of Object.keys(gs)) {
          for (const src of gs[act] || []) {
            if (typeof src === 'string') {
              if (src.startsWith('Profile:')) {
                profilesSet.add(src.replace(/^Profile:\s*/, '').trim());
              } else if (src.startsWith('Permission Set:') || src.startsWith('PSG:')) {
                permissionSetsSet.add(src.replace(/^(Permission Set|PSG):\s*/, '').trim());
              } else if (src !== 'Standard System Field' && src !== 'Restricted / Denied') {
                permissionSetsSet.add(src.trim());
              }
            }
          }
        }
      }
    }
  }

  // Inspect field permissions for granting profiles and permission sets
  for (const f of fieldPermissions) {
    if (f.source && f.source !== 'Standard System Field' && f.source !== 'Restricted / Denied') {
      if (f.source.startsWith('Profile:')) {
        profilesSet.add(f.source.replace(/^Profile:\s*/, '').trim());
      } else if (f.source.startsWith('Permission Set:')) {
        permissionSetsSet.add(f.source.replace(/^Permission Set:\s*/, '').trim());
      } else {
        permissionSetsSet.add(f.source.trim());
      }
    }
  }

  const attribution: CausalAccessAttribution = {
    groups: Array.from(groupsSet),
    roles: Array.from(rolesSet),
    sharingSettings: sharingSettingsList,
    profiles: Array.from(profilesSet),
    permissionSets: Array.from(permissionSetsSet),
  };

  // 7. Assemble Visual Provenance Breadcrumb Nodes
  const breadcrumbNodes: ProvenanceBreadcrumbNode[] = [
    {
      id: 'node-user',
      type: 'user',
      label: targetUserName,
      subLabel: 'Target User',
      status: 'active',
    },
  ];

  if (attribution.roles.length > 0) {
    breadcrumbNodes.push({
      id: 'node-role',
      type: 'role',
      label: attribution.roles[0],
      subLabel: attribution.roles.length > 1 ? `+${attribution.roles.length - 1} role(s)` : 'User Role',
      status: 'active',
    });
  }

  if (attribution.groups.length > 0) {
    breadcrumbNodes.push({
      id: 'node-group',
      type: 'group',
      label: attribution.groups[0],
      subLabel: attribution.groups.length > 1 ? `+${attribution.groups.length - 1} group(s)` : 'Public Group',
      status: 'active',
    });
  }

  if (attribution.sharingSettings.length > 0) {
    const primaryShare = attribution.sharingSettings[0];
    breadcrumbNodes.push({
      id: 'node-share',
      type: 'share',
      label: primaryShare.table,
      subLabel: primaryShare.rowCause || 'Share Row',
      status: 'active',
    });
  } else {
    breadcrumbNodes.push({
      id: 'node-share',
      type: 'share',
      label: 'OWD / Base Policy',
      subLabel: 'No Direct Share Row',
      status: 'neutral',
    });
  }

  const verdictLabel = canRead && canEdit
    ? 'Read & Edit Granted'
    : canRead
    ? 'Read-Only Granted'
    : recordAccess?.read === false
    ? 'Access Denied'
    : 'Inconclusive';

  breadcrumbNodes.push({
    id: 'node-verdict',
    type: 'verdict',
    label: verdictLabel,
    subLabel: recordAccess?.maxAccessLevel ? `Max: ${recordAccess.maxAccessLevel}` : undefined,
    status: canRead ? 'active' : 'denied',
  });

  return {
    headline,
    badgeType,
    userRecordAccessFact,
    sharingRowFact,
    objectCrudFact,
    flsFact,
    blockerFact,
    breadcrumbNodes,
    attribution,
  };
}

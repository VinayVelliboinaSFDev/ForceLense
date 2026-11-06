import { sfApi } from '../salesforce/api-client';
import { ShareRecord, GroupRecord, GroupMemberRecord } from '../salesforce/types';
import { EvidenceItem, SharingFinding, TargetUser } from '../types';

export interface SharingEvidenceAnalyzerResult {
  findings: SharingFinding[];
  evidence: EvidenceItem[];
  warnings: string[];
  ownerId?: string;
  recordName?: string;
}

function getShareTableNameAndForeignKey(objectApiName: string): { shareTable: string; fkField: string } | null {
  const clean = objectApiName.trim();
  if (clean.endsWith('__c')) {
    return {
      shareTable: clean.replace(/__c$/, '__Share'),
      fkField: 'ParentId',
    };
  }

  const standardMap: Record<string, { shareTable: string; fkField: string }> = {
    Account: { shareTable: 'AccountShare', fkField: 'AccountId' },
    Case: { shareTable: 'CaseShare', fkField: 'CaseId' },
    Opportunity: { shareTable: 'OpportunityShare', fkField: 'OpportunityId' },
    Contact: { shareTable: 'ContactShare', fkField: 'ContactId' },
    Lead: { shareTable: 'LeadShare', fkField: 'LeadId' },
    Campaign: { shareTable: 'CampaignShare', fkField: 'CampaignId' },
    User: { shareTable: 'UserShare', fkField: 'UserId' },
  };

  if (standardMap[clean]) {
    return standardMap[clean];
  }

  // Generic fallback for standard objects
  return {
    shareTable: `${clean}Share`,
    fkField: 'ParentId',
  };
}

export async function analyzeSharingEvidence(
  targetUser: TargetUser,
  recordId: string,
  objectApiName: string
): Promise<SharingEvidenceAnalyzerResult> {
  const findings: SharingFinding[] = [];
  const evidence: EvidenceItem[] = [];
  const warnings: string[] = [];

  let ownerId: string | undefined;
  let recordName: string | undefined;

  // 1. Query Record Owner
  try {
    const ownerSoql = `
      SELECT Id, OwnerId
      FROM ${objectApiName}
      WHERE Id = '${recordId}'
      LIMIT 1
    `;
    const recs = await sfApi.query<{ Id: string; OwnerId: string; Name?: string }>(ownerSoql);

    if (recs && recs.length > 0) {
      ownerId = recs[0].OwnerId;
      recordName = recs[0].Name;

      if (ownerId === targetUser.id) {
        findings.push({
          type: 'ownership',
          label: 'Direct Record Owner',
          accessLevel: 'All',
          rowCause: 'Owner',
          source: `${objectApiName}.OwnerId`,
          status: 'confirmed',
        });

        evidence.push({
          id: `share-owner-${recordId}`,
          category: 'sharing',
          status: 'confirmed',
          title: 'Target User is Record Owner',
          explanation: `Target user (${targetUser.name}) is the direct owner of this record. Ownership grants Full (All) access under standard Salesforce sharing rules.`,
          source: `${objectApiName}.OwnerId`,
          retrievedAt: new Date().toISOString(),
          targetUserId: targetUser.id,
          recordId,
        });
      } else {
        evidence.push({
          id: `share-owner-other-${recordId}`,
          category: 'sharing',
          status: 'confirmed',
          title: 'Record Owner Identified',
          explanation: `Record is owned by user/queue ID: ${ownerId}. Target user is not the record owner.`,
          source: `${objectApiName}.OwnerId`,
          retrievedAt: new Date().toISOString(),
          targetUserId: targetUser.id,
          recordId,
        });
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    warnings.push(`Could not query record owner: ${errorMsg}`);
  }

  // 2. Query Share Table
  const shareConfig = getShareTableNameAndForeignKey(objectApiName);
  if (shareConfig) {
    try {
      const shareSoql = `
        SELECT Id, ${shareConfig.fkField}, UserOrGroupId, AccessLevel, RowCause
        FROM ${shareConfig.shareTable}
        WHERE ${shareConfig.fkField} = '${recordId}'
        LIMIT 200
      `;

      const shareRows = await sfApi.query<ShareRecord>(shareSoql);

      if (shareRows && shareRows.length > 0) {
        // Collect candidate groups
        const candidateGroupIds = shareRows
          .map((r) => r.UserOrGroupId)
          .filter((id) => id.startsWith('00G') || id.startsWith('00E'));

        // Check Direct User Shares
        const directUserShares = shareRows.filter((r) => r.UserOrGroupId === targetUser.id);
        for (const row of directUserShares) {
          findings.push({
            type: 'share_row',
            label: `Direct Share (${row.RowCause})`,
            accessLevel: row.AccessLevel,
            rowCause: row.RowCause,
            source: shareConfig.shareTable,
            status: 'confirmed',
          });

          evidence.push({
            id: `share-row-${row.Id}`,
            category: 'sharing',
            status: 'confirmed',
            title: `Direct Share Row: ${row.RowCause}`,
            explanation: `Found explicit share record in ${shareConfig.shareTable} granting ${row.AccessLevel} access directly to user ${targetUser.name}.`,
            source: shareConfig.shareTable,
            retrievedAt: new Date().toISOString(),
            targetUserId: targetUser.id,
            recordId,
            details: {
              shareId: row.Id,
              accessLevel: row.AccessLevel,
              rowCause: row.RowCause,
            },
          });
        }

        // Check Group / Role Shares
        if (candidateGroupIds.length > 0) {
          try {
            const groupDetails = await resolveGroupMemberships(candidateGroupIds, targetUser.id);

            for (const row of shareRows) {
              const matchedGroup = groupDetails.get(row.UserOrGroupId);
              if (matchedGroup && matchedGroup.isMember) {
                findings.push({
                  type: 'group',
                  label: `Public Group Share (${matchedGroup.name})`,
                  accessLevel: row.AccessLevel,
                  rowCause: row.RowCause,
                  path: matchedGroup.path,
                  source: `${shareConfig.shareTable} -> GroupMember`,
                  status: 'supported',
                });

                evidence.push({
                  id: `share-group-${row.Id}`,
                  category: 'sharing',
                  status: 'supported',
                  title: `Access via Group: ${matchedGroup.name}`,
                  explanation: `Share row grants ${row.AccessLevel} to Group/Role "${matchedGroup.name}" (${row.UserOrGroupId}). User is confirmed a member via path: ${matchedGroup.path.join(' -> ')}.`,
                  source: `${shareConfig.shareTable} & GroupMember`,
                  retrievedAt: new Date().toISOString(),
                  targetUserId: targetUser.id,
                  recordId,
                });
              }
            }
          } catch (grpErr) {
            warnings.push(`Group membership resolution partial: ${grpErr instanceof Error ? grpErr.message : String(grpErr)}`);
          }
        }
      } else {
        evidence.push({
          id: `share-table-empty-${recordId}`,
          category: 'sharing',
          status: 'supported',
          title: 'No Explicit Share Rows Found',
          explanation: `Queried ${shareConfig.shareTable} but found 0 share records. Access may be governed by OWD, Role Hierarchy, Implicit sharing, or System permissions.`,
          source: shareConfig.shareTable,
          retrievedAt: new Date().toISOString(),
          targetUserId: targetUser.id,
          recordId,
        });
      }
    } catch (shareErr: unknown) {
      const errorMsg = shareErr instanceof Error ? shareErr.message : String(shareErr);
      warnings.push(`Share table query not accessible (${shareConfig.shareTable}): ${errorMsg}`);
      evidence.push({
        id: `share-table-unavailable-${recordId}`,
        category: 'sharing',
        status: 'unavailable',
        title: `Share Table (${shareConfig.shareTable}) Inaccessible`,
        explanation: `Could not query ${shareConfig.shareTable}: ${errorMsg}. Objects with Private or ControlledByParent sharing or lack of View All permissions may restrict share table access.`,
        source: shareConfig.shareTable,
        retrievedAt: new Date().toISOString(),
        targetUserId: targetUser.id,
        recordId,
        limitation: 'Ensure the connected admin user has permissions to query share tables.',
      });
    }
  }

  // 3. Inspect Role Hierarchy Traversal
  if (ownerId && ownerId.startsWith('005') && ownerId !== targetUser.id && targetUser.userRoleId) {
    try {
      const roleResult = await evaluateRoleHierarchy(ownerId, targetUser.userRoleId, targetUser.userRoleName || 'Target Role');
      if (roleResult && roleResult.isAncestor) {
        findings.push({
          type: 'hierarchy',
          label: 'Inherited via Role Hierarchy',
          accessLevel: 'Read/Edit',
          path: roleResult.path,
          source: 'UserRole Hierarchy',
          status: 'supported',
        });

        evidence.push({
          id: `share-role-hierarchy-${recordId}`,
          category: 'sharing',
          status: 'supported',
          title: 'Role Hierarchy Access Inherited',
          explanation: `Target user holds role "${targetUser.userRoleName}", which is an ancestor/manager of record owner's role "${roleResult.ownerRoleName}". In Salesforce, role hierarchy automatically grants managers access to records owned by subordinates.`,
          source: 'UserRole Hierarchy',
          retrievedAt: new Date().toISOString(),
          targetUserId: targetUser.id,
          recordId,
          details: {
            path: roleResult.path,
            ownerRoleName: roleResult.ownerRoleName,
            targetRoleName: targetUser.userRoleName,
          },
        });
      }
    } catch (roleErr) {
      warnings.push(`Role hierarchy inspection: ${roleErr instanceof Error ? roleErr.message : String(roleErr)}`);
    }
  }

  // 4. Inspect Organization-Wide Defaults (OWD) via EntityDefinition
  try {
    const owdResult = await checkOwdBaseline(objectApiName);
    if (owdResult) {
      if (owdResult.internalSharingModel === 'ReadWrite') {
        findings.push({
          type: 'owd',
          label: 'OWD: Public Read/Write',
          accessLevel: 'Edit',
          source: 'EntityDefinition.InternalSharingModel',
          status: 'confirmed',
        });

        evidence.push({
          id: `share-owd-${recordId}`,
          category: 'sharing',
          status: 'confirmed',
          title: 'OWD Baseline: Public Read/Write',
          explanation: `Salesforce EntityDefinition confirms InternalSharingModel = Public Read/Write. All active internal users receive baseline Read and Edit access without requiring individual share records.`,
          source: 'EntityDefinition',
          retrievedAt: new Date().toISOString(),
          details: {
            internalSharingModel: owdResult.internalSharingModel,
            externalSharingModel: owdResult.externalSharingModel,
          },
        });
      } else if (owdResult.internalSharingModel === 'ReadOnly') {
        findings.push({
          type: 'owd',
          label: 'OWD: Public Read Only',
          accessLevel: 'Read',
          source: 'EntityDefinition.InternalSharingModel',
          status: 'confirmed',
        });

        evidence.push({
          id: `share-owd-${recordId}`,
          category: 'sharing',
          status: 'confirmed',
          title: 'OWD Baseline: Public Read Only',
          explanation: `Salesforce EntityDefinition confirms InternalSharingModel = Public Read Only. All active internal users receive baseline Read access without requiring individual share records.`,
          source: 'EntityDefinition',
          retrievedAt: new Date().toISOString(),
          details: {
            internalSharingModel: owdResult.internalSharingModel,
            externalSharingModel: owdResult.externalSharingModel,
          },
        });
      } else if (owdResult.internalSharingModel === 'Private') {
        evidence.push({
          id: `share-owd-${recordId}`,
          category: 'sharing',
          status: 'confirmed',
          title: 'OWD Baseline: Private',
          explanation: `Salesforce EntityDefinition confirms InternalSharingModel = Private. Access requires explicit record ownership, sharing rules, manual sharing, or role hierarchy.`,
          source: 'EntityDefinition',
          retrievedAt: new Date().toISOString(),
          details: {
            internalSharingModel: owdResult.internalSharingModel,
            externalSharingModel: owdResult.externalSharingModel,
          },
        });
      } else if (owdResult.internalSharingModel === 'ControlledByParent') {
        findings.push({
          type: 'owd',
          label: 'OWD: Controlled By Parent',
          accessLevel: 'Inherited',
          source: 'EntityDefinition.InternalSharingModel',
          status: 'confirmed',
        });

        evidence.push({
          id: `share-owd-${recordId}`,
          category: 'sharing',
          status: 'confirmed',
          title: 'OWD Baseline: Controlled by Parent (Master-Detail)',
          explanation: `Salesforce EntityDefinition confirms InternalSharingModel = ControlledByParent. Sharing is inherited from the parent record.`,
          source: 'EntityDefinition',
          retrievedAt: new Date().toISOString(),
        });
      }
    } else {
      // Document limitation if EntityDefinition not queryable
      evidence.push({
        id: `share-limitation-owd-${recordId}`,
        category: 'sharing',
        status: 'unavailable',
        title: 'Organization-Wide Defaults (OWD) Verification',
        explanation: 'Salesforce standard REST data API does not expose org-wide default sharing settings directly without Tooling/Metadata API access. If OWD is Public Read/Write or Public Read Only, baseline access is granted automatically without explicit share rows.',
        source: 'Metadata/Tooling API Boundary',
        retrievedAt: new Date().toISOString(),
        limitation: 'OWD baseline could not be directly confirmed via standard SOQL.',
      });
    }
  } catch {
    // Document limitation on error
    evidence.push({
      id: `share-limitation-owd-${recordId}`,
      category: 'sharing',
      status: 'unavailable',
      title: 'Organization-Wide Defaults (OWD) Verification',
      explanation: 'Salesforce standard REST data API does not expose org-wide default sharing settings directly without Tooling/Metadata API access. If OWD is Public Read/Write or Public Read Only, baseline access is granted automatically without explicit share rows.',
      source: 'Metadata/Tooling API Boundary',
      retrievedAt: new Date().toISOString(),
      limitation: 'OWD baseline could not be directly confirmed via standard SOQL.',
    });
  }

  // 5. Document Known Limitations (Restriction Rules & Dynamic Forms)
  evidence.push({
    id: `restriction-rule-note-${recordId}`,
    category: 'restriction',
    status: 'unavailable',
    title: 'Restriction Rules & UI Dynamic Forms',
    explanation: 'Restriction Rules and Lightning Dynamic Forms / Component Visibility rules are evaluated at user runtime. Because ForceLens executes via the connected admin identity and does not impersonate the target user, UI filters cannot be guaranteed.',
    source: 'Salesforce Platform Security Architecture',
    retrievedAt: new Date().toISOString(),
    limitation: 'Simulating target user UI filter expressions requires session impersonation which is out of scope.',
  });

  return { findings, evidence, warnings, ownerId, recordName };
}

/**
 * Checks OWD baseline via EntityDefinition query
 */
async function checkOwdBaseline(objectApiName: string): Promise<{ internalSharingModel: string; externalSharingModel?: string } | null> {
  try {
    const soql = `
      SELECT QualifiedApiName, InternalSharingModel, ExternalSharingModel
      FROM EntityDefinition
      WHERE QualifiedApiName = '${objectApiName}'
      LIMIT 1
    `;
    const res = await sfApi.query<{ QualifiedApiName: string; InternalSharingModel: string; ExternalSharingModel?: string }>(soql);
    if (res && res.length > 0 && res[0].InternalSharingModel) {
      return {
        internalSharingModel: res[0].InternalSharingModel,
        externalSharingModel: res[0].ExternalSharingModel,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Evaluates whether target user's role is an ancestor of record owner's role in the hierarchy
 */
async function evaluateRoleHierarchy(
  ownerUserId: string,
  targetUserRoleId: string,
  targetUserRoleName: string
): Promise<{ isAncestor: boolean; ownerRoleName: string; path: string[] } | null> {
  try {
    // 1. Get Owner's UserRole
    const ownerQuery = `
      SELECT Id, UserRoleId, UserRole.Name
      FROM User
      WHERE Id = '${ownerUserId}'
      LIMIT 1
    `;
    const ownerRecs = await sfApi.query<{ Id: string; UserRoleId?: string; UserRole?: { Name: string } }>(ownerQuery);
    if (!ownerRecs || ownerRecs.length === 0 || !ownerRecs[0].UserRoleId) {
      return null;
    }

    const ownerRoleId = ownerRecs[0].UserRoleId;
    const ownerRoleName = ownerRecs[0].UserRole?.Name || 'Owner Role';

    if (ownerRoleId === targetUserRoleId) {
      return {
        isAncestor: false,
        ownerRoleName,
        path: [ownerRoleName],
      };
    }

    // 2. Fetch UserRole table
    const rolesQuery = `
      SELECT Id, Name, ParentRoleId
      FROM UserRole
      LIMIT 1000
    `;
    const roles = await sfApi.query<{ Id: string; Name: string; ParentRoleId?: string }>(rolesQuery);
    const roleMap = new Map<string, { name: string; parentRoleId?: string }>();
    for (const r of roles) {
      roleMap.set(r.Id, { name: r.Name, parentRoleId: r.ParentRoleId });
    }

    // 3. Traverse upwards from ownerRoleId
    let currentId: string | undefined = ownerRoleId;
    const visited = new Set<string>();
    const path: string[] = [ownerRoleName];
    let isAncestor = false;

    while (currentId && !visited.has(currentId) && visited.size < 50) {
      visited.add(currentId);
      const node = roleMap.get(currentId);
      if (!node || !node.parentRoleId) break;

      const parentNode = roleMap.get(node.parentRoleId);
      const parentName = parentNode?.name || node.parentRoleId;
      path.push(parentName);

      if (node.parentRoleId === targetUserRoleId) {
        isAncestor = true;
        break;
      }
      currentId = node.parentRoleId;
    }

    return {
      isAncestor,
      ownerRoleName,
      path: isAncestor ? path.reverse() : path,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves group membership recursively with cycle prevention and depth limit.
 */
async function resolveGroupMemberships(
  groupIds: string[],
  targetUserId: string,
  maxDepth = 3
): Promise<Map<string, { name: string; isMember: boolean; path: string[] }>> {
  const result = new Map<string, { name: string; isMember: boolean; path: string[] }>();
  if (groupIds.length === 0) return result;

  const idList = groupIds.map((id) => `'${id}'`).join(',');
  const groupQuery = `
    SELECT Id, Name, DeveloperName, Type
    FROM Group
    WHERE Id IN (${idList})
  `;
  const groups = await sfApi.query<GroupRecord>(groupQuery);
  for (const g of groups) {
    result.set(g.Id, {
      name: g.Name || g.DeveloperName || g.Id,
      isMember: false,
      path: [],
    });
  }

  // Query direct members
  const memberQuery = `
    SELECT Id, GroupId, UserOrGroupId
    FROM GroupMember
    WHERE GroupId IN (${idList})
  `;
  const members = await sfApi.query<GroupMemberRecord>(memberQuery);

  const nestedGroupIds: string[] = [];

  for (const m of members) {
    if (m.UserOrGroupId === targetUserId) {
      const g = result.get(m.GroupId);
      if (g) {
        g.isMember = true;
        g.path = [g.name, targetUserId];
      }
    } else if (m.UserOrGroupId.startsWith('00G') && maxDepth > 0) {
      nestedGroupIds.push(m.UserOrGroupId);
    }
  }

  // Recurse for nested groups if needed
  if (nestedGroupIds.length > 0 && maxDepth > 0) {
    try {
      const nestedResults = await resolveGroupMemberships(nestedGroupIds, targetUserId, maxDepth - 1);
      for (const m of members) {
        if (m.UserOrGroupId.startsWith('00G')) {
          const nested = nestedResults.get(m.UserOrGroupId);
          if (nested && nested.isMember) {
            const g = result.get(m.GroupId);
            if (g) {
              g.isMember = true;
              g.path = [g.name, ...nested.path];
            }
          }
        }
      }
    } catch {
      // Soft fail nested recursion
    }
  }

  return result;
}

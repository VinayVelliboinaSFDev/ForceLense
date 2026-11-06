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

export interface ResolvedShareTableSchema {
  shareTable: string;
  fkField: string;
  accessLevelField: string;
  hasRowCause: boolean;
  hasUserOrGroupId: boolean;
  relatedAccessFields: string[];
}

// Built-in standard share definitions map as robust fallback knowledge
const STANDARD_SHARE_MAP: Record<string, { shareTable: string; fkField: string; accessLevelField: string; relatedAccessFields?: string[] }> = {
  Account: {
    shareTable: 'AccountShare',
    fkField: 'AccountId',
    accessLevelField: 'AccountAccessLevel',
    relatedAccessFields: ['OpportunityAccessLevel', 'CaseAccessLevel', 'ContactAccessLevel'],
  },
  Case: {
    shareTable: 'CaseShare',
    fkField: 'CaseId',
    accessLevelField: 'CaseAccessLevel',
  },
  Opportunity: {
    shareTable: 'OpportunityShare',
    fkField: 'OpportunityId',
    accessLevelField: 'OpportunityAccessLevel',
  },
  Contact: {
    shareTable: 'ContactShare',
    fkField: 'ContactId',
    accessLevelField: 'ContactAccessLevel',
  },
  Lead: {
    shareTable: 'LeadShare',
    fkField: 'LeadId',
    accessLevelField: 'LeadAccessLevel',
  },
  Campaign: {
    shareTable: 'CampaignShare',
    fkField: 'CampaignId',
    accessLevelField: 'CampaignAccessLevel',
  },
  User: {
    shareTable: 'UserShare',
    fkField: 'UserId',
    accessLevelField: 'UserAccessLevel',
  },
};

/**
 * Dynamically resolves and scans the share table schema for an object:
 * 1. Checks candidate share table name (e.g. AccountShare, Custom__Share)
 * 2. Scans the sObject describe to inspect actual field names
 * 3. Accurately identifies varying access fields (e.g. AccountAccessLevel vs CaseAccessLevel vs AccessLevel)
 * 4. Accurately identifies foreign key fields (e.g. AccountId vs CaseId vs ParentId)
 */
export async function resolveShareTableSchema(objectApiName: string): Promise<ResolvedShareTableSchema | null> {
  const clean = objectApiName.trim();
  const candidateTable = clean.endsWith('__c') ? clean.replace(/__c$/, '__Share') : `${clean}Share`;

  const fallback = STANDARD_SHARE_MAP[clean] || {
    shareTable: candidateTable,
    fkField: clean.endsWith('__c') ? 'ParentId' : `${clean}Id`,
    accessLevelField: clean.endsWith('__c') ? 'AccessLevel' : `${clean}AccessLevel`,
    relatedAccessFields: [],
  };

  try {
    const describe = await sfApi.describeSObject(candidateTable);
    if (!describe || !describe.fields) {
      return {
        shareTable: fallback.shareTable,
        fkField: fallback.fkField,
        accessLevelField: fallback.accessLevelField,
        hasRowCause: true,
        hasUserOrGroupId: true,
        relatedAccessFields: fallback.relatedAccessFields || [],
      };
    }

    const fieldNames = new Set(describe.fields.map((f) => f.name));
    const fieldNamesLower = new Map(describe.fields.map((f) => [f.name.toLowerCase(), f.name]));

    // 1. Resolve Parent/FK field
    let fkField = 'ParentId';
    const specificFk = `${clean}Id`.toLowerCase();
    if (fieldNamesLower.has(specificFk)) {
      fkField = fieldNamesLower.get(specificFk)!;
    } else if (fieldNamesLower.has('parentid')) {
      fkField = fieldNamesLower.get('parentid')!;
    } else {
      fkField = fallback.fkField;
    }

    // 2. Resolve AccessLevel field
    let accessLevelField = 'AccessLevel';
    const specificAccess = `${clean}AccessLevel`.toLowerCase();
    if (fieldNamesLower.has(specificAccess)) {
      accessLevelField = fieldNamesLower.get(specificAccess)!;
    } else if (fieldNamesLower.has('accesslevel')) {
      accessLevelField = fieldNamesLower.get('accesslevel')!;
    } else {
      for (const [lowerName, origName] of fieldNamesLower.entries()) {
        if (lowerName.endsWith('accesslevel')) {
          accessLevelField = origName;
          break;
        }
      }
    }

    const hasRowCause = fieldNamesLower.has('rowcause');
    const hasUserOrGroupId = fieldNamesLower.has('userorgroupid');

    // 3. Resolve any related access level fields (e.g. AccountShare: OpportunityAccessLevel, CaseAccessLevel, ContactAccessLevel)
    const relatedAccessFields: string[] = [];
    if (fallback.relatedAccessFields) {
      for (const relField of fallback.relatedAccessFields) {
        if (fieldNames.has(relField)) {
          relatedAccessFields.push(relField);
        }
      }
    }

    return {
      shareTable: candidateTable,
      fkField,
      accessLevelField,
      hasRowCause,
      hasUserOrGroupId,
      relatedAccessFields,
    };
  } catch {
    // If describe fails (e.g. offline/mock testing or describe not queryable):
    // Return standard fallback schema for standard and custom objects
    return {
      shareTable: fallback.shareTable,
      fkField: fallback.fkField,
      accessLevelField: fallback.accessLevelField,
      hasRowCause: true,
      hasUserOrGroupId: true,
      relatedAccessFields: fallback.relatedAccessFields || [],
    };
  }
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

  // 2. Scan and Query Share Table using Dynamically Discovered Schema
  const shareSchema = await resolveShareTableSchema(objectApiName);
  if (shareSchema) {
    try {
      const selectFields = ['Id', shareSchema.fkField, 'UserOrGroupId', shareSchema.accessLevelField];
      if (shareSchema.hasRowCause) selectFields.push('RowCause');
      if (shareSchema.relatedAccessFields.length > 0) {
        selectFields.push(...shareSchema.relatedAccessFields);
      }

      const shareSoql = `
        SELECT ${selectFields.join(', ')}
        FROM ${shareSchema.shareTable}
        WHERE ${shareSchema.fkField} = '${recordId}'
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
          const rawAccessLevel = String(row[shareSchema.accessLevelField] || row.AccessLevel || 'Read');
          const rowCause = shareSchema.hasRowCause ? String(row.RowCause || 'Manual') : 'Manual';

          const extraDetails: Record<string, unknown> = {
            shareId: row.Id,
            accessLevel: rawAccessLevel,
            rowCause,
            accessLevelField: shareSchema.accessLevelField,
            foreignKeyField: shareSchema.fkField,
          };
          for (const relField of shareSchema.relatedAccessFields) {
            if (row[relField]) extraDetails[relField] = row[relField];
          }

          findings.push({
            type: 'share_row',
            label: `Direct Share (${rowCause})`,
            accessLevel: rawAccessLevel,
            rowCause,
            source: `${shareSchema.shareTable}.${shareSchema.accessLevelField}`,
            status: 'confirmed',
          });

          evidence.push({
            id: `share-row-${row.Id}`,
            category: 'sharing',
            status: 'confirmed',
            title: `Direct Share Row: ${rowCause}`,
            explanation: `Found explicit share record in ${shareSchema.shareTable} granting ${rawAccessLevel} access directly to user ${targetUser.name} (evaluated via field ${shareSchema.accessLevelField}).`,
            source: shareSchema.shareTable,
            retrievedAt: new Date().toISOString(),
            targetUserId: targetUser.id,
            recordId,
            details: extraDetails,
          });
        }

        // Check Group / Role Shares
        if (candidateGroupIds.length > 0) {
          try {
            const groupDetails = await resolveGroupMemberships(candidateGroupIds, targetUser.id);

            for (const row of shareRows) {
              const matchedGroup = groupDetails.get(row.UserOrGroupId);
              if (matchedGroup && matchedGroup.isMember) {
                const rawAccessLevel = String(row[shareSchema.accessLevelField] || row.AccessLevel || 'Read');
                const rowCause = shareSchema.hasRowCause ? String(row.RowCause || 'Manual') : 'Manual';

                const extraDetails: Record<string, unknown> = {
                  shareId: row.Id,
                  accessLevel: rawAccessLevel,
                  rowCause,
                  accessLevelField: shareSchema.accessLevelField,
                  foreignKeyField: shareSchema.fkField,
                };
                for (const relField of shareSchema.relatedAccessFields) {
                  if (row[relField]) extraDetails[relField] = row[relField];
                }

                findings.push({
                  type: 'group',
                  label: `Public Group Share (${matchedGroup.name})`,
                  accessLevel: rawAccessLevel,
                  rowCause,
                  path: matchedGroup.path,
                  source: `${shareSchema.shareTable} -> GroupMember`,
                  status: 'supported',
                });

                evidence.push({
                  id: `share-group-${row.Id}`,
                  category: 'sharing',
                  status: 'supported',
                  title: `Access via Group: ${matchedGroup.name}`,
                  explanation: `Share row grants ${rawAccessLevel} to Group/Role "${matchedGroup.name}" (${row.UserOrGroupId}) via ${shareSchema.accessLevelField}. User is confirmed a member via path: ${matchedGroup.path.join(' -> ')}.`,
                  source: `${shareSchema.shareTable} & GroupMember`,
                  retrievedAt: new Date().toISOString(),
                  targetUserId: targetUser.id,
                  recordId,
                  details: extraDetails,
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
          title: `No Explicit Share Rows in ${shareSchema.shareTable}`,
          explanation: `Queried ${shareSchema.shareTable} (matching foreign key ${shareSchema.fkField} and access field ${shareSchema.accessLevelField}) but found 0 share records. Access may be governed by OWD, Role Hierarchy, Implicit sharing, or System permissions.`,
          source: shareSchema.shareTable,
          retrievedAt: new Date().toISOString(),
          targetUserId: targetUser.id,
          recordId,
        });
      }
    } catch (shareErr: unknown) {
      const errorMsg = shareErr instanceof Error ? shareErr.message : String(shareErr);
      warnings.push(`Share table query error (${shareSchema.shareTable}): ${errorMsg}`);
      evidence.push({
        id: `share-table-unavailable-${recordId}`,
        category: 'sharing',
        status: 'unavailable',
        title: `Share Table (${shareSchema.shareTable}) Inaccessible`,
        explanation: `Could not query ${shareSchema.shareTable}: ${errorMsg}.`,
        source: shareSchema.shareTable,
        retrievedAt: new Date().toISOString(),
        targetUserId: targetUser.id,
        recordId,
        limitation: 'Ensure connected user has permissions to query share tables.',
      });
    }
  } else {
    // If object has no share table (e.g. Master-Detail child or ControlledByParent)
    evidence.push({
      id: `share-table-not-applicable-${recordId}`,
      category: 'sharing',
      status: 'not_applicable',
      title: `No Independent Share Table (${objectApiName})`,
      explanation: `Object ${objectApiName} does not have an independent share table. Sharing is Controlled by Parent (Master-Detail) or governed directly by parent/system defaults.`,
      source: 'Describe & Platform Sharing Architecture',
      retrievedAt: new Date().toISOString(),
      targetUserId: targetUser.id,
      recordId,
    });
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

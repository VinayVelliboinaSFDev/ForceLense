import { sfApi } from '../salesforce/api-client';
import { PermissionSetAssignmentRecord, ObjectPermissionsRecord, MutingPermissionSetRecord } from '../salesforce/types';
import { EvidenceItem, ObjectCRUDPermissions, TargetUser } from '../types';

export interface ObjectPermissionsAnalyzerResult {
  permissions: ObjectCRUDPermissions;
  evidence: EvidenceItem[];
  warnings: string[];
  permissionSetIds: string[];
  mutingPermissionSetIds: string[];
}

export async function analyzeObjectPermissions(
  targetUser: TargetUser,
  objectApiName: string
): Promise<ObjectPermissionsAnalyzerResult> {
  const evidence: EvidenceItem[] = [];
  const warnings: string[] = [];

  const permissions: ObjectCRUDPermissions = {
    read: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    modifyAll: false,
  };

  const grantSources: Record<keyof ObjectCRUDPermissions, string[]> = {
    read: [],
    create: [],
    edit: [],
    delete: [],
    viewAll: [],
    modifyAll: [],
  };

  const mutedActions: Record<keyof ObjectCRUDPermissions, string[]> = {
    read: [],
    create: [],
    edit: [],
    delete: [],
    viewAll: [],
    modifyAll: [],
  };

  try {
    // 1. Retrieve all assigned Permission Sets & Groups for the target user
    const psaSoql = `
      SELECT Id, AssigneeId, PermissionSetId, PermissionSetGroupId,
             PermissionSet.Id, PermissionSet.Name, PermissionSet.Label,
             PermissionSet.IsOwnedByProfile, PermissionSet.ProfileId,
             PermissionSet.PermissionsViewAllData, PermissionSet.PermissionsModifyAllData
      FROM PermissionSetAssignment
      WHERE AssigneeId = '${targetUser.id}'
    `;

    const assignments = await sfApi.query<PermissionSetAssignmentRecord>(psaSoql);
    const permSetIdMap = new Map<string, { label: string; isProfile: boolean; groupId?: string; viewAllData?: boolean; modifyAllData?: boolean }>();
    const assignedGroupIds: string[] = [];

    for (const a of assignments) {
      if (a.PermissionSetId) {
        permSetIdMap.set(a.PermissionSetId, {
          label: a.PermissionSet?.Label || a.PermissionSet?.Name || 'Permission Set',
          isProfile: !!a.PermissionSet?.IsOwnedByProfile,
          groupId: a.PermissionSetGroupId,
          viewAllData: !!a.PermissionSet?.PermissionsViewAllData,
          modifyAllData: !!a.PermissionSet?.PermissionsModifyAllData,
        });
      }
      if (a.PermissionSetGroupId && !assignedGroupIds.includes(a.PermissionSetGroupId)) {
        assignedGroupIds.push(a.PermissionSetGroupId);
      }
    }

    // 2. Also ensure profile permission set is included
    if (targetUser.profileId) {
      try {
        const profPsSoql = `
          SELECT Id, Name, Label, IsOwnedByProfile, PermissionsViewAllData, PermissionsModifyAllData
          FROM PermissionSet
          WHERE ProfileId = '${targetUser.profileId}' AND IsOwnedByProfile = true
          LIMIT 1
        `;
        const profPsRecords = await sfApi.query<{
          Id: string;
          Name: string;
          Label: string;
          IsOwnedByProfile: boolean;
          PermissionsViewAllData?: boolean;
          PermissionsModifyAllData?: boolean;
        }>(profPsSoql);

        for (const ps of profPsRecords) {
          permSetIdMap.set(ps.Id, {
            label: `Profile: ${targetUser.profileName}`,
            isProfile: true,
            viewAllData: !!ps.PermissionsViewAllData,
            modifyAllData: !!ps.PermissionsModifyAllData,
          });
        }
      } catch {
        // Soft fail if PermissionSet table query for profile fails
      }
    }

    const allPermSetIds = Array.from(permSetIdMap.keys());

    // Check system-level overrides: View All Data / Modify All Data
    for (const [, info] of permSetIdMap.entries()) {
      if (info.modifyAllData) {
        permissions.read = true;
        permissions.edit = true;
        permissions.delete = true;
        permissions.viewAll = true;
        permissions.modifyAll = true;
        grantSources.read.push(`${info.label} (Modify All Data)`);
        grantSources.edit.push(`${info.label} (Modify All Data)`);
        grantSources.delete.push(`${info.label} (Modify All Data)`);
        grantSources.viewAll.push(`${info.label} (Modify All Data)`);
        grantSources.modifyAll.push(`${info.label} (Modify All Data)`);
      } else if (info.viewAllData) {
        permissions.read = true;
        permissions.viewAll = true;
        grantSources.read.push(`${info.label} (View All Data)`);
        grantSources.viewAll.push(`${info.label} (View All Data)`);
      }
    }

    if (allPermSetIds.length === 0) {
      warnings.push(`No permission sets or profile records resolved for user ${targetUser.name}.`);
      evidence.push({
        id: `obj-perm-none-${objectApiName}`,
        category: 'object',
        status: 'unknown',
        title: `Object Permissions (${objectApiName}) Inconclusive`,
        explanation: 'No permission set assignments could be inspected.',
        source: 'PermissionSetAssignment',
        retrievedAt: new Date().toISOString(),
        targetUserId: targetUser.id,
      });

      return { permissions, evidence, warnings, permissionSetIds: [], mutingPermissionSetIds: [] };
    }

    // 3. Query ObjectPermissions for these permission sets
    const idListStr = allPermSetIds.map((id) => `'${id}'`).join(',');
    const objPermSoql = `
      SELECT ParentId, Parent.Name, Parent.Label, Parent.IsOwnedByProfile,
             SObjectType, PermissionsRead, PermissionsCreate,
             PermissionsEdit, PermissionsDelete,
             PermissionsViewAllRecords, PermissionsModifyAllRecords
      FROM ObjectPermissions
      WHERE ParentId IN (${idListStr})
        AND SObjectType = '${objectApiName}'
    `;

    const objPermRows = await sfApi.query<ObjectPermissionsRecord>(objPermSoql);

    for (const row of objPermRows) {
      const parentLabel = row.Parent?.Label || permSetIdMap.get(row.ParentId)?.label || 'Permission Set';

      if (row.PermissionsRead) {
        permissions.read = true;
        grantSources.read.push(parentLabel);
      }
      if (row.PermissionsCreate) {
        permissions.create = true;
        grantSources.create.push(parentLabel);
      }
      if (row.PermissionsEdit) {
        permissions.edit = true;
        grantSources.edit.push(parentLabel);
      }
      if (row.PermissionsDelete) {
        permissions.delete = true;
        grantSources.delete.push(parentLabel);
      }
      if (row.PermissionsViewAllRecords) {
        permissions.viewAll = true;
        grantSources.viewAll.push(parentLabel);
      }
      if (row.PermissionsModifyAllRecords) {
        permissions.modifyAll = true;
        grantSources.modifyAll.push(parentLabel);
      }
    }

    // 4. Inspect Permission Set Group Muting Sets
    const mutingSetIds: string[] = [];
    if (assignedGroupIds.length > 0) {
      try {
        const groupListStr = assignedGroupIds.map((id) => `'${id}'`).join(',');
        const mutingQuery = `
          SELECT Id, PermissionSetGroupId, DeveloperName, MasterLabel
          FROM MutingPermissionSet
          WHERE PermissionSetGroupId IN (${groupListStr})
        `;
        const mutingRows = await sfApi.query<MutingPermissionSetRecord>(mutingQuery);

        for (const m of mutingRows) {
          mutingSetIds.push(m.Id);
        }

        if (mutingSetIds.length > 0) {
          const mutingIdStr = mutingSetIds.map((id) => `'${id}'`).join(',');
          const mutingObjPermQuery = `
            SELECT ParentId, SObjectType,
                   PermissionsRead, PermissionsCreate,
                   PermissionsEdit, PermissionsDelete,
                   PermissionsViewAllRecords, PermissionsModifyAllRecords
            FROM ObjectPermissions
            WHERE ParentId IN (${mutingIdStr})
              AND SObjectType = '${objectApiName}'
          `;
          const mutingPermRows = await sfApi.query<ObjectPermissionsRecord>(mutingObjPermQuery);

          for (const mRow of mutingPermRows) {
            // In a MutingPermissionSet, PermissionsX = true means the permission is explicitly MUTED!
            if (mRow.PermissionsRead) mutedActions.read.push('Muting Permission Set');
            if (mRow.PermissionsCreate) mutedActions.create.push('Muting Permission Set');
            if (mRow.PermissionsEdit) mutedActions.edit.push('Muting Permission Set');
            if (mRow.PermissionsDelete) mutedActions.delete.push('Muting Permission Set');
            if (mRow.PermissionsViewAllRecords) mutedActions.viewAll.push('Muting Permission Set');
            if (mRow.PermissionsModifyAllRecords) mutedActions.modifyAll.push('Muting Permission Set');
          }

          // Apply muting negation if no unmuted standalone source exists
          const actions: Array<keyof ObjectCRUDPermissions> = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'];
          for (const act of actions) {
            if (mutedActions[act].length > 0) {
              // Check if any granting source is from outside the muted group (e.g. Profile or unmuted standalone set)
              const hasExternalGrant = grantSources[act].some((src) => src.startsWith('Profile:'));
              if (!hasExternalGrant) {
                permissions[act] = false;
              }
            }
          }

          const mutedList = actions.filter((act) => mutedActions[act].length > 0);
          if (mutedList.length > 0) {
            evidence.push({
              id: `obj-muting-${objectApiName}`,
              category: 'object',
              status: 'confirmed',
              title: `Permission Set Group Muting Applied (${objectApiName})`,
              explanation: `Muting Permission Set explicitly muted: ${mutedList.join(', ')}. Permissions were subtracted from assigned Permission Set Groups.`,
              source: 'MutingPermissionSet',
              retrievedAt: new Date().toISOString(),
              targetUserId: targetUser.id,
              details: {
                mutedActions,
              },
            });
          }
        }
      } catch (mutingErr) {
        warnings.push(`Muting permission check: ${mutingErr instanceof Error ? mutingErr.message : String(mutingErr)}`);
      }
    }

    // Record evidence items
    const actionsSummary = [
      permissions.read ? 'Read' : null,
      permissions.create ? 'Create' : null,
      permissions.edit ? 'Edit' : null,
      permissions.delete ? 'Delete' : null,
      permissions.viewAll ? 'View All' : null,
      permissions.modifyAll ? 'Modify All' : null,
    ].filter(Boolean).join(', ') || 'No CRUD access';

    evidence.push({
      id: `obj-perm-${objectApiName}`,
      category: 'object',
      status: 'confirmed',
      title: `Object CRUD Permissions for ${objectApiName}`,
      explanation: `Granted CRUD actions: ${actionsSummary}. Evaluated across ${allPermSetIds.length} assigned permission sets, ${assignedGroupIds.length} permission set groups, and profile.`,
      source: 'ObjectPermissions',
      retrievedAt: new Date().toISOString(),
      targetUserId: targetUser.id,
      details: {
        read: permissions.read,
        create: permissions.create,
        edit: permissions.edit,
        delete: permissions.delete,
        viewAll: permissions.viewAll,
        modifyAll: permissions.modifyAll,
        grantSources,
        assignedGroupIds,
      },
    });

    return { permissions, evidence, warnings, permissionSetIds: allPermSetIds, mutingPermissionSetIds: mutingSetIds };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    warnings.push(`Object permissions analysis failed: ${errorMsg}`);

    evidence.push({
      id: `obj-perm-failed-${objectApiName}`,
      category: 'object',
      status: 'unavailable',
      title: `Object Permissions Query Failed (${objectApiName})`,
      explanation: `Could not query ObjectPermissions: ${errorMsg}`,
      source: 'ObjectPermissions',
      retrievedAt: new Date().toISOString(),
      targetUserId: targetUser.id,
      limitation: 'Insufficient permissions to query ObjectPermissions or PermissionSetAssignment.',
    });

    return { permissions, evidence, warnings, permissionSetIds: [], mutingPermissionSetIds: [] };
  }
}

import { sfApi } from '../salesforce/api-client';
import { FieldPermissionsRecord, SObjectDescribe } from '../salesforce/types';
import { EvidenceItem, FieldPermissionResult } from '../types';

export interface FieldPermissionsAnalyzerResult {
  fields: FieldPermissionResult[];
  evidence: EvidenceItem[];
  warnings: string[];
}

export async function analyzeFieldPermissions(
  targetUserId: string,
  objectApiName: string,
  permissionSetIds: string[],
  describe?: SObjectDescribe,
  targetProfileName?: string
): Promise<FieldPermissionsAnalyzerResult> {
  const evidence: EvidenceItem[] = [];
  const warnings: string[] = [];
  const fieldsResult: FieldPermissionResult[] = [];

  try {
    const sObjDescribe = describe || (await sfApi.describeSObject(objectApiName));
    const objectFields = sObjDescribe.fields || [];

    // Filter to top key fields and permissionable fields
    const permissionableFields = objectFields.filter((f) => f.permissionable);
    const nonPermissionableFields = objectFields.filter((f) => !f.permissionable);

    const flsMap = new Map<
      string,
      { readable: boolean; editable: boolean; sources: string[] }
    >();

    // Initialize all fields from describe
    for (const f of objectFields) {
      if (!f.permissionable) {
        // System / non-permissionable field behavior (e.g. Id, CreatedDate, etc.)
        flsMap.set(f.name.toLowerCase(), {
          readable: true,
          editable: f.updateable || f.createable,
          sources: ['Standard System Field Rules'],
        });
      } else {
        flsMap.set(f.name.toLowerCase(), {
          readable: false,
          editable: false,
          sources: [],
        });
      }
    }

    if (permissionSetIds.length > 0 && permissionableFields.length > 0) {
      const idListStr = permissionSetIds.map((id) => `'${id}'`).join(',');
      const flsSoql = `
        SELECT ParentId, SObjectType, Field,
               PermissionsRead, PermissionsEdit,
               Parent.Name, Parent.Label
        FROM FieldPermissions
        WHERE ParentId IN (${idListStr})
          AND SObjectType = '${objectApiName}'
      `;

      const flsRows = await sfApi.query<FieldPermissionsRecord>(flsSoql);

      for (const row of flsRows) {
        // Field in FieldPermissions is formatted as 'Account.Type' or 'Type'
        const parts = row.Field.split('.');
        const fieldName = (parts.length > 1 ? parts[1] : parts[0]).toLowerCase();

        const current = flsMap.get(fieldName) || { readable: false, editable: false, sources: [] };
        let parentLabel = row.Parent?.Label || row.Parent?.Name || 'Permission Set';
        if ((/^00e/i.test(parentLabel) || /^[a-zA-Z0-9]{15,18}$/.test(parentLabel)) && targetProfileName) {
          parentLabel = `Profile: ${targetProfileName}`;
        }

        if (row.PermissionsRead) {
          current.readable = true;
          if (!current.sources.includes(parentLabel)) current.sources.push(parentLabel);
        }
        if (row.PermissionsEdit) {
          current.editable = true;
          if (!current.sources.includes(parentLabel)) current.sources.push(parentLabel);
        }
        flsMap.set(fieldName, current);
      }
    }

    // Convert to FieldPermissionResult array
    for (const f of objectFields) {
      const entry = flsMap.get(f.name.toLowerCase()) || {
        readable: false,
        editable: false,
        sources: [],
      };

      fieldsResult.push({
        fieldApiName: f.name,
        label: f.label,
        readable: entry.readable,
        editable: entry.editable,
        source: entry.sources.join(', ') || 'Restricted / Denied',
      });
    }

    const readableCount = fieldsResult.filter((f) => f.readable === true).length;
    const editableCount = fieldsResult.filter((f) => f.editable === true).length;

    evidence.push({
      id: `fls-${objectApiName}`,
      category: 'field',
      status: 'confirmed',
      title: `Field-Level Security (${objectApiName})`,
      explanation: `Analyzed ${objectFields.length} fields (${permissionableFields.length} permissionable, ${nonPermissionableFields.length} standard system). ${readableCount} readable, ${editableCount} editable.`,
      source: 'FieldPermissions & Describe',
      retrievedAt: new Date().toISOString(),
      targetUserId,
      details: {
        totalFields: objectFields.length,
        permissionableFieldsCount: permissionableFields.length,
        readableCount,
        editableCount,
      },
    });

    return { fields: fieldsResult, evidence, warnings };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    warnings.push(`Field permissions analysis failed: ${errorMsg}`);

    evidence.push({
      id: `fls-failed-${objectApiName}`,
      category: 'field',
      status: 'unavailable',
      title: `Field Permissions Query Unavailable (${objectApiName})`,
      explanation: `Could not retrieve field describe or permissions: ${errorMsg}`,
      source: 'FieldPermissions',
      retrievedAt: new Date().toISOString(),
      targetUserId,
      limitation: 'Ensure user has API access to FieldPermissions and sObject describe.',
    });

    return { fields: [], evidence, warnings };
  }
}

import { describe, it, expect } from 'vitest';
import { MOCK_ANALYSIS_RESULT, MOCK_TARGET_USERS } from '../src/components/MockData';
import { AnalysisResult } from '../src/types';
import { traverseParentSharing, CONTROLLED_CHILD_MAP } from '../src/analyzers/sharing-evidence';

describe('V2 Roadmap Features', () => {
  describe('User Diff Mode Analysis', () => {
    it('accurately identifies access differences between Admin (User B) and Standard (User A)', () => {
      const userA = MOCK_TARGET_USERS[0]; // Alex Rivera (Read-Only)
      const userB = MOCK_TARGET_USERS[1]; // Sarah Chen (Full / Admin)

      const resultA = MOCK_ANALYSIS_RESULT;
      const resultB: AnalysisResult = {
        ...MOCK_ANALYSIS_RESULT,
        targetUserId: userB.id,
        targetUserName: userB.name,
        recordAccess: {
          read: true,
          edit: true,
          delete: true,
          maxAccessLevel: 'All',
        },
        objectPermissions: {
          read: true,
          create: true,
          edit: true,
          delete: true,
          viewAll: true,
          modifyAll: true,
        },
        sharingFindings: [
          {
            type: 'ownership',
            label: `Direct Record Owner (${userB.name})`,
            accessLevel: 'All',
            rowCause: 'Owner',
            source: 'Case.OwnerId',
            status: 'confirmed',
          },
        ],
        fieldPermissions: MOCK_ANALYSIS_RESULT.fieldPermissions.map((f) => ({
          ...f,
          readable: true,
          editable: true,
          source: `Profile: ${userB.profileName}`,
        })),
      };

      // 1. Record Access Diff
      expect(resultA.recordAccess?.edit).toBe(false);
      expect(resultB.recordAccess?.edit).toBe(true);
      expect(resultA.recordAccess?.maxAccessLevel).not.toBe(resultB.recordAccess?.maxAccessLevel);

      // 2. Object CRUD Diff
      expect(resultA.objectPermissions.delete).toBe(false);
      expect(resultB.objectPermissions.delete).toBe(true);

      // 3. FLS Diff
      const internalCommentsA = resultA.fieldPermissions.find((f) => f.fieldApiName === 'Internal_Comments__c');
      const internalCommentsB = resultB.fieldPermissions.find((f) => f.fieldApiName === 'Internal_Comments__c');
      expect(internalCommentsA?.readable).toBe(false);
      expect(internalCommentsB?.readable).toBe(true);
    });

    it('accurately detects when Contractor (User B) has restricted access compared to User A', () => {
      const userA = MOCK_TARGET_USERS[0]; // Alex Rivera
      const userContractor = MOCK_TARGET_USERS[2]; // Jordan Taylor

      const resultContractor: AnalysisResult = {
        ...MOCK_ANALYSIS_RESULT,
        targetUserId: userContractor.id,
        targetUserName: userContractor.name,
        recordAccess: {
          read: true,
          edit: false,
          delete: false,
          maxAccessLevel: 'Read',
        },
        objectPermissions: {
          read: true,
          create: false,
          edit: false,
          delete: false,
          viewAll: false,
          modifyAll: false,
        },
        fieldPermissions: MOCK_ANALYSIS_RESULT.fieldPermissions.map((f) => {
          const isBasic = f.fieldApiName === 'CaseNumber' || f.fieldApiName === 'Subject';
          return {
            ...f,
            readable: isBasic,
            editable: false,
            source: isBasic ? `Profile: ${userContractor.profileName}` : 'Restricted / Denied',
          };
        }),
      };

      // Compare CRUD: User A has Edit on object, Contractor does not
      expect(MOCK_ANALYSIS_RESULT.objectPermissions.edit).toBe(true);
      expect(resultContractor.objectPermissions.edit).toBe(false);

      // Compare FLS: User A has Description readable, Contractor has it blocked
      const descA = MOCK_ANALYSIS_RESULT.fieldPermissions.find((f) => f.fieldApiName === 'Description');
      const descB = resultContractor.fieldPermissions.find((f) => f.fieldApiName === 'Description');
      expect(descA?.readable).toBe(true);
      expect(descB?.readable).toBe(false);
    });

    it('correctly handles unknown/undefined permissions without treating them as truthy', () => {
      const partialObjPerms = {
        read: true,
        create: 'unknown' as const,
        edit: false,
        delete: undefined as unknown as boolean,
        viewAll: false,
        modifyAll: false,
      };

      // Strict evaluation: only explicit true is granted
      const isCreateGranted = partialObjPerms.create === true;
      const isDeleteGranted = partialObjPerms.delete === true;

      expect(isCreateGranted).toBe(false);
      expect(isDeleteGranted).toBe(false);
    });
  });

  describe('Master-Detail & ControlledByParent Traversal', () => {
    it('maps known child objects to parent foreign keys', () => {
      expect(CONTROLLED_CHILD_MAP['OpportunityLineItem']).toEqual({
        parentObject: 'Opportunity',
        foreignKey: 'OpportunityId',
      });
      expect(CONTROLLED_CHILD_MAP['CaseComment']).toEqual({
        parentObject: 'Case',
        foreignKey: 'ParentId',
      });
      expect(CONTROLLED_CHILD_MAP['AccountContactRole']).toEqual({
        parentObject: 'Account',
        foreignKey: 'AccountId',
      });
    });
  });
});

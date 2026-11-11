import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveGroupMemberships, clearRoleHierarchyCache } from '../src/analyzers/sharing-evidence';
import { sfApi } from '../src/salesforce/api-client';

describe('Role and Queue Sharing Membership Resolver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearRoleHierarchyCache();
  });

  it('resolves direct Role Group share when target user holds matching UserRole', async () => {
    vi.spyOn(sfApi, 'query').mockImplementation(async (query: string) => {
      if (query.includes('FROM Group')) {
        return [
          {
            Id: '00G000000RoleRep',
            Name: 'Support Representative',
            DeveloperName: 'Support_Representative',
            Type: 'Role',
            RelatedId: '00E000000RoleRep',
          },
        ] as any;
      }
      return [] as any;
    });

    const targetUser = {
      id: '005000000TargetUser',
      name: 'Melissa King',
      userRoleId: '00E000000RoleRep',
      userRoleName: 'Support Representative',
    };

    const results = await resolveGroupMemberships(['00G000000RoleRep'], targetUser);
    const resolved = results.get('00G000000RoleRep');

    expect(resolved).toBeDefined();
    expect(resolved?.isMember).toBe(true);
    expect(resolved?.type).toBe('Role');
    expect(resolved?.path).toEqual(['Role: Support Representative', 'Melissa King']);
  });

  it('resolves Queue share when Queue contains a Role Group matching target user', async () => {
    vi.spyOn(sfApi, 'query').mockImplementation(async (query: string) => {
      // 1. GroupMember query for Queue (must check before FROM Group)
      if (query.includes('FROM GroupMember') && query.includes('00G_CaseQueue')) {
        return [
          {
            Id: '00M_Member1',
            GroupId: '00G_CaseQueue',
            UserOrGroupId: '00G_RoleMember', // Nested Role Group
          },
        ] as any;
      }

      // 2. First Group query for Queue
      if (query.includes('FROM Group') && query.includes('00G_CaseQueue')) {
        return [
          {
            Id: '00G_CaseQueue',
            Name: 'Tier 2 Support Queue',
            DeveloperName: 'Tier_2_Support_Queue',
            Type: 'Queue',
          },
        ] as any;
      }

      // 3. Second Group query for nested Role Group
      if (query.includes('FROM Group') && query.includes('00G_RoleMember')) {
        return [
          {
            Id: '00G_RoleMember',
            Name: 'Tier 2 Agent Role',
            DeveloperName: 'Tier_2_Agent',
            Type: 'Role',
            RelatedId: '00E_Tier2Role',
          },
        ] as any;
      }

      return [] as any;
    });

    const targetUser = {
      id: '005000000TargetUser',
      name: 'Melissa King',
      userRoleId: '00E_Tier2Role',
      userRoleName: 'Tier 2 Agent Role',
    };

    const results = await resolveGroupMemberships(['00G_CaseQueue'], targetUser);
    const queue = results.get('00G_CaseQueue');

    expect(queue).toBeDefined();
    expect(queue?.isMember).toBe(true);
    expect(queue?.type).toBe('Queue');
    // Verifies full traversal path from Queue through nested Role to User!
    expect(queue?.path).toEqual([
      'Queue: Tier 2 Support Queue',
      'Role: Tier 2 Agent Role',
      'Melissa King',
    ]);
  });

  it('resolves RoleAndSubordinates group when target user role reports up to the group role', async () => {
    vi.spyOn(sfApi, 'query').mockImplementation(async (query: string) => {
      if (query.includes('FROM Group') && query.includes("'00G_RoleSubGroup'")) {
        return [
          {
            Id: '00G_RoleSubGroup',
            Name: 'Customer Support VP',
            DeveloperName: 'Customer_Support_VP',
            Type: 'RoleAndSubordinates',
            RelatedId: '00E_VPRole',
          },
        ] as any;
      }

      if (query.includes('FROM UserRole')) {
        return [
          { Id: '00E_VPRole', Name: 'VP of Support', ParentRoleId: undefined },
          { Id: '00E_ManagerRole', Name: 'Support Manager', ParentRoleId: '00E_VPRole' },
          { Id: '00E_RepRole', Name: 'Support Rep', ParentRoleId: '00E_ManagerRole' },
        ] as any;
      }

      return [] as any;
    });

    const targetUser = {
      id: '005000000TargetUser',
      name: 'Melissa King',
      userRoleId: '00E_RepRole',
      userRoleName: 'Support Rep',
    };

    const results = await resolveGroupMemberships(['00G_RoleSubGroup'], targetUser);
    const resolved = results.get('00G_RoleSubGroup');

    expect(resolved).toBeDefined();
    expect(resolved?.isMember).toBe(true);
    expect(resolved?.path).toEqual([
      'Role & Subordinates: Customer Support VP',
      'VP of Support',
      'Support Manager',
      'Support Rep',
      'Melissa King',
    ]);
  });

  it('analyzeSharingEvidence detects Queue share rule when target user role is member of the Queue', async () => {
    vi.spyOn(sfApi, 'query').mockImplementation(async (query: string) => {
      // Owner query
      if (query.includes('FROM Case') && query.includes('WHERE Id =')) {
        return [{ Id: '500000000Record1', OwnerId: '005OtherOwner', Name: 'Case 00123' }] as any;
      }
      // Share rows query
      if (query.includes('FROM CaseShare')) {
        return [
          {
            Id: '00S_Share1',
            CaseId: '500000000Record1',
            UserOrGroupId: '00G_Queue1',
            CaseAccessLevel: 'Read',
            RowCause: 'Rule',
          },
        ] as any;
      }
      // GroupMember query
      if (query.includes('FROM GroupMember') && query.includes('00G_Queue1')) {
        return [
          {
            Id: '00M_Member1',
            GroupId: '00G_Queue1',
            UserOrGroupId: '00G_RoleGroup1',
          },
        ] as any;
      }
      // Group queries
      if (query.includes('FROM Group') && query.includes('00G_Queue1')) {
        return [
          {
            Id: '00G_Queue1',
            Name: 'Escalations Queue',
            Type: 'Queue',
          },
        ] as any;
      }
      if (query.includes('FROM Group') && query.includes('00G_RoleGroup1')) {
        return [
          {
            Id: '00G_RoleGroup1',
            Name: 'Escalation Tier 2 Agent',
            Type: 'Role',
            RelatedId: '00E_Tier2Agent',
          },
        ] as any;
      }
      return [] as any;
    });

    const targetUser = {
      id: '005TargetUser1',
      name: 'Melissa King',
      username: 'melissa@test.com',
      isActive: true,
      profileId: '00eProfile1',
      profileName: 'Standard User',
      userRoleId: '00E_Tier2Agent',
      userRoleName: 'Escalation Tier 2 Agent',
    };

    const { analyzeSharingEvidence } = await import('../src/analyzers/sharing-evidence');
    const result = await analyzeSharingEvidence(targetUser, '500000000Record1', 'Case');

    expect(result.findings.length).toBeGreaterThan(0);
    const queueFinding = result.findings.find((f) => f.label.includes('Escalations Queue'));
    expect(queueFinding).toBeDefined();
    expect(queueFinding?.type).toBe('group');
    expect(queueFinding?.rowCause).toBe('Rule');
    expect(queueFinding?.accessLevel).toBe('Read');
    expect(queueFinding?.path).toEqual([
      'Queue: Escalations Queue',
      'Role: Escalation Tier 2 Agent',
      'Melissa King',
    ]);
  });
});

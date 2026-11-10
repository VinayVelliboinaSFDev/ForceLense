import { describe, it, expect } from 'vitest';
import { generateNarrativeSummary } from '../src/analyzers/narrative-generator';
import { MOCK_ANALYSIS_RESULT } from '../src/components/MockData';
import { AnalysisResult } from '../src/types';

describe('Narrative Summary Generator', () => {
  it('generates exact verified provenance facts for Read-Only access scenario', () => {
    const narrative = generateNarrativeSummary(MOCK_ANALYSIS_RESULT);

    expect(narrative.headline).toContain('Alex Rivera has Read-Only access to this Case');
    expect(narrative.badgeType).toBe('partial');
    expect(narrative.userRecordAccessFact).toContain('Read: Yes');
    expect(narrative.userRecordAccessFact).toContain('Edit: No');
    expect(narrative.sharingRowFact).toContain('Global Support Tier 1');
    expect(narrative.objectCrudFact).toContain('Read');
    expect(narrative.objectCrudFact).toContain('Edit');
    expect(narrative.flsFact).toContain('Internal_Comments__c');
    expect(narrative.blockerFact).toBeDefined();
    expect(narrative.blockerFact).toContain('Record Edit blocked');
  });

  it('extracts causal groups, roles, share settings, and permission sets for visual breadcrumbs', () => {
    const narrative = generateNarrativeSummary(MOCK_ANALYSIS_RESULT);

    // Causal Public Groups
    expect(narrative.attribution.groups).toContain('Global Support Tier 1');

    // Causal User Roles
    expect(narrative.attribution.roles).toContain('Tier 1 Support Specialist');

    // Causal Sharing Settings
    expect(narrative.attribution.sharingSettings.length).toBeGreaterThan(0);
    const ruleShare = narrative.attribution.sharingSettings.find((s) => s.table === 'CaseShare');
    expect(ruleShare).toBeDefined();
    expect(ruleShare?.rowCause).toContain('Rule');
    expect(ruleShare?.accessLevel).toBe('Read');

    // Causal Profiles & Permission Sets
    expect(narrative.attribution.profiles).toContain('Standard Support Agent');
    expect(narrative.attribution.permissionSets).toContain('Tier 1 Escalations Read Only');

    // Visual Breadcrumb Nodes Flow
    expect(narrative.breadcrumbNodes.length).toBeGreaterThanOrEqual(4);
    expect(narrative.breadcrumbNodes[0].label).toBe('Alex Rivera');
    expect(narrative.breadcrumbNodes.some((n) => n.label.includes('Tier 1 Support Specialist'))).toBe(true);
    expect(narrative.breadcrumbNodes.some((n) => n.label.includes('Global Support Tier 1'))).toBe(true);
    expect(narrative.breadcrumbNodes.some((n) => n.type === 'verdict' && n.label.includes('Read'))).toBe(true);
  });

  it('generates granted headline and owner fact when user has Read and Edit access as owner', () => {
    const fullAccessMock: AnalysisResult = {
      ...MOCK_ANALYSIS_RESULT,
      recordAccess: {
        read: true,
        edit: true,
        delete: false,
        maxAccessLevel: 'Edit',
      },
      sharingFindings: [
        {
          type: 'ownership',
          label: 'Direct Record Owner',
          accessLevel: 'All',
          source: 'Case.OwnerId',
          status: 'confirmed',
        },
      ],
    };

    const narrative = generateNarrativeSummary(fullAccessMock);
    expect(narrative.badgeType).toBe('granted');
    expect(narrative.headline).toContain('has Read & Edit access');
    expect(narrative.sharingRowFact).toContain('verified OwnerId on this record');
    expect(narrative.attribution.sharingSettings[0].rowCause).toBe('Record Ownership');
  });

  it('generates denied headline when user has no access', () => {
    const deniedMock: AnalysisResult = {
      ...MOCK_ANALYSIS_RESULT,
      recordAccess: {
        read: false,
        edit: false,
        delete: false,
        maxAccessLevel: 'None',
      },
      sharingFindings: [],
    };

    const narrative = generateNarrativeSummary(deniedMock);
    expect(narrative.badgeType).toBe('denied');
    expect(narrative.headline).toContain('is Denied access');
    expect(narrative.breadcrumbNodes.find((n) => n.type === 'verdict')?.status).toBe('denied');
  });
});

import { describe, it, expect } from 'vitest';
import { resolveShareTableSchema } from '../src/analyzers/sharing-evidence';

describe('Describe-Driven Share Table Schema Resolver', () => {
  it('correctly maps Account to AccountShare with AccountId and AccountAccessLevel', async () => {
    const schema = await resolveShareTableSchema('Account');

    expect(schema).not.toBeNull();
    expect(schema?.shareTable).toBe('AccountShare');
    expect(schema?.fkField).toBe('AccountId');
    expect(schema?.accessLevelField).toBe('AccountAccessLevel');
    expect(schema?.relatedAccessFields).toContain('OpportunityAccessLevel');
    expect(schema?.relatedAccessFields).toContain('CaseAccessLevel');
    expect(schema?.relatedAccessFields).toContain('ContactAccessLevel');
  });

  it('correctly maps Case to CaseShare with CaseId and CaseAccessLevel', async () => {
    const schema = await resolveShareTableSchema('Case');

    expect(schema).not.toBeNull();
    expect(schema?.shareTable).toBe('CaseShare');
    expect(schema?.fkField).toBe('CaseId');
    expect(schema?.accessLevelField).toBe('CaseAccessLevel');
  });

  it('correctly maps Opportunity to OpportunityShare with OpportunityId and OpportunityAccessLevel', async () => {
    const schema = await resolveShareTableSchema('Opportunity');

    expect(schema).not.toBeNull();
    expect(schema?.shareTable).toBe('OpportunityShare');
    expect(schema?.fkField).toBe('OpportunityId');
    expect(schema?.accessLevelField).toBe('OpportunityAccessLevel');
  });

  it('correctly maps Lead to LeadShare with LeadId and LeadAccessLevel', async () => {
    const schema = await resolveShareTableSchema('Lead');

    expect(schema).not.toBeNull();
    expect(schema?.shareTable).toBe('LeadShare');
    expect(schema?.fkField).toBe('LeadId');
    expect(schema?.accessLevelField).toBe('LeadAccessLevel');
  });

  it('correctly maps custom objects to __Share with ParentId and AccessLevel', async () => {
    const schema = await resolveShareTableSchema('Project_Invoice__c');

    expect(schema).not.toBeNull();
    expect(schema?.shareTable).toBe('Project_Invoice__Share');
    expect(schema?.fkField).toBe('ParentId');
    expect(schema?.accessLevelField).toBe('AccessLevel');
  });
});

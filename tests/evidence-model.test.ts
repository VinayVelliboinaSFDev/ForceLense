import { describe, it, expect } from 'vitest';
import { MOCK_ANALYSIS_RESULT } from '../src/components/MockData';
import { EvidenceStatus } from '../src/types';

describe('Evidence Model and Taxonomy Verification', () => {
  it('validates that all evidence items follow the approved status taxonomy', () => {
    const validStatuses: EvidenceStatus[] = [
      'confirmed',
      'supported',
      'possible',
      'unavailable',
      'unknown',
      'not_applicable',
    ];

    for (const ev of MOCK_ANALYSIS_RESULT.evidence) {
      expect(validStatuses).toContain(ev.status);
      expect(ev.id).toBeDefined();
      expect(ev.category).toBeDefined();
      expect(ev.source).toBeDefined();
      expect(ev.retrievedAt).toBeDefined();
      expect(ev.explanation.length).toBeGreaterThan(10);
    }
  });

  it('ensures unavailable sources have explicit limitation messages', () => {
    const unavailableItems = MOCK_ANALYSIS_RESULT.evidence.filter(
      (e) => e.status === 'unavailable'
    );

    expect(unavailableItems.length).toBeGreaterThan(0);
    for (const item of unavailableItems) {
      expect(item.limitation).toBeDefined();
      expect(item.limitation!.length).toBeGreaterThan(5);
    }
  });

  it('distinguishes record-level flags from object-level CRUD', () => {
    const recFlags = MOCK_ANALYSIS_RESULT.recordAccess;
    const objCRUD = MOCK_ANALYSIS_RESULT.objectPermissions;

    // Record has Read = true, Edit = false
    expect(recFlags?.read).toBe(true);
    expect(recFlags?.edit).toBe(false);

    // Object has Read = true, Edit = true (User has permission to edit Cases generally, but not this specific record)
    expect(objCRUD.read).toBe(true);
    expect(objCRUD.edit).toBe(true);
  });
});

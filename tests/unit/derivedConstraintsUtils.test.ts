import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldUsePcivConstraints } from '../../src/decision-program/ui/decision-accelerator/derivedConstraintsUtils.ts';
import type { PcivConstraintV1 } from '../../src/decision-program/pciv/v1/schemas';

test('shouldUsePcivConstraints is true when constraints are present', () => {
  const pcivConstraints: PcivConstraintV1[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      runId: '22222222-2222-4222-8222-222222222222',
      key: 'regulatory.setting',
      domain: 'regulatory',
      label: 'Setting',
      valueKind: 'string',
      valueString: 'Urban core',
      valueNumber: null,
      valueBoolean: null,
      valueEnum: null,
      valueJson: null,
      provenance: 'source-backed',
      sourceId: null,
      snippet: null,
      createdAt: '2025-01-02T03:04:05.000Z'
    }
  ];
  assert.equal(shouldUsePcivConstraints(pcivConstraints), true);
});

test('shouldUsePcivConstraints is false when constraints are empty', () => {
  assert.equal(shouldUsePcivConstraints([]), false);
  assert.equal(shouldUsePcivConstraints(undefined), false);
});

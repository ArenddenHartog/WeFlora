import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldUsePcivConstraints } from '../../src/decision-program/ui/decision-accelerator/derivedConstraintsUtils.ts';
import type { PcivConstraint } from '../../src/decision-program/pciv/v0/types';

test('shouldUsePcivConstraints is true when constraints are present', () => {
  const pcivConstraints: PcivConstraint[] = [
    {
      id: 'pciv-1',
      key: 'regulatory.setting',
      domain: 'regulatory',
      label: 'Setting',
      value: 'Urban core',
      provenance: 'source-backed'
    }
  ];
  assert.equal(shouldUsePcivConstraints(pcivConstraints), true);
});

test('shouldUsePcivConstraints is false when constraints are empty', () => {
  assert.equal(shouldUsePcivConstraints([]), false);
  assert.equal(shouldUsePcivConstraints(undefined), false);
});

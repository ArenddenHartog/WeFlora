import { describe, it, expect } from 'vitest';
import { invariantPCIVValueColumnsMatchKind } from '../../src/decision-program/pciv/v1/runtimeInvariants';

describe('PCIV Runtime Invariants - Unset Values', () => {
  const baseParams = {
    scopeId: 'test-scope',
    runId: 'test-run',
    pointer: '/test/field'
  };

  describe('Unset state (all value columns null)', () => {
    it('should pass for string kind with all nulls', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'string',
          value_string: null,
          value_number: null,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).not.toThrow();
    });

    it('should pass for number kind with all nulls', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'number',
          value_string: null,
          value_number: null,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).not.toThrow();
    });

    it('should pass for boolean kind with all nulls', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'boolean',
          value_string: null,
          value_number: null,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).not.toThrow();
    });

    it('should pass for enum kind with all nulls', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'enum',
          value_string: null,
          value_number: null,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).not.toThrow();
    });

    it('should pass for json kind with all nulls', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'json',
          value_string: null,
          value_number: null,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).not.toThrow();
    });
  });

  describe('Correct value set', () => {
    it('should pass for string kind with value_string set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'string',
          value_string: 'test',
          value_number: null,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).not.toThrow();
    });

    it('should pass for number kind with value_number set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'number',
          value_string: null,
          value_number: 42,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).not.toThrow();
    });

    it('should pass for boolean kind with value_boolean set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'boolean',
          value_string: null,
          value_number: null,
          value_boolean: true,
          value_enum: null,
          value_json: null
        })
      ).not.toThrow();
    });

    it('should pass for enum kind with value_enum set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'enum',
          value_string: null,
          value_number: null,
          value_boolean: null,
          value_enum: 'option1',
          value_json: null
        })
      ).not.toThrow();
    });

    it('should pass for json kind with value_json set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'json',
          value_string: null,
          value_number: null,
          value_boolean: null,
          value_enum: null,
          value_json: { test: 'data' }
        })
      ).not.toThrow();
    });
  });

  describe('Wrong value column for value_kind', () => {
    it('should fail for string kind with value_number set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'string',
          value_string: null,
          value_number: 42,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).toThrow(/pciv_v1_runtime_invariant_failed.*pciv_value_columns_match_kind/);
    });

    it('should fail for number kind with value_string set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'number',
          value_string: 'test',
          value_number: null,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).toThrow(/pciv_v1_runtime_invariant_failed.*pciv_value_columns_match_kind/);
    });

    it('should include context in error message', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          value_kind: 'string',
          value_string: null,
          value_number: 42,
          value_boolean: null,
          value_enum: null,
          value_json: null,
          scopeId: 'scope-123',
          runId: 'run-456',
          pointer: '/path/to/field'
        })
      ).toThrow(/runId=run-456.*scopeId=scope-123.*pointer=\/path\/to\/field/);
    });
  });

  describe('Multiple value columns set', () => {
    it('should fail when two value columns are set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'string',
          value_string: 'test',
          value_number: 42,
          value_boolean: null,
          value_enum: null,
          value_json: null
        })
      ).toThrow(/pciv_v1_runtime_invariant_failed.*Multiple value columns set/);
    });

    it('should fail when all value columns are set', () => {
      expect(() =>
        invariantPCIVValueColumnsMatchKind({
          ...baseParams,
          value_kind: 'string',
          value_string: 'test',
          value_number: 42,
          value_boolean: true,
          value_enum: 'option',
          value_json: { test: 'data' }
        })
      ).toThrow(/pciv_v1_runtime_invariant_failed.*Multiple value columns set/);
    });
  });
});

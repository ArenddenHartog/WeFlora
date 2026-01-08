import type { DerivedConstraints, DerivedInput } from '../types.ts';

type DerivedPointerSpec = {
  pointer: string;
  fieldPath: string;
  getValue: (derived: DerivedConstraints) => unknown;
};

export const DERIVED_POINTER_SPECS: DerivedPointerSpec[] = [
  {
    pointer: '/context/regulatory/setting',
    fieldPath: 'regulatory.setting',
    getValue: (derived) => derived.regulatory.setting
  },
  {
    pointer: '/context/regulatory/constraints/utilityConflicts',
    fieldPath: 'site.utilitiesPresent',
    getValue: (derived) => derived.site.utilitiesPresent
  },
  {
    pointer: '/context/regulatory/constraints/setbacksKnown',
    fieldPath: 'site.setbacksKnown',
    getValue: (derived) => derived.site.setbacksKnown
  },
  {
    pointer: '/context/site/light',
    fieldPath: 'site.lightExposure',
    getValue: (derived) => derived.site.lightExposure
  },
  {
    pointer: '/context/site/soil/type',
    fieldPath: 'site.soilType',
    getValue: (derived) => derived.site.soilType
  },
  {
    pointer: '/context/site/soil/moisture',
    fieldPath: 'site.moisture',
    getValue: (derived) => derived.site.moisture
  },
  {
    pointer: '/context/site/soil/compaction',
    fieldPath: 'site.compactionRisk',
    getValue: (derived) => derived.site.compactionRisk
  },
  {
    pointer: '/context/site/space/rootingVolumeClass',
    fieldPath: 'site.rootingVolumeClass',
    getValue: (derived) => derived.site.rootingVolumeClass
  },
  {
    pointer: '/context/site/space/crownClearanceClass',
    fieldPath: 'site.crownClearanceClass',
    getValue: (derived) => derived.site.crownClearanceClass
  },
  {
    pointer: '/context/equity/priority',
    fieldPath: 'equity.priorityZones',
    getValue: (derived) => derived.equity.priorityZones
  }
];

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

export const buildContextPatchesFromDerivedConstraints = (
  derived: DerivedConstraints | undefined | null
): Array<{ pointer: string; value: unknown }> => {
  if (!derived) return [];
  return DERIVED_POINTER_SPECS.reduce<Array<{ pointer: string; value: unknown }>>((acc, spec) => {
    const value = spec.getValue(derived);
    if (!hasValue(value)) return acc;
    acc.push({ pointer: spec.pointer, value });
    return acc;
  }, []);
};

export const buildDerivedInputs = (
  derived: DerivedConstraints | undefined | null,
  evidenceByPointer: Record<string, string[]>,
  timelineEntryId?: string
): Record<string, DerivedInput> => {
  if (!derived) return {};
  const confidenceByField = derived.meta.confidenceByField ?? {};
  return DERIVED_POINTER_SPECS.reduce<Record<string, DerivedInput>>((acc, spec) => {
    const value = spec.getValue(derived);
    if (!hasValue(value)) return acc;
    acc[spec.pointer] = {
      pointer: spec.pointer,
      value,
      confidence: confidenceByField[spec.fieldPath],
      evidenceItemIds: evidenceByPointer[spec.pointer],
      timelineEntryId
    };
    return acc;
  }, {});
};

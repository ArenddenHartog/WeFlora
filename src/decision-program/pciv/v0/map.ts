import { STREET_TREE_POINTER_INPUT_SPECS } from '../../orchestrator/pointerInputRegistry.ts';
import type { PcivConstraint, PcivDraft, PcivField, PcivFieldProvenance } from './types.ts';
import { deriveConstraintsFromSources, deriveFieldSuggestions } from './extract.ts';

const DOMAIN_MAP: Record<string, PcivField['group']> = {
  site: 'site',
  regulatory: 'regulatory',
  equity: 'equity',
  species: 'biophysical',
  supply: 'biophysical'
};

export const buildPcivFields = (): Record<string, PcivField> =>
  STREET_TREE_POINTER_INPUT_SPECS.reduce<Record<string, PcivField>>((acc, spec) => {
    const group = DOMAIN_MAP[spec.group] ?? 'site';
    acc[spec.pointer] = {
      pointer: spec.pointer,
      label: spec.input.label,
      group,
      required: spec.severity === 'required',
      type: spec.input.type === 'boolean' ? 'boolean' : spec.input.type === 'select' ? 'select' : 'text',
      options: spec.input.options,
      value: null,
      provenance: 'unknown'
    };
    return acc;
  }, {});

const PROVENANCE_PRIORITY: PcivFieldProvenance[] = ['unknown', 'model-inferred', 'source-backed', 'user-entered'];

const canOverrideProvenance = (current: PcivFieldProvenance, incoming: PcivFieldProvenance) =>
  PROVENANCE_PRIORITY.indexOf(incoming) > PROVENANCE_PRIORITY.indexOf(current);

export const applyPcivAutoMapping = (draft: PcivDraft) => {
  const sourceSuggestions = deriveFieldSuggestions(draft.sources, draft.locationHint);
  const updatedFields = { ...draft.fields };

  Object.entries(sourceSuggestions).forEach(([pointer, suggestion]) => {
    const current = updatedFields[pointer];
    if (!current) return;
    if (!canOverrideProvenance(current.provenance, suggestion.provenance)) return;
    updatedFields[pointer] = {
      ...current,
      value: suggestion.value,
      provenance: suggestion.provenance,
      sourceId: suggestion.sourceId ?? current.sourceId,
      snippet: suggestion.snippet ?? current.snippet
    };
  });

  const constraints = mergeConstraints(draft.constraints, deriveConstraintsFromSources(draft.sources));

  return {
    ...draft,
    fields: updatedFields,
    constraints
  };
};

const mergeConstraints = (existing: PcivConstraint[], incoming: PcivConstraint[]) => {
  const byKey = new Map(existing.map((constraint) => [constraint.key, constraint]));
  incoming.forEach((constraint) => {
    if (!byKey.has(constraint.key)) {
      byKey.set(constraint.key, constraint);
      return;
    }
    const current = byKey.get(constraint.key);
    if (!current) return;
    if (current.provenance === 'user-entered') return;
    byKey.set(constraint.key, constraint);
  });
  return Array.from(byKey.values());
};

export const updateLocationHintField = (draft: PcivDraft, locationHint: string) => {
  const pointer = '/context/site/geo/locationHint';
  const target = draft.fields[pointer];
  if (!target) return draft;
  return {
    ...draft,
    locationHint,
    fields: {
      ...draft.fields,
      [pointer]: {
        ...target,
        value: locationHint || null,
        provenance: locationHint ? 'user-entered' : 'unknown'
      }
    }
  };
};

export const setPcivFieldValue = (
  draft: PcivDraft,
  pointer: string,
  value: PcivField['value'],
  provenance: PcivFieldProvenance = 'user-entered'
) => {
  const field = draft.fields[pointer];
  if (!field) return draft;
  return {
    ...draft,
    fields: {
      ...draft.fields,
      [pointer]: {
        ...field,
        value: value === '' ? null : value,
        provenance: value === '' || value === null ? 'unknown' : provenance
      }
    }
  };
};

export const ensureDefaultInferences = (draft: PcivDraft) => {
  const updated = { ...draft, fields: { ...draft.fields } };
  const locationTypePointer = '/context/site/locationType';
  const settingPointer = '/context/regulatory/setting';
  if (draft.locationHint) {
    const locationTypeField = updated.fields[locationTypePointer];
    if (locationTypeField && locationTypeField.provenance === 'unknown') {
      updated.fields[locationTypePointer] = {
        ...locationTypeField,
        value: 'street',
        provenance: 'model-inferred'
      };
    }
    const settingField = updated.fields[settingPointer];
    if (settingField && settingField.provenance === 'unknown') {
      updated.fields[settingPointer] = {
        ...settingField,
        value: 'municipalStreet',
        provenance: 'model-inferred'
      };
    }
  }
  return updated;
};

export const CONSTRAINT_POINTER_MAP: Record<string, string> = {
  'site.locationType': '/context/site/locationType',
  'site.locationHint': '/context/site/geo/locationHint',
  'site.soil.type': '/context/site/soil/type',
  'site.soil.moisture': '/context/site/soil/moisture',
  'site.soil.compaction': '/context/site/soil/compaction',
  'site.lightExposure': '/context/site/light',
  'site.rootingVolumeClass': '/context/site/space/rootingVolumeClass',
  'site.crownClearanceClass': '/context/site/space/crownClearanceClass',
  'stress.heat': '/context/site/stressors/heat',
  'stress.drought': '/context/site/stressors/drought',
  'regulatory.setting': '/context/regulatory/setting',
  'regulatory.utilitiesConflicts': '/context/regulatory/constraints/utilityConflicts',
  'regulatory.setbacksKnown': '/context/regulatory/constraints/setbacksKnown',
  'species.primaryGoal': '/context/species/goals/primaryGoal',
  'species.allergiesOrToxicityConcern': '/context/species/constraints/allergiesOrToxicityConcern',
  'supply.availabilityRequired': '/context/supply/availabilityRequired'
};

export const mapConstraintToPointer = (constraint: PcivConstraint) => CONSTRAINT_POINTER_MAP[constraint.key];

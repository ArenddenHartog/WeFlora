import type { ActionCardInput, ExecutionLogEntry, ExecutionState, PointerPatch } from '../types.ts';
import { hasPointer } from '../runtime/pointers.ts';

export type PointerInputGroup = 'site' | 'regulatory' | 'equity' | 'species' | 'supply';
export type PointerInputSeverity = 'required' | 'recommended' | 'optional';

export type PointerInputSpec = {
  pointer: string;
  input: ActionCardInput;
  group: PointerInputGroup;
  severity: PointerInputSeverity;
  impactNote?: string;
  defaultValue?: string | number | boolean;
  priority: number;
};

const groupOrder: PointerInputGroup[] = ['site', 'regulatory', 'equity', 'species', 'supply'];

const stableSlug = (pointer: string) =>
  pointer
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'input';

const idFromPointer = (pointer: string) => `ptr_${stableSlug(pointer)}`;

const labelFromPointer = (pointer: string) => {
  const cleaned = pointer.replace(/^\/+/, '').replace(/^context\//, '');
  const parts = cleaned.split('/');
  return parts
    .map((part) => part.replace(/([A-Z])/g, ' $1'))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' → ');
};

const makeInput = (pointer: string, input: Omit<ActionCardInput, 'id' | 'pointer'>): ActionCardInput => ({
  id: idFromPointer(pointer),
  pointer,
  ...input
});

export const STREET_TREE_POINTER_INPUT_SPECS: PointerInputSpec[] = [
  {
    pointer: '/context/site/locationType',
    group: 'site',
    severity: 'required',
    priority: 10,
    input: makeInput('/context/site/locationType', {
      label: 'Location type',
      type: 'select',
      required: true,
      placeholder: 'Select a location type',
      options: ['street', 'park', 'courtyard', 'waterfront', 'industrial', 'rural'],
      helpText: 'Sets baseline exposure, access, and maintenance assumptions for street tree siting.'
    })
  },
  {
    pointer: '/context/site/geo/locationHint',
    group: 'site',
    severity: 'required',
    priority: 20,
    input: makeInput('/context/site/geo/locationHint', {
      label: 'Location hint',
      type: 'text',
      required: true,
      placeholder: 'e.g., 3rd Ave corridor near civic plaza',
      helpText: 'Provide a corridor or landmark reference so the shortlist reflects local context.'
    })
  },
  {
    pointer: '/context/site/soil/type',
    group: 'site',
    severity: 'required',
    priority: 30,
    input: makeInput('/context/site/soil/type', {
      label: 'Soil type',
      type: 'select',
      required: true,
      placeholder: 'Select soil type',
      options: ['sand', 'loam', 'clay', 'peat', 'structuralSoil', 'mixed'],
      helpText: 'Soil texture drives drainage, nutrient availability, and root anchoring.'
    })
  },
  {
    pointer: '/context/site/soil/moisture',
    group: 'site',
    severity: 'required',
    priority: 40,
    input: makeInput('/context/site/soil/moisture', {
      label: 'Soil moisture',
      type: 'select',
      required: true,
      placeholder: 'Select moisture level',
      options: ['dry', 'moist', 'wet', 'waterloggedRisk'],
      helpText: 'Moisture regime helps balance drought tolerance with flood resilience.'
    })
  },
  {
    pointer: '/context/site/soil/compaction',
    group: 'site',
    severity: 'required',
    priority: 50,
    input: makeInput('/context/site/soil/compaction', {
      label: 'Soil compaction',
      type: 'select',
      required: true,
      placeholder: 'Select compaction level',
      options: ['low', 'medium', 'high'],
      helpText: 'Compaction limits rooting depth, establishment success, and drought tolerance.'
    })
  },
  {
    pointer: '/context/site/light',
    group: 'site',
    severity: 'required',
    priority: 60,
    input: makeInput('/context/site/light', {
      label: 'Light exposure',
      type: 'select',
      required: true,
      placeholder: 'Select light level',
      options: ['fullSun', 'partialShade', 'shade'],
      helpText: 'Light availability narrows viable species and canopy density expectations.'
    })
  },
  {
    pointer: '/context/site/space/rootingVolumeClass',
    group: 'site',
    severity: 'required',
    priority: 70,
    input: makeInput('/context/site/space/rootingVolumeClass', {
      label: 'Rooting volume class',
      type: 'select',
      required: true,
      placeholder: 'Select rooting volume',
      options: ['veryLimited', 'limited', 'moderate', 'generous'],
      helpText: 'Street tree pits and hardscape conflicts often cap rooting volume and drive species size.'
    })
  },
  {
    pointer: '/context/site/space/crownClearanceClass',
    group: 'site',
    severity: 'required',
    priority: 80,
    input: makeInput('/context/site/space/crownClearanceClass', {
      label: 'Crown clearance class',
      type: 'select',
      required: true,
      placeholder: 'Select clearance class',
      options: ['low', 'medium', 'high'],
      helpText: 'Clearance height affects canopy form, pruning expectations, and conflict with uses.'
    })
  },
  {
    pointer: '/context/site/stressors/drought',
    group: 'site',
    severity: 'required',
    priority: 90,
    input: makeInput('/context/site/stressors/drought', {
      label: 'Drought stress',
      type: 'select',
      required: true,
      placeholder: 'Select drought stress',
      options: ['low', 'medium', 'high'],
      helpText: 'Higher drought stress requires species with proven drought hardiness.'
    })
  },
  {
    pointer: '/context/site/stressors/heat',
    group: 'site',
    severity: 'required',
    priority: 100,
    input: makeInput('/context/site/stressors/heat', {
      label: 'Heat stress',
      type: 'select',
      required: true,
      placeholder: 'Select heat stress',
      options: ['low', 'medium', 'high'],
      helpText: 'Heat intensity influences survival, leaf scorch risk, and long-term vigor.'
    })
  },
  {
    pointer: '/context/regulatory/setting',
    group: 'regulatory',
    severity: 'required',
    priority: 10,
    input: makeInput('/context/regulatory/setting', {
      label: 'Regulatory setting',
      type: 'select',
      required: true,
      placeholder: 'Select setting',
      options: ['municipalStreet', 'provincialRoad', 'privateDevelopment', 'natureArea'],
      helpText: 'Governance context shapes allowable species lists, permits, and maintenance constraints.'
    })
  },
  {
    pointer: '/context/regulatory/constraints/utilityConflicts',
    group: 'regulatory',
    severity: 'required',
    priority: 20,
    input: makeInput('/context/regulatory/constraints/utilityConflicts', {
      label: 'Utility conflicts',
      type: 'boolean',
      required: true,
      placeholder: 'Toggle if utilities are present',
      helpText: 'Conflicts with overhead or underground utilities constrain mature size and species choice.'
    })
  },
  {
    pointer: '/context/regulatory/constraints/setbacksKnown',
    group: 'regulatory',
    severity: 'required',
    priority: 30,
    input: makeInput('/context/regulatory/constraints/setbacksKnown', {
      label: 'Setbacks confirmed',
      type: 'boolean',
      required: true,
      placeholder: 'Toggle if setbacks are confirmed',
      helpText: 'Known setbacks reduce risk of later compliance rework or removals.'
    })
  },
  {
    pointer: '/context/equity/priority',
    group: 'equity',
    severity: 'recommended',
    priority: 10,
    defaultValue: 'neutral',
    input: makeInput('/context/equity/priority', {
      label: 'Equity priority',
      type: 'select',
      required: false,
      placeholder: 'Select equity focus',
      options: ['neutral', 'prioritizeHeat', 'prioritizeEquity', 'both'],
      helpText: 'Default is neutral unless the program explicitly prioritizes heat or equity outcomes.'
    })
  },
  {
    pointer: '/context/species/goals/primaryGoal',
    group: 'species',
    severity: 'required',
    priority: 10,
    input: makeInput('/context/species/goals/primaryGoal', {
      label: 'Primary species goal',
      type: 'select',
      required: true,
      placeholder: 'Select primary goal',
      options: ['biodiversity', 'shade', 'droughtResilience', 'lowMaintenance', 'aesthetic'],
      helpText: 'Primary goal steers the shortlist toward species with the highest program impact.'
    })
  },
  {
    pointer: '/context/species/constraints/allergiesOrToxicityConcern',
    group: 'species',
    severity: 'required',
    priority: 20,
    input: makeInput('/context/species/constraints/allergiesOrToxicityConcern', {
      label: 'Allergies or toxicity concern',
      type: 'boolean',
      required: true,
      placeholder: 'Toggle if this is a concern',
      helpText: 'Flagging this filters out species with high allergen loads or toxicity risks.'
    })
  },
  {
    pointer: '/context/species/diversity/rule',
    group: 'species',
    severity: 'recommended',
    priority: 30,
    defaultValue: '10-20-30',
    input: makeInput('/context/species/diversity/rule', {
      label: 'Diversity rule',
      type: 'select',
      required: false,
      placeholder: 'Select diversity rule',
      options: ['10-20-30', 'none', 'localPolicy'],
      helpText: 'Default is 10-20-30 to reduce monoculture risk unless policy says otherwise.'
    })
  },
  {
    pointer: '/context/supply/availabilityRequired',
    group: 'supply',
    severity: 'required',
    priority: 10,
    input: makeInput('/context/supply/availabilityRequired', {
      label: 'Availability requirement',
      type: 'select',
      required: true,
      placeholder: 'Select availability requirement',
      options: ['ignoreStock', 'mustBeAvailableNow', 'availableWithinSeason'],
      helpText: 'Trade design ideal against procurement reality and lead times.'
    })
  },
  {
    pointer: '/context/site/stripWidthM',
    group: 'site',
    severity: 'optional',
    priority: 110,
    input: makeInput('/context/site/stripWidthM', {
      label: 'Planting strip width (m)',
      type: 'number',
      required: false,
      placeholder: 'e.g., 2.4',
      helpText: 'Measured curb-to-building or curb-to-sidewalk width guides mature size.'
    })
  },
  {
    pointer: '/context/site/soil/ph',
    group: 'site',
    severity: 'optional',
    priority: 120,
    input: makeInput('/context/site/soil/ph', {
      label: 'Soil pH',
      type: 'number',
      required: false,
      placeholder: 'e.g., 6.5',
      helpText: 'pH helps eliminate species that fail in acidic or alkaline soils.'
    })
  },
  {
    pointer: '/context/species/constraints/invasivesConcern',
    group: 'species',
    severity: 'optional',
    priority: 40,
    input: makeInput('/context/species/constraints/invasivesConcern', {
      label: 'Invasives concern',
      type: 'boolean',
      required: false,
      placeholder: 'Toggle if invasives are a concern',
      helpText: 'If required, exclude species with invasive or banned classifications.'
    })
  }
];

export const getInputSpec = (pointer: string): PointerInputSpec | undefined =>
  STREET_TREE_POINTER_INPUT_SPECS.find((spec) => spec.pointer === pointer);

export const buildRefineInputsFromPointers = (pointers: string[]): ActionCardInput[] => {
  const unique = Array.from(new Set(pointers));
  const sorted = unique
    .map((pointer) => ({ pointer, spec: getInputSpec(pointer) }))
    .sort((a, b) => {
      const groupIndexA = a.spec ? groupOrder.indexOf(a.spec.group) : groupOrder.length;
      const groupIndexB = b.spec ? groupOrder.indexOf(b.spec.group) : groupOrder.length;
      if (groupIndexA !== groupIndexB) return groupIndexA - groupIndexB;
      const priorityA = a.spec?.priority ?? 999;
      const priorityB = b.spec?.priority ?? 999;
      return priorityA - priorityB;
    });

  return sorted.map(({ pointer, spec }) => {
    if (!spec) {
      return {
        id: idFromPointer(pointer),
        pointer,
        label: labelFromPointer(pointer),
        type: 'text',
        severity: 'required',
        required: true,
        placeholder: 'Provide value',
        helpText: 'Provide a value for this missing input.',
        impactNote: 'Required to continue the planning run.'
      };
    }
    return {
      ...spec.input,
      id: idFromPointer(pointer),
      severity: spec.severity,
      required: spec.severity === 'required',
      impactNote: spec.impactNote ?? spec.input.helpText
    };
  });
};

export const buildDefaultPatchesForPointers = (
  state: ExecutionState,
  pointers: string[]
): { patches: PointerPatch[]; appliedPointers: string[] } => {
  const unique = Array.from(new Set(pointers));
  const patches: PointerPatch[] = [];
  const appliedPointers: string[] = [];

  unique.forEach((pointer) => {
    if (hasPointer(state, pointer)) return;
    const spec = getInputSpec(pointer);
    if (!spec || spec.defaultValue === undefined) return;
    patches.push({ pointer, value: spec.defaultValue });
    appliedPointers.push(pointer);
  });

  return { patches, appliedPointers };
};

export const buildDefaultsLogEntry = (args: { runId: string; pointers: string[] }): ExecutionLogEntry => ({
  level: 'info',
  message: 'Applied safe defaults',
  data: { runId: args.runId, pointers: args.pointers },
  timestamp: new Date().toISOString()
});

export const pointerGroupOrder = groupOrder;

export const getPointersBySeverity = (severity: PointerInputSeverity): string[] =>
  STREET_TREE_POINTER_INPUT_SPECS.filter((spec) => spec.severity === severity).map((spec) => spec.pointer);

export const listMissingPointersBySeverity = (state: ExecutionState, severity: PointerInputSeverity): string[] =>
  getPointersBySeverity(severity).filter((pointer) => !hasPointer(state, pointer));

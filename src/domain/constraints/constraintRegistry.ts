export type ConstraintDatatype = 'number' | 'string' | 'boolean' | 'enum' | 'range' | 'geo' | 'json';

export type ConstraintRegistryEntry = {
  key: string;
  datatype: ConstraintDatatype;
  unit?: string;
  allowedValues?: string[];
  label: string;
  helpText: string;
};

export const CONSTRAINT_REGISTRY: ConstraintRegistryEntry[] = [
  {
    key: 'site.locationType',
    datatype: 'enum',
    allowedValues: ['street', 'park', 'courtyard', 'waterfront', 'industrial', 'rural'],
    label: 'Location type',
    helpText: 'Baseline setting for access, exposure, and maintenance expectations.'
  },
  {
    key: 'site.locationHint',
    datatype: 'string',
    label: 'Location hint',
    helpText: 'Free text corridor or landmark reference for planning context.'
  },
  {
    key: 'site.soil.type',
    datatype: 'enum',
    allowedValues: ['sand', 'loam', 'clay', 'peat', 'structuralSoil', 'mixed'],
    label: 'Soil type',
    helpText: 'Soil texture drives drainage, nutrient availability, and root anchoring.'
  },
  {
    key: 'site.soil.moisture',
    datatype: 'enum',
    allowedValues: ['dry', 'moist', 'wet', 'waterloggedRisk'],
    label: 'Soil moisture',
    helpText: 'Moisture regime helps balance drought tolerance with flood resilience.'
  },
  {
    key: 'site.soil.compaction',
    datatype: 'enum',
    allowedValues: ['low', 'medium', 'high'],
    label: 'Soil compaction',
    helpText: 'Compaction limits rooting depth, establishment success, and drought tolerance.'
  },
  {
    key: 'site.lightExposure',
    datatype: 'enum',
    allowedValues: ['fullSun', 'partialShade', 'shade'],
    label: 'Light exposure',
    helpText: 'Light availability narrows viable species and canopy density expectations.'
  },
  {
    key: 'site.rootingVolumeClass',
    datatype: 'enum',
    allowedValues: ['veryLimited', 'limited', 'moderate', 'generous'],
    label: 'Rooting volume class',
    helpText: 'Hardscape constraints often cap rooting volume and drive size selection.'
  },
  {
    key: 'site.crownClearanceClass',
    datatype: 'enum',
    allowedValues: ['low', 'medium', 'high'],
    label: 'Crown clearance class',
    helpText: 'Clearance height affects canopy form and pruning expectations.'
  },
  {
    key: 'stress.heat',
    datatype: 'enum',
    allowedValues: ['low', 'medium', 'high'],
    label: 'Heat stress',
    helpText: 'Heat intensity influences survival and long-term vigor.'
  },
  {
    key: 'stress.drought',
    datatype: 'enum',
    allowedValues: ['low', 'medium', 'high'],
    label: 'Drought stress',
    helpText: 'Drought exposure requires species with higher drought hardiness.'
  },
  {
    key: 'regulatory.setting',
    datatype: 'enum',
    allowedValues: ['municipalStreet', 'provincialRoad', 'privateDevelopment', 'natureArea'],
    label: 'Regulatory setting',
    helpText: 'Governance context shapes allowable species lists and permits.'
  },
  {
    key: 'regulatory.utilitiesConflicts',
    datatype: 'boolean',
    label: 'Utility conflicts',
    helpText: 'Conflicts with overhead or underground utilities constrain mature size.'
  },
  {
    key: 'regulatory.setbacksKnown',
    datatype: 'boolean',
    label: 'Setbacks confirmed',
    helpText: 'Known setbacks reduce risk of later compliance rework.'
  },
  {
    key: 'species.primaryGoal',
    datatype: 'enum',
    allowedValues: ['biodiversity', 'shade', 'droughtResilience', 'lowMaintenance', 'aesthetic'],
    label: 'Primary species goal',
    helpText: 'Primary goal steers shortlist priorities.'
  },
  {
    key: 'species.allergiesOrToxicityConcern',
    datatype: 'boolean',
    label: 'Allergies or toxicity concern',
    helpText: 'Flag to filter out species with allergen or toxicity risks.'
  },
  {
    key: 'supply.availabilityRequired',
    datatype: 'enum',
    allowedValues: ['immediate', 'seasonal', 'longLead', 'flexible'],
    label: 'Availability requirement',
    helpText: 'Specifies how quickly supply must be available.'
  }
];

export const CONSTRAINT_REGISTRY_MAP = new Map(
  CONSTRAINT_REGISTRY.map((entry) => [entry.key, entry])
);

export const validateConstraintRegistry = () => {
  const errors: string[] = [];
  const keys = new Set<string>();
  CONSTRAINT_REGISTRY.forEach((entry) => {
    if (keys.has(entry.key)) {
      errors.push(`Duplicate key: ${entry.key}`);
    }
    keys.add(entry.key);
    if (entry.datatype === 'enum' && (!entry.allowedValues || entry.allowedValues.length === 0)) {
      errors.push(`Enum key missing values: ${entry.key}`);
    }
  });
  return errors;
};

export type SkillRowContext = {
  speciesScientific?: string; // "Quercus robur"
  cultivar?: string; // "'Elsrijk'"
  commonName?: string; // "oak"
  rowLabel?: string; // fallback row.entityName
  // optional: columnId->value map for other references
  cellsByColumnId?: Record<string, string>;
  cellsByColumnTitle?: Record<string, string>;
};
